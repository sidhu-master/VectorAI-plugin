import { describe, expect, it } from 'vitest';

import type { GeometryId } from '../../../src/drawing/index.js';
import { collectPreservedNodeHashes } from '../drawing-edit/preserve-report.js';
import { validateSpatialEditPreview } from './spatial-validator.js';
import {
  TEST2_REVISION,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

describe('validateSpatialEditPreview', () => {
  it('allows pre-existing open endpoints when the candidate introduces no new dangling point', () => {
    const before = test2SharedPolylineDocument();
    before.geometry = [{
      id: 'body_connection' as GeometryId,
      type: 'line', start: [-10, 0], end: [0, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }, {
      id: 'editable_connector' as GeometryId,
      type: 'line', start: [0, 0], end: [10, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const region = {
      ...test2RightArmRegion(),
      worldContours: [[
        [-1, -1] as const, [11, -1] as const, [11, 1] as const, [-1, 1] as const,
      ]],
      anchors: [],
    };
    const selection = {
      regionId: region.id,
      revision: TEST2_REVISION,
      wholeNodes: ['editable_connector' as GeometryId],
      partialSegments: [],
      crossingNodes: [],
      protectedNodes: ['body_connection'],
      boundaryAnchors: [{
        id: 'anchor_connection', role: 'shared-boundary' as const, point: [0, 0] as const,
        confidence: 1,
      }],
      classifications: [],
      uncertainParts: [],
      splitPlan: [],
    };
    const report = validateSpatialEditPreview({
      before,
      after: structuredClone(before),
      region,
      selection,
      candidate: {
        baseRevision: TEST2_REVISION,
        commands: [],
        targetNodeIds: ['editable_connector' as GeometryId],
        preserveNodeHashes: collectPreservedNodeHashes(before, ['body_connection']),
        protectedFragmentHashes: {},
        authorizedBounds: { minX: -1, minY: -1, maxX: 11, maxY: 1 },
        lineage: [],
        strategy: 'geometric-edit',
        fidelityWarnings: [],
        authorizationId: 'authorization_fixture',
        topologyResolutionId: 'topology_resolution_fixture',
      },
      tolerance: 0.01,
    });

    expect(report.unexpectedDanglingEndpoints).toEqual([]);
    expect(report.issues.map((issue) => issue.code)).not.toContain('UNEXPECTED_DANGLING_ENDPOINT');
  });

  it('uses a bounded fitted-geometry tolerance for a sub-unit body connection gap', () => {
    const before = test2SharedPolylineDocument();
    before.geometry = [{
      id: 'target_edge' as GeometryId,
      type: 'line', start: [0, 0], end: [10, 0], visible: true,
      quality: { status: 'confirmed', confidence: 0.9, evidenceRefs: [] },
    }, {
      id: 'protected_edge' as GeometryId,
      type: 'line', start: [10.5, 0], end: [30, 0], visible: true,
      quality: { status: 'confirmed', confidence: 0.9, evidenceRefs: [] },
    }];
    const region = {
      ...test2RightArmRegion(),
      worldContours: [[
        [-100, -100] as const, [100, -100] as const,
        [100, 100] as const, [-100, 100] as const,
      ]],
      anchors: [],
    };
    const selection = {
      regionId: region.id, revision: TEST2_REVISION,
      wholeNodes: ['target_edge' as GeometryId], partialSegments: [], crossingNodes: [],
      protectedNodes: ['protected_edge'],
      boundaryAnchors: [{
        id: 'fitted_joint', role: 'shared-boundary' as const,
        point: [10, 0] as const, confidence: 0.9,
      }],
      classifications: [], uncertainParts: [], splitPlan: [],
    };
    const report = validateSpatialEditPreview({
      before, after: structuredClone(before), region, selection,
      candidate: {
        baseRevision: TEST2_REVISION, commands: [],
        targetNodeIds: ['target_edge' as GeometryId],
        preserveNodeHashes: collectPreservedNodeHashes(before, ['protected_edge']),
        protectedFragmentHashes: {},
        authorizedBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
        lineage: [], strategy: 'geometric-edit', fidelityWarnings: [],
        authorizationId: 'authorization_fitted', topologyResolutionId: 'topology_resolution_fitted',
      },
      tolerance: 0.01,
    });

    expect(report.issues.map((item) => item.code)).not.toContain('BOUNDARY_ANCHOR_DISCONNECTED');
  });

  it('keeps a stale spatial candidate as a hard failure', () => {
    const before = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const report = validateSpatialEditPreview({
      before,
      after: structuredClone(before),
      region,
      selection: {
        regionId: region.id,
        revision: 'revision_other' as typeof TEST2_REVISION,
        wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      candidate: {
        baseRevision: TEST2_REVISION,
        commands: [], targetNodeIds: [], preserveNodeHashes: {}, protectedFragmentHashes: {},
        authorizedBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, lineage: [],
        strategy: 'geometric-edit', fidelityWarnings: [],
        authorizationId: 'authorization_stale', topologyResolutionId: 'topology_stale',
      },
      tolerance: 0.01,
    });

    expect(report).toMatchObject({
      valid: false,
      hardValid: false,
      issues: [{ code: 'SPATIAL_EDIT_STALE', severity: 'error' }],
    });
  });

  it('reports changed protected nodes and lineage gaps as diagnostics while keeping hard validity', () => {
    const before = test2SharedPolylineDocument();
    const after = structuredClone(before);
    const face = after.geometry.find((node) => node.id === 'node_test2_face');
    if (!face || face.type !== 'circle') throw new Error('fixture face missing');
    face.radius += 1;
    const hand = after.geometry.find((node) => node.id === 'node_test2_hand_outline');
    if (!hand || hand.type !== 'polyline') throw new Error('fixture hand missing');
    hand.vertices[1].point = hand.vertices[0].point;

    const report = validateSpatialEditPreview({
      before,
      after,
      region: test2RightArmRegion(),
      selection: {
        regionId: 'region_test2_right_arm', revision: TEST2_REVISION,
        wholeNodes: ['node_test2_hand_outline' as GeometryId], partialSegments: [],
        crossingNodes: [], protectedNodes: ['node_test2_face'], boundaryAnchors: [],
        classifications: [], uncertainParts: [], splitPlan: [],
      },
      candidate: {
        baseRevision: TEST2_REVISION,
        commands: [], targetNodeIds: ['node_test2_hand_outline' as GeometryId],
        preserveNodeHashes: collectPreservedNodeHashes(before, ['node_test2_face']),
        protectedFragmentHashes: {}, authorizedBounds: { minX: 0, minY: 0, maxX: 200, maxY: 250 },
        lineage: [{
          sourceNodeId: 'source_missing' as GeometryId,
          fragmentId: 'fragment_missing' as GeometryId,
          sourceRange: [0, 0.4], role: 'target',
        }],
        strategy: 'geometric-edit', fidelityWarnings: [],
        authorizationId: 'authorization_fixture',
        topologyResolutionId: 'topology_resolution_fixture',
      },
      tolerance: 0.01,
    });

    expect(report.valid).toBe(true);
    expect(report.hardValid).toBe(true);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'PROTECTED_NODE_CHANGED',
      'LINEAGE_COVERAGE_INCOMPLETE',
    ]));
    expect(report.issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});
