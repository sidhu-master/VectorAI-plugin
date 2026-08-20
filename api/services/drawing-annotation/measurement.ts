import type {
  EvidenceId,
  GeometryId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import { geometryBounds, unionBounds } from '../../../src/drawing/query/bounds.js';
import type {
  AngleFact,
  AxialLengthFact,
  CenterlineFact,
  DiameterFact,
  MeasurementAxis,
  MeasurementFact,
  MeasurementResult,
  RadiusFact,
} from './types.js';

const MINIMUM_TOLERANCE = 1e-5;

interface SegmentSample {
  source: GeometryNode;
  start: Vec2;
  end: Vec2;
}

interface Station {
  x: number;
  sources: GeometryNode[];
  error: number;
}

interface ProfileLevel {
  y: number;
  minX: number;
  maxX: number;
  source: GeometryNode;
  origin: 'segment' | 'spline';
}

export function measureDeterministicAnnotations(input: {
  geometry: GeometryNode[];
  unit: 'mm' | 'cm' | 'm';
}): MeasurementResult {
  void input.unit;
  const geometry = input.geometry.filter((node) => (
    node.visible
    && node.quality.status === 'confirmed'
    && (node.type === 'xline' || geometryBounds(node) !== null)
  ));
  const bounds = unionBounds(geometry.flatMap((node) => {
    const value = geometryBounds(node);
    return value ? [value] : [];
  }));
  if (!bounds) return emptyResult('ANNOTATION_GEOMETRY_EMPTY', '图纸中没有可测量的已确认几何');

  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const tolerance = Math.max(diagonal * 1e-6, MINIMUM_TOLERANCE);
  const radialTolerance = Math.max(diagonal * 1e-3, tolerance * 10);
  const segments = collectSegments(geometry);
  const axis = detectHorizontalAxis(geometry, segments, bounds, tolerance);
  if (axis.status === 'conflict') {
    return {
      axis,
      facts: [],
      conflicts: [{
        code: 'ANNOTATION_AXIS_AMBIGUOUS',
        message: '未找到显式轴线，也无法从上下轮廓确认唯一对称轴',
        sourceIds: axis.sourceIds,
      }],
    };
  }

  const stations = collectProfileStations(segments, axis.origin[1], tolerance);
  const facts: MeasurementFact[] = [];
  facts.push(centerlineFact(axis, stations, bounds));
  facts.push(...axialFacts(stations, axis.origin[1]));
  facts.push(...diameterFacts(geometry, segments, axis.origin[1], bounds, tolerance, radialTolerance));
  facts.push(...radiusFacts(geometry));
  facts.push(...openingAngleFacts(segments, axis.origin[1], diagonal, tolerance));

  return {
    axis,
    facts: deduplicateFacts(facts),
    conflicts: [],
  };
}

function emptyResult(code: string, message: string): MeasurementResult {
  return {
    axis: {
      origin: [0, 0],
      direction: [1, 0],
      status: 'conflict',
      sourceIds: [],
      evidenceRefs: [],
      error: Number.POSITIVE_INFINITY,
    },
    facts: [],
    conflicts: [{ code, message, sourceIds: [] }],
  };
}

function collectSegments(geometry: GeometryNode[]): SegmentSample[] {
  const segments: SegmentSample[] = [];
  for (const node of geometry) {
    if (node.type === 'line') {
      segments.push({ source: node, start: node.start, end: node.end });
      continue;
    }
    if (node.type !== 'polyline' || node.vertices.length < 2) continue;
    const count = node.closed ? node.vertices.length : node.vertices.length - 1;
    for (let index = 0; index < count; index += 1) {
      const first = node.vertices[index];
      const second = node.vertices[(index + 1) % node.vertices.length];
      if (!first || !second || Math.abs(first.bulge ?? 0) > MINIMUM_TOLERANCE) continue;
      segments.push({ source: node, start: first.point, end: second.point });
    }
  }
  return segments;
}

function detectHorizontalAxis(
  geometry: GeometryNode[],
  segments: SegmentSample[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  tolerance: number,
): MeasurementAxis {
  const explicit = geometry.filter((node): node is Extract<GeometryNode, { type: 'xline' }> => (
    node.type === 'xline'
    && Math.abs(node.direction[1]) <= tolerance
    && Math.abs(node.direction[0]) > tolerance
  ));
  if (explicit.length === 1) {
    return {
      origin: [bounds.minX, clean(explicit[0].origin[1])],
      direction: [1, 0],
      status: 'confirmed',
      sourceIds: [explicit[0].id],
      evidenceRefs: evidenceOf([explicit[0]]),
      error: 0,
    };
  }

  const centerY = (bounds.minY + bounds.maxY) / 2;
  const horizontal = segments.filter((segment) => (
    Math.abs(segment.end[1] - segment.start[1]) <= tolerance
    && Math.abs(segment.end[0] - segment.start[0]) > tolerance
  ));
  const supporting: SegmentSample[] = [];
  let worstError = 0;
  for (let firstIndex = 0; firstIndex < horizontal.length; firstIndex += 1) {
    const first = horizontal[firstIndex];
    const firstRadius = first.start[1] - centerY;
    if (Math.abs(firstRadius) <= tolerance) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < horizontal.length; secondIndex += 1) {
      const second = horizontal[secondIndex];
      const secondRadius = second.start[1] - centerY;
      if (firstRadius * secondRadius >= 0) continue;
      const error = Math.abs(firstRadius + secondRadius);
      if (error > tolerance * 10 || !rangesOverlap(first, second, tolerance)) continue;
      supporting.push(first, second);
      worstError = Math.max(worstError, error);
    }
  }
  const sources = uniqueNodes(supporting.map((item) => item.source));
  return {
    origin: [clean(bounds.minX), clean(centerY)],
    direction: [1, 0],
    status: sources.length >= 2 ? 'confirmed' : 'conflict',
    sourceIds: sources.map((node) => node.id),
    evidenceRefs: evidenceOf(sources),
    error: clean(worstError),
  };
}

function collectProfileStations(
  segments: SegmentSample[],
  axisY: number,
  tolerance: number,
): Station[] {
  const vertical = segments.filter((segment) => (
    Math.abs(segment.end[0] - segment.start[0]) <= Math.max(
      tolerance,
      Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]) * 0.001,
    )
    && Math.abs(segment.end[1] - segment.start[1]) > tolerance
  ));
  if (vertical.length === 0) return [];
  const stationTolerance = tolerance * 10;
  const groups: SegmentSample[][] = [];
  for (const segment of [...vertical].sort((left, right) => segmentX(left) - segmentX(right))) {
    const current = groups.at(-1);
    if (!current || Math.abs(meanX(current) - segmentX(segment)) > stationTolerance) groups.push([segment]);
    else current.push(segment);
  }
  const minimumX = Math.min(...vertical.map(segmentX));
  const maximumX = Math.max(...vertical.map(segmentX));
  return groups.flatMap((group): Station[] => {
    const x = meanX(group);
    const above = group.some((segment) => Math.min(segment.start[1], segment.end[1]) > axisY + tolerance);
    const below = group.some((segment) => Math.max(segment.start[1], segment.end[1]) < axisY - tolerance);
    const boundary = Math.abs(x - minimumX) <= stationTolerance
      || Math.abs(x - maximumX) <= stationTolerance;
    if (!boundary && !(above && below)) return [];
    const sources = uniqueNodes(group.map((segment) => segment.source));
    return [{
      x: clean(x),
      sources,
      error: clean(Math.max(...group.map((segment) => Math.abs(segmentX(segment) - x)))),
    }];
  });
}

function centerlineFact(
  axis: MeasurementAxis,
  stations: Station[],
  bounds: { minX: number; maxX: number },
): CenterlineFact {
  const startX = stations[0]?.x ?? bounds.minX;
  const endX = stations.at(-1)?.x ?? bounds.maxX;
  return {
    key: `centerline:${numberKey(startX)}:${numberKey(endX)}:${numberKey(axis.origin[1])}`,
    kind: 'centerline',
    quality: 'confirmed',
    start: [clean(startX), axis.origin[1]],
    end: [clean(endX), axis.origin[1]],
    sourceIds: axis.sourceIds,
    evidenceRefs: axis.evidenceRefs,
    method: 'explicit-or-reflected-horizontal-profile-axis',
    error: axis.error,
  };
}

function axialFacts(stations: Station[], axisY: number): AxialLengthFact[] {
  if (stations.length < 2) return [];
  const spans: Array<readonly [Station, Station, string]> = [];
  for (let index = 0; index < stations.length - 1; index += 1) {
    spans.push([stations[index], stations[index + 1], 'adjacent-confirmed-profile-stations']);
  }
  if (stations.length > 2) {
    spans.push([stations[0], stations.at(-1)!, 'overall-confirmed-profile-envelope']);
  }
  return spans.map(([first, second, method]) => {
    const sources = uniqueNodes([...first.sources, ...second.sources]);
    const value = clean(Math.abs(second.x - first.x));
    return {
      key: `axial:${numberKey(first.x)}:${numberKey(second.x)}`,
      kind: 'axial-length',
      quality: 'confirmed',
      value,
      first: [first.x, axisY],
      second: [second.x, axisY],
      sourceIds: sources.map((node) => node.id),
      evidenceRefs: evidenceOf(sources),
      method,
      error: clean(Math.max(first.error, second.error)),
    };
  });
}

function diameterFacts(
  geometry: GeometryNode[],
  segments: SegmentSample[],
  axisY: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  tolerance: number,
  radialTolerance: number,
): DiameterFact[] {
  const minimumHorizontalSupport = Math.max((bounds.maxX - bounds.minX) * 0.005, tolerance * 10);
  const levels: ProfileLevel[] = segments.flatMap((segment): ProfileLevel[] => {
    if (Math.abs(segment.end[1] - segment.start[1]) > tolerance) return [];
    if (Math.abs(segment.end[0] - segment.start[0]) < minimumHorizontalSupport) return [];
    return [{
      y: clean((segment.start[1] + segment.end[1]) / 2),
      minX: Math.min(segment.start[0], segment.end[0]),
      maxX: Math.max(segment.start[0], segment.end[0]),
      source: segment.source,
      origin: 'segment',
    }];
  });
  for (const node of geometry) {
    if (node.type !== 'spline') continue;
    const nodeBounds = geometryBounds(node);
    if (!nodeBounds) continue;
    const width = nodeBounds.maxX - nodeBounds.minX;
    const height = nodeBounds.maxY - nodeBounds.minY;
    if (!(width > tolerance) || height > Math.max(width * 0.05, tolerance * 20)) continue;
    const y = Math.abs(nodeBounds.maxY - axisY) >= Math.abs(nodeBounds.minY - axisY)
      ? nodeBounds.maxY
      : nodeBounds.minY;
    levels.push({
      y,
      minX: nodeBounds.minX,
      maxX: nodeBounds.maxX,
      source: node,
      origin: 'spline',
    });
  }

  const upper = levels.filter((level) => level.y > axisY + tolerance);
  const lower = levels.filter((level) => level.y < axisY - tolerance);
  const facts: DiameterFact[] = [];
  for (const top of upper) {
    for (const bottom of lower) {
      if (top.origin === 'spline' && bottom.origin === 'spline') continue;
      const error = Math.abs((top.y - axisY) - (axisY - bottom.y));
      if (error > radialTolerance) continue;
      const overlapStart = Math.max(top.minX, bottom.minX);
      const overlapEnd = Math.min(top.maxX, bottom.maxX);
      if (overlapEnd < overlapStart - tolerance) continue;
      const x = clean((overlapStart + overlapEnd) / 2);
      const sources = uniqueNodes([top.source, bottom.source]);
      const value = clean(top.y - bottom.y);
      facts.push({
        key: `diameter:${numberKey(x)}:${numberKey(value)}`,
        kind: 'diameter',
        quality: 'confirmed',
        value,
        center: [x, axisY],
        first: [x, clean(bottom.y)],
        second: [x, clean(top.y)],
        sourceIds: sources.map((node) => node.id),
        evidenceRefs: evidenceOf(sources),
        method: 'mirrored-profile-levels',
        error: clean(error),
      });
    }
  }

  for (const node of geometry) {
    if (node.type !== 'circle' || Math.abs(node.center[1] - axisY) > radialTolerance) continue;
    facts.push({
      key: `diameter:${numberKey(node.center[0])}:${numberKey(node.radius * 2)}`,
      kind: 'diameter',
      quality: 'confirmed',
      value: clean(node.radius * 2),
      center: node.center,
      first: [node.center[0], clean(node.center[1] - node.radius)],
      second: [node.center[0], clean(node.center[1] + node.radius)],
      sourceIds: [node.id],
      evidenceRefs: evidenceOf([node]),
      method: 'analytic-circle-diameter',
      error: 0,
    });
  }

  if (geometry.some((node) => node.type === 'spline')) {
    const bottomSources = geometry.filter((node) => {
      const item = geometryBounds(node);
      return item && Math.abs(item.minY - bounds.minY) <= tolerance * 10;
    });
    const topSources = geometry.filter((node) => {
      const item = geometryBounds(node);
      return item && Math.abs(item.maxY - bounds.maxY) <= tolerance * 10;
    });
    const sources = uniqueNodes([...bottomSources, ...topSources]);
    if (bottomSources.length > 0 && topSources.length > 0) {
      const x = clean((bounds.minX + bounds.maxX) / 2);
      facts.push({
        key: `diameter:${numberKey(x)}:${numberKey(bounds.maxY - bounds.minY)}`,
        kind: 'diameter',
        quality: 'confirmed',
        value: clean(bounds.maxY - bounds.minY),
        center: [x, axisY],
        first: [x, clean(bounds.minY)],
        second: [x, clean(bounds.maxY)],
        sourceIds: sources.map((node) => node.id),
        evidenceRefs: evidenceOf(sources),
        method: 'mirrored-spline-envelope',
        error: clean(Math.abs((bounds.maxY - axisY) - (axisY - bounds.minY))),
      });
    }
  }
  return facts;
}

function radiusFacts(geometry: GeometryNode[]): RadiusFact[] {
  return geometry.flatMap((node): RadiusFact[] => {
    if (node.type !== 'arc' || !(node.radius > MINIMUM_TOLERANCE)) return [];
    const middle = middleSweepRadians(node.startAngle, node.endAngle, node.counterClockwise);
    return [{
      key: `radius:${node.id}:${numberKey(node.radius)}`,
      kind: 'radius',
      quality: 'confirmed',
      value: clean(node.radius),
      center: node.center,
      edge: [
        clean(node.center[0] + Math.cos(middle) * node.radius),
        clean(node.center[1] + Math.sin(middle) * node.radius),
      ],
      sourceIds: [node.id],
      evidenceRefs: evidenceOf([node]),
      method: 'analytic-arc-radius',
      error: 0,
    }];
  });
}

function openingAngleFacts(
  segments: SegmentSample[],
  axisY: number,
  diagonal: number,
  tolerance: number,
): AngleFact[] {
  const maximumLength = Math.max(diagonal * 0.12, tolerance * 100);
  const mirrorTolerance = Math.max(diagonal * 0.002, tolerance * 10);
  const intersectionLimit = Math.max(diagonal * 0.15, tolerance * 100);
  const candidates = segments
    .map(normalizedSlopedSegment)
    .filter((segment): segment is NormalizedSlopedSegment => (
      segment !== null
      && segment.length <= maximumLength
      && Math.abs(segment.midpoint[1] - axisY) > mirrorTolerance
    ));
  const upper = candidates.filter((segment) => segment.midpoint[1] > axisY);
  const lower = candidates.filter((segment) => segment.midpoint[1] < axisY);
  const facts: AngleFact[] = [];

  for (const first of upper) {
    for (const second of lower) {
      const endpointError = Math.max(
        Math.abs(first.left[0] - second.left[0]),
        Math.abs(first.right[0] - second.right[0]),
        Math.abs(first.left[1] + second.left[1] - axisY * 2),
        Math.abs(first.right[1] + second.right[1] - axisY * 2),
      );
      if (endpointError > mirrorTolerance) continue;
      const vertex = lineIntersection(first.left, first.right, second.left, second.right, tolerance);
      if (!vertex || Math.abs(vertex[1] - axisY) > mirrorTolerance) continue;
      const distanceToFirst = distanceToSegmentRange(vertex[0], first.left[0], first.right[0]);
      const distanceToSecond = distanceToSegmentRange(vertex[0], second.left[0], second.right[0]);
      if (Math.max(distanceToFirst, distanceToSecond) > intersectionLimit) continue;
      const firstRay = cleanPoint(first.midpoint);
      const secondRay = cleanPoint(second.midpoint);
      const value = normalizedAngleValue(includedAngle(vertex, firstRay, secondRay));
      if (value <= 0.5 || value >= 179.5) continue;
      const pairedRays = [
        { source: first.segment.source, ray: firstRay },
        { source: second.segment.source, ray: secondRay },
      ].sort((left, right) => left.source.id.localeCompare(right.source.id));
      const sources = pairedRays.map((item) => item.source);
      facts.push({
        key: `opening-angle:${sources.map((source) => source.id).join(':')}:${numberKey(vertex[0])}:${numberKey(value)}`,
        kind: 'angle',
        quality: 'confirmed',
        value,
        vertex: [clean(vertex[0]), clean(axisY)],
        rays: [pairedRays[0].ray, pairedRays[1].ray],
        sourceIds: sources.map((source) => source.id),
        evidenceRefs: evidenceOf(sources),
        method: 'mirrored-line-pair-opening',
        error: clean(Math.max(endpointError, Math.abs(vertex[1] - axisY))),
      });
    }
  }
  return facts;
}

interface NormalizedSlopedSegment {
  segment: SegmentSample;
  left: Vec2;
  right: Vec2;
  midpoint: Vec2;
  length: number;
}

function normalizedSlopedSegment(segment: SegmentSample): NormalizedSlopedSegment | null {
  const dx = segment.end[0] - segment.start[0];
  const dy = segment.end[1] - segment.start[1];
  const length = Math.hypot(dx, dy);
  if (length <= MINIMUM_TOLERANCE || Math.abs(dx) <= MINIMUM_TOLERANCE
    || Math.abs(dy) <= MINIMUM_TOLERANCE) return null;
  const [left, right] = segment.start[0] <= segment.end[0]
    ? [segment.start, segment.end]
    : [segment.end, segment.start];
  return {
    segment,
    left,
    right,
    midpoint: [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2],
    length,
  };
}

function lineIntersection(
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2,
  tolerance: number,
): Vec2 | null {
  const firstDirection = [firstEnd[0] - firstStart[0], firstEnd[1] - firstStart[1]] as const;
  const secondDirection = [secondEnd[0] - secondStart[0], secondEnd[1] - secondStart[1]] as const;
  const denominator = cross(firstDirection, secondDirection);
  if (Math.abs(denominator) <= tolerance) return null;
  const between = [secondStart[0] - firstStart[0], secondStart[1] - firstStart[1]] as const;
  const scale = cross(between, secondDirection) / denominator;
  return [
    firstStart[0] + firstDirection[0] * scale,
    firstStart[1] + firstDirection[1] * scale,
  ];
}

function cleanPoint(point: Vec2): Vec2 {
  return [clean(point[0]), clean(point[1])];
}

function includedAngle(vertex: Vec2, first: Vec2, second: Vec2): number {
  const firstVector = [first[0] - vertex[0], first[1] - vertex[1]] as const;
  const secondVector = [second[0] - vertex[0], second[1] - vertex[1]] as const;
  const denominator = Math.hypot(...firstVector) * Math.hypot(...secondVector);
  if (denominator <= MINIMUM_TOLERANCE) return 0;
  const cosine = Math.max(-1, Math.min(1, (
    firstVector[0] * secondVector[0] + firstVector[1] * secondVector[1]
  ) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

function normalizedAngleValue(value: number): number {
  const integer = Math.round(value);
  return Math.abs(value - integer) <= 0.01 ? integer : clean(value);
}

function distanceToSegmentRange(x: number, first: number, second: number): number {
  const minimum = Math.min(first, second);
  const maximum = Math.max(first, second);
  if (x < minimum) return minimum - x;
  if (x > maximum) return x - maximum;
  return 0;
}

function cross(first: Vec2, second: Vec2): number {
  return first[0] * second[1] - first[1] * second[0];
}

function deduplicateFacts(facts: MeasurementFact[]): MeasurementFact[] {
  const byKey = new Map<string, MeasurementFact>();
  for (const fact of facts) {
    const current = byKey.get(fact.key);
    if (!current) {
      byKey.set(fact.key, fact);
      continue;
    }
    current.sourceIds = uniqueStrings([...current.sourceIds, ...fact.sourceIds]) as GeometryId[];
    current.evidenceRefs = uniqueStrings([...current.evidenceRefs, ...fact.evidenceRefs]) as EvidenceId[];
    current.error = Math.min(current.error, fact.error);
  }
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function rangesOverlap(first: SegmentSample, second: SegmentSample, tolerance: number): boolean {
  const firstMin = Math.min(first.start[0], first.end[0]);
  const firstMax = Math.max(first.start[0], first.end[0]);
  const secondMin = Math.min(second.start[0], second.end[0]);
  const secondMax = Math.max(second.start[0], second.end[0]);
  return Math.min(firstMax, secondMax) >= Math.max(firstMin, secondMin) - tolerance;
}

function meanX(segments: SegmentSample[]): number {
  return segments.reduce((sum, segment) => sum + segmentX(segment), 0) / segments.length;
}

function segmentX(segment: SegmentSample): number {
  return (segment.start[0] + segment.end[0]) / 2;
}

function uniqueNodes(nodes: GeometryNode[]): GeometryNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function evidenceOf(nodes: GeometryNode[]): EvidenceId[] {
  return uniqueStrings(nodes.flatMap((node) => node.quality.evidenceRefs)) as EvidenceId[];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function middleSweepRadians(startDegrees: number, endDegrees: number, counterClockwise: boolean): number {
  const start = startDegrees * Math.PI / 180;
  const end = endDegrees * Math.PI / 180;
  const full = Math.PI * 2;
  const sweep = counterClockwise
    ? positiveModulo(end - start, full)
    : -positiveModulo(start - end, full);
  return start + sweep / 2;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function numberKey(value: number): string {
  return clean(value).toFixed(6);
}

function clean(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
