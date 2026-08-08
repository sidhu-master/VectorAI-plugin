/**
 * VectorAI Spatial Protocol - 类型定义
 *
 * 三层结构：Semantic Layer -> Spatial Model Layer -> Representation Layer
 */

// ============ 几何实体类型 ============

export type Vec2 = [number, number];

export type EntityType =
  | 'point'
  | 'line'
  | 'ray'
  | 'xline'
  | 'circle'
  | 'arc'
  | 'ellipse'
  | 'polyline'
  | 'spline'
  | 'text'
  | 'dimension';

export interface BaseEntity {
  id: string;
  type: EntityType;
  visible: boolean;
  parentId?: string; // 预留：父实体 ID，支持组织结构
  group?: string; // 预留：分组名称
  confidence?: number; // 实体级置信度，范围 0-1
}

export interface PointEntity extends BaseEntity {
  type: 'point';
  x: number;
  y: number;
}

export interface LineEntity extends BaseEntity {
  type: 'line';
  start: Vec2;
  end: Vec2;
}

export interface RayEntity extends BaseEntity {
  type: 'ray';
  origin: Vec2;
  direction: Vec2;
}

export interface XLineEntity extends BaseEntity {
  type: 'xline';
  origin: Vec2;
  direction: Vec2;
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: Vec2;
  radius: number;
}

export interface ArcEntity extends BaseEntity {
  type: 'arc';
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
}

export interface EllipseEntity extends BaseEntity {
  type: 'ellipse';
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

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  vertices: PolylineVertex[];
  closed: boolean;
}

export interface SplineEntity extends BaseEntity {
  type: 'spline';
  degree: number;
  controlPoints: Vec2[];
  knots: number[];
  weights?: number[];
  closed: boolean;
  periodic: boolean;
}

export interface TextEntity extends BaseEntity {
  type: 'text';
  content: string;
  position: Vec2;
  height: number;
  rotation: number;
  alignment: 'left' | 'center' | 'right';
  verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top';
  maxWidth?: number;
}

export type DimensionKind =
  | 'linear'
  | 'aligned'
  | 'angular'
  | 'radius'
  | 'diameter'
  | 'ordinate'
  | 'arc-length';

export type EntityAnchor =
  | { kind: 'start' | 'end' | 'center' }
  | { kind: 'vertex'; index: number }
  | { kind: 'curve-parameter'; parameter: number }
  | { kind: 'nearest'; point: Vec2 };

export interface DimensionTarget {
  entityId: string;
  anchor: EntityAnchor;
}

export interface DimensionCandidate {
  targets: DimensionTarget[];
  score: number;
  reasons: string[];
}

export interface DimensionTolerance {
  upper?: number;
  lower?: number;
}

export interface DimensionEntity extends BaseEntity {
  type: 'dimension';
  dimensionKind: DimensionKind;
  associationStatus: 'resolved' | 'ambiguous' | 'conflict';
  targets: DimensionTarget[];
  candidates?: DimensionCandidate[];
  observedValue?: number;
  computedValue?: number;
  displayText?: string;
  unit?: 'mm' | 'cm' | 'm' | 'deg';
  tolerance?: DimensionTolerance;
  prefix?: string;
  suffix?: string;
  textPosition: Vec2;
  definitionPoints: Vec2[];
}

export type GeometryEntity =
  | PointEntity
  | LineEntity
  | RayEntity
  | XLineEntity
  | CircleEntity
  | ArcEntity
  | EllipseEntity
  | PolylineEntity
  | SplineEntity
  | TextEntity
  | DimensionEntity;

// ============ 关系类型 ============

export type ConstraintKind =
  | 'coincident'
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'tangent'
  | 'distance'
  | 'radius'
  | 'angle'
  | 'equal'
  | 'symmetry';

// MVP: 所有关系类型均为约束类型
// 未来: RelationKind = ConstraintKind | 'belongs_to' | 'connected_to' | ...
export type RelationKind = ConstraintKind;

export type RelationStatus = 'defined' | 'violated' | 'unsolved';

export interface SpatialRelation {
  id: string;
  kind: RelationKind;
  entities: string[]; // 引用实体 ID
  status: RelationStatus;
  value?: number; // distance / radius / angle 的值
  axis?: 'x' | 'y' | string; // symmetry 的对称轴标识
  property?: string; // equal 的属性名
}

// ============ 语义类型（协议预留） ============

export interface SemanticEntity {
  id: string;
  semanticType: string; // 'hole' | 'bracket' | 'wall' | 'gear' | 'bolt' | ...
  geometryId: string;
  properties?: Record<string, unknown>;
}

// ============ 模型元数据 ============

export interface ModelMetadata {
  unit: 'mm' | 'cm' | 'm';
  createdBy: 'AI' | 'user' | 'system';
  timestamp: number;
  parentId?: string; // 前一版本模型 ID，支持 Undo/History
}

// ============ SpatialModel ============

export interface SpatialModel {
  protocol: 'VectorAI-Spatial';
  version: string;
  metadata: ModelMetadata;
  entities: GeometryEntity[];
  relations: SpatialRelation[];
  semanticEntities?: SemanticEntity[];
}

// ============ Spatial Intent（LLM 输出中间表示） ============

export type IntentOperation = 'create' | 'modify' | 'replace';

export interface IntentObject {
  type: EntityType;
  params: Record<string, unknown>; // 宽松参数，编译器规范化
  reference?: string; // 可选名称，供关系引用
  id?: string; // modify 操作时：指定要修改的实体 ID
  confidence?: number; // 实体级置信度（感知路径用，0-1）
}

export interface IntentRelation {
  kind: RelationKind;
  entities: (number | string)[];
  value?: number;
  axis?: string;
  property?: string;
}

export interface SpatialIntent {
  operation?: IntentOperation; // 默认 'create'
  objects: IntentObject[];
  relations?: IntentRelation[];
  description?: string;
  confidence?: number;
}

// ============ 验证结果 ============

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============ RepresentationAdapter 接口 ============

export interface RepresentationAdapter {
  format: string;
  represent(model: SpatialModel): string;
}

// ============ 常量 ============

export const PROTOCOL_NAME = 'VectorAI-Spatial';
export const PROTOCOL_VERSION = '0.2';

// 关系类型所需的最少实体数量
export const RELATION_MIN_ENTITIES: Record<ConstraintKind, number> = {
  coincident: 2,
  horizontal: 1,
  vertical: 1,
  parallel: 2,
  perpendicular: 2,
  tangent: 2,
  distance: 2,
  radius: 1,
  angle: 2,
  equal: 2,
  symmetry: 2,
};
