import type { GeometryNode, Vec2 } from '../../../src/drawing/index.js';
import type { SpatialTransform } from './geometry-transform.js';

export interface AnchoredDeformationContext {
  anchors: Vec2[];
  targetGeometry: GeometryNode[];
  tolerance: number;
}

export function applyAnchoredDeformation(
  node: GeometryNode,
  transform: SpatialTransform,
  context: AnchoredDeformationContext,
): GeometryNode {
  const clone = structuredClone(node);
  // 每个可编辑图元分别从固定接口归一化到自由端，避免同一选择中更远的
  // 图元放大全局距离上限，并保证相邻目标图元在共享端点处使用一致变换。
  const influence = deformationInfluence({ ...context, targetGeometry: [node] });
  const movePoint = (point: Vec2): Vec2 => {
    const weight = influence(point);
    if (weight === 0) return [...point];
    const moved = transformPoint(point, transform);
    return blendPoint(point, moved, weight);
  };
  const moveVector = (origin: Vec2, vector: Vec2): Vec2 => {
    const weight = influence(origin);
    if (weight === 0 || transform.kind === 'translate') return [...vector];
    return blendPoint(vector, transformVector(vector, transform), weight);
  };

  switch (clone.type) {
    case 'point': {
      const moved = movePoint([clone.x, clone.y]);
      clone.x = moved[0];
      clone.y = moved[1];
      break;
    }
    case 'line':
      clone.start = movePoint(clone.start);
      clone.end = movePoint(clone.end);
      break;
    case 'ray':
    case 'xline': {
      const origin = clone.origin;
      clone.origin = movePoint(origin);
      clone.direction = moveVector(origin, clone.direction);
      break;
    }
    case 'circle': {
      const center = clone.center;
      const weight = influence(center);
      clone.center = movePoint(center);
      if (transform.kind === 'scale') {
        clone.radius = clean(clone.radius * blend(1, transform.factor, weight));
      }
      break;
    }
    case 'arc': {
      const center = clone.center;
      const weight = influence(center);
      clone.center = movePoint(center);
      if (transform.kind === 'scale') {
        clone.radius = clean(clone.radius * blend(1, transform.factor, weight));
      }
      if (transform.kind === 'rotate') {
        clone.startAngle = clean(clone.startAngle + transform.angleDegrees * weight);
        clone.endAngle = clean(clone.endAngle + transform.angleDegrees * weight);
      }
      break;
    }
    case 'ellipse': {
      const center = clone.center;
      clone.center = movePoint(center);
      clone.majorAxis = moveVector(center, clone.majorAxis);
      break;
    }
    case 'polyline':
      clone.vertices = clone.vertices.map((vertex) => ({ point: movePoint(vertex.point) }));
      break;
    case 'spline':
      clone.controlPoints = clone.controlPoints.map(movePoint);
      break;
  }
  return clone;
}

export function transformMovesAnyAnchor(
  transform: SpatialTransform,
  anchors: Vec2[],
  tolerance: number,
): boolean {
  return anchors.some((anchor) => distance(anchor, transformPoint(anchor, transform)) > tolerance);
}

function deformationInfluence(context: AnchoredDeformationContext): (point: Vec2) => number {
  if (context.anchors.length === 0) return () => 1;
  const points = context.targetGeometry.flatMap(geometryControlPoints);
  const maxDistance = Math.max(
    ...points.map((point) => distanceToClosestAnchor(point, context.anchors)),
    context.tolerance,
  );
  return (point) => {
    const distanceToAnchor = distanceToClosestAnchor(point, context.anchors);
    if (distanceToAnchor <= context.tolerance) return 0;
    if (maxDistance <= context.tolerance) return 0;
    const normalized = Math.max(0, Math.min(1, (
      (distanceToAnchor - context.tolerance) / (maxDistance - context.tolerance)
    )));
    return normalized * normalized * (3 - 2 * normalized);
  };
}

function geometryControlPoints(node: GeometryNode): Vec2[] {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'ray':
    case 'xline': return [node.origin];
    case 'circle':
    case 'arc':
    case 'ellipse': return [node.center];
    case 'polyline': return node.vertices.map((vertex) => vertex.point);
    case 'spline': return [...node.controlPoints];
  }
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

function distanceToClosestAnchor(point: Vec2, anchors: Vec2[]): number {
  return Math.min(...anchors.map((anchor) => distance(point, anchor)));
}

function blendPoint(start: Vec2, end: Vec2, weight: number): Vec2 {
  return [clean(blend(start[0], end[0], weight)), clean(blend(start[1], end[1], weight))];
}

function blend(start: number, end: number, weight: number): number {
  return start + (end - start) * weight;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function clean(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10));
}
