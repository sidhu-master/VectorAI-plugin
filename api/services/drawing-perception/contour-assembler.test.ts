import { describe, expect, it } from 'vitest';

import type { ContourEvidence, GlobalContour } from './types.js';
import { assembleContours } from './contour-assembler.js';

describe('global contour assembler', () => {
  it('assembles two regional arc-like fragments into one global circle', () => {
    const result = assembleContours({
      contours: [circleContour('outer_circle')],
      evidence: [
        evidence('left_fragment', 'outer_circle', [[0.2, 0.5], [0.5, 0.2], [0.5, 0.8]]),
        evidence('right_fragment', 'outer_circle', [[0.8, 0.5], [0.5, 0.2], [0.5, 0.8]]),
      ],
    });

    expect(result.geometry).toEqual([expect.objectContaining({
      id: 'global_contour_outer_circle',
      type: 'circle',
      measuredParams: expect.objectContaining({ center: [0.5, 0.5], radius: 0.3 }),
    })]);
    expect(result.geometry.some((item) => item.type === 'arc')).toBe(false);
    expect(result.unresolvedContourIds).toEqual([]);
  });

  it('fits a circle from contour evidence when coarse analytic parameters are absent', () => {
    const contour = circleContour('fitted_circle');
    delete contour.coarseParams;

    const result = assembleContours({
      contours: [contour],
      evidence: [evidence('samples', 'fitted_circle', [
        [0.2, 0.5], [0.5, 0.2], [0.8, 0.5], [0.5, 0.8],
      ])],
    });

    expect(result.geometry[0]).toMatchObject({
      type: 'circle',
      measuredParams: { center: [0.5, 0.5], radius: 0.3 },
    });
  });

  it('keeps crop-edge evidence without a global contour out of Drawing geometry', () => {
    const result = assembleContours({
      contours: [],
      evidence: [{
        id: 'orphan_fragment', viewId: 'view_1', imageBounds: [0.45, 0.1, 0.05, 0.3],
        samplePoints: [[0.45, 0.1], [0.5, 0.4]], confidence: 0.8,
        touchesCropEdge: true,
      }],
    });

    expect(result.geometry).toEqual([]);
    expect(result.warnings).toContain('轮廓证据 orphan_fragment 缺少全局轮廓归属');
  });

  it('reports a global contour unresolved when neither coarse parameters nor enough evidence exist', () => {
    const contour = circleContour('unresolved_circle');
    delete contour.coarseParams;

    const result = assembleContours({
      contours: [contour],
      evidence: [evidence('too_short', 'unresolved_circle', [[0.2, 0.5], [0.5, 0.2]])],
    });

    expect(result.geometry).toEqual([]);
    expect(result.unresolvedContourIds).toEqual(['unresolved_circle']);
  });
});

function circleContour(id: string): GlobalContour {
  return {
    id, viewId: 'view_1', geometryFamily: 'circle', imageBounds: [0.2, 0.2, 0.6, 0.6],
    closed: true, confidence: 0.9,
    coarseParams: { center: [0.5, 0.5], radius: 0.3 },
  };
}

function evidence(
  id: string,
  globalContourId: string,
  samplePoints: Array<[number, number]>,
): ContourEvidence {
  return {
    id, viewId: 'view_1', globalContourId, imageBounds: [0.2, 0.2, 0.6, 0.6],
    samplePoints, confidence: 0.88, touchesCropEdge: true,
  };
}
