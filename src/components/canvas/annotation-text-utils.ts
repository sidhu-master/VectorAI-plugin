import type {
  AnnotationNode,
  Vec2,
} from '@/drawing';
import type { DrawingRenderable } from './geometry';

export interface AnnotationTextHandle {
  id: string;
  position: Vec2;
  width: number;
  height: number;
}

export interface AnnotationTextOffset {
  x: number;
  y: number;
}

export interface AnnotationLabelBounds {
  id: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

function textWidthEstimate(text: string, height: number): number {
  return text.length * Math.max(2, Math.abs(height)) * 0.55;
}

function dimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  const value = node.displayText;
  if (value !== undefined) return value;
  const numericValue = node.observedValue ?? node.computedValue;
  if (numericValue === undefined) return '—';
  const prefix = node.prefix ?? '';
  const suffix = node.suffix ?? '';
  const unit = node.unit ? ` ${node.unit}` : '';
  return `${prefix}${numericValue}${unit}${suffix}`;
}

export function extractAnnotationTextHandles(
  entities: readonly DrawingRenderable[],
): AnnotationTextHandle[] {
  return entities.flatMap((entity): AnnotationTextHandle[] => {
    if (entity.type === 'text') {
      return [{
        id: entity.id,
        position: entity.position,
        width: textWidthEstimate(entity.content, entity.height),
        height: entity.height,
      }];
    }
    if (entity.type === 'dimension') {
      const label = dimensionLabel(entity);
      return [{
        id: entity.id,
        position: entity.textPosition,
        width: textWidthEstimate(label, entity.dimensionKind === 'diameter' ? 8 : 11),
        height: entity.dimensionKind === 'diameter' ? 8 : 11,
      }];
    }
    if (entity.type === 'leader') {
      return [{
        id: entity.id,
        position: entity.points.at(-1) ?? [0, 0],
        width: textWidthEstimate(entity.content, entity.textHeight),
        height: entity.textHeight,
      }];
    }
    return [];
  });
}

export type DimensionAnnotationNode = Extract<AnnotationNode, { type: 'dimension' }>;

const GEOMETRY_TOLERANCE = 1e-9;

function cleanPoint(point: readonly [number, number]): Vec2 {
  const x = Math.round(point[0] * 1e6) / 1e6;
  const y = Math.round(point[1] * 1e6) / 1e6;
  return [Math.abs(x) < GEOMETRY_TOLERANCE ? 0 : x, Math.abs(y) < GEOMETRY_TOLERANCE ? 0 : y];
}

function rescaleFromVertex(vertex: Vec2, point: Vec2, factor: number): Vec2 {
  return cleanPoint([
    vertex[0] + (point[0] - vertex[0]) * factor,
    vertex[1] + (point[1] - vertex[1]) * factor,
  ]);
}

/** 沿顶点->端点射线把延长线伸长到不小于目标半径（只伸长不缩短） */
function extendRay(vertex: Vec2, point: Vec2, radius: number): Vec2 {
  const length = Math.hypot(point[0] - vertex[0], point[1] - vertex[1]);
  if (length <= GEOMETRY_TOLERANCE || length >= radius) return cleanPoint(point);
  return rescaleFromVertex(vertex, point, radius / length);
}

/**
 * 拖动尺寸标注文字后的确定性更新：文字与标注线（箭头）跟随新位置，
 * 而锚定在几何上的定义点（延长线起点、圆心/轮廓点、角度顶点）保持不动。
 */
export function applyDimensionTextDrag(
  node: DimensionAnnotationNode,
  nextTextPosition: Vec2,
): { textPosition: Vec2; definitionPoints: Vec2[] } {
  const text = cleanPoint(nextTextPosition);
  const points = node.definitionPoints;

  if ((node.dimensionKind === 'linear' || node.dimensionKind === 'aligned') && points.length >= 4) {
    const [sourceStart, sourceEnd, measureStart, measureEnd] = points;
    const directionLength = Math.hypot(measureEnd[0] - measureStart[0], measureEnd[1] - measureStart[1]);
    if (directionLength <= GEOMETRY_TOLERANCE) {
      return { textPosition: text, definitionPoints: points.map(cleanPoint) };
    }
    // 标注线保持原方向，平移到穿过文字位置；延长线从固定起点拉伸到新标注线
    const direction: Vec2 = [
      (measureEnd[0] - measureStart[0]) / directionLength,
      (measureEnd[1] - measureStart[1]) / directionLength,
    ];
    const normal: Vec2 = [-direction[1], direction[0]];
    const project = (source: Vec2): Vec2 => {
      const offset = (text[0] - source[0]) * normal[0] + (text[1] - source[1]) * normal[1];
      return cleanPoint([source[0] + normal[0] * offset, source[1] + normal[1] * offset]);
    };
    return {
      textPosition: text,
      definitionPoints: [
        cleanPoint(sourceStart),
        cleanPoint(sourceEnd),
        project(sourceStart),
        project(sourceEnd),
      ],
    };
  }

  if (node.dimensionKind === 'angular' && points.length >= 5) {
    const [vertex, firstExtension, secondExtension, arcStart, arcEnd] = points;
    const radius = Math.hypot(text[0] - vertex[0], text[1] - vertex[1]);
    const firstRadius = Math.hypot(arcStart[0] - vertex[0], arcStart[1] - vertex[1]);
    const secondRadius = Math.hypot(arcEnd[0] - vertex[0], arcEnd[1] - vertex[1]);
    if (radius <= GEOMETRY_TOLERANCE || firstRadius <= GEOMETRY_TOLERANCE || secondRadius <= GEOMETRY_TOLERANCE) {
      return { textPosition: text, definitionPoints: points.map(cleanPoint) };
    }
    // 圆弧半径跟随文字到顶点的距离，箭头随圆弧移动；
    // 延长线沿原射线同步伸长到不小于圆弧半径，保证圆弧始终落在延长线之间
    return {
      textPosition: text,
      definitionPoints: [
        cleanPoint(vertex),
        extendRay(vertex, firstExtension, radius),
        extendRay(vertex, secondExtension, radius),
        rescaleFromVertex(vertex, arcStart, radius / firstRadius),
        rescaleFromVertex(vertex, arcEnd, radius / secondRadius),
      ],
    };
  }

  if (node.dimensionKind === 'radius' && points.length >= 2) {
    // 圆心与轮廓点固定，引线终点跟随文字
    return {
      textPosition: text,
      definitionPoints: [cleanPoint(points[0]), cleanPoint(points[1]), text],
    };
  }

  // 直径等其余类型：定义点全部锚定在几何上，仅移动文字（引线在编译时由 textPosition 推导）
  return { textPosition: text, definitionPoints: points.map(cleanPoint) };
}

function intersects(a: AnnotationLabelBounds, b: AnnotationLabelBounds): boolean {
  return a.xMin <= b.xMax && a.xMax >= b.xMin && a.yMin <= b.yMax && a.yMax >= b.yMin;
}

/** 标签应用避让偏移后的占用边界 */
export function annotationLabelBounds(
  handle: AnnotationTextHandle,
  offset: AnnotationTextOffset = { x: 0, y: 0 },
): AnnotationLabelBounds {
  return {
    id: handle.id,
    xMin: handle.position[0] - handle.width / 2,
    xMax: handle.position[0] + handle.width / 2,
    yMin: handle.position[1] + offset.y - handle.height / 2,
    yMax: handle.position[1] + offset.y + handle.height / 2,
  };
}

function placeHandle(
  handle: AnnotationTextHandle,
  placed: AnnotationLabelBounds[],
): AnnotationTextOffset {
  const step = Math.max(handle.height * 1.08, 0.8);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const yStep = attempt === 0 ? 0 : (Math.ceil(attempt / 2) * step) * (attempt % 2 === 0 ? 1 : -1);
    const candidate = annotationLabelBounds(handle, { x: 0, y: yStep });
    if (!placed.some((item) => intersects(item, candidate))) {
      return { x: 0, y: yStep };
    }
  }
  return { x: 0, y: 0 };
}

/**
 * 只为"新出现"的标签计算避让偏移；已放置标签（placedBounds）位置固定不动，
 * 用于实现"自动避让只在标注首次生成时运行一次"的语义。
 */
export function resolveNewAnnotationTextOffsets(
  pending: AnnotationTextHandle[],
  placedBounds: AnnotationLabelBounds[],
): Record<string, AnnotationTextOffset> {
  const sorted = [...pending].sort((a, b) => (a.position[1] - b.position[1]) || (a.position[0] - b.position[0]));
  const placed = [...placedBounds];
  const offsets: Record<string, AnnotationTextOffset> = {};
  for (const handle of sorted) {
    const offset = placeHandle(handle, placed);
    offsets[handle.id] = offset;
    placed.push(annotationLabelBounds(handle, offset));
  }
  return offsets;
}

export function resolveAnnotationTextOffsets(entities: readonly DrawingRenderable[]): Record<string, AnnotationTextOffset> {
  const handles = extractAnnotationTextHandles(entities)
    .filter((item) => item.width > 0 && item.height > 0);

  if (handles.length === 0) return {};
  return resolveNewAnnotationTextOffsets(handles, []);
}

