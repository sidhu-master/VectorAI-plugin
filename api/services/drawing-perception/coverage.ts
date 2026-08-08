import type { GeometryObservation, NormalizedImageBounds } from './types.js';
import type { PerceptionRegion } from './regions.js';

export type DrawingCoverageRegionStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'refine'
  | 'failed'
  | 'budget_exhausted';

export interface DrawingCoverageAssessment {
  complete: boolean;
  confidence: number;
  unreadBounds: NormalizedImageBounds[];
  reasons: string[];
}

export interface DrawingCoverageRegion extends PerceptionRegion {
  parentId?: string;
  depth: number;
  status: DrawingCoverageRegionStatus;
  attempts: number;
  geometryCount: number;
  annotationCount: number;
  assessment: DrawingCoverageAssessment | null;
  refinementReasons: string[];
}

export interface DrawingCoverageLedger {
  runId: string;
  page: number;
  regions: DrawingCoverageRegion[];
  complete: boolean;
  warnings: string[];
}

export interface CoverageLimits {
  maxDepth: number;
  maxRegions: number;
}

export interface RegionRefinementDecision {
  refine: boolean;
  budgetExhausted: boolean;
  reasons: string[];
}

export function createCoverageRegion(
  region: PerceptionRegion,
  options: { parentId?: string; depth?: number } = {},
): DrawingCoverageRegion {
  return {
    ...structuredClone(region),
    ...(options.parentId ? { parentId: options.parentId } : {}),
    depth: options.depth ?? 0,
    status: 'pending',
    attempts: 0,
    geometryCount: 0,
    annotationCount: 0,
    assessment: null,
    refinementReasons: [],
  };
}

export function decideRegionRefinement(input: {
  region: DrawingCoverageRegion;
  viewBounds: NormalizedImageBounds;
  assessment: DrawingCoverageAssessment | null;
  geometry: GeometryObservation[];
  annotationCount: number;
  extractionErrorCount: number;
  currentRegionCount: number;
  limits: CoverageLimits;
}): RegionRefinementDecision {
  const reasons: string[] = [];
  if (!input.assessment) reasons.push('assessment_unavailable');
  else if (!input.assessment.complete || input.assessment.unreadBounds.length > 0) {
    reasons.push('model_incomplete');
  }
  if (input.extractionErrorCount > 0) reasons.push('extraction_error');
  if (input.geometry.length >= 16) reasons.push('geometry_saturated');
  if (input.annotationCount >= 24) reasons.push('annotation_saturated');
  if (input.geometry.some((item) => touchesInternalEdge(
    item.imageBounds,
    input.region.pageBounds,
    input.viewBounds,
  ))) reasons.push('internal_edge_clipped');

  if (reasons.length === 0) return { refine: false, budgetExhausted: false, reasons };
  if (input.region.depth >= input.limits.maxDepth) {
    return { refine: false, budgetExhausted: true, reasons: [...reasons, 'max_depth'] };
  }
  if (input.currentRegionCount + 2 > input.limits.maxRegions) {
    return { refine: false, budgetExhausted: true, reasons: [...reasons, 'max_regions'] };
  }
  return { refine: true, budgetExhausted: false, reasons };
}

export function splitPerceptionRegion(input: {
  region: DrawingCoverageRegion;
  pageHeightToWidthRatio: number;
  overlapFraction?: number;
}): DrawingCoverageRegion[] {
  const overlapFraction = input.overlapFraction ?? 0.04;
  const [x, y, width, height] = input.region.pageBounds;
  const splitY = height * input.pageHeightToWidthRatio >= width;
  const origin = splitY ? y : x;
  const span = splitY ? height : width;
  const midpoint = origin + span / 2;
  const overlap = span * overlapFraction;
  const bounds: [NormalizedImageBounds, NormalizedImageBounds] = splitY
    ? [
        [x, y, width, round(midpoint - y + overlap / 2)],
        [x, round(midpoint - overlap / 2), width, round(y + height - midpoint + overlap / 2)],
      ]
    : [
        [x, y, round(midpoint - x + overlap / 2), height],
        [round(midpoint - overlap / 2), y, round(x + width - midpoint + overlap / 2), height],
      ];
  return bounds.map((pageBounds, index) => createCoverageRegion({
    id: `${input.region.id}_child_${index + 1}`,
    viewId: input.region.viewId,
    pageBounds,
  }, {
    parentId: input.region.id,
    depth: input.region.depth + 1,
  }));
}

export function createTargetedRefinementRegion(input: {
  region: DrawingCoverageRegion;
  unreadBounds: NormalizedImageBounds[];
  paddingFraction?: number;
}): DrawingCoverageRegion {
  const padding = input.paddingFraction ?? 0.06;
  const left = Math.max(0, Math.min(...input.unreadBounds.map((bounds) => bounds[0])) - padding);
  const top = Math.max(0, Math.min(...input.unreadBounds.map((bounds) => bounds[1])) - padding);
  const right = Math.min(1, Math.max(
    ...input.unreadBounds.map((bounds) => bounds[0] + bounds[2]),
  ) + padding);
  const bottom = Math.min(1, Math.max(
    ...input.unreadBounds.map((bounds) => bounds[1] + bounds[3]),
  ) + padding);
  const [regionX, regionY, regionWidth, regionHeight] = input.region.pageBounds;
  return createCoverageRegion({
    id: `${input.region.id}_focus_1`,
    viewId: input.region.viewId,
    pageBounds: [
      round(regionX + left * regionWidth),
      round(regionY + top * regionHeight),
      round((right - left) * regionWidth),
      round((bottom - top) * regionHeight),
    ],
  }, {
    parentId: input.region.id,
    depth: input.region.depth + 1,
  });
}

function touchesInternalEdge(
  observation: NormalizedImageBounds,
  region: NormalizedImageBounds,
  view: NormalizedImageBounds,
): boolean {
  const epsilon = 0.005;
  const [left, top, width, height] = observation;
  const right = left + width;
  const bottom = top + height;
  const [regionLeft, regionTop, regionWidth, regionHeight] = region;
  const regionRight = regionLeft + regionWidth;
  const regionBottom = regionTop + regionHeight;
  const [viewLeft, viewTop, viewWidth, viewHeight] = view;
  const viewRight = viewLeft + viewWidth;
  const viewBottom = viewTop + viewHeight;
  return (regionLeft > viewLeft + epsilon && left <= regionLeft + epsilon)
    || (regionRight < viewRight - epsilon && right >= regionRight - epsilon)
    || (regionTop > viewTop + epsilon && top <= regionTop + epsilon)
    || (regionBottom < viewBottom - epsilon && bottom >= regionBottom - epsilon);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
