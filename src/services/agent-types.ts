import type { DrawingAgentRunStatus } from '@/contracts/drawing-agent';

export type {
  DrawingAgentPlan,
  DrawingAgentRunView,
  GoalSpec,
  WorkflowNode,
  WorkflowNodeStatus,
} from '@/contracts/drawing-agent';

export type AgentRunWireStatus = DrawingAgentRunStatus;

export type AgentTaskStepStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface AgentTaskStep {
  id: number;
  action: string;
  description: string;
  status: AgentTaskStepStatus;
}

export interface AgentTaskPlan {
  task: string;
  steps: AgentTaskStep[];
  summary: string;
}

export interface AgentStepResult {
  stepId: number;
  success: boolean;
  addedEntities: number;
  modifiedEntities: number;
  errors: string[];
  warnings: string[];
  description: string;
}

/** Presentation-only projection of a legacy Agent run response. */
export interface AgentRunView {
  runId?: string;
  goal?: string;
  status: AgentRunWireStatus;
  plan: AgentTaskPlan | null;
  currentStepIndex: number;
  stepResults?: AgentStepResult[];
  pendingInstructions?: string[];
  activeInstruction?: string;
  needsReplan?: boolean;
}
