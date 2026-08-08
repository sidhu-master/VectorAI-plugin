import type { AnnotationNode, GeometryNode, Vec2 } from '@/drawing';

export type DrawingRenderable = GeometryNode | AnnotationNode;

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const CARDINAL_ANGLES = [0, 90, 180, 270];

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function finitePoint(point: Vec2): boolean {
  return finite(point[0]) && finite(point[1]);
}

function boundsFromPoints(points: readonly Vec2[]): BBox | null {
  if (points.length === 0 || points.some((point) => !finitePoint(point))) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function angleOnArc(angle: number, start: number, end: number, counterClockwise: boolean): boolean {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  if (counterClockwise) {
    const span = (normalizedEnd - normalizedStart + 360) % 360;
    const offset = (normalizedAngle - normalizedStart + 360) % 360;
    return offset <= span;
  }
  const span = (normalizedStart - normalizedEnd + 360) % 360;
  const offset = (normalizedStart - normalizedAngle + 360) % 360;
  return offset <= span;
}

function arcPoint(center: Vec2, radius: number, angle: number): Vec2 {
  const radians = angle * Math.PI / 180;
  return [center[0] + Math.cos(radians) * radius, center[1] + Math.sin(radians) * radius];
}

function rotatedTextBounds(entity: Extract<DrawingRenderable, { type: 'text' }>): BBox | null {
  const width = entity.maxWidth ?? entity.content.length * entity.height * 0.6;
  if (!finitePoint(entity.position) || !finite(entity.height) || !finite(width) || !finite(entity.rotation)) {
    return null;
  }
  const localMinX = entity.alignment === 'center' ? -width / 2 : entity.alignment === 'right' ? -width : 0;
  const localMaxX = localMinX + width;
  const localMinY = entity.verticalAlignment === 'top'
    ? -entity.height
    : entity.verticalAlignment === 'middle'
      ? -entity.height / 2
      : entity.verticalAlignment === 'bottom'
        ? 0
        : -entity.height;
  const localMaxY = localMinY + entity.height;
  const radians = entity.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners: Vec2[] = [
    [localMinX, localMinY], [localMaxX, localMinY],
    [localMaxX, localMaxY], [localMinX, localMaxY],
  ].map(([x, y]) => [
    entity.position[0] + x * cos - y * sin,
    entity.position[1] + x * sin + y * cos,
  ]);
  return boundsFromPoints(corners);
}

export function entityBounds(entity: DrawingRenderable): BBox | null {
  switch (entity.type) {
    case 'point':
      return boundsFromPoints([[entity.x, entity.y]]);
    case 'line':
      return boundsFromPoints([entity.start, entity.end]);
    case 'ray':
    case 'xline':
      return null;
    case 'circle':
      if (!finitePoint(entity.center) || !finite(entity.radius) || entity.radius < 0) return null;
      return {
        minX: entity.center[0] - entity.radius,
        minY: entity.center[1] - entity.radius,
        maxX: entity.center[0] + entity.radius,
        maxY: entity.center[1] + entity.radius,
      };
    case 'arc': {
      if (!finitePoint(entity.center) || !finite(entity.radius) || entity.radius < 0
        || !finite(entity.startAngle) || !finite(entity.endAngle)) return null;
      const angles = [entity.startAngle, entity.endAngle, ...CARDINAL_ANGLES.filter((angle) => (
        angleOnArc(angle, entity.startAngle, entity.endAngle, entity.counterClockwise)
      ))];
      return boundsFromPoints(angles.map((angle) => arcPoint(entity.center, entity.radius, angle)));
    }
    case 'ellipse': {
      if (!finitePoint(entity.center) || !finitePoint(entity.majorAxis)
        || !finite(entity.ratio) || entity.ratio <= 0) return null;
      const [axisX, axisY] = entity.majorAxis;
      const majorRadius = Math.hypot(axisX, axisY);
      if (majorRadius === 0) return null;
      const minorRadius = majorRadius * entity.ratio;
      const minorX = -axisY / majorRadius * minorRadius;
      const minorY = axisX / majorRadius * minorRadius;
      const extentX = Math.hypot(axisX, minorX);
      const extentY = Math.hypot(axisY, minorY);
      return {
        minX: entity.center[0] - extentX,
        minY: entity.center[1] - extentY,
        maxX: entity.center[0] + extentX,
        maxY: entity.center[1] + extentY,
      };
    }
    case 'polyline':
      return boundsFromPoints(entity.vertices.map((vertex) => vertex.point));
    case 'spline':
      return boundsFromPoints(entity.controlPoints);
    case 'text':
      return rotatedTextBounds(entity);
    case 'dimension':
      return boundsFromPoints([...entity.definitionPoints, entity.textPosition]);
  }
}

export function modelBounds(entities: readonly DrawingRenderable[]): BBox | null {
  const finiteBounds = entities
    .filter((entity) => entity.visible)
    .map(entityBounds)
    .filter((bounds): bounds is BBox => bounds !== null);
  if (finiteBounds.length === 0) return null;
  return finiteBounds.reduce((combined, bounds) => ({
    minX: Math.min(combined.minX, bounds.minX),
    minY: Math.min(combined.minY, bounds.minY),
    maxX: Math.max(combined.maxX, bounds.maxX),
    maxY: Math.max(combined.maxY, bounds.maxY),
  }));
}

export function entityCenter(entity: DrawingRenderable): Vec2 | null {
  if (entity.type === 'ray' || entity.type === 'xline') {
    return finitePoint(entity.origin) ? entity.origin : null;
  }
  const bounds = entityBounds(entity);
  return bounds
    ? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]
    : null;
}

export function aabbIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
