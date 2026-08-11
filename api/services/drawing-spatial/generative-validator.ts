import type {
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import { roughGeometryBounds, sampleGeometryRanges } from './geometry-sampling.js';
import { pointInPolygonRegion } from './polygon.js';

export interface GenerativeValidationIssue {
  code: string;
  message: string;
  nodeIds: string[];
}

export interface GenerativeValidationReport {
  valid: boolean;
  issues: GenerativeValidationIssue[];
  connectedAnchorIds: string[];
}

export function validateGenerativeGeometry(input: {
  geometry: GeometryNode[];
  protectedGeometry: GeometryNode[];
  contours: readonly (readonly Vec2[])[];
  holes: readonly (readonly Vec2[])[];
  boundaryAnchors: Array<{ id: string; point: Vec2 }>;
  tolerance: number;
}): GenerativeValidationReport {
  const issues: GenerativeValidationIssue[] = [];
  if (input.geometry.length === 0) {
    issues.push(issue('GENERATED_GEOMETRY_EMPTY', '局部重绘没有产生可编辑几何'));
  }
  const generatedSamples = input.geometry.map((node) => ({ node, points: sampleNode(node) }));
  for (const { node, points } of generatedSamples) {
    if (points.length === 0 || points.some((point) => !pointInPolygonRegion(
      point, input.contours, input.holes, input.tolerance,
    ))) {
      issues.push(issue('GENERATED_OUTSIDE_REGION', '生成图元越出授权语义区域', [node.id]));
    }
  }
  const protectedSamples = input.protectedGeometry.map((node) => ({ node, points: sampleNode(node) }));
  for (const generated of generatedSamples) {
    const collides = protectedSamples.some((protectedItem) => pathsCollide(
      generated.points,
      protectedItem.points,
      input.tolerance,
      input.boundaryAnchors.map((anchor) => anchor.point),
    ));
    if (collides) {
      issues.push(issue(
        'GENERATED_PROTECTED_COLLISION',
        '生成图元穿过受保护几何',
        [generated.node.id],
      ));
    }
  }
  const allGeneratedPoints = generatedSamples.flatMap((item) => item.points);
  const connectedAnchorIds = input.boundaryAnchors
    .filter((anchor) => allGeneratedPoints.some((point) => distance(point, anchor.point) <= input.tolerance))
    .map((anchor) => anchor.id);
  const missingAnchors = input.boundaryAnchors
    .filter((anchor) => !connectedAnchorIds.includes(anchor.id));
  if (missingAnchors.length > 0) {
    issues.push(issue(
      'GENERATED_SEAM_DISCONNECTED',
      '生成轮廓没有连接全部区域边界锚点',
      input.geometry.map((node) => node.id),
    ));
  }
  return { valid: issues.length === 0, issues: dedupeIssues(issues), connectedAnchorIds };
}

function sampleNode(node: GeometryNode): Vec2[] {
  const bounds = roughGeometryBounds(node) ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const points = sampleGeometryRanges(node, { curveSamples: 96, localBounds: bounds })
    .flatMap((range) => range.samples);
  return points.filter((point, index) => index === 0 || distance(point, points[index - 1]) > 1e-9);
}

function pathsCollide(
  generated: Vec2[],
  protectedPoints: Vec2[],
  tolerance: number,
  allowedAnchors: Vec2[],
): boolean {
  const generatedSegments = segments(generated);
  const protectedSegments = segments(protectedPoints);
  for (const [leftStart, leftEnd] of generatedSegments) {
    for (const [rightStart, rightEnd] of protectedSegments) {
      const collision = segmentIntersection(leftStart, leftEnd, rightStart, rightEnd)
        ?? nearestCollision(leftStart, leftEnd, rightStart, rightEnd, tolerance);
      if (collision && !allowedAnchors.some((anchor) => distance(anchor, collision) <= tolerance * 4)) {
        return true;
      }
    }
  }
  return false;
}

function segments(points: Vec2[]): Array<readonly [Vec2, Vec2]> {
  return points.slice(1).map((point, index) => [points[index], point] as const);
}

function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= 1e-12) return null;
  const delta: Vec2 = [c[0] - a[0], c[1] - a[1]];
  const t = cross(delta, s) / denominator;
  const u = cross(delta, r) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
    ? [a[0] + t * r[0], a[1] + t * r[1]]
    : null;
}

function nearestCollision(a: Vec2, b: Vec2, c: Vec2, d: Vec2, tolerance: number): Vec2 | null {
  const candidates = [
    { point: a, distance: distanceToSegment(a, c, d) },
    { point: b, distance: distanceToSegment(b, c, d) },
    { point: c, distance: distanceToSegment(c, a, b) },
    { point: d, distance: distanceToSegment(d, a, b) },
  ].sort((left, right) => left.distance - right.distance);
  return candidates[0].distance <= tolerance ? candidates[0].point : null;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx ** 2 + dy ** 2;
  if (lengthSquared <= 1e-18) return distance(point, start);
  const t = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  return distance(point, [start[0] + t * dx, start[1] + t * dy]);
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function issue(code: string, message: string, nodeIds: string[] = []): GenerativeValidationIssue {
  return { code, message, nodeIds };
}

function dedupeIssues(issues: GenerativeValidationIssue[]): GenerativeValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = `${item.code}:${item.nodeIds.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
