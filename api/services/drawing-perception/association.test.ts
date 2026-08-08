import { describe, expect, it } from 'vitest';

import { associateDimensions } from './associate-dimensions.js';
import { buildDrawingTopology } from './topology.js';
import type { AnnotationObservation, GeometryObservation } from './types.js';

describe('drawing topology and dimension association', () => {
  it('builds stable closed and disconnected components without crossing views', () => {
    const observations: GeometryObservation[] = [
      circle('circle_b', 'view_1', [0.4, 0.1, 0.1, 0.1]),
      circle('circle_a', 'view_1', [0.1, 0.1, 0.1, 0.1]),
      line('line_a', 'view_2', [0.1, 0.1], [0.3, 0.1]),
    ];

    const first = buildDrawingTopology(observations);
    const second = buildDrawingTopology([...observations].reverse());

    expect(first).toEqual(second);
    expect(first.components).toHaveLength(3);
    expect(first.components.filter((component) => component.closed)).toHaveLength(2);
    expect(first.components.find((component) => component.observationIds.includes('line_a'))?.viewId)
      .toBe('view_2');
  });

  it('associates diameter with a circle and radius with an arc', () => {
    const geometry = [
      circle('circle_1', 'view_1', [0.1, 0.1, 0.2, 0.2]),
      arc('arc_1', 'view_1', [0.6, 0.1, 0.2, 0.2]),
    ];
    const annotations = [
      annotation('ann_diameter', 'diameter', [0.12, 0.32, 0.18, 0.08], [[0.2, 0.3]]),
      annotation('ann_radius', 'radius', [0.62, 0.32, 0.18, 0.08], [[0.7, 0.3]]),
    ];

    const associations = associateDimensions({ annotations, geometry });

    expect(associations[0]).toMatchObject({
      annotationId: 'ann_diameter', status: 'resolved',
      targets: [{ geometryObservationId: 'circle_1', anchor: { kind: 'center' } }],
    });
    expect(associations[1]).toMatchObject({
      annotationId: 'ann_radius', status: 'resolved',
      targets: [{ geometryObservationId: 'arc_1', anchor: { kind: 'center' } }],
    });
  });

  it('associates aligned/ordinate dimensions to line endpoints and angular dimensions to two lines', () => {
    const geometry = [
      line('horizontal', 'view_1', [0.1, 0.2], [0.5, 0.2]),
      line('vertical', 'view_1', [0.1, 0.2], [0.1, 0.6]),
    ];
    const annotations = [
      annotation('ann_aligned', 'aligned', [0.2, 0.05, 0.2, 0.08], [[0.1, 0.2], [0.5, 0.2]]),
      annotation('ann_ordinate', 'ordinate', [0.02, 0.3, 0.07, 0.1], [[0.1, 0.2], [0.1, 0.6]]),
      annotation('ann_angle', 'angular', [0.12, 0.22, 0.1, 0.1], [[0.1, 0.2]]),
    ];

    const associations = associateDimensions({ annotations, geometry });

    expect(associations[0].targets).toEqual([
      { geometryObservationId: 'horizontal', anchor: { kind: 'start' } },
      { geometryObservationId: 'horizontal', anchor: { kind: 'end' } },
    ]);
    expect(associations[1].targets).toEqual([
      { geometryObservationId: 'vertical', anchor: { kind: 'start' } },
      { geometryObservationId: 'vertical', anchor: { kind: 'end' } },
    ]);
    expect(associations[2]).toMatchObject({
      status: 'resolved',
      targets: [
        { geometryObservationId: 'horizontal' },
        { geometryObservationId: 'vertical' },
      ],
    });
  });

  it('marks two nearly equal candidates ambiguous with scored reasons', () => {
    const geometry = [
      circle('circle_left', 'view_1', [0.3, 0.2, 0.1, 0.1]),
      circle('circle_right', 'view_1', [0.41, 0.2, 0.1, 0.1]),
    ];
    const annotations = [
      annotation('ann_diameter', 'diameter', [0.35, 0.32, 0.1, 0.06], [[0.405, 0.29]]),
    ];

    const [association] = associateDimensions({
      annotations, geometry, ambiguityDelta: 0.12,
    });

    expect(association.status).toBe('ambiguous');
    expect(association.candidates).toHaveLength(2);
    expect(association.candidates?.[0].reasons).toContain('symbol-compatible');
  });

  it('marks symbol-incompatible dimensions as conflict', () => {
    const [association] = associateDimensions({
      annotations: [annotation('ann_diameter', 'diameter', [0.1, 0.1, 0.2, 0.1], [])],
      geometry: [line('line_only', 'view_1', [0.1, 0.2], [0.3, 0.2])],
    });

    expect(association).toMatchObject({
      annotationId: 'ann_diameter', status: 'conflict', targets: [], score: 0,
    });
  });

  it('does not bind endpoint dimensions to an infinite construction line', () => {
    const [association] = associateDimensions({
      annotations: [annotation(
        'ann_linear', 'linear', [0.2, 0.1, 0.2, 0.08], [[0.2, 0.2], [0.4, 0.2]],
      )],
      geometry: [{
        id: 'datum_xline', viewId: 'view_1', type: 'xline',
        imageBounds: [0.3, 0, 0.01, 1],
        measuredParams: { origin: [0.3, 0], direction: [0, 1] },
        confidence: 0.9,
      }],
    });

    expect(association).toMatchObject({
      annotationId: 'ann_linear', status: 'conflict', targets: [],
    });
  });
});

function circle(
  id: string,
  viewId: string,
  imageBounds: [number, number, number, number],
): GeometryObservation {
  return {
    id, viewId, type: 'circle', imageBounds,
    measuredParams: { center: center(imageBounds), radius: imageBounds[2] / 2 }, confidence: 0.9,
  };
}

function arc(
  id: string,
  viewId: string,
  imageBounds: [number, number, number, number],
): GeometryObservation {
  return {
    id, viewId, type: 'arc', imageBounds,
    measuredParams: { center: center(imageBounds), radius: imageBounds[2] / 2, startAngle: 0, endAngle: 90 },
    confidence: 0.9,
  };
}

function line(id: string, viewId: string, start: [number, number], end: [number, number]): GeometryObservation {
  const x = Math.min(start[0], end[0]);
  const y = Math.min(start[1], end[1]);
  return {
    id, viewId, type: 'line',
    imageBounds: [x, y, Math.max(0.001, Math.abs(end[0] - start[0])), Math.max(0.001, Math.abs(end[1] - start[1]))],
    measuredParams: { start, end }, confidence: 0.9,
  };
}

function annotation(
  id: string,
  kind: AnnotationObservation['kind'],
  imageBounds: [number, number, number, number],
  arrowheads: [number, number][],
): AnnotationObservation {
  return {
    id, viewId: 'view_1', kind, rawText: kind, imageBounds, arrowheads,
    confidence: 0.9,
  };
}

function center(bounds: [number, number, number, number]): [number, number] {
  return [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2];
}
