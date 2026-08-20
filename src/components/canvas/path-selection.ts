import { compileDrawingNode, type GeometryNode, type ScenePathCommand, type Vec2 } from '@/drawing';
import type { BBox, DrawingRenderable } from './geometry';

const EPSILON = 1e-9;
const FULL_TURN = Math.PI * 2;

export function selectGeometryIdsInBox(
  entities: readonly DrawingRenderable[],
  box: BBox,
  viewBounds: BBox,
): string[] {
  return entities
    .filter((entity): entity is GeometryNode => (
      entity.type !== 'text'
      && entity.type !== 'dimension'
      && entity.type !== 'leader'
      && entity.type !== 'centerline'
      && entity.type !== 'section-hatch'
    ))
    .filter((entity) => entity.visible && geometryIntersectsSelectionBox(entity, box, viewBounds))
    .map((entity) => entity.id);
}

export function geometryIntersectsSelectionBox(
  entity: GeometryNode,
  box: BBox,
  viewBounds: BBox,
): boolean {
  if (entity.type === 'point') return pointInBox([entity.x, entity.y], box);
  const primitives = compileDrawingNode(entity, { viewBounds });
  const tolerance = Math.max(
    Math.hypot(viewBounds.maxX - viewBounds.minX, viewBounds.maxY - viewBounds.minY) * 0.0001,
    Math.min(box.maxX - box.minX, box.maxY - box.minY) * 0.025,
    EPSILON,
  );
  return primitives.some((primitive) => (
    primitive.kind === 'path'
    && pathIntersectsBox(primitive.commands, box, tolerance)
  ));
}

function pathIntersectsBox(commands: readonly ScenePathCommand[], box: BBox, tolerance: number): boolean {
  let current: Vec2 | null = null;
  let subpathStart: Vec2 | null = null;
  for (const command of commands) {
    if (command.op === 'M') {
      current = command.point;
      subpathStart = command.point;
      if (pointInBox(current, box)) return true;
      continue;
    }
    if (command.op === 'L') {
      if (current && segmentIntersectsBox(current, command.point, box)) return true;
      current = command.point;
      continue;
    }
    if (command.op === 'Q') {
      if (!current) continue;
      const flattened = flattenQuadratic(current, command.control, command.end, tolerance);
      if (polylineIntersectsBox(flattened, box)) return true;
      current = command.end;
      continue;
    }
    if (command.op === 'A') {
      const flattened = flattenArc(command, tolerance);
      if (polylineIntersectsBox(flattened, box)) return true;
      current = flattened.at(-1) ?? current;
      continue;
    }
    if (command.op === 'Z' && current && subpathStart) {
      if (segmentIntersectsBox(current, subpathStart, box)) return true;
      current = subpathStart;
    }
  }
  return false;
}

function polylineIntersectsBox(points: readonly Vec2[], box: BBox): boolean {
  if (points.some((point) => pointInBox(point, box))) return true;
  for (let index = 1; index < points.length; index += 1) {
    if (segmentIntersectsBox(points[index - 1], points[index], box)) return true;
  }
  return false;
}

function flattenArc(
  command: Extract<ScenePathCommand, { op: 'A' }>,
  tolerance: number,
): Vec2[] {
  const rawSpan = command.endAngle - command.startAngle;
  const full = Math.abs(rawSpan) >= FULL_TURN - EPSILON;
  const span = full
    ? (command.counterClockwise ? FULL_TURN : -FULL_TURN)
    : directedSpan(command.startAngle, command.endAngle, command.counterClockwise);
  const maximumRadius = Math.max(command.radiusX, command.radiusY, EPSILON);
  const chordStep = tolerance >= maximumRadius
    ? Math.PI / 6
    : 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / maximumRadius)));
  const maximumStep = Math.PI / 18;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / Math.max(EPSILON, Math.min(maximumStep, chordStep))));
  return Array.from({ length: steps + 1 }, (_unused, index) => (
    ellipsePoint(command, command.startAngle + span * index / steps)
  ));
}

function flattenQuadratic(start: Vec2, control: Vec2, end: Vec2, tolerance: number): Vec2[] {
  const points: Vec2[] = [start];
  appendQuadratic(points, start, control, end, tolerance, 0);
  return points;
}

function appendQuadratic(
  output: Vec2[], start: Vec2, control: Vec2, end: Vec2, tolerance: number, depth: number,
): void {
  const flatness = distanceToLine(control, start, end);
  if (flatness <= tolerance || depth >= 12) {
    output.push(end);
    return;
  }
  const startControl = midpoint(start, control);
  const controlEnd = midpoint(control, end);
  const middle = midpoint(startControl, controlEnd);
  appendQuadratic(output, start, startControl, middle, tolerance, depth + 1);
  appendQuadratic(output, middle, controlEnd, end, tolerance, depth + 1);
}

function segmentIntersectsBox(start: Vec2, end: Vec2, box: BBox): boolean {
  if (pointInBox(start, box) || pointInBox(end, box)) return true;
  const corners: Vec2[] = [
    [box.minX, box.minY], [box.maxX, box.minY],
    [box.maxX, box.maxY], [box.minX, box.maxY],
  ];
  return corners.some((corner, index) => segmentsIntersect(
    start, end, corner, corners[(index + 1) % corners.length],
  ));
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON))
    && ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))) return true;
  return (Math.abs(abC) <= EPSILON && pointOnSegment(c, a, b))
    || (Math.abs(abD) <= EPSILON && pointOnSegment(d, a, b))
    || (Math.abs(cdA) <= EPSILON && pointOnSegment(a, c, d))
    || (Math.abs(cdB) <= EPSILON && pointOnSegment(b, c, d));
}

function pointInBox([x, y]: Vec2, box: BBox): boolean {
  return x >= box.minX - EPSILON && x <= box.maxX + EPSILON
    && y >= box.minY - EPSILON && y <= box.maxY + EPSILON;
}

function pointOnSegment([x, y]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): boolean {
  return x >= Math.min(ax, bx) - EPSILON && x <= Math.max(ax, bx) + EPSILON
    && y >= Math.min(ay, by) - EPSILON && y <= Math.max(ay, by) + EPSILON;
}

function orientation(a: Vec2, b: Vec2, c: Vec2): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function directedSpan(start: number, end: number, counterClockwise: boolean): number {
  const positive = ((end - start) % FULL_TURN + FULL_TURN) % FULL_TURN;
  return counterClockwise ? positive : positive - FULL_TURN;
}

function ellipsePoint(command: Extract<ScenePathCommand, { op: 'A' }>, parameter: number): Vec2 {
  const cosRotation = Math.cos(command.rotation);
  const sinRotation = Math.sin(command.rotation);
  const x = command.radiusX * Math.cos(parameter);
  const y = command.radiusY * Math.sin(parameter);
  return [
    command.center[0] + x * cosRotation - y * sinRotation,
    command.center[1] + x * sinRotation + y * cosRotation,
  ];
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function distanceToLine(point: Vec2, start: Vec2, end: Vec2): number {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  return length <= EPSILON
    ? Math.hypot(point[0] - start[0], point[1] - start[1])
    : Math.abs(orientation(start, end, point)) / length;
}
