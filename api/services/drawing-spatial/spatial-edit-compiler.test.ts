import { describe, expect, it } from 'vitest';

import { previewTransaction, type GeometryId } from '../../../src/drawing/index.js';
import { buildAtomicGeometryGraph } from './atomic-graph.js';
import { polygonRegionBounds } from './polygon.js';
import { RegionResolver } from './region-resolver.js';
import { materializeSpatialSplits } from './split-materializer.js';
import { compileSpatialEdit } from './spatial-edit-compiler.js';
import { validateSpatialEditPreview } from './spatial-validator.js';
import { routeSpatialEditStrategy } from './strategy-router.js';
import {
  TEST2_REVISION,
  TEST2_SHARED_POLYLINE_ID,
  TEST2_SHARED_POLYLINE_POINTS,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

describe('compileSpatialEdit', () => {
  it('raises the complete test2 arm while retaining the protected body fragment', () => {
    const before = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const graph = buildAtomicGeometryGraph({
      document: before, revision: TEST2_REVISION,
      regionBounds: polygonRegionBounds(region.worldContours), padding: 2,
    });
    const selection = new RegionResolver().resolve({
      document: before, revision: TEST2_REVISION, region, graph, tolerance: 0.01,
    });
    const split = materializeSpatialSplits({ document: before, selection });
    const strategy = routeSpatialEditStrategy({
      goal: '把右手抬起来打招呼，保持身体不变并保持手臂闭合连接',
      document: before, region, selection,
    });
    const candidate = compileSpatialEdit({
      document: before,
      selection,
      region,
      strategy,
      split,
      design: {
        kind: 'transform', confidence: 0.97, evidenceRefs: ['view_test2'],
        transform: {
          kind: 'rotate',
          center: TEST2_SHARED_POLYLINE_POINTS[3],
          angleDegrees: 35,
        },
      },
    });
    const preview = previewTransaction({ document: before, currentRevision: TEST2_REVISION }, {
      id: 'transaction_region_edit', baseRevision: TEST2_REVISION,
      actor: { type: 'AI', id: 'test' }, commands: candidate.commands,
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });

    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') return;
    const protectedBody = preview.resultingDocument.geometry.find((node) => (
      node.id === TEST2_SHARED_POLYLINE_ID
    ));
    expect(protectedBody).toMatchObject({
      type: 'polyline',
      vertices: TEST2_SHARED_POLYLINE_POINTS.slice(3).map((point) => ({ point })),
    });
    expect(candidate.targetNodeIds).toHaveLength(2);
    expect(candidate.commands[0].type).toMatch(/^geometry\.(update|delete)$/);
    expect(validateSpatialEditPreview({
      before,
      after: preview.resultingDocument,
      region,
      selection,
      candidate,
      tolerance: 0.02,
    })).toMatchObject({ valid: true, issues: [], unexpectedDanglingEndpoints: [] });
  });

  it('adds generated vector geometry without rewriting the existing primitive ownership model', () => {
    const before = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const selection = {
      regionId: region.id, revision: TEST2_REVISION,
      wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
      boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
    };
    const strategy = routeSpatialEditStrategy({
      goal: '给角色增加卷发', document: before, region, selection,
    });
    const hair = {
      id: 'node_generated_hair' as GeometryId, type: 'polyline' as const,
      vertices: [{ point: [102, 202] as const }, { point: [108, 208] as const }, { point: [115, 202] as const }],
      closed: false, visible: true,
      quality: { status: 'confirmed' as const, confidence: 0.92, evidenceRefs: [] },
    };

    const candidate = compileSpatialEdit({
      document: before, selection, region, strategy,
      split: { commands: [], fragments: [], lineage: [], fidelityWarnings: [] },
      design: {
        kind: 'local-redraw', geometry: [hair], replaceTarget: false,
        confidence: 0.92, evidenceRefs: ['generated_source'],
      },
    });
    const preview = previewTransaction({ document: before, currentRevision: TEST2_REVISION }, {
      id: 'transaction_add_hair', baseRevision: TEST2_REVISION,
      actor: { type: 'AI', id: 'test' }, commands: candidate.commands,
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });

    expect(candidate.commands).toEqual([{ type: 'geometry.create', value: expect.objectContaining({ id: hair.id }) }]);
    expect(candidate.targetNodeIds).toEqual([hair.id]);
    expect(Object.keys(candidate.preserveNodeHashes)).toHaveLength(before.geometry.length);
    expect(preview.status).toBe('ready');
  });
});
