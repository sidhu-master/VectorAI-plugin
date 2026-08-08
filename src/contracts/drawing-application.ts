import type {
  DrawingCommit,
  DrawingDocument,
  DrawingQueryResult,
  RevisionId,
} from '../drawing/index';

export interface DrawingWorkspaceSnapshot {
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export interface DrawingQueryWorkspaceResult {
  revision: RevisionId;
  result: DrawingQueryResult;
}
