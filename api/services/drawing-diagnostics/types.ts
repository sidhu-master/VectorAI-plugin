import type {
  DrawingDocument,
  DrawingTransaction,
  Vec2,
} from '../../../src/drawing/index.js';

export type DrawingDiagnosticSeverity =
  | 'info'
  | 'warning'
  | 'candidate'
  | 'decision_required';

export interface DrawingDiagnostic {
  code: string;
  severity: DrawingDiagnosticSeverity;
  message: string;
  nodeIds: string[];
  action?: string;
  facts?: Record<string, unknown>;
}

export interface DrawingDiagnosticReport {
  hardValid: boolean;
  diagnostics: DrawingDiagnostic[];
  changedNodeIds: string[];
  unexpectedDanglingEndpoints: Vec2[];
}

export interface EvaluateDrawingPreviewInput {
  before: DrawingDocument;
  after: DrawingDocument;
  transaction: DrawingTransaction;
  tolerance: number;
}
