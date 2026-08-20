export type DrawingId = string & { readonly __brand: 'DrawingId' };
export type GeometryId = string & { readonly __brand: 'GeometryId' };
export type AnnotationId = string & { readonly __brand: 'AnnotationId' };
export type RelationId = string & { readonly __brand: 'RelationId' };
export type FeatureId = string & { readonly __brand: 'FeatureId' };
export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export type RevisionId = string & { readonly __brand: 'RevisionId' };
export type CommitId = string & { readonly __brand: 'CommitId' };

export type Vec2 = readonly [number, number];

export interface NodeQuality {
  status: 'confirmed' | 'candidate';
  confidence?: number;
  evidenceRefs: EvidenceId[];
}

export interface BaseNode<TId extends string, TType extends string> {
  id: TId;
  type: TType;
  visible: boolean;
  quality: NodeQuality;
}

export interface PointGeometry extends BaseNode<GeometryId, 'point'> {
  x: number;
  y: number;
}

export interface LineGeometry extends BaseNode<GeometryId, 'line'> {
  start: Vec2;
  end: Vec2;
}

export interface RayGeometry extends BaseNode<GeometryId, 'ray'> {
  origin: Vec2;
  direction: Vec2;
}

export interface XLineGeometry extends BaseNode<GeometryId, 'xline'> {
  origin: Vec2;
  direction: Vec2;
}

export interface CircleGeometry extends BaseNode<GeometryId, 'circle'> {
  center: Vec2;
  radius: number;
}

export interface ArcGeometry extends BaseNode<GeometryId, 'arc'> {
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
}

export interface EllipseGeometry extends BaseNode<GeometryId, 'ellipse'> {
  center: Vec2;
  majorAxis: Vec2;
  ratio: number;
  startParam?: number;
  endParam?: number;
}

export interface PolylineVertex {
  point: Vec2;
  bulge?: number;
}

export interface PolylineGeometry extends BaseNode<GeometryId, 'polyline'> {
  vertices: PolylineVertex[];
  closed: boolean;
}

export interface SplineGeometry extends BaseNode<GeometryId, 'spline'> {
  degree: number;
  controlPoints: Vec2[];
  knots: number[];
  weights?: number[];
  closed: boolean;
  periodic: boolean;
}

export type GeometryNode =
  | PointGeometry
  | LineGeometry
  | RayGeometry
  | XLineGeometry
  | CircleGeometry
  | ArcGeometry
  | EllipseGeometry
  | PolylineGeometry
  | SplineGeometry;

export type EntityAnchor =
  | { kind: 'start' | 'end' | 'center' }
  | { kind: 'vertex'; index: number }
  | { kind: 'curve-parameter'; parameter: number }
  | { kind: 'nearest'; point: Vec2 };

export interface DimensionTarget {
  geometryId: GeometryId;
  anchor: EntityAnchor;
}

export interface DimensionCandidate {
  targets: DimensionTarget[];
  score: number;
  reasons: string[];
}

export interface TextAnnotation extends BaseNode<AnnotationId, 'text'> {
  content: string;
  position: Vec2;
  height: number;
  rotation: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top';
  maxWidth?: number;
}

export interface DimensionAnnotation extends BaseNode<AnnotationId, 'dimension'> {
  dimensionKind:
    | 'linear'
    | 'aligned'
    | 'angular'
    | 'radius'
    | 'diameter'
    | 'ordinate'
    | 'arc-length';
  associationStatus: 'resolved' | 'ambiguous' | 'conflict';
  targets: DimensionTarget[];
  candidates?: DimensionCandidate[];
  observedValue?: number;
  computedValue?: number;
  displayText?: string;
  unit?: 'mm' | 'cm' | 'm' | 'deg';
  tolerance?: { upper?: number; lower?: number };
  prefix?: string;
  suffix?: string;
  textPosition: Vec2;
  definitionPoints: Vec2[];
}

export interface LeaderAnnotation extends BaseNode<AnnotationId, 'leader'> {
  target: DimensionTarget;
  points: Vec2[];
  content: string;
  textHeight: number;
}

export interface CenterlineAnnotation extends BaseNode<AnnotationId, 'centerline'> {
  targets: GeometryId[];
  start: Vec2;
  end: Vec2;
  extension: number;
}

export interface SectionHatchSegment {
  start: Vec2;
  end: Vec2;
}

/** A grouped, display-only projection of a real DXF hatch boundary/pattern. */
export interface SectionHatchAnnotation extends BaseNode<AnnotationId, 'section-hatch'> {
  pattern: string;
  angle: number;
  spacing: number;
  segments: SectionHatchSegment[];
}

export type AnnotationNode =
  | TextAnnotation
  | DimensionAnnotation
  | LeaderAnnotation
  | CenterlineAnnotation
  | SectionHatchAnnotation;

export interface TopologyRelation extends BaseNode<RelationId, 'topology'> {
  plane: 'topology';
  kind: 'connected' | 'closed' | 'contains' | 'intersects';
  nodeIds: string[];
}

export interface ConstraintRelation extends BaseNode<RelationId, 'constraint'> {
  plane: 'constraint';
  kind:
    | 'horizontal'
    | 'vertical'
    | 'parallel'
    | 'perpendicular'
    | 'tangent'
    | 'concentric'
    | 'equal'
    | 'distance'
    | 'radius'
    | 'angle'
    | 'symmetry';
  geometryIds: GeometryId[];
  value?: number;
  property?: string;
  status: 'defined' | 'satisfied' | 'violated' | 'unsolved';
}

export interface AssociationRelation extends BaseNode<RelationId, 'association'> {
  plane: 'association';
  kind: 'annotation-target';
  annotationId: AnnotationId;
  geometryIds: GeometryId[];
}

export interface SemanticRelation extends BaseNode<RelationId, 'semantic'> {
  plane: 'semantic';
  kind: 'feature-member';
  featureId: FeatureId;
  nodeIds: string[];
}

export type DrawingRelation =
  | TopologyRelation
  | ConstraintRelation
  | AssociationRelation
  | SemanticRelation;

export interface SemanticFeature extends BaseNode<FeatureId, 'feature'> {
  semanticType: string;
  geometryIds: GeometryId[];
  annotationIds: AnnotationId[];
  relationIds: RelationId[];
  properties: Record<string, unknown>;
}

export interface CoordinateFrame {
  id: string;
  kind: 'document' | 'source' | 'page' | 'view' | 'provisional';
  transform: readonly [number, number, number, number, number, number];
  parentId?: string;
}

export interface DrawingDocument {
  protocol: 'VectorAI-Drawing';
  schemaVersion: '1.0';
  id: DrawingId;
  metadata: {
    createdAt: number;
    updatedAt: number;
  };
  unitSystem: {
    length: 'mm' | 'cm' | 'm';
    angle: 'deg';
  };
  coordinateFrames: CoordinateFrame[];
  geometry: GeometryNode[];
  annotations: AnnotationNode[];
  relations: DrawingRelation[];
  features: SemanticFeature[];
}
