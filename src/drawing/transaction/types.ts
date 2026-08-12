import type { DrawingAssertion, DrawingCommand } from '../command/types';
import type {
  DrawingDocument,
  EvidenceId,
  RevisionId,
} from '../document/types';
import type { DrawingPatch } from '../patch/types';
import type { ValidationReport } from '../validation/types';

export interface Actor {
  type: 'AI' | 'user' | 'system';
  id: string;
}

export interface DrawingLineageRecord {
  sourceIds: string[];
  resultIds: string[];
  operation: 'preserve' | 'transform' | 'split' | 'merge' | 'replace' | 'redraw';
  sourceRanges?: Array<{ nodeId: string; range: [number, number] }>;
  evidenceRefs: EvidenceId[];
}

export interface DrawingTransactionMetadata {
  episodeId: string;
  summary: string;
  confidence?: number;
  lineage?: DrawingLineageRecord[];
  decisionGrantRefs?: string[];
  diagnosticAcknowledgements?: string[];
}

export interface DrawingTransaction {
  id: string;
  baseRevision: RevisionId;
  actor: Actor;
  goalId?: string;
  commands: DrawingCommand[];
  preconditions: DrawingAssertion[];
  postconditions: DrawingAssertion[];
  evidenceRefs: EvidenceId[];
  metadata?: DrawingTransactionMetadata;
}

export interface DrawingError {
  code: string;
  stage: 'revision' | 'precondition' | 'compile' | 'patch' | 'validation' | 'postcondition';
  retryable: boolean;
  nodeIds: string[];
  message: string;
  suggestedAction?: 'requery' | 'repair' | 'replan' | 'pause';
}

export interface GoalOutcomeReport {
  satisfied: boolean;
  assertions: Array<{ assertion: DrawingAssertion; satisfied: boolean }>;
}

export interface TransactionPreview {
  transactionId: string;
  baseRevision: RevisionId;
  patch: DrawingPatch;
  inversePatch: DrawingPatch;
  affectedNodeIds: string[];
  validationReport: ValidationReport;
  outcomeReport: GoalOutcomeReport;
  candidate: boolean;
  metadata?: DrawingTransactionMetadata;
}

export type TransactionResult =
  | { status: 'already_satisfied'; outcome: GoalOutcomeReport }
  | { status: 'rejected'; errors: DrawingError[] }
  | { status: 'ready'; preview: TransactionPreview; resultingDocument: DrawingDocument };

export interface TransactionContext {
  document: DrawingDocument;
  currentRevision: RevisionId;
}
