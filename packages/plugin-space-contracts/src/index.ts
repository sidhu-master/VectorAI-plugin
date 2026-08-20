// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

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

export const drawingSessionIdSchema = z.string().min(1);

export const drawingCanvasProjectionSchema = z.object({
  version: z.literal(1),
  ref: z.object({
    drawingId: z.string().min(1),
    revision: z.number().int().nonnegative(),
  }),
  source: z.object({
    attachmentId: z.string().min(1),
    mediaType: z.union([
      z.literal('image/png'),
      z.literal('image/jpeg'),
      z.literal('image/webp'),
      z.literal('image/gif'),
    ]),
    width: z.number().positive(),
    height: z.number().positive(),
    name: z.string().optional(),
    dataUrl: z.string().min(1),
  }),
  bounds: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }),
  geometry: z.array(z.object({
    id: z.string().min(1),
    type: z.literal('line'),
    start: z.tuple([z.number(), z.number()]),
    end: z.tuple([z.number(), z.number()]),
    status: z.union([z.literal('candidate'), z.literal('confirmed')]),
    confidence: z.number().optional(),
  })),
  provisional: z.boolean(),
}).nullable();
