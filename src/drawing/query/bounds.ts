import type { AnnotationNode, GeometryNode, Vec2 } from '../document/types';
import type { Bounds2D } from './types';

const EPSILON = 1e-10;

export function geometryBounds(node: GeometryNode, clip?: Bounds2D): Bounds2D | null {
  switch (node.type) {
    case 'point':
      return boundsFromPoints([[node.x, node.y]]);
    case 'line':
      return boundsFromPoints([node.start, node.end]);
    case 'ray':
      return clipLine(node.origin, node.direction, clip, true);
    case 'xline':
      return clipLine(node.origin, node.direction, clip, false);
    case 'circle':
      return {
        minX: clean(node.center[0] - node.radius),
        minY: clean(node.center[1] - node.radius),
        maxX: clean(node.center[0] + node.radius),
        maxY: clean(node.center[1] + node.radius),
      };
    case 'arc':
      return arcBounds(
        node.center,
        node.radius,
        degreesToRadians(node.startAngle),
        degreesToRadians(node.endAngle),
        node.counterClockwise,
      );
    case 'ellipse':
      return ellipseBounds(node);
    case 'polyline':
      return polylineBounds(node);
    case 'spline':
      return boundsFromPoints(node.controlPoints);
  }
}

export function annotationBounds(node: AnnotationNode): Bounds2D {
  if (node.type === 'dimension') {
    return boundsFromPoints([node.textPosition, ...node.definitionPoints]);
  }

  if (node.type === 'leader') {
    const textOrigin = node.points.at(-1) ?? [0, 0];
    const textWidth = Math.max(node.textHeight * 0.6, node.content.length * node.textHeight * 0.6);
    return unionBounds([
      boundsFromPoints(node.points),
      boundsFromPoints([
        textOrigin,
        [textOrigin[0] + textWidth, textOrigin[1] + node.textHeight],
      ]),
    ])!;
  }

  if (node.type === 'centerline') {
    const dx = node.end[0] - node.start[0];
    const dy = node.end[1] - node.start[1];
    const length = Math.hypot(dx, dy);
    if (!(length > EPSILON)) return boundsFromPoints([node.start]);
    const ux = dx / length;
    const uy = dy / length;
    return boundsFromPoints([
      [node.start[0] - ux * node.extension, node.start[1] - uy * node.extension],
      [node.end[0] + ux * node.extension, node.end[1] + uy * node.extension],
    ]);
  }

  if (node.type === 'section-hatch') {
    return boundsFromPoints(node.segments.flatMap(({ start, end }) => [start, end]));
  }

  const width = node.maxWidth ?? Math.max(node.height * 0.6, node.content.length * node.height * 0.6);
  const left = node.alignment === 'center' ? -width / 2 : node.alignment === 'right' ? -width : 0;
  const bottom = node.verticalAlignment === 'top'
    ? -node.height
    : node.verticalAlignment === 'middle'
      ? -node.height / 2
      : 0;
  const corners: Vec2[] = [
    [left, bottom],
    [left + width, bottom],
    [left + width, bottom + node.height],
    [left, bottom + node.height],
  ];
  const angle = degreesToRadians(node.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return boundsFromPoints(corners.map(([x, y]): Vec2 => [
    node.position[0] + x * cos - y * sin,
    node.position[1] + x * sin + y * cos,
  ]));
}

export function boundsIntersect(first: Bounds2D, second: Bounds2D): boolean {
  return first.minX <= second.maxX
    && first.maxX >= second.minX
    && first.minY <= second.maxY
    && first.maxY >= second.minY;
}

export function unionBounds(items: Bounds2D[]): Bounds2D | undefined {
  if (items.length === 0) return undefined;
  return {
    minX: clean(Math.min(...items.map((item) => item.minX))),
    minY: clean(Math.min(...items.map((item) => item.minY))),
    maxX: clean(Math.max(...items.map((item) => item.maxX))),
    maxY: clean(Math.max(...items.map((item) => item.maxY))),
  };
}

function ellipseBounds(node: Extract<GeometryNode, { type: 'ellipse' }>): Bounds2D {
  const major = node.majorAxis;
  const minor: Vec2 = [-major[1] * node.ratio, major[0] * node.ratio];
  const pointAt = (parameter: number): Vec2 => [
    node.center[0] + major[0] * Math.cos(parameter) + minor[0] * Math.sin(parameter),
    node.center[1] + major[1] * Math.cos(parameter) + minor[1] * Math.sin(parameter),
  ];
  const critical = [
    Math.atan2(minor[0], major[0]),
    Math.atan2(minor[0], major[0]) + Math.PI,
    Math.atan2(minor[1], major[1]),
    Math.atan2(minor[1], major[1]) + Math.PI,
  ];
  if (node.startParam === undefined || node.endParam === undefined) {
    return boundsFromPoints(critical.map(pointAt));
  }
  const candidates = [node.startParam, node.endParam, ...critical.filter((parameter) => (
    angleInSweep(parameter, node.startParam!, node.endParam!, true)
  ))];
  return boundsFromPoints(candidates.map(pointAt));
}

function polylineBounds(node: Extract<GeometryNode, { type: 'polyline' }>): Bounds2D {
  const bounds = node.vertices.map((vertex) => boundsFromPoints([vertex.point]));
  const segmentCount = node.closed ? node.vertices.length : node.vertices.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const first = node.vertices[index];
    const second = node.vertices[(index + 1) % node.vertices.length];
    if (!first.bulge || Math.abs(first.bulge) <= EPSILON) continue;
    bounds.push(bulgeBounds(first.point, second.point, first.bulge));
  }
  return unionBounds(bounds)!;
}

function bulgeBounds(start: Vec2, end: Vec2, bulge: number): Bounds2D {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const chord = Math.hypot(dx, dy);
  if (chord <= EPSILON) return boundsFromPoints([start]);
  const midpoint: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const normal: Vec2 = [-dy / chord, dx / chord];
  const offset = chord * (1 - bulge * bulge) / (4 * bulge);
  const center: Vec2 = [midpoint[0] + normal[0] * offset, midpoint[1] + normal[1] * offset];
  const radius = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
  return arcBounds(
    center,
    radius,
    Math.atan2(start[1] - center[1], start[0] - center[0]),
    Math.atan2(end[1] - center[1], end[0] - center[0]),
    bulge > 0,
  );
}

function arcBounds(
  center: Vec2,
  radius: number,
  start: number,
  end: number,
  counterClockwise: boolean,
): Bounds2D {
  const candidates = [start, end];
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    if (angleInSweep(angle, start, end, counterClockwise)) candidates.push(angle);
  }
  return boundsFromPoints(candidates.map((angle): Vec2 => [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ]));
}

function angleInSweep(angle: number, start: number, end: number, counterClockwise: boolean): boolean {
  const full = Math.PI * 2;
  const normalizedStart = normalizeRadians(start);
  const normalizedEnd = normalizeRadians(end);
  const normalizedAngle = normalizeRadians(angle);
  if (counterClockwise) {
    const sweep = normalizePositive(normalizedEnd - normalizedStart, full);
    const relative = normalizePositive(normalizedAngle - normalizedStart, full);
    return relative <= sweep + EPSILON;
  }
  const sweep = normalizePositive(normalizedStart - normalizedEnd, full);
  const relative = normalizePositive(normalizedStart - normalizedAngle, full);
  return relative <= sweep + EPSILON;
}

function clipLine(
  origin: Vec2,
  direction: Vec2,
  clip: Bounds2D | undefined,
  ray: boolean,
): Bounds2D | null {
  if (!clip) return null;
  let minimum = ray ? 0 : Number.NEGATIVE_INFINITY;
  let maximum = Number.POSITIVE_INFINITY;
  const axes = [
    { origin: origin[0], direction: direction[0], minimum: clip.minX, maximum: clip.maxX },
    { origin: origin[1], direction: direction[1], minimum: clip.minY, maximum: clip.maxY },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.direction) <= EPSILON) {
      if (axis.origin < axis.minimum || axis.origin > axis.maximum) return null;
      continue;
    }
    const first = (axis.minimum - axis.origin) / axis.direction;
    const second = (axis.maximum - axis.origin) / axis.direction;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return null;
  }

  return boundsFromPoints([
    [origin[0] + direction[0] * minimum, origin[1] + direction[1] * minimum],
    [origin[0] + direction[0] * maximum, origin[1] + direction[1] * maximum],
  ]);
}

function boundsFromPoints(points: Vec2[]): Bounds2D {
  return {
    minX: clean(Math.min(...points.map((point) => point[0]))),
    minY: clean(Math.min(...points.map((point) => point[1]))),
    maxX: clean(Math.max(...points.map((point) => point[0]))),
    maxY: clean(Math.max(...points.map((point) => point[1]))),
  };
}

function normalizeRadians(value: number): number {
  return normalizePositive(value, Math.PI * 2);
}

function normalizePositive(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function clean(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Math.abs(rounded) <= EPSILON ? 0 : rounded;
}
