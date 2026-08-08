import type {
  DrawingCommit,
  DrawingDocument,
  RevisionId,
} from '../drawing/index';

export interface DrawingWorkspaceSnapshot {
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}
