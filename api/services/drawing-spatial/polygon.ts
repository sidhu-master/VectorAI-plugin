import type { Bounds2D, Vec2 } from '../../../src/drawing/index.js';

const DEFAULT_EPSILON = 1e-9;

export function pointInPolygonRegion(
  point: Vec2,
  contours: readonly (readonly Vec2[])[],
  holes: readonly (readonly Vec2[])[],
  epsilon = DEFAULT_EPSILON,
): boolean {
  const insideOuter = contours.some((polygon) => pointInPolygon(point, polygon, epsilon));
  if (!insideOuter) return false;
  return !holes.some((polygon) => pointInPolygon(point, polygon, epsilon));
}

export function segmentRegionIntersections(
  start: Vec2,
  end: Vec2,
  contours: readonly (readonly Vec2[])[],
  holes: readonly (readonly Vec2[])[],
  epsilon = DEFAULT_EPSILON,
): number[] {
  const values = [...contours, ...holes].flatMap((polygon) => polygonEdges(polygon)
    .flatMap(([edgeStart, edgeEnd]) => segmentIntersectionParameters(
      start,
      end,
      edgeStart,
      edgeEnd,
      epsilon,
    )));
  return uniqueNumbers(values, epsilon).sort((left, right) => left - right);
}

export function polygonRegionBounds(
  contours: readonly (readonly Vec2[])[],
): Bounds2D {
  const points = contours.flatMap((polygon) => [...polygon]);
  if (points.length === 0) throw new Error('POLYGON_REGION_EMPTY');
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

export function boundsIntersect(left: Bounds2D, right: Bounds2D, padding = 0): boolean {
  return left.maxX + padding >= right.minX
    && left.minX - padding <= right.maxX
    && left.maxY + padding >= right.minY
    && left.minY - padding <= right.maxY;
}

function pointInPolygon(point: Vec2, polygon: readonly Vec2[], epsilon: number): boolean {
  if (polygon.length < 3) return false;
  if (polygonEdges(polygon).some(([start, end]) => pointOnSegment(point, start, end, epsilon))) {
    return true;
  }
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1]);
    if (!crosses) continue;
    const x = (previousPoint[0] - currentPoint[0])
      * (point[1] - currentPoint[1])
      / (previousPoint[1] - currentPoint[1])
      + currentPoint[0];
    if (point[0] < x) inside = !inside;
  }
  return inside;
}

function polygonEdges(polygon: readonly Vec2[]): Array<readonly [Vec2, Vec2]> {
  if (polygon.length < 2) return [];
  return polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]] as const);
}

function pointOnSegment(point: Vec2, start: Vec2, end: Vec2, epsilon: number): boolean {
  const cross = (point[0] - start[0]) * (end[1] - start[1])
    - (point[1] - start[1]) * (end[0] - start[0]);
  if (Math.abs(cross) > epsilon * Math.max(1, distance(start, end))) return false;
  const dot = (point[0] - start[0]) * (end[0] - start[0])
    + (point[1] - start[1]) * (end[1] - start[1]);
  const lengthSquared = distanceSquared(start, end);
  return dot >= -epsilon && dot <= lengthSquared + epsilon;
}

function segmentIntersectionParameters(
  start: Vec2,
  end: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2,
  epsilon: number,
): number[] {
  const r: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const s: Vec2 = [edgeEnd[0] - edgeStart[0], edgeEnd[1] - edgeStart[1]];
  const denominator = cross(r, s);
  const delta: Vec2 = [edgeStart[0] - start[0], edgeStart[1] - start[1]];
  if (Math.abs(denominator) <= epsilon) {
    if (Math.abs(cross(delta, r)) > epsilon) return [];
    const lengthSquared = distanceSquared(start, end);
    if (lengthSquared <= epsilon ** 2) return [];
    return [edgeStart, edgeEnd].map((point) => (
      ((point[0] - start[0]) * r[0] + (point[1] - start[1]) * r[1]) / lengthSquared
    )).filter((value) => value >= -epsilon && value <= 1 + epsilon)
      .map((value) => clamp01(value));
  }
  const t = cross(delta, s) / denominator;
  const u = cross(delta, r) / denominator;
  return t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon
    ? [clamp01(t)]
    : [];
}

function uniqueNumbers(values: number[], epsilon: number): number[] {
  return values.reduce<number[]>((result, value) => (
    result.some((candidate) => Math.abs(candidate - value) <= epsilon)
      ? result
      : [...result, value]
  ), []);
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function distanceSquared(left: Vec2, right: Vec2): number {
  return (right[0] - left[0]) ** 2 + (right[1] - left[1]) ** 2;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.sqrt(distanceSquared(left, right));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
