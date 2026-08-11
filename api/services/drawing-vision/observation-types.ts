import type {
  Bounds2D,
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';
import type { GroundingNode } from './grounding-renderer.js';

export type ObservationViewPurpose = 'overview' | 'target-detail' | 'user-viewport';

export interface ObservationImageReference {
  handle: string;
  mimeType: 'image/png';
}

export interface VisualObservationView {
  id: string;
  purpose: ObservationViewPurpose;
  cacheKey: string;
  image: ObservationImageReference;
  width: number;
  height: number;
  worldBounds: Bounds2D;
  worldToImage: AffineTransform;
  grounding: GroundingNode[];
}

export interface VisualVectorDigest {
  unit: string;
  counts: {
    geometry: number;
    annotation: number;
    relation: number;
    feature: number;
  };
  bounds: Bounds2D | null;
  nodes: Array<{
    id: string;
    type: string;
    bounds: Bounds2D;
  }>;
}

export interface VisualObservation {
  drawingId: DrawingId;
  revision: RevisionId;
  rendererVersion: 'scene-1.0';
  selectedIds: string[];
  vectorDigest: VisualVectorDigest;
  views: VisualObservationView[];
}

export interface AgentObservationViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}
