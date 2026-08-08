import type {
  Actor,
  DrawingId,
  DrawingInspectResult,
  DrawingQueryResult,
  RevisionId,
} from '../../../src/drawing/index.js';

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
}

export interface DrawingToolInvocation {
  capability: DrawingToolCapability;
  caller: 'model' | 'runtime';
  toolCallId: string;
  context: DrawingToolContext;
  input: unknown;
}
