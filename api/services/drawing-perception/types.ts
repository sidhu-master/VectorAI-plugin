import type {
  DimensionKind,
  DimensionTolerance,
  EntityAnchor,
  EntityType,
  Vec2,
} from '../../../src/core/types.js';

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

export type GeometryObservationType = Exclude<EntityType, 'text' | 'dimension'>;

export interface GeometryObservation {
  id: string;
  viewId: string;
  type: GeometryObservationType;
  imageBounds: NormalizedImageBounds;
  measuredParams: Record<string, unknown>;
  confidence: number;
}

export interface AnnotationObservation {
  id: string;
  viewId: string;
  kind: DimensionKind | 'text';
  rawText: string;
  value?: number;
  unit?: string;
  tolerance?: DimensionTolerance;
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
