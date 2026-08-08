import type { Vec2 } from '../../../src/drawing/index.js';
import type {
  AnnotationObservation,
  ContourEvidence,
  DrawingView,
  GeometryObservation,
  GlobalContour,
  NormalizedImageBounds,
} from './types.js';

export interface PerceptionRegion {
  id: string;
  viewId: string;
  pageBounds: NormalizedImageBounds;
}

export interface PerceptionPageMetrics {
  heightToWidthRatio?: number;
}

export function planPerceptionRegions(
  view: DrawingView,
  page: PerceptionPageMetrics,
): PerceptionRegion[] {
  const [x, y, width, height] = view.imageBounds;
  const coversPage = width * height >= 0.75;
  if (!coversPage || (view.kind !== 'primary' && view.kind !== 'unknown')) {
    return [region(view, 1, view.imageBounds)];
  }

  const pixelAspect = height / width * (page.heightToWidthRatio ?? 1);
  if (pixelAspect >= 1.2) {
    return split(view, 'y', 3, 0.04);
  }
  if (pixelAspect <= 1 / 1.2) {
    return split(view, 'x', 3, 0.04);
  }
  return [
    region(view, 1, [x, y, width, round(height * 0.52)]),
    region(view, 2, [x, round(y + height * 0.48), width, round(height * 0.52)]),
  ];
}

export function stitchGeometryObservation(
  observation: GeometryObservation,
  region: PerceptionRegion,
  pageHeightToWidthRatio: number,
): GeometryObservation {
  return {
    ...structuredClone(observation),
    id: stitchedId(region.id, observation.id),
    viewId: region.viewId,
    imageBounds: transformBounds(observation.imageBounds, region.pageBounds),
    measuredParams: stitchGeometryParams(
      observation.type,
      observation.measuredParams,
      region.pageBounds,
      pageHeightToWidthRatio,
    ),
  };
}

export function stitchAnnotationObservation(
  observation: AnnotationObservation,
  region: PerceptionRegion,
): AnnotationObservation {
  return {
    ...structuredClone(observation),
    id: stitchedId(region.id, observation.id),
    viewId: region.viewId,
    imageBounds: transformBounds(observation.imageBounds, region.pageBounds),
    arrowheads: observation.arrowheads.map((point) => transformImagePoint(point, region.pageBounds)),
  };
}

export function stitchGlobalContour(
  contour: GlobalContour,
  region: PerceptionRegion,
  pageHeightToWidthRatio: number,
): GlobalContour {
  const stitched = stitchGeometryObservation({
    id: contour.id,
    viewId: contour.viewId,
    type: contour.geometryFamily,
    imageBounds: contour.imageBounds,
    measuredParams: contour.coarseParams ?? {},
    confidence: contour.confidence,
  }, region, pageHeightToWidthRatio);
  return {
    id: stitched.id,
    viewId: stitched.viewId,
    geometryFamily: stitched.type,
    imageBounds: stitched.imageBounds,
    closed: contour.closed,
    confidence: stitched.confidence,
    ...(contour.coarseParams ? { coarseParams: stitched.measuredParams } : {}),
  };
}

export function stitchContourEvidence(
  evidence: ContourEvidence,
  region: PerceptionRegion,
): ContourEvidence {
  return {
    ...structuredClone(evidence),
    id: stitchedId(region.id, evidence.id),
    viewId: region.viewId,
    imageBounds: transformBounds(evidence.imageBounds, region.pageBounds),
    samplePoints: evidence.samplePoints.map((point) => transformImagePoint(point, region.pageBounds)),
  };
}

export function projectGlobalContoursToRegion(
  contours: GlobalContour[],
  region: PerceptionRegion,
): Array<Pick<GlobalContour, 'id' | 'geometryFamily' | 'imageBounds'>> {
  return contours.flatMap((contour) => {
    const intersection = intersectBounds(contour.imageBounds, region.pageBounds);
    if (!intersection) return [];
    return [{
      id: contour.id,
      geometryFamily: contour.geometryFamily,
      imageBounds: projectBounds(intersection, region.pageBounds),
    }];
  });
}

export function deduplicateGeometryObservations(
  observations: GeometryObservation[],
): GeometryObservation[] {
  const retained: GeometryObservation[] = [];
  const sorted = [...observations].sort((first, second) =>
    second.confidence - first.confidence || first.id.localeCompare(second.id));
  for (const observation of sorted) {
    if (!retained.some((candidate) => isDuplicateGeometry(observation, candidate))) {
      retained.push(observation);
    }
  }
  return retained;
}

export function deduplicateAnnotationObservations(
  observations: AnnotationObservation[],
): AnnotationObservation[] {
  const retained: AnnotationObservation[] = [];
  const sorted = [...observations].sort((first, second) =>
    second.confidence - first.confidence || first.id.localeCompare(second.id));
  for (const observation of sorted) {
    const duplicate = retained.some((candidate) =>
      candidate.viewId === observation.viewId
      && candidate.kind === observation.kind
      && normalizeText(candidate.rawText) === normalizeText(observation.rawText)
      && boundsIou(candidate.imageBounds, observation.imageBounds) >= 0.5);
    if (!duplicate) retained.push(observation);
  }
  return retained;
}

function split(
  view: DrawingView,
  axis: 'x' | 'y',
  count: number,
  overlapFraction: number,
): PerceptionRegion[] {
  const [x, y, width, height] = view.imageBounds;
  const origin = axis === 'x' ? x : y;
  const span = axis === 'x' ? width : height;
  const segment = span / count;
  const overlap = span * overlapFraction;
  return Array.from({ length: count }, (_, index) => {
    const start = index === 0 ? origin : origin + index * segment - overlap / 2;
    const end = index === count - 1
      ? origin + span
      : origin + (index + 1) * segment + overlap / 2;
    const bounds: NormalizedImageBounds = axis === 'x'
      ? [round(start), y, round(end - start), height]
      : [x, round(start), width, round(end - start)];
    return region(view, index + 1, bounds);
  });
}

function region(
  view: DrawingView,
  index: number,
  pageBounds: NormalizedImageBounds,
): PerceptionRegion {
  return {
    id: `${view.id}_region_${index}`,
    viewId: view.id,
    pageBounds,
  };
}

function stitchGeometryParams(
  type: GeometryObservation['type'],
  original: Record<string, unknown>,
  bounds: NormalizedImageBounds,
  pageRatio: number,
): Record<string, unknown> {
  const params = structuredClone(original);
  switch (type) {
    case 'point':
      if (isNumber(params.x) && isNumber(params.y)) {
        const point = transformCadPoint([params.x, params.y], bounds, pageRatio);
        return { ...params, x: point[0], y: point[1] };
      }
      return params;
    case 'line': return transformPointFields(params, ['start', 'end'], bounds, pageRatio);
    case 'ray':
    case 'xline':
      return {
        ...transformPointFields(params, ['origin'], bounds, pageRatio),
        ...(isPoint(params.direction)
          ? { direction: normalize(transformCadVector(params.direction, bounds, pageRatio)) }
          : {}),
      };
    case 'circle':
    case 'arc':
      return {
        ...transformPointFields(params, ['center'], bounds, pageRatio),
        ...(isNumber(params.radius) ? { radius: round(params.radius * bounds[2]) } : {}),
      };
    case 'ellipse':
      return {
        ...transformPointFields(params, ['center'], bounds, pageRatio),
        ...(isPoint(params.majorAxis)
          ? { majorAxis: transformCadVector(params.majorAxis, bounds, pageRatio) }
          : {}),
      };
    case 'polyline':
      return {
        ...params,
        ...(Array.isArray(params.vertices) ? {
          vertices: params.vertices.map((vertex) => transformVertex(vertex, bounds, pageRatio)),
        } : {}),
      };
    case 'spline':
      return {
        ...params,
        ...(Array.isArray(params.controlPoints) ? {
          controlPoints: params.controlPoints.map((point) => isPoint(point)
            ? transformCadPoint(point, bounds, pageRatio)
            : point),
        } : {}),
      };
    default: return params;
  }
}

function transformPointFields(
  params: Record<string, unknown>,
  fields: string[],
  bounds: NormalizedImageBounds,
  pageRatio: number,
): Record<string, unknown> {
  const transformed = { ...params };
  for (const field of fields) {
    if (isPoint(params[field])) {
      transformed[field] = transformCadPoint(params[field], bounds, pageRatio);
    }
  }
  return transformed;
}

function transformVertex(
  vertex: unknown,
  bounds: NormalizedImageBounds,
  pageRatio: number,
): unknown {
  if (isPoint(vertex)) return transformCadPoint(vertex, bounds, pageRatio);
  if (!vertex || typeof vertex !== 'object') return vertex;
  const record = vertex as Record<string, unknown>;
  return isPoint(record.point)
    ? { ...record, point: transformCadPoint(record.point, bounds, pageRatio) }
    : record;
}

function transformBounds(
  local: NormalizedImageBounds,
  page: NormalizedImageBounds,
): NormalizedImageBounds {
  return [
    round(page[0] + local[0] * page[2]),
    round(page[1] + local[1] * page[3]),
    round(local[2] * page[2]),
    round(local[3] * page[3]),
  ];
}

function intersectBounds(
  first: NormalizedImageBounds,
  second: NormalizedImageBounds,
): NormalizedImageBounds | null {
  const left = Math.max(first[0], second[0]);
  const top = Math.max(first[1], second[1]);
  const right = Math.min(first[0] + first[2], second[0] + second[2]);
  const bottom = Math.min(first[1] + first[3], second[1] + second[3]);
  if (right <= left || bottom <= top) return null;
  return [round(left), round(top), round(right - left), round(bottom - top)];
}

function projectBounds(
  pageBounds: NormalizedImageBounds,
  regionBounds: NormalizedImageBounds,
): NormalizedImageBounds {
  return [
    round((pageBounds[0] - regionBounds[0]) / regionBounds[2]),
    round((pageBounds[1] - regionBounds[1]) / regionBounds[3]),
    round(pageBounds[2] / regionBounds[2]),
    round(pageBounds[3] / regionBounds[3]),
  ];
}

function transformImagePoint(point: Vec2, page: NormalizedImageBounds): Vec2 {
  return [round(page[0] + point[0] * page[2]), round(page[1] + point[1] * page[3])];
}

function transformCadPoint(
  point: Vec2,
  page: NormalizedImageBounds,
  pageRatio: number,
): Vec2 {
  return [
    round(page[0] + point[0] * page[2]),
    round((page[1] + point[1] * page[3]) * pageRatio),
  ];
}

function transformCadVector(
  vector: Vec2,
  page: NormalizedImageBounds,
  pageRatio: number,
): Vec2 {
  return [round(vector[0] * page[2]), round(vector[1] * page[3] * pageRatio)];
}

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector[0], vector[1]);
  return length === 0 ? vector : [round(vector[0] / length), round(vector[1] / length)];
}

function isDuplicateGeometry(first: GeometryObservation, second: GeometryObservation): boolean {
  if (first.viewId !== second.viewId || first.type !== second.type
    || boundsIou(first.imageBounds, second.imageBounds) < 0.8) return false;
  if (first.type === 'circle') {
    const firstCenter = first.measuredParams.center;
    const secondCenter = second.measuredParams.center;
    const firstRadius = first.measuredParams.radius;
    const secondRadius = second.measuredParams.radius;
    return isPoint(firstCenter) && isPoint(secondCenter)
      && isNumber(firstRadius) && isNumber(secondRadius)
      && distance(firstCenter, secondCenter) <= Math.max(0.005, firstRadius * 0.1)
      && Math.abs(firstRadius - secondRadius) / Math.max(firstRadius, secondRadius) <= 0.08;
  }
  if (first.type === 'line') {
    return linesClose(first.measuredParams, second.measuredParams);
  }
  return boundsIou(first.imageBounds, second.imageBounds) >= 0.9;
}

function linesClose(
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): boolean {
  if (!isPoint(first.start) || !isPoint(first.end)
    || !isPoint(second.start) || !isPoint(second.end)) return false;
  const direct = distance(first.start, second.start) + distance(first.end, second.end);
  const reverse = distance(first.start, second.end) + distance(first.end, second.start);
  return Math.min(direct, reverse) <= 0.02;
}

function boundsIou(first: NormalizedImageBounds, second: NormalizedImageBounds): number {
  const left = Math.max(first[0], second[0]);
  const top = Math.max(first[1], second[1]);
  const right = Math.min(first[0] + first[2], second[0] + second[2]);
  const bottom = Math.min(first[1] + first[3], second[1] + second[3]);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = first[2] * first[3] + second[2] * second[3] - intersection;
  return union > 0 ? intersection / union : 0;
}

function stitchedId(regionId: string, observationId: string): string {
  return `${regionId}__${observationId}`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

function isPoint(value: unknown): value is Vec2 {
  return Array.isArray(value) && value.length >= 2
    && isNumber(value[0]) && isNumber(value[1]);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function round(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}
