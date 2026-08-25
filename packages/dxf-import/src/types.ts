// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';

export interface DxfPair {
  code: number;
  value: string;
  line: number;
}

export interface DxfImportDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  line?: number;
  sourceHandle?: string;
}

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DxfImportRequest {
  bytes: Uint8Array;
  source: { name?: string; digest: string };
  drawingId: string;
  now?: () => number;
}

export type DxfImportResult =
  | {
    status: 'imported';
    document: DrawingDocument;
    bounds: Bounds2D;
    diagnostics: DxfImportDiagnostic[];
    counts: Record<string, number>;
  }
  | { status: 'rejected'; diagnostics: DxfImportDiagnostic[] };
