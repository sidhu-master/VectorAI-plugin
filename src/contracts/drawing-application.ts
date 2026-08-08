import type {
  Bounds2D,
  DrawingCommit,
  DrawingDocument,
  DrawingInspectResult,
  DrawingQueryItem,
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

export interface DrawingDocumentSummary {
  unit: 'mm' | 'cm' | 'm';
  counts: {
    geometry: number;
    annotation: number;
    relation: number;
    feature: number;
  };
  bounds?: Bounds2D;
  items: DrawingQueryItem[];
  truncated: boolean;
}

export interface DrawingSummaryWorkspaceResult {
  revision: RevisionId;
  summary: DrawingDocumentSummary;
}
