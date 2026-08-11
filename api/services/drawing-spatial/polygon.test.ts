import { describe, expect, it } from 'vitest';

import {
  boundsIntersect,
  pointInPolygonRegion,
  polygonRegionBounds,
  segmentRegionIntersections,
} from './polygon.js';

const outer = [[[0, 0], [10, 0], [10, 10], [0, 10]]] as const;
const holes = [[[4, 4], [6, 4], [6, 6], [4, 6]]] as const;

describe('polygon region geometry', () => {
  it('includes outer points and excludes holes while keeping boundaries stable', () => {
    expect(pointInPolygonRegion([2, 2], outer, holes)).toBe(true);
    expect(pointInPolygonRegion([5, 5], outer, holes)).toBe(false);
    expect(pointInPolygonRegion([0, 5], outer, holes)).toBe(true);
    expect(pointInPolygonRegion([-0.01, 5], outer, holes)).toBe(false);
  });

  it('returns unique ordered segment crossings', () => {
    expect(segmentRegionIntersections([-2, 5], [12, 5], outer, [])).toEqual([
      expect.closeTo(2 / 14, 9),
      expect.closeTo(12 / 14, 9),
    ]);
    expect(segmentRegionIntersections([-2, -2], [0, 0], outer, [])).toEqual([1]);
  });

  it('derives bounds and applies optional padding', () => {
    const bounds = polygonRegionBounds(outer);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(boundsIntersect(bounds, { minX: 11, minY: 1, maxX: 12, maxY: 2 })).toBe(false);
    expect(boundsIntersect(bounds, { minX: 11, minY: 1, maxX: 12, maxY: 2 }, 1)).toBe(true);
  });
});
