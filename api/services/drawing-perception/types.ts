import type {
  DimensionAnnotation,
  EntityAnchor,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';

export type NormalizedImageBounds = [x: number, y: number, width: number, height: number];

export type DrawingViewKind = 'primary' | 'section' | 'detail' | 'auxiliary' | 'unknown';

export interface DrawingView {
  id: string;
  kind: DrawingViewKind;
  imageBounds: NormalizedImageBounds;
  confidence: number;
}

export interface DrawingManifest {
  runId: string;
  page: number;
  unit?: 'mm' | 'cm' | 'm';
  scale?: number;
  views: DrawingView[];
  warnings: string[];
}

export type GeometryObservationType = GeometryNode['type'];

export interface GeometryObservation {
  id: string;
  sourceId?: string;
  evidenceRefs?: string[];
  viewId: string;
  type: GeometryObservationType;
  imageBounds: NormalizedImageBounds;
  measuredParams: Record<string, unknown>;
  confidence: number;
}

export interface GlobalContour {
  id: string;
  viewId: string;
  geometryFamily: GeometryObservationType;
  imageBounds: NormalizedImageBounds;
  closed: boolean;
  confidence: number;
  coarseParams?: Record<string, unknown>;
}

export interface ContourEvidence {
  id: string;
  viewId: string;
  globalContourId?: string;
  imageBounds: NormalizedImageBounds;
  samplePoints: Vec2[];
  confidence: number;
  touchesCropEdge: boolean;
}

export interface AnnotationObservation {
  id: string;
  sourceId?: string;
  evidenceRefs?: string[];
  viewId: string;
  kind: DimensionAnnotation['dimensionKind'] | 'text';
  rawText: string;
  value?: number;
  unit?: string;
  tolerance?: DimensionAnnotation['tolerance'];
  imageBounds: NormalizedImageBounds;
  arrowheads: Vec2[];
  confidence: number;
}

export interface DimensionAssociationTarget {
  geometryObservationId: string;
  anchor: EntityAnchor;
}

export interface DimensionAssociation {
  annotationId: string;
  targets: DimensionAssociationTarget[];
  score: number;
  reasons: string[];
  status: 'resolved' | 'ambiguous' | 'conflict';
  candidates?: Array<{
    targets: DimensionAssociationTarget[];
    score: number;
    reasons: string[];
  }>;
}

export interface DrawingRecordValidation {
  valid: boolean;
  errors: string[];
}
