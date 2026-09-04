// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId, type GeometryNode } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { measureShaftDiameters } from './measure';

const quality = { status: 'confirmed' as const, confidence: 1, evidenceRefs: [] };
const line = (id: string, start: readonly [number, number], end: readonly [number, number]): GeometryNode => ({
  id: id as GeometryId, type: 'line', visible: true, quality, start, end,
});

describe('shaft diameter connectivity', () => {
  it('keeps disconnected equal maximum diameters as separate facts', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry = [
      line('top-a', [0, 10], [20, 10]), line('bottom-a', [0, -10], [20, -10]),
      line('top-mid', [20, 6], [30, 6]), line('bottom-mid', [20, -6], [30, -6]),
      line('top-b', [30, 10], [50, 10]), line('bottom-b', [30, -10], [50, -10]),
      line('left', [0, -10], [0, 10]), line('step-a-top', [20, 6], [20, 10]), line('step-a-bottom', [20, -10], [20, -6]),
      line('step-b-top', [30, 6], [30, 10]), line('step-b-bottom', [30, -10], [30, -6]), line('right', [50, -10], [50, 10]),
    ];

    const maximum = measureShaftDiameters(document).filter(({ diameter }) => Math.abs(diameter - 20) < 1e-9);
    expect(maximum.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([[0, 20], [30, 50]]);
  });

  it('classifies overlapping inner and outer cylindrical surfaces independently', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry = [
      line('outer-top', [0, 10], [40, 10]), line('outer-bottom', [0, -10], [40, -10]),
      line('inner-top', [5, 4], [35, 4]), line('inner-bottom', [5, -4], [35, -4]),
      line('left-outer', [0, -10], [0, 10]), line('right-outer', [40, -10], [40, 10]),
      line('inner-left', [5, -4], [5, 4]), line('inner-right', [35, -4], [35, 4]),
    ];

    const facts = measureShaftDiameters(document);
    expect(facts.find(({ diameter }) => Math.abs(diameter - 20) < 1e-9)?.featureClass).toBe('shaft');
    expect(facts.find(({ diameter }) => Math.abs(diameter - 8) < 1e-9)?.featureClass).toBe('hole');
    expect(facts.every(({ measurementUncertainty }) => measurementUncertainty > 0)).toBe(true);
  });

  it('preserves measured precision instead of rounding facts for display', () => {
    const document = createEmptyDrawing({ now: () => 1 });
    document.geometry = [
      line('top', [0, 6.172839], [20, 6.172839]), line('bottom', [0, -6.172839], [20, -6.172839]),
      line('left', [0, -6.172839], [0, 6.172839]), line('right', [20, -6.172839], [20, 6.172839]),
    ];
    expect(measureShaftDiameters(document)[0]?.diameter).toBeCloseTo(12.345678, 6);
  });
});
