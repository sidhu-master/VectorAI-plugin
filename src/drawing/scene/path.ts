import type { GeometryNode, Vec2 } from '../document/types';
import type { Bounds2D } from '../query/types';
import type { ScenePathCommand } from './types';

const EPSILON = 1e-10;
const FULL_TURN = Math.PI * 2;

export function compileGeometryPath(
  node: Exclude<GeometryNode, { type: 'point' }>,
  viewBounds?: Bounds2D,
): ScenePathCommand[] {
  switch (node.type) {
    case 'line':
      return [{ op: 'M', point: node.start }, { op: 'L', point: node.end }];
    case 'ray':
    case 'xline': {
      const clipped = viewBounds
        ? clipExtendedLine(node.origin, node.direction, viewBounds, node.type === 'ray')
        : null;
      return clipped
        ? [{ op: 'M', point: clipped[0] }, { op: 'L', point: clipped[1] }]
        : [];
    }
    case 'circle': {
      const start: Vec2 = [node.center[0] + node.radius, node.center[1]];
      return [
        { op: 'M', point: start },
        arcCommand(node.center, node.radius, node.radius, 0, 0, FULL_TURN, true),
      ];
    }
    case 'arc': {
      const start = degreesToRadians(node.startAngle);
      const end = degreesToRadians(node.endAngle);
      return [
        { op: 'M', point: pointOnEllipse(node.center, node.radius, node.radius, 0, start) },
        arcCommand(
          node.center,
          node.radius,
          node.radius,
          0,
          start,
          end,
          node.counterClockwise,
        ),
      ];
    }
    case 'ellipse': {
      const radiusX = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      if (!(radiusX > 0)) return [];
      const radiusY = radiusX * node.ratio;
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]);
      const start = node.startParam ?? 0;
      const end = node.endParam ?? FULL_TURN;
      return [
        { op: 'M', point: pointOnEllipse(node.center, radiusX, radiusY, rotation, start) },
        arcCommand(node.center, radiusX, radiusY, rotation, start, end, true),
      ];
    }
    case 'polyline':
      return compilePolyline(node.vertices, node.closed);
    case 'spline':
      return compileSpline(node.controlPoints, node.closed);
  }
}

function compilePolyline(
  vertices: Extract<GeometryNode, { type: 'polyline' }>['vertices'],
  closed: boolean,
): ScenePathCommand[] {
  if (vertices.length === 0) return [];
  const commands: ScenePathCommand[] = [{ op: 'M', point: vertices[0].point }];
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const first = vertices[index];
    const second = vertices[(index + 1) % vertices.length];
    if (first.bulge && Math.abs(first.bulge) > EPSILON) {
      const arc = bulgeArc(first.point, second.point, first.bulge);
      if (arc) commands.push(arc);
      else commands.push({ op: 'L', point: second.point });
    } else {
      commands.push({ op: 'L', point: second.point });
    }
  }
  if (closed) commands.push({ op: 'Z' });
  return commands;
}

function compileSpline(points: readonly Vec2[], closed: boolean): ScenePathCommand[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ op: 'M', point: points[0] }];
  if (points.length === 2) {
    const commands: ScenePathCommand[] = [
      { op: 'M', point: points[0] },
      { op: 'L', point: points[1] },
    ];
    if (closed) commands.push({ op: 'Z' });
    return commands;
  }
  const commands: ScenePathCommand[] = [{ op: 'M', point: points[0] }];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const end: Vec2 = index === points.length - 2
      ? next
      : [(control[0] + next[0]) / 2, (control[1] + next[1]) / 2];
    commands.push({ op: 'Q', control, end });
  }
  if (closed) commands.push({ op: 'Z' });
  return commands;
}

function bulgeArc(start: Vec2, end: Vec2, bulge: number): Extract<ScenePathCommand, { op: 'A' }> | null {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const chord = Math.hypot(dx, dy);
  if (chord <= EPSILON) return null;
  const midpoint: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const normal: Vec2 = [-dy / chord, dx / chord];
  const offset = chord * (1 - bulge * bulge) / (4 * bulge);
  const center: Vec2 = [midpoint[0] + normal[0] * offset, midpoint[1] + normal[1] * offset];
  const radius = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
  return arcCommand(
    center,
    radius,
    radius,
    0,
    Math.atan2(start[1] - center[1], start[0] - center[0]),
    Math.atan2(end[1] - center[1], end[0] - center[0]),
    bulge > 0,
  );
}

function arcCommand(
  center: Vec2,
  radiusX: number,
  radiusY: number,
  rotation: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean,
): Extract<ScenePathCommand, { op: 'A' }> {
  return {
    op: 'A', center, radiusX, radiusY, rotation,
    startAngle, endAngle, counterClockwise,
  };
}

function pointOnEllipse(
  center: Vec2,
  radiusX: number,
  radiusY: number,
  rotation: number,
  parameter: number,
): Vec2 {
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);
  const x = radiusX * Math.cos(parameter);
  const y = radiusY * Math.sin(parameter);
  return [
    center[0] + x * cosRotation - y * sinRotation,
    center[1] + x * sinRotation + y * cosRotation,
  ];
}

function clipExtendedLine(
  origin: Vec2,
  direction: Vec2,
  bounds: Bounds2D,
  ray: boolean,
): [Vec2, Vec2] | null {
  if (Math.hypot(direction[0], direction[1]) <= EPSILON) return null;
  let minimum = ray ? 0 : Number.NEGATIVE_INFINITY;
  let maximum = Number.POSITIVE_INFINITY;
  const axes = [
    [origin[0], direction[0], bounds.minX, bounds.maxX],
    [origin[1], direction[1], bounds.minY, bounds.maxY],
  ] as const;
  for (const [axisOrigin, axisDirection, low, high] of axes) {
    if (Math.abs(axisDirection) <= EPSILON) {
      if (axisOrigin < low || axisOrigin > high) return null;
      continue;
    }
    const first = (low - axisOrigin) / axisDirection;
    const second = (high - axisOrigin) / axisDirection;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return null;
  }
  return [
    [origin[0] + direction[0] * minimum, origin[1] + direction[1] * minimum],
    [origin[0] + direction[0] * maximum, origin[1] + direction[1] * maximum],
  ];
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}
