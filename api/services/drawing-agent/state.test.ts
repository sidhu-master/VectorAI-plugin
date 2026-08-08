import { describe, expect, it } from 'vitest';

import type { DrawingAgentPlan } from '../../../src/contracts/drawing-agent';
import type { DrawingId, RevisionId } from '../../../src/drawing';
import {
  checkDrawingAgentBudget,
  createDrawingAgentState,
  reduceDrawingAgentState,
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
