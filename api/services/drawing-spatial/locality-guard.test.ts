import { describe, expect, it } from 'vitest';

import { assessSearchEnvelope, localityBudgetFor } from './locality-guard.js';

const documentBounds = { minX: 20.26, minY: 36.48, maxX: 470.99, maxY: 636.29 };

describe('assessSearchEnvelope', () => {
  it('rejects the real failed right-arm envelope before design', () => {
    const result = assessSearchEnvelope({
      documentBounds,
      envelopeBounds: { minX: 83.3622, minY: 120.4534, maxX: 182.5228, maxY: 486.3382 },
      targetHint: {
        semanticDescription: '把图形的右手举起来打招呼',
        approximateBounds: { minX: 300, minY: 200, maxX: 430, maxY: 300 },
        preferredScale: 'part',
      },
      counts: { wholeNodes: 3, crossingNodes: 9, boundaryAnchors: 11, candidateFragments: 25 },
      budget: localityBudgetFor('part'),
    });

    expect(result.accepted).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'ENVELOPE_SPAN_EXCEEDED',
      'ENVELOPE_COMPLEXITY_EXCEEDED',
    ]));
    expect(result.metrics.heightRatio).toBeGreaterThan(0.6);
  });

  it('accepts a compact arm envelope within a part-scale budget', () => {
    const result = assessSearchEnvelope({
      documentBounds,
      envelopeBounds: { minX: 302, minY: 205, maxX: 421, maxY: 296 },
      targetHint: {
        semanticDescription: '把图形的右手举起来打招呼',
        approximateBounds: { minX: 300, minY: 200, maxX: 430, maxY: 300 },
        preferredScale: 'part',
      },
      counts: { wholeNodes: 2, crossingNodes: 2, boundaryAnchors: 2, candidateFragments: 7 },
      budget: localityBudgetFor('part'),
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('does not reject an anatomical-side target only because its horizontal center differs', () => {
    const result = assessSearchEnvelope({
      documentBounds,
      envelopeBounds: { minX: 70, minY: 200, maxX: 160, maxY: 285 },
      targetHint: {
        semanticDescription: '抬起角色的右手',
        approximateBounds: { minX: 300, minY: 200, maxX: 430, maxY: 300 },
        preferredScale: 'part',
      },
      counts: { wholeNodes: 1, crossingNodes: 2, boundaryAnchors: 2, candidateFragments: 6 },
      budget: localityBudgetFor('part'),
    });

    expect(result.accepted).toBe(true);
    expect(result.metrics.targetCenterDistanceRatio).toBeGreaterThan(0.2);
  });
});
