import type {
  DrawingAgentPlan,
  DrawingAgentRunStatus,
  DrawingAgentRunView,
  WorkflowNode,
} from '../../../src/contracts/drawing-agent.js';
import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
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
  | { type: 'REPLAN_REQUIRED'; revision: RevisionId }
  | { type: 'REPLAN_STARTED' }
  | { type: 'PAUSE_REQUESTED' }
  | { type: 'SAFE_POINT'; point: DrawingAgentSafePoint }
  | { type: 'RESUME' }
  | { type: 'INSTRUCTION_ADDED'; instruction: string }
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
    pendingInstructions: [...state.pendingInstructions],
    error: state.error,
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
