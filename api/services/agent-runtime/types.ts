import type { TaskPlan, TaskStep } from '../../../src/core/agent.js';
import type { RuntimeContextProjection } from '../../../src/core/runtime/context.js';
import type { SpatialIntent, SpatialModel } from '../../../src/core/types.js';

export interface PlanStageInput {
  goal: string;
  model: SpatialModel;
  instruction?: string;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface ExecuteStageInput {
  goal: string;
  plan: TaskPlan;
  step: TaskStep;
  model: SpatialModel;
  context: RuntimeContextProjection;
  attempt: number;
  previousErrors: string[];
  signal: AbortSignal;
  deadlineAt: number;
}

export interface AgentPlannerAdapter {
  plan(input: PlanStageInput): Promise<TaskPlan>;
}

export interface AgentExecutorAdapter {
  execute(input: ExecuteStageInput): Promise<SpatialIntent>;
}

export interface StartAgentRunInput {
  runId: string;
  goal: string;
  model: SpatialModel;
  stableRules?: string[];
}
