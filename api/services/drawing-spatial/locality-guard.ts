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
  const documentWidth = span(input.documentBounds.minX, input.documentBounds.maxX);
  const documentHeight = span(input.documentBounds.minY, input.documentBounds.maxY);
  const envelopeWidth = span(input.envelopeBounds.minX, input.envelopeBounds.maxX);
  const envelopeHeight = span(input.envelopeBounds.minY, input.envelopeBounds.maxY);
  const metrics: LocalityMetrics = {
    areaRatio: envelopeWidth * envelopeHeight / (documentWidth * documentHeight),
    widthRatio: envelopeWidth / documentWidth,
    heightRatio: envelopeHeight / documentHeight,
    targetCenterDistanceRatio: input.targetHint.approximateBounds
      ? centerDistance(input.envelopeBounds, input.targetHint.approximateBounds)
        / Math.hypot(documentWidth, documentHeight)
      : null,
    ...input.counts,
  };
  const issues: SearchEnvelopeAssessment['issues'] = [];
  if (metrics.areaRatio > input.budget.maxAreaRatio) {
    issues.push({
      code: 'ENVELOPE_AREA_EXCEEDED',
      message: `搜索区域占图纸面积 ${(metrics.areaRatio * 100).toFixed(1)}%，超过当前目标预算`,
    });
  }
  if (Math.max(metrics.widthRatio, metrics.heightRatio) > input.budget.maxSpanRatio) {
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

function span(min: number, max: number): number {
  return Math.max(max - min, 1e-9);
}

function centerDistance(left: Bounds2D, right: Bounds2D): number {
  return Math.hypot(
    (left.minX + left.maxX - right.minX - right.maxX) / 2,
    (left.minY + left.maxY - right.minY - right.maxY) / 2,
  );
}
