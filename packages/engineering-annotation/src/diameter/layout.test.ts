// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { findNearestFreeCoordinate, layoutDiameterSpans } from './layout';

describe('layoutDiameterSpans', () => {
  it('keeps separated feature-local diameters near their ideal positions', () => {
    const layout = layoutDiameterSpans([
      { id: 'wide-middle', zStart: 20, zEnd: 50, radius: 8 },
      { id: 'short-right', zStart: 72, zEnd: 75, radius: 6 },
      { id: 'maximum-envelope', zStart: 55, zEnd: 68, radius: 12 },
    ], { zMin: 0, zMax: 100, maximumRadius: 12 });
    const byId = new Map(layout.map((item) => [item.id, item]));

    expect(byId.get('wide-middle')).toMatchObject({ placement: 'interior', dimensionZ: 35 });
    expect(byId.get('short-right')?.placement).toBe('interior');
    expect(byId.get('maximum-envelope')?.placement).toBe('interior');
    expect(Math.abs(byId.get('short-right')!.dimensionZ - 73.5)).toBeLessThanOrEqual(1);
  });

  it('separates overlapping labels from their measured widths regardless of radius similarity', () => {
    const layout = layoutDiameterSpans([
      { id: 'small-radius', zStart: 48, zEnd: 52, radius: 4, labelWidth: 12 },
      { id: 'large-radius', zStart: 49, zEnd: 53, radius: 10, labelWidth: 12 },
    ], { zMin: 0, zMax: 100, maximumRadius: 12 });
    const byId = new Map(layout.map((item) => [item.id, item]));

    expect(byId.get('small-radius')?.placement).toBe('interior');
    expect(byId.get('large-radius')?.placement).toBe('interior');
    expect(Math.abs(byId.get('small-radius')!.dimensionZ - byId.get('large-radius')!.dimensionZ)).toBeGreaterThanOrEqual(13);
  });

  it('moves labels to overflow layers only when their measured widths cannot fit the available interval', () => {
    const layout = layoutDiameterSpans([
      { id: 'first', zStart: 8, zEnd: 12, radius: 4, labelWidth: 40 },
      { id: 'second', zStart: 48, zEnd: 52, radius: 6, labelWidth: 40 },
      { id: 'third', zStart: 88, zEnd: 92, radius: 8, labelWidth: 40 },
    ], { zMin: 0, zMax: 100, maximumRadius: 12 });

    expect(layout.filter(({ placement }) => placement === 'interior')).toHaveLength(2);
    expect(layout.filter(({ placement }) => placement === 'exterior')).toHaveLength(1);
  });

  it('places overflow labels fully outside the shaft interval and remains translation invariant', () => {
    const spans = [
      { id: 'first', zStart: 8, zEnd: 12, radius: 4, labelWidth: 40 },
      { id: 'second', zStart: 48, zEnd: 52, radius: 6, labelWidth: 40 },
      { id: 'third', zStart: 88, zEnd: 92, radius: 8, labelWidth: 40 },
    ];
    const layout = layoutDiameterSpans(spans, { zMin: 0, zMax: 100, maximumRadius: 12 });
    const exterior = layout.filter(({ placement }) => placement === 'exterior');
    expect(exterior).toHaveLength(1);
    expect(exterior[0]!.dimensionZ + exterior[0]!.labelWidth! / 2).toBeLessThan(0);

    const translated = layoutDiameterSpans(
      spans.map((span) => ({ ...span, zStart: span.zStart + 1_000, zEnd: span.zEnd + 1_000 })),
      { zMin: 1_000, zMax: 1_100, maximumRadius: 12 },
    );
    translated.forEach(({ dimensionZ, placement }, index) => {
      expect(placement).toBe(layout[index]!.placement);
      expect(dimensionZ - 1_000).toBeCloseTo(layout[index]!.dimensionZ, 9);
    });
  });

  it('uses the first available gap between obstacles instead of jumping beyond every obstacle', () => {
    const coordinate = findNearestFreeCoordinate({
      start: 0,
      direction: -1,
      step: 1,
      maximumDistance: 20,
      isBlocked: (value) => value >= -4 || value <= -9 && value >= -14,
    });

    expect(coordinate).toBe(-5);
  });
});
