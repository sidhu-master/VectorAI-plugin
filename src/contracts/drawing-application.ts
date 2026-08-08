import type {
  DrawingCommit,
  DrawingDocument,
  DrawingInspectResult,
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

export interface DrawingInspectWorkspaceResult {
  revision: RevisionId;
  result: DrawingInspectResult | null;
}
