import type {
  LocalityBudget,
  LocalityMetrics,
  SearchEnvelopeAssessment,
  TargetHint,
} from '../../../src/contracts/drawing-spatial-region.js';
import type { Bounds2D } from '../../../src/drawing/index.js';

export interface SearchEnvelopeCounts {
  wholeNodes: number;
  crossingNodes: number;
  boundaryAnchors: number;
  candidateFragments: number;
}

export function localityBudgetFor(scale: TargetHint['preferredScale']): LocalityBudget {
  switch (scale) {
    case 'detail':
      return budget(0.08, 0.32, 4, 4, 4, 12);
    case 'part':
      return budget(0.25, 0.55, 6, 6, 6, 18);
    case 'assembly':
      return budget(0.6, 0.82, 20, 20, 16, 60);
    case 'drawing':
      return budget(1.05, 1.05, 10_000, 10_000, 10_000, 50_000);
  }
}

export function assessSearchEnvelope(input: {
  documentBounds: Bounds2D;
  envelopeBounds: Bounds2D;
  targetHint: TargetHint;
  counts: SearchEnvelopeCounts;
  budget: LocalityBudget;
}): SearchEnvelopeAssessment {
  const documentWidth = rawSpan(input.documentBounds.minX, input.documentBounds.maxX);
  const documentHeight = rawSpan(input.documentBounds.minY, input.documentBounds.maxY);
  const envelopeWidth = rawSpan(input.envelopeBounds.minX, input.envelopeBounds.maxX);
  const envelopeHeight = rawSpan(input.envelopeBounds.minY, input.envelopeBounds.maxY);
  const activeAxes = meaningfulAxes(documentWidth, documentHeight);
  const widthRatio = activeAxes.x ? envelopeWidth / documentWidth : 0;
  const heightRatio = activeAxes.y ? envelopeHeight / documentHeight : 0;
  const metrics: LocalityMetrics = {
    areaRatio: dimensionalAreaRatio(widthRatio, heightRatio, activeAxes),
    widthRatio,
    heightRatio,
    targetCenterDistanceRatio: input.targetHint.approximateBounds
      ? centerDistance(input.envelopeBounds, input.targetHint.approximateBounds)
        / Math.hypot(documentWidth, documentHeight)
      : null,
    ...input.counts,
  };
  const issues: SearchEnvelopeAssessment['issues'] = [];
  const targetRatios = input.targetHint.approximateBounds
    ? boundsRatios(input.targetHint.approximateBounds, input.documentBounds)
    : null;
  const allowedAreaRatio = Math.max(
    input.budget.maxAreaRatio,
    (targetRatios?.areaRatio ?? 0) * 1.8,
  );
  const allowedSpanRatio = Math.max(
    input.budget.maxSpanRatio,
    Math.max(targetRatios?.widthRatio ?? 0, targetRatios?.heightRatio ?? 0) * 1.35,
  );
  if (metrics.areaRatio > allowedAreaRatio) {
    issues.push({
      code: 'ENVELOPE_AREA_EXCEEDED',
      message: `搜索区域占图纸面积 ${(metrics.areaRatio * 100).toFixed(1)}%，超过当前目标预算`,
    });
  }
  if (Math.max(metrics.widthRatio, metrics.heightRatio) > allowedSpanRatio) {
    issues.push({
      code: 'ENVELOPE_SPAN_EXCEEDED',
      message: `搜索区域跨度达到图纸的 ${(Math.max(metrics.widthRatio, metrics.heightRatio) * 100).toFixed(1)}%`,
    });
  }
  const complexityExceeded = metrics.wholeNodes > input.budget.maxWholeNodes
    || metrics.crossingNodes > input.budget.maxCrossingNodes
    || metrics.boundaryAnchors > input.budget.maxBoundaryAnchors
    || metrics.candidateFragments > input.budget.maxCandidateFragments;
  if (complexityExceeded) {
    issues.push({
      code: 'ENVELOPE_COMPLEXITY_EXCEEDED',
      message: [
        `完整图元 ${metrics.wholeNodes}`,
        `跨边界图元 ${metrics.crossingNodes}`,
        `边界锚点 ${metrics.boundaryAnchors}`,
        `候选片段 ${metrics.candidateFragments}`,
      ].join('，'),
    });
  }
  return { accepted: issues.length === 0, metrics, issues };
}

function boundsRatios(bounds: Bounds2D, document: Bounds2D) {
  const documentWidth = rawSpan(document.minX, document.maxX);
  const documentHeight = rawSpan(document.minY, document.maxY);
  const activeAxes = meaningfulAxes(documentWidth, documentHeight);
  const widthRatio = activeAxes.x
    ? rawSpan(bounds.minX, bounds.maxX) / documentWidth
    : 0;
  const heightRatio = activeAxes.y
    ? rawSpan(bounds.minY, bounds.maxY) / documentHeight
    : 0;
  return {
    widthRatio,
    heightRatio,
    areaRatio: dimensionalAreaRatio(widthRatio, heightRatio, activeAxes),
  };
}

function budget(
  maxAreaRatio: number,
  maxSpanRatio: number,
  maxWholeNodes: number,
  maxCrossingNodes: number,
  maxBoundaryAnchors: number,
  maxCandidateFragments: number,
): LocalityBudget {
  return {
    maxAreaRatio,
    maxSpanRatio,
    maxWholeNodes,
    maxCrossingNodes,
    maxBoundaryAnchors,
    maxCandidateFragments,
  };
}

function rawSpan(min: number, max: number): number {
  return Math.max(max - min, 0);
}

function meaningfulAxes(width: number, height: number): { x: boolean; y: boolean } {
  const reference = Math.max(width, height, 1);
  const epsilon = reference * 1e-6;
  return { x: width > epsilon, y: height > epsilon };
}

function dimensionalAreaRatio(
  widthRatio: number,
  heightRatio: number,
  axes: { x: boolean; y: boolean },
): number {
  if (axes.x && axes.y) return widthRatio * heightRatio;
  if (axes.x) return widthRatio;
  if (axes.y) return heightRatio;
  return 0;
}

function centerDistance(left: Bounds2D, right: Bounds2D): number {
  return Math.hypot(
    (left.minX + left.maxX - right.minX - right.maxX) / 2,
    (left.minY + left.maxY - right.minY - right.maxY) / 2,
  );
}
