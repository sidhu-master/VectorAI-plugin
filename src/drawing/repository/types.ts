import type { DrawingCommand } from '../command/types';
import type {
  CommitId,
  DrawingDocument,
  DrawingId,
  EvidenceId,
  RevisionId,
} from '../document/types';
import type { DrawingPatch } from '../patch/types';
import type {
  Actor,
  DrawingError,
  DrawingTransaction,
  DrawingTransactionMetadata,
  GoalOutcomeReport,
} from '../transaction/types';
import type { ValidationReport } from '../validation/types';

export interface DrawingCommit {
  id: CommitId;
  drawingId: DrawingId;
  parentRevision: RevisionId;
  resultingRevision: RevisionId;
  actor: Actor;
  goalId?: string;
  commands: DrawingCommand[];
  patch: DrawingPatch;
  inversePatch: DrawingPatch;
  validationReport: ValidationReport;
  outcomeReport: GoalOutcomeReport;
  evidenceRefs: EvidenceId[];
  metadata?: DrawingTransactionMetadata;
  confidence?: number;
  timestamp: number;
}

export interface DrawingRepositoryState {
  initialDocument: DrawingDocument;
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export interface DrawingRepositorySnapshot extends DrawingRepositoryState {
  schemaVersion: 1;
  contentDigest?: string;
}

export type RepositoryCommitResult =
  | {
      status: 'committed';
      commit: DrawingCommit;
      document: DrawingDocument;
      revision: RevisionId;
    }
  | { status: 'already_satisfied'; outcome: GoalOutcomeReport }
  | { status: 'rejected'; errors: DrawingError[] };

export interface DrawingRepository {
  create(document: DrawingDocument): Promise<{ document: DrawingDocument; revision: RevisionId }>;
  /** Optional checkpoint-only fast path for read projections that do not need Commit history. */
  getCurrentCheckpoint?(
    drawingId: DrawingId,
  ): Promise<{ document: DrawingDocument; revision: RevisionId }>;
  getCurrent(drawingId: DrawingId): Promise<{ document: DrawingDocument; revision: RevisionId }>;
  commit(transaction: DrawingTransaction): Promise<RepositoryCommitResult>;
  revert(input: {
    drawingId: DrawingId;
    commitId: CommitId;
    actor: Actor;
  }): Promise<RepositoryCommitResult>;
  clear(input: {
    drawingId: DrawingId;
    actor: Actor;
  }): Promise<RepositoryCommitResult>;
  listCommits(drawingId: DrawingId): Promise<DrawingCommit[]>;
}
