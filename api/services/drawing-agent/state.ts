import type {
  DrawingAgentPlan,
  DrawingAgentRunStatus,
  DrawingAgentRunView,
  HumanDecisionRequest,
  WorkflowNode,
} from '../../../src/contracts/drawing-agent.js';
import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';
import type { ModelToolResult } from '../drawing-tools/types.js';
import type { DrawingToolReceipt } from './types.js';

const MAX_RECENT_RECEIPTS = 20;

export type DrawingAgentSafePoint =
  | 'before_model'
  | 'before_read'
  | 'after_preview'
  | 'after_commit';

export interface DrawingAgentLimits {
  maxDecisions: number;
  maxCommits: number;
  maxConsecutiveReads: number;
  deadlineAt: number;
}

export interface DrawingAgentRecoveryState {
  schemaCorrections: number;
  validationRepairs: number;
  lowConfidenceEscalations: number;
  staleRecoveries: number;
  replans: number;
}

export interface DrawingAgentState {
  runId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  objective: string;
  status: DrawingAgentRunStatus;
  plan: DrawingAgentPlan | null;
  currentWorkflowNodeId: string | null;
  recentReceipts: DrawingToolReceipt[];
  pendingInstructions: string[];
  activeInstructions: string[];
  needsReplan: boolean;
  commitCount: number;
  analysisSummary: string | null;
  pendingDecision: HumanDecisionRequest | null;
  decisionCount: number;
  consecutiveReadCount: number;
  recovery: DrawingAgentRecoveryState;
  limits: DrawingAgentLimits;
  lastSafePoint: DrawingAgentSafePoint | null;
  createdAt: number;
  error: string | null;
}

export type DrawingAgentEvent =
  | { type: 'PLAN_READY'; plan: DrawingAgentPlan }
  | { type: 'ANALYSIS_READY'; summary: string }
  | { type: 'REPLAN_REQUIRED'; revision: RevisionId }
  | { type: 'REPLAN_STARTED' }
  | { type: 'PAUSE_REQUESTED' }
  | { type: 'SAFE_POINT'; point: DrawingAgentSafePoint }
  | { type: 'RESUME' }
  | { type: 'INSTRUCTION_ADDED'; instruction: string }
  | { type: 'HUMAN_DECISION_REQUIRED'; request: HumanDecisionRequest }
  | { type: 'HUMAN_DECISION_RESOLVED'; requestId: string }
  | { type: 'STOP_REQUESTED' }
  | { type: 'WORKFLOW_NODE_STARTED'; nodeId: string }
  | { type: 'WORKFLOW_NODE_COMPLETED'; nodeId: string }
  | { type: 'DECISION_RECORDED' }
  | { type: 'RECEIPT_RECORDED'; receipt: DrawingToolReceipt }
  | {
      type: 'RECOVERY_RECORDED';
      recovery: Exclude<keyof DrawingAgentRecoveryState, 'replans'>;
    }
  | { type: 'COMPLETED' }
  | { type: 'FAILED'; error: string };

export interface DrawingAgentTransitionError {
  code: 'INVALID_TRANSITION';
  message: string;
}

export interface DrawingAgentTransitionResult {
  previousState: DrawingAgentState;
  state: DrawingAgentState;
  error?: DrawingAgentTransitionError;
}

export interface DrawingAgentBudgetError {
  code:
    | 'DEADLINE_EXCEEDED'
    | 'MAX_DECISIONS'
    | 'MAX_COMMITS'
    | 'MAX_CONSECUTIVE_READS';
  message: string;
}

export function createDrawingAgentState(input: {
  runId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  objective: string;
  createdAt: number;
  limits: DrawingAgentLimits;
}): DrawingAgentState {
  return {
    ...input,
    status: 'planning',
    plan: null,
    currentWorkflowNodeId: null,
    recentReceipts: [],
    pendingInstructions: [],
    activeInstructions: [],
    needsReplan: false,
    commitCount: 0,
    analysisSummary: null,
    pendingDecision: null,
    decisionCount: 0,
    consecutiveReadCount: 0,
    recovery: {
      schemaCorrections: 0,
      validationRepairs: 0,
      lowConfidenceEscalations: 0,
      staleRecoveries: 0,
      replans: 0,
    },
    lastSafePoint: null,
    error: null,
  };
}

export function reduceDrawingAgentState(
  state: DrawingAgentState,
  event: DrawingAgentEvent,
): DrawingAgentTransitionResult {
  if (isTerminal(state.status)) return valid(state, state);

  switch (event.type) {
    case 'ANALYSIS_READY':
      return valid(state, { ...state, analysisSummary: event.summary });

    case 'PLAN_READY':
      if (state.status !== 'planning' && state.status !== 'pause_requested') {
        return invalid(state, event.type);
      }
      return valid(state, {
        ...state,
        plan: structuredClone(event.plan),
        currentWorkflowNodeId: null,
        activeInstructions: [],
        needsReplan: false,
        status: state.status === 'pause_requested' ? 'paused' : 'running',
      });

    case 'REPLAN_REQUIRED':
      return valid(state, {
        ...state,
        revision: event.revision,
        currentWorkflowNodeId: null,
        needsReplan: true,
      });

    case 'REPLAN_STARTED':
      if (state.status !== 'running' || !state.needsReplan) return invalid(state, event.type);
      return valid(state, {
        ...state,
        status: 'planning',
        currentWorkflowNodeId: null,
        recovery: { ...state.recovery, replans: state.recovery.replans + 1 },
      });

    case 'PAUSE_REQUESTED':
      if (state.status !== 'planning' && state.status !== 'running') {
        return invalid(state, event.type);
      }
      return valid(state, { ...state, status: 'pause_requested' });

    case 'SAFE_POINT':
      return atSafePoint(state, event.point);

    case 'RESUME':
      if (state.status !== 'paused') return invalid(state, event.type);
      return valid(state, { ...state, status: state.plan ? 'running' : 'planning' });

    case 'INSTRUCTION_ADDED': {
      const instruction = event.instruction.trim();
      if (instruction === '') return invalid(state, event.type);
      return valid(state, {
        ...state,
        pendingInstructions: [...state.pendingInstructions, instruction],
      });
    }

    case 'HUMAN_DECISION_REQUIRED':
      if (state.status !== 'running' || state.pendingDecision !== null) {
        return invalid(state, event.type);
      }
      if (event.request.revision !== state.revision) return invalid(state, event.type);
      return valid(state, {
        ...state,
        status: 'waiting_for_user',
        pendingDecision: structuredClone(event.request),
      });

    case 'HUMAN_DECISION_RESOLVED':
      if (state.status !== 'waiting_for_user'
        || state.pendingDecision?.id !== event.requestId) {
        return invalid(state, event.type);
      }
      return valid(state, {
        ...state,
        status: 'running',
        pendingDecision: null,
      });

    case 'STOP_REQUESTED':
      if (state.status === 'paused') return valid(state, { ...state, status: 'stopped' });
      if (state.status === 'stopping') return valid(state, state);
      return valid(state, { ...state, status: 'stopping' });

    case 'WORKFLOW_NODE_STARTED': {
      if (state.status !== 'running' || state.currentWorkflowNodeId !== null || !state.plan) {
        return invalid(state, event.type);
      }
      const node = state.plan.workflow.find((item) => item.id === event.nodeId);
      if (!node || node.status !== 'pending' || !dependenciesComplete(state.plan.workflow, node)) {
        return invalid(state, event.type);
      }
      return valid(state, {
        ...state,
        plan: updateWorkflowNode(state.plan, event.nodeId, 'running'),
        currentWorkflowNodeId: event.nodeId,
      });
    }

    case 'WORKFLOW_NODE_COMPLETED':
      if (
        state.status !== 'running'
        || state.currentWorkflowNodeId !== event.nodeId
        || !state.plan
      ) return invalid(state, event.type);
      return valid(state, {
        ...state,
        plan: updateWorkflowNode(state.plan, event.nodeId, 'completed'),
        currentWorkflowNodeId: null,
      });

    case 'DECISION_RECORDED':
      if (state.status !== 'running') return invalid(state, event.type);
      return valid(state, { ...state, decisionCount: state.decisionCount + 1 });

    case 'RECEIPT_RECORDED': {
      const receipt = structuredClone(event.receipt);
      const committed = receipt.capability === 'commit_transaction'
        && receipt.status === 'succeeded'
        && receipt.outcome.kind === 'commit'
        && receipt.outcome.committed;
      return valid(state, {
        ...state,
        revision: receipt.revisionAfter,
        recentReceipts: [...state.recentReceipts, receipt].slice(-MAX_RECENT_RECEIPTS),
        consecutiveReadCount: receipt.access === 'read'
          ? state.consecutiveReadCount + 1
          : 0,
        commitCount: state.commitCount + (committed ? 1 : 0),
      });
    }

    case 'RECOVERY_RECORDED':
      return valid(state, {
        ...state,
        recovery: {
          ...state.recovery,
          [event.recovery]: state.recovery[event.recovery] + 1,
        },
      });

    case 'COMPLETED':
      if (state.status !== 'running' || !workflowComplete(state.plan)) {
        return invalid(state, event.type);
      }
      return valid(state, { ...state, status: 'completed', currentWorkflowNodeId: null });

    case 'FAILED':
      return valid(state, {
        ...state,
        status: 'failed',
        currentWorkflowNodeId: null,
        error: event.error,
      });
  }
}

export function checkDrawingAgentBudget(
  state: DrawingAgentState,
  now: number,
): DrawingAgentBudgetError | null {
  if (now >= state.limits.deadlineAt) {
    return { code: 'DEADLINE_EXCEEDED', message: '任务已超过运行截止时间' };
  }
  if (state.decisionCount >= state.limits.maxDecisions) {
    return {
      code: 'MAX_DECISIONS',
      message: `已达到最大决策次数 ${state.limits.maxDecisions}`,
    };
  }
  if (state.commitCount >= state.limits.maxCommits) {
    return { code: 'MAX_COMMITS', message: `已达到最大提交次数 ${state.limits.maxCommits}` };
  }
  if (state.consecutiveReadCount >= state.limits.maxConsecutiveReads) {
    return {
      code: 'MAX_CONSECUTIVE_READS',
      message: `已达到最大连续读取次数 ${state.limits.maxConsecutiveReads}`,
    };
  }
  return null;
}

export function toDrawingAgentRunView(state: DrawingAgentState): DrawingAgentRunView {
  return {
    runId: state.runId,
    drawingId: state.drawingId,
    revision: state.revision,
    status: state.status,
    goal: state.plan ? structuredClone(state.plan.goal) : null,
    workflow: state.plan ? structuredClone(state.plan.workflow) : [],
    currentWorkflowNodeId: state.currentWorkflowNodeId,
    commitCount: state.commitCount,
    analysisSummary: state.analysisSummary,
    pendingInstructions: [...state.pendingInstructions],
    pendingDecision: state.pendingDecision ? structuredClone(state.pendingDecision) : null,
    error: state.error,
  };
}

const MAX_MODEL_RESULTS = 12;
const MAX_MODEL_DIAGNOSTICS = 24;
const MAX_CANDIDATE_DIGESTS = 24;

export interface ModelLedDrawingAgentLimits {
  maxActions: number;
  maxToolCalls: number;
  maxConsecutiveReads: number;
  maxCommits: number;
  maxProtocolCorrections: number;
  deadlineAt: number;
}

export interface ModelLedDrawingAgentActivity {
  title: string;
  detail?: string;
  actionKind: 'model' | 'tool' | 'preview' | 'decision' | 'commit';
}

export interface ModelLedDrawingAgentState {
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  objective: string;
  status: DrawingAgentRunStatus;
  recentToolResults: ModelToolResult[];
  recentDiagnostics: Array<Pick<DrawingDiagnostic, 'code' | 'severity' | 'nodeIds'> & {
    message?: string;
    action?: string;
  }>;
  pendingInstructions: string[];
  activeInstructions: string[];
  pendingDecision: HumanDecisionRequest | null;
  decisionGrants: import('../../../src/contracts/drawing-agent.js').PermissionGrant[];
  decisions: Array<{
    request: HumanDecisionRequest;
    response?: import('../../../src/contracts/drawing-agent.js').HumanDecisionResponse;
    grants: import('../../../src/contracts/drawing-agent.js').PermissionGrant[];
  }>;
  currentPreviewHandle: string | null;
  candidateDigests: string[];
  duplicateCandidateCount: number;
  actionCount: number;
  toolCallCount: number;
  consecutiveReadCount: number;
  commitCount: number;
  protocolCorrectionCount: number;
  latestActivity: ModelLedDrawingAgentActivity | null;
  analysisSummary: string | null;
  limits: ModelLedDrawingAgentLimits;
  createdAt: number;
  pauseReturnStatus: 'running' | 'waiting_for_user' | null;
  error: string | null;
}

export type ModelLedDrawingAgentEvent =
  | { type: 'ACTION_STARTED'; title: string; detail?: string; actionKind: ModelLedDrawingAgentActivity['actionKind'] }
  | { type: 'MODEL_TOOL_RECORDED'; result: ModelToolResult }
  | { type: 'PREVIEW_READY'; previewHandle: string; candidateDigest: string }
  | { type: 'PREVIEW_CLEARED' }
  | { type: 'DIAGNOSTICS_RECORDED'; diagnostics: ModelLedDrawingAgentState['recentDiagnostics'] }
  | { type: 'INSTRUCTION_ADDED'; instruction: string }
  | { type: 'INSTRUCTIONS_ACTIVATED' }
  | { type: 'HUMAN_DECISION_REQUIRED'; request: HumanDecisionRequest }
  | {
      type: 'HUMAN_DECISION_RESOLVED';
      requestId: string;
      grants: import('../../../src/contracts/drawing-agent.js').PermissionGrant[];
      response?: import('../../../src/contracts/drawing-agent.js').HumanDecisionResponse;
    }
  | { type: 'PROTOCOL_CORRECTION_RECORDED' }
  | { type: 'COMMIT_RECORDED'; revision: RevisionId }
  | { type: 'PAUSE_REQUESTED' }
  | { type: 'RESUME' }
  | { type: 'STOP_REQUESTED' }
  | { type: 'COMPLETED'; summary: string }
  | { type: 'FAILED'; error: string };

export interface ModelLedDrawingAgentTransitionResult {
  previousState: ModelLedDrawingAgentState;
  state: ModelLedDrawingAgentState;
  error?: DrawingAgentTransitionError;
}

export interface ModelLedDrawingAgentBudgetError {
  code:
    | 'DEADLINE_EXCEEDED'
    | 'MAX_ACTIONS'
    | 'MAX_TOOL_CALLS'
    | 'MAX_CONSECUTIVE_READS'
    | 'MAX_COMMITS'
    | 'MAX_PROTOCOL_CORRECTIONS';
  message: string;
}

export function createModelLedDrawingAgentState(input: {
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  objective: string;
  createdAt: number;
  limits: ModelLedDrawingAgentLimits;
}): ModelLedDrawingAgentState {
  return {
    ...input,
    status: 'running',
    recentToolResults: [],
    recentDiagnostics: [],
    pendingInstructions: [],
    activeInstructions: [],
    pendingDecision: null,
    decisionGrants: [],
    decisions: [],
    currentPreviewHandle: null,
    candidateDigests: [],
    duplicateCandidateCount: 0,
    actionCount: 0,
    toolCallCount: 0,
    consecutiveReadCount: 0,
    commitCount: 0,
    protocolCorrectionCount: 0,
    latestActivity: null,
    analysisSummary: null,
    pauseReturnStatus: null,
    error: null,
  };
}

export function reduceModelLedDrawingAgentState(
  state: ModelLedDrawingAgentState,
  event: ModelLedDrawingAgentEvent,
): ModelLedDrawingAgentTransitionResult {
  if (isTerminal(state.status)) return modelLedValid(state, state);
  switch (event.type) {
    case 'ACTION_STARTED':
      if (state.status !== 'running') return modelLedInvalid(state, event.type);
      return modelLedValid(state, {
        ...state,
        actionCount: state.actionCount + 1,
        latestActivity: {
          title: event.title,
          ...(event.detail === undefined ? {} : { detail: event.detail }),
          actionKind: event.actionKind,
        },
      });
    case 'MODEL_TOOL_RECORDED': {
      const result = structuredClone(event.result);
      return modelLedValid(state, {
        ...state,
        revision: result.receipt.revisionAfter,
        recentToolResults: [...state.recentToolResults, result].slice(-MAX_MODEL_RESULTS),
        toolCallCount: state.toolCallCount + 1,
        consecutiveReadCount: result.receipt.access === 'read'
          ? state.consecutiveReadCount + 1
          : 0,
      });
    }
    case 'PREVIEW_READY': {
      const duplicate = state.candidateDigests.includes(event.candidateDigest);
      return modelLedValid(state, {
        ...state,
        currentPreviewHandle: event.previewHandle,
        candidateDigests: [...state.candidateDigests, event.candidateDigest]
          .slice(-MAX_CANDIDATE_DIGESTS),
        duplicateCandidateCount: state.duplicateCandidateCount + (duplicate ? 1 : 0),
      });
    }
    case 'PREVIEW_CLEARED':
      return modelLedValid(state, { ...state, currentPreviewHandle: null });
    case 'DIAGNOSTICS_RECORDED':
      return modelLedValid(state, {
        ...state,
        recentDiagnostics: [...state.recentDiagnostics, ...structuredClone(event.diagnostics)]
          .slice(-MAX_MODEL_DIAGNOSTICS),
      });
    case 'INSTRUCTION_ADDED': {
      const instruction = event.instruction.trim();
      if (!instruction) return modelLedInvalid(state, event.type);
      return modelLedValid(state, {
        ...state,
        pendingInstructions: [...state.pendingInstructions, instruction],
      });
    }
    case 'INSTRUCTIONS_ACTIVATED':
      return modelLedValid(state, {
        ...state,
        activeInstructions: [...state.activeInstructions, ...state.pendingInstructions],
        pendingInstructions: [],
      });
    case 'HUMAN_DECISION_REQUIRED':
      if (state.status !== 'running' || state.pendingDecision
        || event.request.revision !== state.revision) {
        return modelLedInvalid(state, event.type);
      }
      return modelLedValid(state, {
        ...state,
        status: 'waiting_for_user',
        pendingDecision: structuredClone(event.request),
        latestActivity: {
          title: '需要你确认后继续',
          detail: event.request.question,
          actionKind: 'decision',
        },
      });
    case 'HUMAN_DECISION_RESOLVED':
      if (state.status !== 'waiting_for_user'
        || state.pendingDecision?.id !== event.requestId) {
        return modelLedInvalid(state, event.type);
      }
      return modelLedValid(state, {
        ...state,
        status: 'running',
        pendingDecision: null,
        decisionGrants: [...state.decisionGrants, ...structuredClone(event.grants)],
        decisions: [...state.decisions, {
          request: structuredClone(state.pendingDecision),
          ...(event.response ? { response: structuredClone(event.response) } : {}),
          grants: structuredClone(event.grants),
        }],
      });
    case 'PROTOCOL_CORRECTION_RECORDED':
      return modelLedValid(state, {
        ...state,
        protocolCorrectionCount: state.protocolCorrectionCount + 1,
      });
    case 'COMMIT_RECORDED':
      return modelLedValid(state, {
        ...state,
        revision: event.revision,
        commitCount: state.commitCount + 1,
        currentPreviewHandle: null,
        consecutiveReadCount: 0,
      });
    case 'PAUSE_REQUESTED':
      if (state.status !== 'running' && state.status !== 'waiting_for_user') {
        return modelLedInvalid(state, event.type);
      }
      return modelLedValid(state, {
        ...state,
        status: 'paused',
        pauseReturnStatus: state.status,
      });
    case 'RESUME':
      if (state.status !== 'paused') return modelLedInvalid(state, event.type);
      return modelLedValid(state, {
        ...state,
        status: state.pauseReturnStatus ?? 'running',
        pauseReturnStatus: null,
      });
    case 'STOP_REQUESTED':
      return modelLedValid(state, { ...state, status: 'stopped' });
    case 'COMPLETED':
      if (state.status !== 'running') return modelLedInvalid(state, event.type);
      return modelLedValid(state, {
        ...state,
        status: 'completed',
        analysisSummary: event.summary,
        currentPreviewHandle: null,
      });
    case 'FAILED':
      return modelLedValid(state, {
        ...state,
        status: 'failed',
        error: event.error,
        currentPreviewHandle: null,
      });
  }
}

export function checkModelLedDrawingAgentBudget(
  state: ModelLedDrawingAgentState,
  now: number,
): ModelLedDrawingAgentBudgetError | null {
  if (now >= state.limits.deadlineAt) {
    return { code: 'DEADLINE_EXCEEDED', message: '任务已超过运行截止时间' };
  }
  if (state.actionCount >= state.limits.maxActions) {
    return { code: 'MAX_ACTIONS', message: `已达到最大动作次数 ${state.limits.maxActions}` };
  }
  if (state.toolCallCount >= state.limits.maxToolCalls) {
    return { code: 'MAX_TOOL_CALLS', message: `已达到最大工具调用次数 ${state.limits.maxToolCalls}` };
  }
  if (state.consecutiveReadCount >= state.limits.maxConsecutiveReads) {
    return {
      code: 'MAX_CONSECUTIVE_READS',
      message: `已达到最大连续读取次数 ${state.limits.maxConsecutiveReads}`,
    };
  }
  if (state.commitCount >= state.limits.maxCommits) {
    return { code: 'MAX_COMMITS', message: `已达到最大提交次数 ${state.limits.maxCommits}` };
  }
  if (state.protocolCorrectionCount >= state.limits.maxProtocolCorrections) {
    return {
      code: 'MAX_PROTOCOL_CORRECTIONS',
      message: `已达到最大协议纠错次数 ${state.limits.maxProtocolCorrections}`,
    };
  }
  return null;
}

export function toModelLedDrawingAgentRunView(
  state: ModelLedDrawingAgentState,
): DrawingAgentRunView {
  return {
    runId: state.runId,
    drawingId: state.drawingId,
    revision: state.revision,
    status: state.status,
    goal: null,
    workflow: [],
    currentWorkflowNodeId: null,
    commitCount: state.commitCount,
    analysisSummary: state.analysisSummary,
    pendingInstructions: [...state.pendingInstructions],
    pendingDecision: state.pendingDecision ? structuredClone(state.pendingDecision) : null,
    currentPreviewHandle: state.currentPreviewHandle,
    latestActivity: state.latestActivity ? structuredClone(state.latestActivity) : null,
    error: state.error,
  };
}

function modelLedValid(
  previousState: ModelLedDrawingAgentState,
  state: ModelLedDrawingAgentState,
): ModelLedDrawingAgentTransitionResult {
  return { previousState, state };
}

function modelLedInvalid(
  state: ModelLedDrawingAgentState,
  eventType: ModelLedDrawingAgentEvent['type'],
): ModelLedDrawingAgentTransitionResult {
  return {
    previousState: state,
    state,
    error: {
      code: 'INVALID_TRANSITION',
      message: `${state.status} 状态不能处理 ${eventType}`,
    },
  };
}

function atSafePoint(
  state: DrawingAgentState,
  point: DrawingAgentSafePoint,
): DrawingAgentTransitionResult {
  const pending = state.pendingInstructions.length > 0;
  const next: DrawingAgentState = {
    ...state,
    lastSafePoint: point,
    ...(pending ? {
      activeInstructions: [...state.activeInstructions, ...state.pendingInstructions],
      pendingInstructions: [],
      needsReplan: true,
    } : {}),
  };
  if (state.status === 'stopping') return valid(state, { ...next, status: 'stopped' });
  if (state.status === 'pause_requested') return valid(state, { ...next, status: 'paused' });
  if (state.status === 'planning' || state.status === 'running' || state.status === 'paused') {
    return valid(state, next);
  }
  return invalid(state, 'SAFE_POINT');
}

function updateWorkflowNode(
  plan: DrawingAgentPlan,
  nodeId: string,
  status: WorkflowNode['status'],
): DrawingAgentPlan {
  return {
    ...plan,
    workflow: plan.workflow.map((node) => (
      node.id === nodeId ? { ...node, status } : { ...node }
    )),
  };
}

function dependenciesComplete(workflow: WorkflowNode[], node: WorkflowNode): boolean {
  return node.dependsOn.every((dependency) => (
    workflow.find((candidate) => candidate.id === dependency)?.status === 'completed'
  ));
}

function workflowComplete(plan: DrawingAgentPlan | null): boolean {
  return Boolean(plan && plan.workflow.every((node) => node.status === 'completed'));
}

function isTerminal(status: DrawingAgentRunStatus): boolean {
  return status === 'stopped' || status === 'completed' || status === 'failed';
}

function valid(
  previousState: DrawingAgentState,
  state: DrawingAgentState,
): DrawingAgentTransitionResult {
  return { previousState, state };
}

function invalid(
  state: DrawingAgentState,
  eventType: DrawingAgentEvent['type'],
): DrawingAgentTransitionResult {
  return {
    previousState: state,
    state,
    error: {
      code: 'INVALID_TRANSITION',
      message: `${state.status} 状态不能处理 ${eventType}`,
    },
  };
}
