import type {
  Actor,
  DrawingCommit,
  DrawingId,
  DrawingInspectResult,
  DrawingQueryResult,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { DrawingDocumentSummary } from '../../../src/contracts/drawing-application.js';
import type {
  AgentDecision,
  DrawingAgentPlan,
} from '../../../src/contracts/drawing-agent.js';

export type DrawingToolCapability =
  | 'query_entities'
  | 'inspect_entity'
  | 'preview_transaction'
  | 'commit_transaction'
  | 'verify_goal';

export interface DrawingToolDefinition {
  capability: DrawingToolCapability;
  version: '1.0.0';
  access: 'read' | 'write';
  caller: 'model' | 'runtime';
  timeoutMs: number;
}

export interface DrawingToolContext {
  runId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  actor: Actor;
  goalId?: string;
}

export type DrawingToolStatus =
  | 'succeeded'
  | 'already_satisfied'
  | 'not_found'
  | 'stale'
  | 'rejected';

export type DrawingToolOutcome =
  | { kind: 'query'; count: number; truncated: boolean }
  | { kind: 'inspect'; found: boolean; relationCount: number; featureCount: number }
  | {
      kind: 'preview';
      candidate: boolean;
      validationValid: boolean;
      goalSatisfied: boolean;
    }
  | { kind: 'commit'; committed: boolean; commitId?: string }
  | { kind: 'verification'; satisfied: boolean; assertionCount: number }
  | { kind: 'error'; codes: string[] };

export interface DrawingToolReceipt {
  toolCallId: string;
  capability: DrawingToolCapability;
  version: '1.0.0';
  access: 'read' | 'write';
  inputDigest: string;
  revisionBefore: RevisionId;
  revisionAfter: RevisionId;
  affectedNodeIds: string[];
  outcome: DrawingToolOutcome;
  durationMs: number;
  status: DrawingToolStatus;
  retry: { allowed: boolean; action?: 'requery' | 'repair' | 'replan' | 'pause' };
}

/** Runtime-only reference. This object is never part of a public progress receipt. */
export interface PreparedDrawingTransaction {
  handle: string;
  runId: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
}

export interface DrawingToolExecution {
  receipt: DrawingToolReceipt;
  output?: DrawingQueryResult | DrawingInspectResult | null;
  prepared?: PreparedDrawingTransaction;
  commit?: DrawingCommit;
}

export interface DrawingToolInvocation {
  capability: DrawingToolCapability;
  caller: 'model' | 'runtime';
  toolCallId: string;
  context: DrawingToolContext;
  input: unknown;
}

export interface DrawingPlannerInput {
  objective: string;
  instruction?: string;
  drawingId: DrawingId;
  revision: RevisionId;
  summary: DrawingDocumentSummary;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface DrawingToolEvidence {
  receipt: DrawingToolReceipt;
  output?: DrawingQueryResult | DrawingInspectResult | null;
}

export interface DrawingDecisionInput {
  plan: DrawingAgentPlan;
  currentWorkflowNodeId: string;
  revision: RevisionId;
  pendingInstructions: string[];
  recentReceipts: DrawingToolReceipt[];
  toolEvidence: DrawingToolEvidence[];
  attempt: number;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface DrawingPlannerModelAdapter {
  plan(input: DrawingPlannerInput): Promise<DrawingAgentPlan>;
}

export interface DrawingDecisionModelAdapter {
  decide(input: DrawingDecisionInput): Promise<AgentDecision>;
}

export interface DrawingAgentModelProfile {
  planner: string;
  decision: string;
  repair: string;
}

export interface StartDrawingAgentRunInput {
  runId: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
  goal: string;
  modelProfile: DrawingAgentModelProfile;
  selectedIds?: string[];
  stableRules?: string[];
}
