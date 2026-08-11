import { describe, expect, it } from 'vitest';

import type { RevisionId } from '../../../src/drawing/index.js';
import { buildAtomicGeometryGraph } from './atomic-graph.js';
import { polygonRegionBounds } from './polygon.js';
import { RegionResolver } from './region-resolver.js';
import {
  TEST2_REVISION,
  TEST2_SHARED_POLYLINE_ID,
  TEST2_SHARED_POLYLINE_POINTS,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

describe('RegionResolver', () => {
  it('selects the lower arm inside a Polyline shared with the protected body', () => {
    const document = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const graph = buildAtomicGeometryGraph({
      document,
      revision: TEST2_REVISION,
      regionBounds: polygonRegionBounds(region.worldContours),
      padding: 2,
    });
    const selection = new RegionResolver().resolve({
      document, revision: TEST2_REVISION, region, graph, tolerance: 0.01,
    });

    expect(selection.wholeNodes).toContain('node_test2_hand_outline');
    expect(selection.crossingNodes).toContain(TEST2_SHARED_POLYLINE_ID);
    expect(selection.partialSegments.filter((segment) => (
      segment.nodeId === TEST2_SHARED_POLYLINE_ID
    )).map((segment) => segment.vertexRange)).toEqual([
      [0, 1], [1, 2], [2, 3],
    ]);
    expect(selection.splitPlan).toEqual([expect.objectContaining({
      nodeId: TEST2_SHARED_POLYLINE_ID,
      ranges: [
        { range: [0, 3], role: 'target' },
        { range: [3, 4], role: 'protected' },
      ],
      cutParameters: [3],
    })]);
    expect(selection.classifications).toContainEqual(expect.objectContaining({
      nodeId: TEST2_SHARED_POLYLINE_ID,
      classification: 'shared-boundary',
    }));
    expect(selection.boundaryAnchors).toContainEqual(expect.objectContaining({
      role: 'shared-boundary',
      point: TEST2_SHARED_POLYLINE_POINTS[3],
    }));
  });

  it('classifies complete inside/outside geometry and respects holes', () => {
    const document = test2SharedPolylineDocument();
    const base = test2RightArmRegion();
    const region = {
      ...base,
      worldHoles: [[
        [103, 195] as const,
        [115, 195] as const,
        [115, 205] as const,
        [103, 205] as const,
      ]],
    };
    const graph = buildAtomicGeometryGraph({
      document, revision: TEST2_REVISION,
      regionBounds: polygonRegionBounds(region.worldContours), padding: 100,
    });
    const selection = new RegionResolver().resolve({
      document, revision: TEST2_REVISION, region, graph, tolerance: 0.01,
    });

    expect(selection.wholeNodes).not.toContain('node_test2_hand_outline');
    expect(selection.protectedNodes).toContain('node_test2_face');
    expect(selection.classifications).toContainEqual(expect.objectContaining({
      nodeId: 'node_test2_face', classification: 'outside',
    }));
  });

  it('marks low-confidence geometric ownership as uncertain', () => {
    const document = test2SharedPolylineDocument();
    const region = test2RightArmRegion(0.4);
    const graph = buildAtomicGeometryGraph({
      document, revision: TEST2_REVISION,
      regionBounds: polygonRegionBounds(region.worldContours), padding: 2,
    });
    const selection = new RegionResolver().resolve({
      document, revision: TEST2_REVISION, region, graph, tolerance: 0.01,
    });

    expect(selection.uncertainParts.length).toBeGreaterThan(0);
    expect(selection.uncertainParts.every((part) => part.classification === 'uncertain')).toBe(true);
  });

  it('rejects stale region and graph revisions before resolving', () => {
    const document = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const graph = buildAtomicGeometryGraph({
      document, revision: TEST2_REVISION,
      regionBounds: polygonRegionBounds(region.worldContours), padding: 2,
    });

    expect(() => new RegionResolver().resolve({
      document,
      revision: 'revision_new' as RevisionId,
      region,
      graph,
      tolerance: 0.01,
    })).toThrow('REGION_RESOLUTION_STALE');
  });
});
