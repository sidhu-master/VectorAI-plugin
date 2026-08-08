import { describe, expect, it } from 'vitest';

import type { AnnotationObservation, GeometryObservation, GlobalContour } from './types.js';
import { numberGlobalContours, numberRegionObservations } from './numbering.js';

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

  it('assigns system ids to regional geometry and annotations', () => {
    const geometry = [
      geometryObservation('model_circle', [0.6, 0.1, 0.2, 0.2], 'circle'),
      geometryObservation('anything', [0.1, 0.1, 0.2, 0.2], 'line'),
    ];
    const annotations: AnnotationObservation[] = [{
      id: 'free-form-model-id', viewId: 'view_1', kind: 'text', rawText: 'A',
      imageBounds: [0.1, 0.7, 0.1, 0.05], arrowheads: [], confidence: 0.8,
    }];

    const result = numberRegionObservations(1, 'view_1', 'region A', geometry, annotations);

    expect(result.geometry.map((item) => item.id)).toEqual([
      'geo_p1_view_1_region_a_0001', 'geo_p1_view_1_region_a_0002',
    ]);
    expect(result.annotations.map((item) => item.id)).toEqual(['txt_p1_view_1_region_a_0001']);
    expect(JSON.stringify(result)).not.toMatch(/model_circle|anything|free-form-model-id/);
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

function geometryObservation(
  id: string,
  imageBounds: GeometryObservation['imageBounds'],
  type: GeometryObservation['type'],
): GeometryObservation {
  return {
    id, viewId: 'view_1', type, imageBounds, measuredParams: type === 'line'
      ? { start: [0.1, 0.1], end: [0.3, 0.1] }
      : { center: [0.7, 0.2], radius: 0.1 },
    confidence: 0.8,
  };
}
