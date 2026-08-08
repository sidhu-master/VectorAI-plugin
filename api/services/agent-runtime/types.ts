import type { TaskPlan, TaskStep } from '../../../src/core/agent.js';
import type { RuntimeContextProjection } from '../../../src/core/runtime/context.js';
import type { SpatialIntent, SpatialModel } from '../../../src/core/types.js';

export type AgentModelRole = 'planner' | 'executor' | 'repair';

export interface AgentModelProfile {
  planner?: string;
  vision: string;
  executor?: string;
  repair?: string;
}

export interface PlanStageInput {
  goal: string;
  model: SpatialModel;
  modelName: string;
  instruction?: string;
  image?: string;
  mimeType?: string;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface ExecuteStageInput {
  goal: string;
  plan: TaskPlan;
  step: TaskStep;
  model: SpatialModel;
  modelName: string;
  context: RuntimeContextProjection;
  image?: string;
  mimeType?: string;
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
  modelProfile: AgentModelProfile;
  stableRules?: string[];
  image?: string;
  mimeType?: string;
}

export interface PreparedAgentAttachment {
  image: string;
  mimeType: string;
}

export interface AgentAttachmentPreparer {
  prepare(input: PreparedAgentAttachment & { signal: AbortSignal }): Promise<PreparedAgentAttachment>;
}
