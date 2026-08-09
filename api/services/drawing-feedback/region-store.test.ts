import { describe, expect, it } from 'vitest';

import { MemoryObservationRegionStore } from './region-store.js';

describe('MemoryObservationRegionStore', () => {
  it('keeps nested and overlapping regions in creation order', () => {
    const regions = new MemoryObservationRegionStore({
      resolveSourceSize: () => ({ width: 1260, height: 1748 }),
    });
    const root = regions.create({
      id: 'region_root',
      sourceId: 'source_test1',
      bounds: { x: 0, y: 0, width: 900, height: 900 },
      purpose: 'inventory',
      targetSlotIds: [],
      resolutionLevel: 0,
      attempt: 1,
    });
    const child = regions.create({
      id: 'region_circle',
      sourceId: 'source_test1',
      bounds: { x: 400, y: 200, width: 700, height: 600 },
      purpose: 'geometry',
      targetSlotIds: ['slot_circle'],
      parentRegionId: root.id,
      resolutionLevel: 1,
      attempt: 1,
    });

    expect(regions.list().map((item) => item.id)).toEqual([root.id, child.id]);
    expect(child.bounds.x).toBeLessThan(root.bounds.x + root.bounds.width);
    expect(child.bounds.x + child.bounds.width).toBeGreaterThan(root.bounds.x);
  });

  it('rejects invalid parent lineage and source bounds', () => {
    const regions = new MemoryObservationRegionStore({
      resolveSourceSize: () => ({ width: 100, height: 100 }),
    });

    expect(() => regions.create({
      id: 'region_bad_parent', sourceId: 'source_a',
      bounds: { x: 0, y: 0, width: 20, height: 20 },
      purpose: 'geometry', targetSlotIds: [], parentRegionId: 'missing',
      resolutionLevel: 1, attempt: 1,
    })).toThrow('OBSERVATION_PARENT_NOT_FOUND');
    expect(() => regions.create({
      id: 'region_outside', sourceId: 'source_a',
      bounds: { x: 90, y: 90, width: 20, height: 20 },
      purpose: 'geometry', targetSlotIds: [],
      resolutionLevel: 1, attempt: 1,
    })).toThrow('OBSERVATION_REGION_OUT_OF_BOUNDS');
  });
});
