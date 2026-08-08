import type {
  AnnotationNode,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
} from '../document/types';

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawingSelector {
  plane?: 'geometry' | 'annotation' | 'relation' | 'feature';
  ids?: string[];
  types?: string[];
  qualityStatus?: 'confirmed' | 'candidate';
  bounds?: Bounds2D;
  relationKind?: string;
  limit?: number;
}

export interface DrawingQueryItem {
  id: string;
  plane: DrawingSelector['plane'];
  type: string;
  summary: string;
  bounds?: Bounds2D;
}

export interface DrawingQueryResult {
  items: DrawingQueryItem[];
  truncated: boolean;
}

export type DrawingNode = GeometryNode | AnnotationNode | DrawingRelation | SemanticFeature;

export interface DrawingInspectResult {
  node: DrawingNode;
  relations: DrawingRelation[];
  features: SemanticFeature[];
  bounds?: Bounds2D;
}
