/**
 * 图纸分区（Drawing Partition）共享契约。
 * 分区承载于 Drawing IR 的 feature plane（semanticType = drawing-partition）：
 * 由 AI 结合用户补充信息与图纸中的“台阶”（阶梯状几何/高差变化）特征生成，
 * 用户在画布预览并编辑（拖动顶点、重命名），确认后再触发按分区的自动标注。
 */
import { geometryBounds, type DrawingDocument, type GeometryNode, type SemanticFeature, type Vec2 } from '@/drawing';

export const PARTITION_SEMANTIC_TYPE = 'drawing-partition';
export const PARTITION_ID_PREFIX = 'partition_';
export const MIN_PARTITION_VERTICES = 3;
export const MAX_PARTITION_VERTICES = 24;

/** 分区渲染色板；colorIndex 循环取色 */
export const PARTITION_PALETTE = [
  '#5fa8d3', '#d7ad6d', '#79c7a5', '#b48ee0',
  '#e08f8f', '#8fbfe8', '#cbb972', '#93a8e0',
  '#6fc3b7', '#d8a3c7',
] as const;

export interface DrawingPartition {
  /** feature 节点 ID（partition_<n>） */
  id: string;
  name: string;
  /** 分区依据（台阶特征 / 补充文档中的描述） */
  basis: string;
  /** 世界坐标多边形顶点，按边界顺序排列，隐式闭合 */
  polygon: Vec2[];
  colorIndex: number;
  order: number;
  /** 归属该分区的几何图元 ID */
  geometryIds: string[];
}

export interface PartitionFeatureProperties {
  [key: string]: unknown;
  name: string;
  basis: string;
  polygon: Array<[number, number]>;
  colorIndex: number;
  order: number;
}

export function partitionToFeature(partition: DrawingPartition): SemanticFeature {
  return {
    id: partition.id as SemanticFeature['id'],
    type: 'feature',
    visible: true,
    quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
    semanticType: PARTITION_SEMANTIC_TYPE,
    geometryIds: [...partition.geometryIds] as SemanticFeature['geometryIds'],
    annotationIds: [],
    relationIds: [],
    properties: partitionProperties(partition),
  };
}

export function partitionProperties(
  partition: DrawingPartition,
): PartitionFeatureProperties {
  return {
    name: partition.name,
    basis: partition.basis,
    polygon: partition.polygon.map((point) => [point[0], point[1]]),
    colorIndex: partition.colorIndex,
    order: partition.order,
  };
}

/** 容错读取当前图纸上的全部分区（按 order 排序） */
export function readDrawingPartitions(document: DrawingDocument): DrawingPartition[] {
  const partitions = document.features
    .filter((feature) => feature.semanticType === PARTITION_SEMANTIC_TYPE)
    .map(parsePartitionFeature)
    .filter((partition): partition is DrawingPartition => partition !== null);
  return partitions.sort((left, right) => left.order - right.order);
}

function parsePartitionFeature(feature: SemanticFeature): DrawingPartition | null {
  const properties = feature.properties as Partial<PartitionFeatureProperties> | undefined;
  const polygon = sanitizePartitionPolygon(
    Array.isArray(properties?.polygon) ? properties!.polygon! : [],
  );
  if (!polygon) return null;
  const order = Number.isFinite(properties?.order) ? properties!.order! : 0;
  return {
    id: feature.id,
    name: typeof properties?.name === 'string' && properties.name.trim()
      ? properties.name.trim()
      : '未命名分区',
    basis: typeof properties?.basis === 'string' ? properties.basis : '',
    polygon,
    colorIndex: Number.isInteger(properties?.colorIndex) && properties!.colorIndex! >= 0
      ? properties!.colorIndex! % PARTITION_PALETTE.length
      : 0,
    order,
    geometryIds: [...feature.geometryIds],
  };
}

export function sanitizePartitionPolygon(points: readonly Vec2[]): Vec2[] | null {
  const finite = points.filter((point) => (
    Array.isArray(point)
    && point.length === 2
    && Number.isFinite(point[0])
    && Number.isFinite(point[1])
  ));
  const deduped: Vec2[] = [];
  for (const point of finite) {
    const last = deduped.at(-1);
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) <= 1e-9) continue;
    deduped.push([point[0], point[1]]);
  }
  if (deduped.length >= 2) {
    const first = deduped[0];
    const last = deduped.at(-1)!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-9) deduped.pop();
  }
  if (deduped.length < MIN_PARTITION_VERTICES) return null;
  if (deduped.length <= MAX_PARTITION_VERTICES) return deduped;
  const step = deduped.length / MAX_PARTITION_VERTICES;
  return Array.from({ length: MAX_PARTITION_VERTICES }, (_, index) => {
    const point = deduped[Math.floor(index * step)];
    return [point[0], point[1]] as Vec2;
  });
}

/** 射线法：点是否在多边形内（边界视作内部） */
export function pointInPartition(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const prior = polygon[previous];
    const onEdge = distanceToSegment(point, prior, current) <= 1e-9;
    if (onEdge) return true;
    const intersects = (current[1] > point[1]) !== (prior[1] > point[1])
      && point[0] < ((prior[0] - current[0]) * (point[1] - current[1])) / (prior[1] - current[1]) + current[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

/** 计算归属某多边形的几何图元（以图元包围盒中心判定） */
export function assignPartitionMembers(
  geometry: readonly GeometryNode[],
  polygon: readonly Vec2[],
): string[] {
  return geometry
    .filter((node) => {
      const bounds = geometryBounds(node);
      if (!bounds) return false;
      const center: Vec2 = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
      return pointInPartition(center, polygon);
    })
    .map((node) => node.id);
}

export function partitionPolygonBounds(polygon: readonly Vec2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  return {
    minX: Math.min(...polygon.map((point) => point[0])),
    minY: Math.min(...polygon.map((point) => point[1])),
    maxX: Math.max(...polygon.map((point) => point[0])),
    maxY: Math.max(...polygon.map((point) => point[1])),
  };
}

export function partitionPaletteColor(colorIndex: number): string {
  return PARTITION_PALETTE[((colorIndex % PARTITION_PALETTE.length) + PARTITION_PALETTE.length)
    % PARTITION_PALETTE.length];
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-18) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dy),
  );
}
