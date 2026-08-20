import { describe, expect, it } from 'vitest';

import type {
  DrawingAgentPlan,
  HumanDecisionRequest,
} from '../../../src/contracts/drawing-agent';
import type { DrawingId, RevisionId } from '../../../src/drawing';
import {
  checkDrawingAgentBudget,
  checkModelLedDrawingAgentBudget,
  createDrawingAgentState,
  createModelLedDrawingAgentState,
  reduceDrawingAgentState,
  reduceModelLedDrawingAgentState,
  toModelLedDrawingAgentRunView,
  toDrawingAgentRunView,
} from './state';
import type { DrawingToolReceipt } from './types';

const drawingId = 'drawing_1' as DrawingId;
const revision = 'revision_1' as RevisionId;

describe('Drawing Agent state machine', () => {
  it('starts from a bounded planning state and exposes a document-free public view', () => {
    const state = initial();
    const view = toDrawingAgentRunView(state);

    expect(state).toMatchObject({
      status: 'planning', drawingId, revision, plan: null,
      commitCount: 0, decisionCount: 0, consecutiveReadCount: 0,
      pendingInstructions: [], activeInstructions: [], needsReplan: false,
    });
    expect(view).toMatchObject({
      runId: 'run_1', drawingId, revision, status: 'planning',
      goal: null, workflow: [], commitCount: 0,
    });
    expect(JSON.stringify(view)).not.toContain('document');
    expect(JSON.stringify(view)).not.toContain('history');
    expect(JSON.stringify(view)).not.toContain('model');
  });

  it('installs a plan and advances workflow nodes without mutating prior state', () => {
    const before = initial();
    const planned = reduce(before, { type: 'PLAN_READY', plan });
    const started = reduce(planned, { type: 'WORKFLOW_NODE_STARTED', nodeId: 'inspect' });
    const completed = reduce(started, { type: 'WORKFLOW_NODE_COMPLETED', nodeId: 'inspect' });

    expect(before.plan).toBeNull();
    expect(planned).toMatchObject({ status: 'running', currentWorkflowNodeId: null });
    expect(started.currentWorkflowNodeId).toBe('inspect');
    expect(started.plan?.workflow[0].status).toBe('running');
    expect(completed.currentWorkflowNodeId).toBeNull();
    expect(completed.plan?.workflow[0].status).toBe('completed');
  });

  it('honors pause at the preview safe point and stops deterministically from paused', () => {
    const running = reduce(initial(), { type: 'PLAN_READY', plan });
    const requested = reduce(running, { type: 'PAUSE_REQUESTED' });
    const paused = reduce(requested, { type: 'SAFE_POINT', point: 'after_preview' });
    const stopped = reduce(paused, { type: 'STOP_REQUESTED' });

    expect(requested.status).toBe('pause_requested');
    expect(paused).toMatchObject({ status: 'paused', lastSafePoint: 'after_preview' });
    expect(stopped.status).toBe('stopped');
  });

  it('waits on a Human Decision and resumes only after that exact request resolves', () => {
    const running = reduce(initial(), { type: 'PLAN_READY', plan });
    const waiting = reduce(running, { type: 'HUMAN_DECISION_REQUIRED', request });
    const publicView = toDrawingAgentRunView(waiting);

    expect(waiting).toMatchObject({ status: 'waiting_for_user', pendingDecision: request });
    expect(publicView).toMatchObject({ status: 'waiting_for_user', pendingDecision: request });
    expect(reduceDrawingAgentState(waiting, {
      type: 'HUMAN_DECISION_RESOLVED', requestId: 'another_request',
    }).error).toMatchObject({ code: 'INVALID_TRANSITION' });

    const resumed = reduce(waiting, {
      type: 'HUMAN_DECISION_RESOLVED', requestId: request.id,
    });
    expect(resumed).toMatchObject({ status: 'running', pendingDecision: null });
  });

  it('moves a running stop through the next safe point without committing more work', () => {
    const running = reduce(initial(), { type: 'PLAN_READY', plan });
    const stopping = reduce(running, { type: 'STOP_REQUESTED' });
    const stopped = reduce(stopping, { type: 'SAFE_POINT', point: 'before_model' });

    expect(stopping.status).toBe('stopping');
    expect(stopped.status).toBe('stopped');
    expect(stopped.commitCount).toBe(0);
  });

  it('merges queued instructions once at a safe point and requires re-planning', () => {
    let state = reduce(initial(), { type: 'PLAN_READY', plan });
    state = reduce(state, { type: 'INSTRUCTION_ADDED', instruction: '半径改为 12' });
    state = reduce(state, { type: 'INSTRUCTION_ADDED', instruction: '圆心不要移动' });
    const merged = reduce(state, { type: 'SAFE_POINT', point: 'before_model' });
    const repeated = reduce(merged, { type: 'SAFE_POINT', point: 'before_read' });
    const replanning = reduce(repeated, { type: 'REPLAN_STARTED' });
    const replanned = reduce(replanning, { type: 'PLAN_READY', plan });

    expect(merged.pendingInstructions).toEqual([]);
    expect(merged.activeInstructions).toEqual(['半径改为 12', '圆心不要移动']);
    expect(merged.needsReplan).toBe(true);
    expect(repeated.activeInstructions).toEqual(merged.activeInstructions);
    expect(replanning.status).toBe('planning');
    expect(replanned).toMatchObject({
      status: 'running', needsReplan: false, activeInstructions: [],
    });
  });

  it('tracks bounded receipts, read loops, decisions, commits and latest revision', () => {
    let state = reduce(initial(), { type: 'PLAN_READY', plan });
    state = reduce(state, { type: 'DECISION_RECORDED' });
    for (let index = 0; index < 25; index += 1) {
      state = reduce(state, {
        type: 'RECEIPT_RECORDED', receipt: receipt('query_entities', `call_${index}`),
      });
    }
    const committedReceipt = receipt(
      'commit_transaction', 'call_commit', 'revision_2' as RevisionId,
    );
    state = reduce(state, { type: 'RECEIPT_RECORDED', receipt: committedReceipt });

    expect(state.decisionCount).toBe(1);
    expect(state.recentReceipts).toHaveLength(20);
    expect(state.recentReceipts[0].toolCallId).toBe('call_6');
    expect(state.consecutiveReadCount).toBe(0);
    expect(state.commitCount).toBe(1);
    expect(state.revision).toBe('revision_2');
  });

  it('reports deterministic budget failures without changing state', () => {
    let state = reduce(initial({
      limits: { maxDecisions: 1, maxCommits: 1, maxConsecutiveReads: 1, deadlineAt: 500 },
    }), { type: 'PLAN_READY', plan });
    state = reduce(state, { type: 'DECISION_RECORDED' });
    expect(checkDrawingAgentBudget(state, 100)).toEqual({
      code: 'MAX_DECISIONS', message: '已达到最大决策次数 1',
    });

    const expired = initial({
      limits: { maxDecisions: 5, maxCommits: 5, maxConsecutiveReads: 5, deadlineAt: 100 },
    });
    expect(checkDrawingAgentBudget(expired, 100)?.code).toBe('DEADLINE_EXCEEDED');
  });

  it('returns a structured error for invalid transitions and ignores terminal events', () => {
    const invalid = reduceDrawingAgentState(initial(), { type: 'RESUME' });
    expect(invalid.error).toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(invalid.state).toBe(invalid.previousState);

    const failed = reduce(initial(), { type: 'FAILED', error: '模型不可用' });
    expect(reduce(failed, { type: 'RESUME' })).toBe(failed);
  });
});

describe('Model-led Drawing Agent state machine', () => {
  it('starts directly in a bounded tool loop without exposing a workflow or model', () => {
    const state = modelLedInitial();
    const view = toModelLedDrawingAgentRunView(state);

    expect(state).toMatchObject({
      status: 'running', episodeId: 'episode_run_1', currentPreviewHandle: null,
      recentToolResults: [], candidateDigests: [], actionCount: 0, toolCallCount: 0,
    });
    expect(view).toMatchObject({
      runId: 'run_1', drawingId, revision, status: 'running',
      goal: null, workflow: [], currentPreviewHandle: null,
    });
    expect(JSON.stringify(view)).not.toMatch(/model|document|history/i);
  });

  it('tracks real tool receipts, current Preview, diagnostics and duplicate candidates', () => {
    let state = modelLedInitial();
    state = reduceModelLed(state, { type: 'ACTION_STARTED', title: '正在查看拓扑', actionKind: 'tool' });
    state = reduceModelLed(state, {
      type: 'MODEL_TOOL_RECORDED',
      result: modelToolResult('query_nodes', 'read', ['line_a']),
    });
    state = reduceModelLed(state, {
      type: 'PREVIEW_READY', previewHandle: 'preview_1', candidateDigest: 'digest_a',
    });
    state = reduceModelLed(state, {
      type: 'DIAGNOSTICS_RECORDED', diagnostics: [{
        code: 'NEW_DANGLING_ENDPOINT', severity: 'warning', nodeIds: ['line_a'],
      }],
    });
    state = reduceModelLed(state, {
      type: 'PREVIEW_READY', previewHandle: 'preview_2', candidateDigest: 'digest_a',
    });
    state = reduceModelLed(state, {
      type: 'DIAGNOSTICS_RECORDED', diagnostics: [{
        code: 'CURRENT_PREVIEW_WARNING', severity: 'warning', nodeIds: ['line_b'],
      }],
    });

    expect(state).toMatchObject({
      currentPreviewHandle: 'preview_2', actionCount: 1, toolCallCount: 1,
      consecutiveReadCount: 1, duplicateCandidateCount: 1,
      latestActivity: { title: '正在查看拓扑' },
    });
    expect(state.recentDiagnostics).toEqual([
      { code: 'CURRENT_PREVIEW_WARNING', severity: 'warning', nodeIds: ['line_b'] },
    ]);
  });

  it('waits for an exact Human Decision, can pause there, and resumes with queued feedback', () => {
    let state = modelLedInitial();
    state = reduceModelLed(state, { type: 'HUMAN_DECISION_REQUIRED', request });
    state = reduceModelLed(state, { type: 'INSTRUCTION_ADDED', instruction: '保留其他部分' });
    state = reduceModelLed(state, { type: 'PAUSE_REQUESTED' });

    expect(state).toMatchObject({
      status: 'paused', pendingDecision: request,
      pendingInstructions: ['保留其他部分'],
    });
    state = reduceModelLed(state, { type: 'RESUME' });
    expect(state.status).toBe('waiting_for_user');
    expect(reduceModelLedDrawingAgentState(state, {
      type: 'HUMAN_DECISION_RESOLVED', requestId: 'wrong', grants: [],
    }).error?.code).toBe('INVALID_TRANSITION');
    state = reduceModelLed(state, {
      type: 'HUMAN_DECISION_RESOLVED', requestId: request.id, grants: [],
    });
    expect(state).toMatchObject({ status: 'running', pendingDecision: null });
  });

  it('stops from waiting and reports action/tool/read/commit/deadline budgets', () => {
    let waiting = reduceModelLed(modelLedInitial(), {
      type: 'HUMAN_DECISION_REQUIRED', request,
    });
    waiting = reduceModelLed(waiting, { type: 'STOP_REQUESTED' });
    expect(waiting.status).toBe('stopped');

    const budgeted = modelLedInitial({
      limits: {
        maxActions: 1, maxToolCalls: 1, maxConsecutiveReads: 1,
        maxCommits: 1, maxProtocolCorrections: 1, deadlineAt: 100,
      },
    });
    expect(checkModelLedDrawingAgentBudget({ ...budgeted, actionCount: 1 }, 0)?.code)
      .toBe('MAX_ACTIONS');
    expect(checkModelLedDrawingAgentBudget({ ...budgeted, toolCallCount: 1 }, 0)?.code)
      .toBe('MAX_TOOL_CALLS');
    expect(checkModelLedDrawingAgentBudget({ ...budgeted, consecutiveReadCount: 1 }, 0)?.code)
      .toBe('MAX_CONSECUTIVE_READS');
    expect(checkModelLedDrawingAgentBudget({ ...budgeted, commitCount: 1 }, 0)).toBeNull();
    expect(checkModelLedDrawingAgentBudget({ ...budgeted, budgetedCommitCount: 1 }, 0)?.code)
      .toBe('MAX_COMMITS');
    expect(checkModelLedDrawingAgentBudget(budgeted, 100)?.code).toBe('DEADLINE_EXCEEDED');
  });

  it('completes without any workflow node after a commit or a read-only finish', () => {
    let state = reduceModelLed(modelLedInitial(), {
      type: 'COMMIT_RECORDED', revision: 'revision_2' as RevisionId,
    });
    state = reduceModelLed(state, { type: 'COMPLETED', summary: '已完成编辑' });
    expect(state).toMatchObject({
      status: 'completed', revision: 'revision_2', commitCount: 1,
      budgetedCommitCount: 1,
      analysisSummary: '已完成编辑', currentPreviewHandle: null,
    });
  });

  it('tracks deterministic import commits without spending the semantic edit budget', () => {
    const state = reduceModelLed(modelLedInitial(), {
      type: 'COMMIT_RECORDED', revision: 'revision_2' as RevisionId,
      countsTowardBudget: false,
    });

    expect(state).toMatchObject({ commitCount: 1, budgetedCommitCount: 0 });
    expect(checkModelLedDrawingAgentBudget(state, 0)).toBeNull();
  });
});

const plan: DrawingAgentPlan = {
  goal: {
    id: 'goal_1', objective: '修改圆', scope: { ids: ['circle_1'] },
    acceptanceCriteria: [{ type: 'document.valid' }],
    riskPolicy: { candidateAllowed: true, maxCommits: 2 },
  },
  workflow: [{
    id: 'inspect', capability: 'inspect_entity', dependsOn: [],
    completionCriteria: [], status: 'pending',
  }, {
    id: 'edit', capability: 'edit_entities', dependsOn: ['inspect'],
    completionCriteria: [{ type: 'document.valid' }], status: 'pending',
  }],
  summary: '检查并修改圆',
};

const request: HumanDecisionRequest = {
  id: 'request_1', episodeId: 'episode_1', revision,
  candidateId: 'candidate_1', transactionDigest: 'a'.repeat(64),
  kind: 'grant-permission', question: '允许解除当前约束吗？',
  reason: '候选事务需要删除一个已有约束',
  options: [{
    id: 'allow', label: '仅允许本次',
    effect: {
      type: 'permission', decision: 'allow',
      actions: ['constraint.delete'], resourceIds: ['constraint_1'],
    },
  }, {
    id: 'deny', label: '不允许',
    effect: {
      type: 'permission', decision: 'deny',
      actions: ['constraint.delete'], resourceIds: ['constraint_1'],
    },
  }],
  recommendedOptionId: 'allow',
  affectedResources: [{ plane: 'relation', ids: ['constraint_1'], action: 'constraint.delete' }],
  expiresWhenRevisionChanges: true,
};

function initial(overrides: Record<string, unknown> = {}) {
  return createDrawingAgentState({
    runId: 'run_1', drawingId, revision,
    objective: '修改圆', createdAt: 0,
    limits: {
      maxDecisions: 10, maxCommits: 3, maxConsecutiveReads: 4, deadlineAt: 1_000,
    },
    ...overrides,
  } as never);
}

function reduce(
  state: ReturnType<typeof initial>,
  event: Parameters<typeof reduceDrawingAgentState>[1],
) {
  const result = reduceDrawingAgentState(state, event);
  if (result.error) throw new Error(result.error.message);
  return result.state;
}

function receipt(
  capability: DrawingToolReceipt['capability'],
  toolCallId: string,
  revisionAfter: RevisionId = revision,
): DrawingToolReceipt {
  const write = capability === 'commit_transaction' || capability === 'preview_transaction';
  return {
    toolCallId, capability, version: '1.0.0', access: write ? 'write' : 'read',
    inputDigest: 'a'.repeat(64), revisionBefore: revision, revisionAfter,
    affectedNodeIds: capability === 'commit_transaction' ? ['circle_1'] : [],
    outcome: capability === 'commit_transaction'
      ? { kind: 'commit', committed: true, commitId: 'commit_1' }
      : { kind: 'query', count: 0, truncated: false },
    durationMs: 1, status: 'succeeded', retry: { allowed: false },
  };
}

function modelLedInitial(overrides: Record<string, unknown> = {}) {
  return createModelLedDrawingAgentState({
    runId: 'run_1', episodeId: 'episode_run_1', drawingId, revision,
    objective: '修改当前图形', createdAt: 0,
    limits: {
      maxActions: 30, maxToolCalls: 24, maxConsecutiveReads: 8,
      maxCommits: 2, maxProtocolCorrections: 2, deadlineAt: 1_000,
    },
    ...overrides,
  } as never);
}

function reduceModelLed(
  state: ReturnType<typeof modelLedInitial>,
  event: Parameters<typeof reduceModelLedDrawingAgentState>[1],
) {
  const result = reduceModelLedDrawingAgentState(state, event);
  if (result.error) throw new Error(result.error.message);
  return result.state;
}

function modelToolResult(tool: string, access: 'read' | 'write', affectedNodeIds: string[]) {
  return {
    schemaVersion: 1 as const,
    receipt: {
      schemaVersion: 1 as const,
      runId: 'run_1', episodeId: 'episode_run_1', drawingId,
      toolCallId: 'model_call_1', tool, toolVersion: '1.0.0', access,
      status: 'succeeded' as const, revisionBefore: revision, revisionAfter: revision,
      affectedNodeIds, inputDigest: 'sha256:input', outputDigest: 'sha256:output', durationMs: 1,
    },
    output: { ok: true },
  };
}
