import { describe, expect, it } from 'vitest';

import type { GlobalContour } from './types.js';
import { numberGlobalContours } from './numbering.js';

describe('drawing perception system numbering', () => {
  it('replaces model contour ids in deterministic spatial order', () => {
    const input: GlobalContour[] = [
      contour('model-right', [0.6, 0.1, 0.2, 0.2], 'circle'),
      contour('model-bottom', [0.1, 0.7, 0.2, 0.2], 'polyline'),
      contour('model-left', [0.1, 0.1, 0.2, 0.2], 'line'),
    ];

    const first = numberGlobalContours('run_1', 1, 'Main View', input);
    const retry = numberGlobalContours('run_1', 1, 'Main View', [...input].reverse());

    expect(first.contours.map((item) => [item.id, item.geometryFamily])).toEqual([
      ['ctr_p1_main_view_0001', 'line'],
      ['ctr_p1_main_view_0002', 'circle'],
      ['ctr_p1_main_view_0003', 'polyline'],
    ]);
    expect(retry.contours).toEqual(first.contours);
    expect(first.idMap).toEqual({
      'model-left': 'ctr_p1_main_view_0001',
      'model-right': 'ctr_p1_main_view_0002',
      'model-bottom': 'ctr_p1_main_view_0003',
    });
    expect(first.contours.map((item) => item.id).join(',')).not.toContain('model-');
  });
});

function contour(
  id: string,
  imageBounds: GlobalContour['imageBounds'],
  geometryFamily: GlobalContour['geometryFamily'],
): GlobalContour {
  return {
    id, viewId: 'Main View', geometryFamily, imageBounds,
    closed: geometryFamily !== 'line', confidence: 0.9,
  };
}
