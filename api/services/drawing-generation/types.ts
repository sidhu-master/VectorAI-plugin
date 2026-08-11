import type { Vec2 } from '../../../src/drawing/index.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';

export interface DrawingRegionImageEditInput {
  prompt: string;
  cropPng: Buffer;
  maskPng: Buffer;
  protectedMaskPng: Buffer;
  seed: number;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface DrawingRegionImageEditResult {
  png: Buffer;
  providerRequestId: string;
}

/** Replaceable model boundary. The provider can produce pixels, never Drawing IR commands. */
export interface DrawingRegionImageEditProvider {
  edit(input: DrawingRegionImageEditInput): Promise<DrawingRegionImageEditResult>;
}

export interface DrawingRegionRedrawInput extends DrawingRegionImageEditInput {
  cropPixelToWorld: AffineTransform;
  authorizedContours: Vec2[][];
  authorizedHoles: Vec2[][];
  maxPixels: number;
  onStage?: (stage: 'generated' | 'vectorizing') => void;
}
