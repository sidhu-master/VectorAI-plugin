import { describe, expect, it } from 'vitest';

import type {
  GeometryId,
  RevisionId,
} from '../../../src/drawing/index.js';
import { collectPreservedNodeHashes } from '../drawing-edit/preserve-report.js';
import type { CompiledSpatialEditCandidate } from './spatial-edit-compiler.js';
import { validateSpatialEditPreview } from './spatial-validator.js';
import {
  TEST2_REVISION,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

describe('spatial validation compatibility diagnostics', () => {
  it('keeps stale revision as a hard failure', () => {
    const before = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const report = validateSpatialEditPreview({
      before,
      after: structuredClone(before),
      region,
      selection: {
        regionId: region.id,
        revision: 'revision_other' as RevisionId,
        wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      candidate: candidate({ targetNodeIds: [] }),
      tolerance: 0.01,
    });

    expect(report).toMatchObject({
      valid: false,
      hardValid: false,
      issues: [{ code: 'SPATIAL_EDIT_STALE', severity: 'error' }],
    });
  });

  it('reports locality and lineage differences without rejecting a protocol-valid candidate', () => {
    const before = test2SharedPolylineDocument();
    const after = structuredClone(before);
    const face = after.geometry.find((node) => node.id === 'node_test2_face');
    if (!face || face.type !== 'circle') throw new Error('fixture face missing');
    face.radius += 1;

    const report = validateSpatialEditPreview({
      before,
      after,
      region: test2RightArmRegion(),
      selection: {
        regionId: 'region_test2_right_arm', revision: TEST2_REVISION,
        wholeNodes: [], partialSegments: [], crossingNodes: [],
        protectedNodes: ['node_test2_face'], boundaryAnchors: [],
        classifications: [], uncertainParts: [], splitPlan: [],
      },
      candidate: candidate({
        preserveNodeHashes: collectPreservedNodeHashes(before, ['node_test2_face']),
        lineage: [{
          sourceNodeId: 'source_missing' as GeometryId,
          fragmentId: 'fragment_missing' as GeometryId,
          sourceRange: [0, 0.4], role: 'target',
        }],
      }),
      tolerance: 0.01,
    });

    expect(report.valid).toBe(true);
    expect(report.hardValid).toBe(true);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PROTECTED_NODE_CHANGED', severity: 'warning' }),
      expect.objectContaining({ code: 'LINEAGE_COVERAGE_INCOMPLETE', severity: 'warning' }),
    ]));
  });
});

function candidate(
  overrides: Partial<CompiledSpatialEditCandidate>,
): CompiledSpatialEditCandidate {
  return {
    baseRevision: TEST2_REVISION,
    commands: [], targetNodeIds: [], preserveNodeHashes: {}, protectedFragmentHashes: {},
    authorizedBounds: { minX: 0, minY: 0, maxX: 200, maxY: 250 },
    lineage: [], strategy: 'geometric-edit', fidelityWarnings: [],
    authorizationId: 'authorization_diagnostic',
    ...overrides,
  } as CompiledSpatialEditCandidate;
}
