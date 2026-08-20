import type { Vec2 } from '../../../src/drawing/index.js';
import type { DxfPair } from './types.js';
import { pointInPolygonRegion, segmentRegionIntersections } from '../drawing-spatial/polygon.js';

const EPSILON = 1e-8;
const MAX_HATCH_SEGMENTS = 10_000;

export interface ProjectedHatchPattern {
  pattern: string;
  angle: number;
  spacing: number;
  segments: Array<{ start: Vec2; end: Vec2 }>;
}

interface PatternLine {
  angle: number;
  base: Vec2;
  offset: Vec2;
  dashLengths: number[];
}

type BoundaryEdge =
  | { kind: 'line'; start: Vec2; end: Vec2 }
  | {
      kind: 'arc';
      center: Vec2;
      radius: number;
      startAngle: number;
      endAngle: number;
      counterClockwise: boolean;
    }
  | {
      kind: 'ellipse';
      center: Vec2;
      majorAxis: Vec2;
      ratio: number;
      startParam: number;
      endParam: number;
      counterClockwise: boolean;
    }
  | {
      kind: 'spline';
      degree: number;
      controlPoints: Vec2[];
      knots: number[];
      weights?: number[];
    };

/**
 * Projects a line-pattern DXF HATCH into compact, explicitly clipped segments.
 * The original HATCH still remains in the raw DXF manifest; these segments are
 * only the deterministic Drawing IR/render projection.
 */
export function projectHatchPattern(pairs: DxfPair[]): ProjectedHatchPattern | null {
  const hatchSubclass = pairs.findIndex((pair) => pair.code === 100 && pair.value.trim() === 'AcDbHatch');
  if (hatchSubclass < 0) return null;
  const header = pairs.slice(hatchSubclass + 1);
  const boundaryCountIndex = header.findIndex((pair) => pair.code === 91);
  if (boundaryCountIndex < 0) return null;
  const solid = integerValue(header.slice(0, boundaryCountIndex), 70, 0);
  if (solid !== 0) return null;

  const pattern = value(header.slice(0, boundaryCountIndex), 2)?.trim() || 'USER';
  const cursor = new PairCursor(header, boundaryCountIndex + 1);
  const boundaryCount = integer(header[boundaryCountIndex]?.value, 0);
  const boundarySegments: Array<{ start: Vec2; end: Vec2 }> = [];
  const boundaryContours: Vec2[][] = [];
  for (let pathIndex = 0; pathIndex < boundaryCount; pathIndex += 1) {
    const flags = cursor.number(92);
    if (flags === undefined) return null;
    const edges = (Math.trunc(flags) & 2) === 2
      ? parsePolylineBoundary(cursor)
      : parseEdgeBoundary(cursor);
    if (!edges) return null;
    const segments = flattenBoundary(edges);
    if (segments.length === 0) return null;
    boundarySegments.push(...segments);
    const contours = boundaryContoursFromSegments(segments);
    if (process.env.DXF_HATCH_DEBUG === '1') {
      const bounds = segments.length === 0 ? null : {
        minX: Math.min(...segments.flatMap((segment) => [segment.start[0], segment.end[0]])),
        maxX: Math.max(...segments.flatMap((segment) => [segment.start[0], segment.end[0]])),
        minY: Math.min(...segments.flatMap((segment) => [segment.start[1], segment.end[1]])),
        maxY: Math.max(...segments.flatMap((segment) => [segment.start[1], segment.end[1]])),
      };
      console.log('hatch boundary path', {
        pathIndex,
        segments: segments.length,
        contours: contours.length,
        bounds,
      });
      for (let contourIndex = 0; contourIndex < contours.length; contourIndex += 1) {
        const contour = contours[contourIndex];
        console.log(' contour', {
          contourIndex,
          points: contour.length,
          start: contour[0],
          end: contour[contour.length - 1],
          closeGap: contour.length > 1
            ? distance(contour[0]!, contour[contour.length - 1]!)
            : 0,
        });
      }
    }
    boundaryContours.push(...contours);
    skipBoundaryReferences(cursor);
  }
  if (boundarySegments.length < 3) return null;
  if (process.env.DXF_HATCH_DEBUG === '1') {
    const boundaryBounds = boundarySegments.length === 0 ? null : {
      minX: Math.min(...boundarySegments.flatMap((segment) => [segment.start[0], segment.end[0]])),
      maxX: Math.max(...boundarySegments.flatMap((segment) => [segment.start[0], segment.end[0]])),
      minY: Math.min(...boundarySegments.flatMap((segment) => [segment.start[1], segment.end[1]])),
      maxY: Math.max(...boundarySegments.flatMap((segment) => [segment.start[1], segment.end[1]])),
    };
    console.log('hatch boundary', {
      pattern,
      boundarySegments: boundarySegments.length,
      contours: boundaryContours.length,
      boundaryBounds,
    });
  }

  const globalAngle = numberValue(header.slice(cursor.index), 52, 0);
  const scale = numberValue(header.slice(cursor.index), 41, 1);
  const patternCountOffset = header.slice(cursor.index).findIndex((pair) => pair.code === 78);
  if (patternCountOffset < 0 || !(scale > 0)) return null;
  cursor.index += patternCountOffset;
  const patternLineCount = Math.max(0, Math.trunc(cursor.number(78) ?? 0));
  const patternLines: PatternLine[] = [];
  for (let index = 0; index < patternLineCount; index += 1) {
    const rawAngle = cursor.number(53);
    const baseX = cursor.number(43);
    const baseY = cursor.number(44);
    const offsetX = cursor.number(45);
    const offsetY = cursor.number(46);
    const dashCount = Math.max(0, Math.trunc(cursor.number(79) ?? 0));
    if ([rawAngle, baseX, baseY, offsetX, offsetY].some((item) => item === undefined)) {
      return null;
    }
    const dashLengths: number[] = [];
    for (let dashIndex = 0; dashIndex < dashCount; dashIndex += 1) {
      const dash = cursor.number(49);
      if (dash === undefined) return null;
      dashLengths.push(dash * scale);
    }
    patternLines.push(transformPatternLine({
      angle: rawAngle as number,
      base: [baseX as number, baseY as number],
      offset: [offsetX as number, offsetY as number],
      dashLengths,
    }, globalAngle, scale));
  }
  if (patternLines.length === 0) return null;

  const clipped: Array<{ start: Vec2; end: Vec2 }> = [];
  let representativeAngle = normalizeDegrees(patternLines[0]?.angle ?? 0);
  let representativeSpacing = Number.POSITIVE_INFINITY;
  for (const line of patternLines) {
    // Dashed hatch families need dash-phase clipping; preserving them as raw
    // source data is safer than silently rendering a continuous pattern.
    if (line.dashLengths.length > 0) continue;
    const family = clipPatternFamily(line, boundarySegments, boundaryContours, MAX_HATCH_SEGMENTS - clipped.length);
    if (process.env.DXF_HATCH_DEBUG === '1' && family.segments.length > 0) {
      const outside = family.segments.filter(({ start, end }) => {
        const mid: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
        return !pointInPolygonRegion(mid, boundaryContours, [], 1e-6);
      }).length;
      console.log('family stats', {
        familySegments: family.segments.length,
        outsideByMidpoint: outside,
        familyAngle: clean(line.angle),
      });
    }
    if (family.segments.length > 0 && clipped.length === 0) {
      representativeAngle = normalizeDegrees(line.angle);
    }
    representativeSpacing = Math.min(representativeSpacing, family.spacing);
    clipped.push(...family.segments);
    if (clipped.length >= MAX_HATCH_SEGMENTS) break;
  }
  if (clipped.length === 0 || !Number.isFinite(representativeSpacing)) return null;
  return {
    pattern,
    angle: clean(representativeAngle),
    spacing: clean(representativeSpacing),
    segments: clipped,
  };
}

function parsePolylineBoundary(cursor: PairCursor): BoundaryEdge[] | null {
  const hasBulge = Math.trunc(cursor.number(72) ?? 0) !== 0;
  const closed = Math.trunc(cursor.number(73) ?? 0) !== 0;
  const vertexCount = Math.max(0, Math.trunc(cursor.number(93) ?? 0));
  const vertices: Array<{ point: Vec2; bulge: number }> = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const x = cursor.number(10);
    const y = cursor.number(20);
    const bulge = hasBulge && cursor.peekCode() === 42 ? cursor.number(42) ?? 0 : 0;
    if (x === undefined || y === undefined) return null;
    vertices.push({ point: [x, y], bulge });
  }
  if (vertices.length < (closed ? 3 : 2)) return null;
  const edges: BoundaryEdge[] = [];
  const edgeCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < edgeCount; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (!current || !next) continue;
    if (Math.abs(current.bulge) <= EPSILON) {
      edges.push({ kind: 'line', start: current.point, end: next.point });
    } else {
      edges.push(bulgeArc(current.point, next.point, current.bulge));
    }
  }
  return edges;
}

function parseEdgeBoundary(cursor: PairCursor): BoundaryEdge[] | null {
  const edgeCount = Math.max(0, Math.trunc(cursor.number(93) ?? 0));
  const edges: BoundaryEdge[] = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const edgeType = Math.trunc(cursor.number(72) ?? 0);
    if (edgeType === 1) {
      const start = cursor.point(10, 20);
      const end = cursor.point(11, 21);
      if (!start || !end) return null;
      edges.push({ kind: 'line', start, end });
    } else if (edgeType === 2) {
      const center = cursor.point(10, 20);
      const radius = cursor.number(40);
      const startAngle = cursor.number(50);
      const endAngle = cursor.number(51);
      const counterClockwise = Math.trunc(cursor.number(73) ?? 0) !== 0;
      if (!center || !(radius && radius > 0) || startAngle === undefined || endAngle === undefined) {
        return null;
      }
      edges.push({ kind: 'arc', center, radius, startAngle, endAngle, counterClockwise });
    } else if (edgeType === 3) {
      const center = cursor.point(10, 20);
      const majorAxis = cursor.point(11, 21);
      const ratio = cursor.number(40);
      const startParam = cursor.number(50);
      const endParam = cursor.number(51);
      const counterClockwise = Math.trunc(cursor.number(73) ?? 0) !== 0;
      if (!center || !majorAxis || !(ratio && ratio > 0)
        || startParam === undefined || endParam === undefined) return null;
      edges.push({
        kind: 'ellipse', center, majorAxis, ratio, startParam, endParam, counterClockwise,
      });
    } else if (edgeType === 4) {
      const spline = parseSplineEdge(cursor);
      if (!spline) return null;
      edges.push(spline);
    } else return null;
  }
  return edges;
}

function parseSplineEdge(cursor: PairCursor): Extract<BoundaryEdge, { kind: 'spline' }> | null {
  const degree = Math.max(1, Math.trunc(cursor.number(94) ?? 0));
  const rational = Math.trunc(cursor.number(73) ?? 0) !== 0;
  cursor.number(74); // periodic flag; the stored knot vector remains authoritative
  const knotCount = Math.max(0, Math.trunc(cursor.number(95) ?? 0));
  const controlCount = Math.max(0, Math.trunc(cursor.number(96) ?? 0));
  const knots: number[] = [];
  for (let index = 0; index < knotCount; index += 1) {
    const knot = cursor.number(40);
    if (knot === undefined) return null;
    knots.push(knot);
  }
  const controlPoints: Vec2[] = [];
  const weights: number[] = [];
  for (let index = 0; index < controlCount; index += 1) {
    const point = cursor.point(10, 20);
    if (!point) return null;
    controlPoints.push(point);
    if (rational) {
      const weight = cursor.number(42);
      if (!(weight && weight > 0)) return null;
      weights.push(weight);
    } else if (cursor.peekCode() === 42) cursor.number(42);
  }
  if (cursor.peekCode() === 97) {
    const fitCount = Math.max(0, Math.trunc(cursor.number(97) ?? 0));
    for (let index = 0; index < fitCount; index += 1) {
      if (!cursor.point(11, 21)) return null;
    }
  }
  if (controlPoints.length <= degree || knots.length !== controlPoints.length + degree + 1) {
    return null;
  }
  return {
    kind: 'spline', degree, controlPoints, knots,
    ...(weights.length === controlPoints.length ? { weights } : {}),
  };
}

function skipBoundaryReferences(cursor: PairCursor): void {
  if (cursor.peekCode() !== 97) return;
  const count = Math.max(0, Math.trunc(cursor.number(97) ?? 0));
  for (let index = 0; index < count; index += 1) cursor.number(330);
}

function flattenBoundary(edges: BoundaryEdge[]): Array<{ start: Vec2; end: Vec2 }> {
  const output: Array<{ start: Vec2; end: Vec2 }> = [];
  edges.forEach((edge) => {
    const points = edgeSamples(edge);
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const start = points[pointIndex - 1];
      const end = points[pointIndex];
      if (start && end && distance(start, end) > EPSILON) output.push({ start, end });
    }
  });
  return output;
}

function edgeSamples(edge: BoundaryEdge): Vec2[] {
  if (edge.kind === 'line') return [edge.start, edge.end];
  if (edge.kind === 'spline') {
    const points = sampleSpline(edge);
    return points;
  }
  if (edge.kind === 'arc') {
    return sampleArc(edge, false, false);
  }
  const direct = sampleEllipse(edge, false, false);
  return direct;
}

function sampleArc(
  edge: Extract<BoundaryEdge, { kind: 'arc' }>,
  reflectY: boolean,
  reverse: boolean,
): Vec2[] {
  const start = edge.startAngle * Math.PI / 180;
  const end = edge.endAngle * Math.PI / 180;
  const sweep = directedSweep(start, end, edge.counterClockwise);
  const steps = Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = start + sweep * index / steps;
    return [
      edge.center[0] + Math.cos(angle) * edge.radius,
      edge.center[1] + Math.sin(angle) * edge.radius * (reflectY ? -1 : 1),
    ] as Vec2;
  });
  return reverse ? points.reverse() : points;
}

function sampleEllipse(
  edge: Extract<BoundaryEdge, { kind: 'ellipse' }>,
  reflectY: boolean,
  reverse: boolean,
): Vec2[] {
  const majorLength = Math.hypot(edge.majorAxis[0], edge.majorAxis[1]);
  if (!(majorLength > 0)) return [];
  const ux: Vec2 = [edge.majorAxis[0] / majorLength, edge.majorAxis[1] / majorLength];
  const uy: Vec2 = [-ux[1], ux[0]];
  const start = edge.startParam * Math.PI / 180;
  const end = edge.endParam * Math.PI / 180;
  const sweep = directedSweep(start, end, edge.counterClockwise);
  const steps = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const parameter = start + sweep * index / steps;
    const minor = Math.sin(parameter) * majorLength * edge.ratio * (reflectY ? -1 : 1);
    return [
      edge.center[0] + ux[0] * Math.cos(parameter) * majorLength + uy[0] * minor,
      edge.center[1] + ux[1] * Math.cos(parameter) * majorLength + uy[1] * minor,
    ] as Vec2;
  });
  return reverse ? points.reverse() : points;
}

function sampleSpline(edge: Extract<BoundaryEdge, { kind: 'spline' }>): Vec2[] {
  const start = edge.knots[edge.degree];
  const end = edge.knots[edge.controlPoints.length];
  if (start === undefined || end === undefined || !(end > start)) return [...edge.controlPoints];
  const sampleCount = Math.min(320, Math.max(16, edge.controlPoints.length * 5));
  return Array.from({ length: sampleCount + 1 }, (_, index) => (
    evaluateSpline(edge, index === sampleCount ? end : start + (end - start) * index / sampleCount)
  ));
}

function evaluateSpline(edge: Extract<BoundaryEdge, { kind: 'spline' }>, parameter: number): Vec2 {
  const count = edge.controlPoints.length;
  const span = findSpan(count - 1, edge.degree, parameter, edge.knots);
  const points: Array<[number, number, number]> = [];
  for (let index = 0; index <= edge.degree; index += 1) {
    const controlIndex = span - edge.degree + index;
    const point = edge.controlPoints[controlIndex] ?? [0, 0];
    const weight = edge.weights?.[controlIndex] ?? 1;
    points.push([point[0] * weight, point[1] * weight, weight]);
  }
  for (let level = 1; level <= edge.degree; level += 1) {
    for (let index = edge.degree; index >= level; index -= 1) {
      const controlIndex = span - edge.degree + index;
      const left = edge.knots[controlIndex];
      const right = edge.knots[controlIndex + edge.degree - level + 1];
      const denominator = (right ?? 0) - (left ?? 0);
      const alpha = Math.abs(denominator) <= EPSILON ? 0 : (parameter - (left ?? 0)) / denominator;
      const before = points[index - 1] ?? [0, 0, 1];
      const current = points[index] ?? before;
      points[index] = [
        (1 - alpha) * before[0] + alpha * current[0],
        (1 - alpha) * before[1] + alpha * current[1],
        (1 - alpha) * before[2] + alpha * current[2],
      ];
    }
  }
  const result = points[edge.degree] ?? [0, 0, 1];
  return Math.abs(result[2]) <= EPSILON
    ? [result[0], result[1]]
    : [result[0] / result[2], result[1] / result[2]];
}

function findSpan(controlLast: number, degree: number, parameter: number, knots: number[]): number {
  if (parameter >= (knots[controlLast + 1] ?? parameter)) return controlLast;
  let low = degree;
  let high = controlLast + 1;
  let middle = Math.floor((low + high) / 2);
  while (parameter < (knots[middle] ?? parameter)
    || parameter >= (knots[middle + 1] ?? parameter + 1)) {
    if (parameter < (knots[middle] ?? parameter)) high = middle;
    else low = middle;
    middle = Math.floor((low + high) / 2);
  }
  return middle;
}

function clipPatternFamily(
  line: PatternLine,
  boundary: Array<{ start: Vec2; end: Vec2 }>,
  boundaryContours: Vec2[][],
  remaining: number,
): { spacing: number; segments: Array<{ start: Vec2; end: Vec2 }> } {
  const radians = line.angle * Math.PI / 180;
  const direction: Vec2 = [Math.cos(radians), Math.sin(radians)];
  const normal: Vec2 = [-direction[1], direction[0]];
  const delta = dot(line.offset, normal);
  const spacing = Math.abs(delta);
  if (!(spacing > EPSILON) || remaining <= 0) return { spacing: Number.POSITIVE_INFINITY, segments: [] };
  const projections = boundary.flatMap(({ start, end }) => [dot(start, normal), dot(end, normal)]);
  const minimum = Math.min(...projections);
  const maximum = Math.max(...projections);
  const baseProjection = dot(line.base, normal);
  const first = (minimum - baseProjection) / delta;
  const last = (maximum - baseProjection) / delta;
  const startIndex = Math.ceil(Math.min(first, last) - EPSILON);
  const endIndex = Math.floor(Math.max(first, last) + EPSILON);
  const segments: Array<{ start: Vec2; end: Vec2 }> = [];
  for (let index = startIndex; index <= endIndex && segments.length < remaining; index += 1) {
    const origin: Vec2 = [
      line.base[0] + line.offset[0] * index,
      line.base[1] + line.offset[1] * index,
    ];
    const intersections = boundary.flatMap((edge) => {
      const vector: Vec2 = [edge.end[0] - edge.start[0], edge.end[1] - edge.start[1]];
      const denominator = cross(direction, vector);
      if (Math.abs(denominator) <= EPSILON) return [];
      const relative: Vec2 = [edge.start[0] - origin[0], edge.start[1] - origin[1]];
      const parameter = cross(relative, vector) / denominator;
      const edgeParameter = cross(relative, direction) / denominator;
      return edgeParameter >= -EPSILON && edgeParameter <= 1 + EPSILON ? [parameter] : [];
    }).sort((left, right) => left - right);
    const unique = intersections.filter((item, itemIndex) => (
      itemIndex === 0 || Math.abs(item - (intersections[itemIndex - 1] ?? item)) > 1e-6
    ));
    for (let pairIndex = 0; pairIndex + 1 < unique.length && segments.length < remaining; pairIndex += 2) {
      const startParameter = unique[pairIndex];
      const endParameter = unique[pairIndex + 1];
      if (startParameter === undefined || endParameter === undefined
        || endParameter - startParameter <= EPSILON) continue;
      segments.push({
        start: cleanPoint([
          origin[0] + direction[0] * startParameter,
          origin[1] + direction[1] * startParameter,
        ]),
        end: cleanPoint([
          origin[0] + direction[0] * endParameter,
          origin[1] + direction[1] * endParameter,
        ]),
      });
    }
  }
  return {
    spacing,
    segments: clipToBoundary(segments, boundaryContours, remaining),
  };
}

function boundaryContoursFromSegments(
  boundarySegments: Array<{ start: Vec2; end: Vec2 }>,
): Vec2[][] {
  if (boundarySegments.length === 0) return [];
  const defaultJoinTolerance = estimateJoinTolerance(boundarySegments);
  let contours = buildContoursFromSegments(boundarySegments, defaultJoinTolerance);
  let usedFallback = false;
  if (contours.length === 0) {
    const fallbackTolerance = estimateFallbackJoinTolerance(boundarySegments, defaultJoinTolerance);
    contours = buildContoursFromSegments(boundarySegments, fallbackTolerance);
    usedFallback = true;
  }

  if (process.env.DXF_HATCH_DEBUG === '1') {
    console.log('boundaryContoursFromSegments', {
      rawSegments: boundarySegments.length,
      contourCount: contours.length,
      defaultJoinTolerance,
      fallbackUsed: usedFallback,
      samples: contours.slice(0, 2).map((contour, index) => ({
        index,
        points: contour.length,
        start: contour[0],
        end: contour[contour.length - 1],
        closeGap: contour.length > 1 ? distance(contour[0], contour[contour.length - 1]) : 0,
      })),
    });
  }

  return contours;
}

function buildContoursFromSegments(
  boundarySegments: Array<{ start: Vec2; end: Vec2 }>,
  joinTolerance: number,
): Vec2[][] {
  if (boundarySegments.length === 0) return [];
  const contours: Vec2[][] = [];
  let current: Vec2[] = [];
  for (const segment of boundarySegments) {
    if (current.length === 0) {
      current = [segment.start, segment.end];
      continue;
    }
    const last = current[current.length - 1];
    if (last && distance(last, segment.start) <= joinTolerance) {
      current.push(segment.end);
      continue;
    }
    const finalized = finalizeBoundaryContour(current, joinTolerance);
    if (finalized) contours.push(finalized);
    current = [segment.start, segment.end];
  }
  const finalized = finalizeBoundaryContour(current, joinTolerance);
  if (finalized) contours.push(finalized);
  return contours;
}

function estimateJoinTolerance(segments: Array<{ start: Vec2; end: Vec2 }>): number {
  const gaps = collectSegmentGaps(segments);
  if (gaps.length === 0) return 1e-4;
  const median = gaps.sort((left, right) => left - right)[Math.floor(gaps.length / 2)] ?? 0;
  const bbox = boundaryBounds(segments);
  const diagonal = Math.max(1e-6, Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY));
  return Math.max(1e-4, Math.min(0.6, Math.max(median * 2.5, diagonal * 1e-5)));
}

function estimateFallbackJoinTolerance(
  segments: Array<{ start: Vec2; end: Vec2 }>,
  fallbackFrom: number,
): number {
  const gaps = collectSegmentGaps(segments);
  const fallback = Math.max(fallbackFrom, Math.max(...gaps, 0) * 1.4);
  return Math.min(20, Math.max(fallback, 1e-3));
}

function collectSegmentGaps(segments: Array<{ start: Vec2; end: Vec2 }>): number[] {
  const gaps: number[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    const prev = segments[index - 1];
    const current = segments[index];
    if (!prev || !current) continue;
    gaps.push(distance(prev.end, current.start));
  }
  return gaps;
}

function boundaryBounds(segments: Array<{ start: Vec2; end: Vec2 }>): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return {
    minX: Math.min(...segments.flatMap((segment) => [segment.start[0], segment.end[0]])),
    maxX: Math.max(...segments.flatMap((segment) => [segment.start[0], segment.end[0]])),
    minY: Math.min(...segments.flatMap((segment) => [segment.start[1], segment.end[1]])),
    maxY: Math.max(...segments.flatMap((segment) => [segment.start[1], segment.end[1]])),
  };
}

function finalizeBoundaryContour(points: Vec2[], joinTolerance: number): Vec2[] | null {
  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && distance(first, last) <= joinTolerance * 10) {
    points = points.slice(0, -1);
  }
  if (points.length < 3) return null;
  if (!first || !last) return null;
  const perimeter = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + distance(point, next);
  }, 0);
  if (distance(first, last) > Math.max(joinTolerance * 3, perimeter * 0.02)) {
    // 非闭合路径在大跨越处容易产生伪闭合边，拒绝作为裁剪轮廓。
    return null;
  }
  return points;
}

function clipToBoundary(
  segments: Array<{ start: Vec2; end: Vec2 }>,
  contours: Vec2[][],
  remaining: number,
): Array<{ start: Vec2; end: Vec2 }> {
  if (contours.length === 0 || remaining <= 0) return segments.slice(0, remaining <= 0 ? 0 : segments.length);
  const output: Array<{ start: Vec2; end: Vec2 }> = [];
  for (const segment of segments) {
    if (output.length >= remaining) break;
    const axis = clipSegmentToContours(segment.start, segment.end, contours, remaining - output.length);
    output.push(...axis);
    if (output.length >= remaining) break;
  }
  return output;
}

function clipSegmentToContours(
  start: Vec2,
  end: Vec2,
  contours: Vec2[][],
  remaining: number,
): Array<{ start: Vec2; end: Vec2 }> {
  if (contours.length === 0 || remaining <= 0) return [];
  if (distance(start, end) <= EPSILON) return [];
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const rawIntersections = segmentRegionIntersections(start, end, contours, [], EPSILON);
  const parameters = uniqueNumbers([0, 1, ...rawIntersections], EPSILON * 10);
  if (parameters.length < 2) return [];
  const output: Array<{ start: Vec2; end: Vec2 }> = [];
  for (let index = 1; index < parameters.length && output.length < remaining; index += 1) {
    const a = parameters[index - 1];
    const b = parameters[index];
    if (a === undefined || b === undefined || b - a <= EPSILON) continue;
    const middle = (a + b) / 2;
    const midpoint: Vec2 = [start[0] + dx * middle, start[1] + dy * middle];
    if (!pointInPolygonRegion(midpoint, contours, [], EPSILON * 10)) continue;
    output.push({
      start: cleanPoint([start[0] + dx * a, start[1] + dy * a]),
      end: cleanPoint([start[0] + dx * b, start[1] + dy * b]),
    });
    if (output.length >= remaining) break;
  }
  return output;
}

function transformPatternLine(line: PatternLine, angle: number, scale: number): PatternLine {
  const radians = angle * Math.PI / 180;
  const rotate = (point: Vec2): Vec2 => [
    scale * (point[0] * Math.cos(radians) - point[1] * Math.sin(radians)),
    scale * (point[0] * Math.sin(radians) + point[1] * Math.cos(radians)),
  ];
  return {
    angle: line.angle + angle,
    base: rotate(line.base),
    offset: rotate(line.offset),
    dashLengths: line.dashLengths,
  };
}

function bulgeArc(start: Vec2, end: Vec2, bulge: number): Extract<BoundaryEdge, { kind: 'arc' }> {
  const chord = distance(start, end);
  const sweep = 4 * Math.atan(bulge);
  const radius = Math.abs(chord / (2 * Math.sin(sweep / 2)));
  const midpoint: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const chordAngle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const offset = chord / (2 * Math.tan(sweep / 2));
  const center: Vec2 = [
    midpoint[0] - Math.sin(chordAngle) * offset,
    midpoint[1] + Math.cos(chordAngle) * offset,
  ];
  return {
    kind: 'arc', center, radius,
    startAngle: Math.atan2(start[1] - center[1], start[0] - center[0]) * 180 / Math.PI,
    endAngle: Math.atan2(end[1] - center[1], end[0] - center[0]) * 180 / Math.PI,
    counterClockwise: bulge > 0,
  };
}

function directedSweep(start: number, end: number, counterClockwise: boolean): number {
  const full = Math.PI * 2;
  if (counterClockwise) return positiveModulo(end - start, full) || full;
  return -(positiveModulo(start - end, full) || full);
}

class PairCursor {
  constructor(readonly pairs: DxfPair[], public index: number) {}

  peekCode(): number | undefined {
    return this.pairs[this.index]?.code;
  }

  number(code: number): number | undefined {
    const pair = this.pairs[this.index];
    if (!pair || pair.code !== code) return undefined;
    this.index += 1;
    const parsed = Number.parseFloat(pair.value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  point(xCode: number, yCode: number): Vec2 | undefined {
    const x = this.number(xCode);
    const y = this.number(yCode);
    if (x === undefined || y === undefined) return undefined;
    if (this.peekCode() === xCode + 20) this.number(xCode + 20);
    return [x, y];
  }
}

function value(pairs: DxfPair[], code: number): string | undefined {
  return pairs.find((pair) => pair.code === code)?.value;
}

function numberValue(pairs: DxfPair[], code: number, fallback: number): number {
  const parsed = Number.parseFloat(value(pairs, code)?.trim() ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integerValue(pairs: DxfPair[], code: number, fallback: number): number {
  return Math.trunc(numberValue(pairs, code, fallback));
}

function integer(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(input?.trim() ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dot(first: Vec2, second: Vec2): number {
  return first[0] * second[0] + first[1] * second[1];
}

function cross(first: Vec2, second: Vec2): number {
  return first[0] * second[1] - first[1] * second[0];
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function cleanPoint(point: Vec2): Vec2 {
  return [clean(point[0]), clean(point[1])];
}

function clean(input: number): number {
  const rounded = Math.round(input * 1_000_000_000) / 1_000_000_000;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}

function normalizeDegrees(input: number): number {
  const normalized = positiveModulo(input, 360);
  return Math.abs(normalized - 360) <= EPSILON ? 0 : normalized;
}

function positiveModulo(input: number, modulus: number): number {
  return ((input % modulus) + modulus) % modulus;
}

function uniqueNumbers(values: number[], epsilon: number): number[] {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted.reduce<number[]>((result, value) => (
    result.length === 0 || Math.abs(value - (result[result.length - 1] ?? value)) > epsilon
      ? [...result, value]
      : result
  ), []);
}
