// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { projectAnnotationDrag } from './annotation-drag';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

describe('projectAnnotationDrag', () => {
  it('moves a diameter line and label only along the shaft axis', () => {
    const annotation: DimensionAnnotation = {
      id: 'diameter' as never, type: 'dimension', dimensionKind: 'diameter', visible: true,
      quality, associationStatus: 'resolved', targets: [], computedValue: 20, unit: 'mm',
      textPosition: [10, 0],
      definitionPoints: [[10, -10], [10, 10], [0, -10], [0, 10]],
    };

    const projected = projectAnnotationDrag(annotation, [10, 0], [15, 7]);

    expect(projected.textPosition).toEqual([15, 0]);
    expect(projected.definitionPoints).toEqual([[15, -10], [15, 10], [0, -10], [0, 10]]);
  });

  it('changes only an angular annotation radius along its bisector', () => {
    const annotation: DimensionAnnotation = {
      id: 'angle' as never, type: 'dimension', dimensionKind: 'angular', visible: true,
      quality, associationStatus: 'resolved', targets: [], computedValue: 60, unit: 'deg',
      textPosition: [14, 0],
      definitionPoints: [[0, 0], [12, -6], [12, 6], [10, -5], [10, 5]],
    };

    const projected = projectAnnotationDrag(annotation, [14, 0], [18, 9]);

    expect(projected.definitionPoints[0]).toEqual([0, 0]);
    expect(projected.textPosition).toEqual([18, 0]);
    expect(angleBetween(projected.definitionPoints[3]!, projected.definitionPoints[4]!))
      .toBeCloseTo(angleBetween(annotation.definitionPoints[3]!, annotation.definitionPoints[4]!), 9);
    expect(Math.hypot(...projected.definitionPoints[3]!)).toBeCloseTo(Math.hypot(...annotation.definitionPoints[3]!) + 4, 9);
  });
});

function angleBetween(first: readonly [number, number], second: readonly [number, number]): number {
  const dot = first[0] * second[0] + first[1] * second[1];
  return Math.acos(dot / (Math.hypot(...first) * Math.hypot(...second)));
}
