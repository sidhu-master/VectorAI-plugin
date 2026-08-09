import { describe, expect, it } from 'vitest';

import { gridPatternMetrics } from './grid-pattern';

describe('CAD grid pattern', () => {
  it('changes phase without changing coverage spacing while panning', () => {
    const before = gridPatternMetrics({ scale: 2, offsetX: 80, offsetY: 500 });
    const after = gridPatternMetrics({ scale: 2, offsetX: -2_000, offsetY: 1_610 });

    expect(after.minorSize).toBe(before.minorSize);
    expect(after.majorSize).toBe(before.majorSize);
    expect([after.minorX, after.minorY]).not.toEqual([before.minorX, before.minorY]);
    expect([after.majorX, after.majorY]).not.toEqual([before.majorX, before.majorY]);
  });

  it('keeps negative offsets inside one positive pattern period', () => {
    const metrics = gridPatternMetrics({ scale: 1.5, offsetX: -82, offsetY: -151 });

    expect(metrics.minorX).toBeGreaterThanOrEqual(0);
    expect(metrics.minorX).toBeLessThan(metrics.minorSize);
    expect(metrics.minorY).toBeGreaterThanOrEqual(0);
    expect(metrics.minorY).toBeLessThan(metrics.minorSize);
    expect(metrics.majorX).toBeGreaterThanOrEqual(0);
    expect(metrics.majorX).toBeLessThan(metrics.majorSize);
    expect(metrics.majorY).toBeGreaterThanOrEqual(0);
    expect(metrics.majorY).toBeLessThan(metrics.majorSize);
  });

  it('scales ten-unit minor and fifty-unit major spacing', () => {
    expect(gridPatternMetrics({ scale: 3, offsetX: 0, offsetY: 0 })).toEqual({
      minorSize: 30,
      majorSize: 150,
      minorX: 0,
      minorY: 0,
      majorX: 0,
      majorY: 0,
    });
  });
});
