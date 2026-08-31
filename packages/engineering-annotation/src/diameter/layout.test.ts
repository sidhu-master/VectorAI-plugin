// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { layoutDiameterSpans } from './layout';

describe('layoutDiameterSpans', () => {
  it('places a diameter inside a sufficiently wide shaft span and sends a short span outside', () => {
    const layout = layoutDiameterSpans([
      { id: 'wide-middle', zStart: 20, zEnd: 50, radius: 8 },
      { id: 'short-right', zStart: 72, zEnd: 75, radius: 6 },
    ], { zMin: 0, zMax: 100, maximumRadius: 12 });
    const byId = new Map(layout.map((item) => [item.id, item]));

    expect(byId.get('wide-middle')).toMatchObject({ placement: 'interior', dimensionZ: 35 });
    expect(byId.get('short-right')?.placement).toBe('exterior');
    expect(byId.get('short-right')?.dimensionZ).toBeGreaterThan(100);
  });

  it('keeps colliding internal labels apart by moving the lower-priority span outside', () => {
    const layout = layoutDiameterSpans([
      { id: 'wide-primary', zStart: 20, zEnd: 60, radius: 10 },
      { id: 'overlapping-secondary', zStart: 28, zEnd: 54, radius: 7 },
    ], { zMin: 0, zMax: 100, maximumRadius: 12 });
    const byId = new Map(layout.map((item) => [item.id, item]));

    expect(byId.get('wide-primary')?.placement).toBe('interior');
    expect(byId.get('overlapping-secondary')?.placement).toBe('exterior');
  });

  it('orders only exterior diameters by size and remains translation invariant', () => {
    const spans = [
      { id: 'left-small', zStart: 10, zEnd: 13, radius: 5 },
      { id: 'left-large', zStart: 15, zEnd: 18, radius: 10 },
      { id: 'right-small', zStart: 82, zEnd: 85, radius: 6 },
      { id: 'right-large', zStart: 87, zEnd: 90, radius: 12 },
    ];
    const layout = layoutDiameterSpans(spans, { zMin: 0, zMax: 100, maximumRadius: 12 });
    const byId = new Map(layout.map((item) => [item.id, item]));

    expect(byId.get('left-small')?.dimensionZ).toBeLessThan(0);
    expect(byId.get('left-large')?.dimensionZ).toBeLessThan(byId.get('left-small')!.dimensionZ);
    expect(byId.get('right-small')?.dimensionZ).toBeGreaterThan(100);
    expect(byId.get('right-large')?.dimensionZ).toBeGreaterThan(byId.get('right-small')!.dimensionZ);

    const translated = layoutDiameterSpans(
      spans.map((span) => ({ ...span, zStart: span.zStart + 1_000, zEnd: span.zEnd + 1_000 })),
      { zMin: 1_000, zMax: 1_100, maximumRadius: 12 },
    );
    translated.forEach(({ dimensionZ, placement }, index) => {
      expect(placement).toBe(layout[index]!.placement);
      expect(dimensionZ - 1_000).toBeCloseTo(layout[index]!.dimensionZ, 9);
    });
  });
});
