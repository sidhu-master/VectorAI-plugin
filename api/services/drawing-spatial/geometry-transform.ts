import type { GeometryNode, Vec2 } from '../../../src/drawing/index.js';

export type SpatialTransform =
  | { kind: 'translate'; offset: Vec2 }
  | { kind: 'rotate'; center: Vec2; angleDegrees: number }
  | { kind: 'scale'; center: Vec2; factor: number };

export function transformGeometryNode(
  node: GeometryNode,
  transform: SpatialTransform,
): GeometryNode {
  const clone = structuredClone(node);
  const movePoint = (point: Vec2) => transformPoint(point, transform);
  const moveVector = (vector: Vec2) => transformVector(vector, transform);
  switch (clone.type) {
    case 'point': {
      const moved = movePoint([clone.x, clone.y]);
      clone.x = moved[0]; clone.y = moved[1];
      break;
    }
    case 'line': clone.start = movePoint(clone.start); clone.end = movePoint(clone.end); break;
    case 'ray':
    case 'xline':
      clone.origin = movePoint(clone.origin);
      clone.direction = moveVector(clone.direction);
      break;
    case 'circle':
      clone.center = movePoint(clone.center);
      if (transform.kind === 'scale') clone.radius = clean(clone.radius * transform.factor);
      break;
    case 'arc':
      clone.center = movePoint(clone.center);
      if (transform.kind === 'scale') clone.radius = clean(clone.radius * transform.factor);
      if (transform.kind === 'rotate') {
        clone.startAngle = clean(clone.startAngle + transform.angleDegrees);
        clone.endAngle = clean(clone.endAngle + transform.angleDegrees);
      }
      break;
    case 'ellipse':
      clone.center = movePoint(clone.center);
      clone.majorAxis = moveVector(clone.majorAxis);
      break;
    case 'polyline':
      clone.vertices = clone.vertices.map((vertex) => ({ ...vertex, point: movePoint(vertex.point) }));
      break;
    case 'spline': clone.controlPoints = clone.controlPoints.map(movePoint); break;
  }
  return clone;
}

function transformPoint(point: Vec2, transform: SpatialTransform): Vec2 {
  if (transform.kind === 'translate') {
    return [clean(point[0] + transform.offset[0]), clean(point[1] + transform.offset[1])];
  }
  const x = point[0] - transform.center[0];
  const y = point[1] - transform.center[1];
  if (transform.kind === 'scale') {
    return [
      clean(transform.center[0] + x * transform.factor),
      clean(transform.center[1] + y * transform.factor),
    ];
  }
  const radians = transform.angleDegrees * Math.PI / 180;
  return [
    clean(transform.center[0] + x * Math.cos(radians) - y * Math.sin(radians)),
    clean(transform.center[1] + x * Math.sin(radians) + y * Math.cos(radians)),
  ];
}

function transformVector(vector: Vec2, transform: SpatialTransform): Vec2 {
  if (transform.kind === 'translate') return [...vector];
  if (transform.kind === 'scale') {
    return [clean(vector[0] * transform.factor), clean(vector[1] * transform.factor)];
  }
  const radians = transform.angleDegrees * Math.PI / 180;
  return [
    clean(vector[0] * Math.cos(radians) - vector[1] * Math.sin(radians)),
    clean(vector[0] * Math.sin(radians) + vector[1] * Math.cos(radians)),
  ];
}

function clean(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10));
}
