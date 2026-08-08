import type { TaskPlan } from '../agent';
import type { SpatialHistory } from '../history/types';
import type { RuntimeContextLedger } from './context';

export type AgentRunStatus =
  | 'planning'
  | 'running'
  | 'pause_requested'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'failed';

export interface AgentRunState {
  runId: string;
  goal: string;
  status: AgentRunStatus;
  plan: TaskPlan | null;
  currentStepIndex: number;
  history: SpatialHistory;
  context: RuntimeContextLedger;
  pendingInstructions: string[];
  activeInstruction?: string;
  needsReplan: boolean;
  createdAt: number;
}

export type AgentRunEvent =
  | { type: 'PLAN_READY'; plan: TaskPlan }
  | { type: 'PAUSE_REQUESTED' }
  | { type: 'SAFE_POINT' }
  | { type: 'RESUME' }
  | { type: 'INSTRUCTION_ADDED'; instruction: string }
  | { type: 'STOP_REQUESTED' }
  | { type: 'STOPPED' }
  | { type: 'STEP_COMPLETED' };

export interface AgentTransitionError {
  code: 'INVALID_TRANSITION';
  message: string;
}

export interface AgentTransitionResult {
  previousState: AgentRunState;
  state: AgentRunState;
  error?: AgentTransitionError;
}

export function createAgentRunState(input: {
  runId: string;
  goal: string;
  history: SpatialHistory;
  context: RuntimeContextLedger;
  createdAt: number;
}): AgentRunState {
  return {
    ...input,
    status: 'planning',
    plan: null,
    currentStepIndex: 0,
    pendingInstructions: [],
    needsReplan: false,
  };
}

export function reduceAgentRun(
  state: AgentRunState,
  event: AgentRunEvent,
): AgentTransitionResult {
  if (isTerminal(state.status)) return valid(state, state);

  switch (event.type) {
    case 'PLAN_READY':
      if (state.status !== 'planning') return invalid(state, event.type);
      return valid(state, { ...state, plan: event.plan, status: 'running', needsReplan: false });

    case 'PAUSE_REQUESTED':
      if (state.status !== 'running') return invalid(state, event.type);
      return valid(state, { ...state, status: 'pause_requested' });

    case 'SAFE_POINT': {
      const instruction = state.pendingInstructions[0];
      const next = instruction
        ? {
            ...state,
            pendingInstructions: state.pendingInstructions.slice(1),
            activeInstruction: instruction,
            needsReplan: true,
          }
        : state;
      if (next.status === 'pause_requested') return valid(state, { ...next, status: 'paused' });
      if (next.status !== 'running' && next.status !== 'paused') return invalid(state, event.type);
      return valid(state, next);
    }

    case 'RESUME':
      if (state.status !== 'paused') return invalid(state, event.type);
      return valid(state, { ...state, status: 'running' });

    case 'INSTRUCTION_ADDED':
      if (event.instruction.trim().length === 0) return invalid(state, event.type);
      return valid(state, {
        ...state,
        pendingInstructions: [...state.pendingInstructions, event.instruction.trim()],
      });

    case 'STOP_REQUESTED':
      if (state.status === 'stopping') return valid(state, state);
      return valid(state, { ...state, status: 'stopping' });

    case 'STOPPED':
      if (state.status !== 'stopping') return invalid(state, event.type);
      return valid(state, { ...state, status: 'stopped' });

    case 'STEP_COMPLETED': {
      if (state.status !== 'running') return invalid(state, event.type);
      const currentStepIndex = state.currentStepIndex + 1;
      const completed = state.plan !== null && currentStepIndex >= state.plan.steps.length;
      return valid(state, {
        ...state,
        currentStepIndex,
        status: completed ? 'completed' : 'running',
      });
    }
  }
}

function isTerminal(status: AgentRunStatus): boolean {
  return status === 'stopped' || status === 'completed' || status === 'failed';
}

function valid(previousState: AgentRunState, state: AgentRunState): AgentTransitionResult {
  return { previousState, state };
}

function invalid(state: AgentRunState, eventType: AgentRunEvent['type']): AgentTransitionResult {
  return {
    previousState: state,
    state,
    error: {
      code: 'INVALID_TRANSITION',
      message: `${state.status} 状态不能处理 ${eventType}`,
    },
  };
}
