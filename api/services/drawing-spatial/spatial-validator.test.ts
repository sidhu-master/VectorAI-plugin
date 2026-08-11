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
      id: 'open_arm' as GeometryId,
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
      wholeNodes: ['open_arm' as GeometryId],
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
        targetNodeIds: ['open_arm' as GeometryId],
        preserveNodeHashes: collectPreservedNodeHashes(before, ['body_connection']),
        protectedFragmentHashes: {},
        authorizedBounds: { minX: -1, minY: -1, maxX: 11, maxY: 1 },
        lineage: [],
        strategy: 'geometric-edit',
        fidelityWarnings: [],
        authorizationId: 'authorization_fixture',
        selectionProofId: 'proof_fixture',
      },
      tolerance: 0.01,
    });

    expect(report.unexpectedDanglingEndpoints).toEqual([]);
    expect(report.issues.map((issue) => issue.code)).not.toContain('UNEXPECTED_DANGLING_ENDPOINT');
  });

  it('rejects changed protected nodes, lineage gaps, and zero-length target geometry', () => {
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
        selectionProofId: 'proof_fixture',
      },
      tolerance: 0.01,
    });

    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'PROTECTED_NODE_CHANGED',
      'LINEAGE_COVERAGE_INCOMPLETE',
      'ZERO_LENGTH_GEOMETRY',
    ]));
  });
});
