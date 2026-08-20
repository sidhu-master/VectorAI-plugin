// SPDX-License-Identifier: Apache-2.0

export interface DrawingRef {
  drawingId: string;
  revision: number;
}

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawingCanvasLine {
  id: string;
  type: 'line';
  start: readonly [number, number];
  end: readonly [number, number];
  status: 'candidate' | 'confirmed';
  confidence?: number;
}

export interface DrawingSourceRaster {
  attachmentId: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  width: number;
  height: number;
  name?: string;
  dataUrl: string;
}

export interface DrawingCanvasProjection {
  version: 1;
  ref: DrawingRef;
  source: DrawingSourceRaster;
  bounds: Bounds2D;
  geometry: DrawingCanvasLine[];
  provisional: boolean;
}

export interface DrawingSummary {
  ref: DrawingRef;
  unit: 'mm' | 'cm' | 'm';
  bounds: Bounds2D;
  geometryByType: Record<string, number>;
  provisional: boolean;
}

export interface DrawingImportResult {
  status: 'imported' | 'already-imported';
  ref: DrawingRef;
  provisional: boolean;
}
