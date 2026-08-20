import { describe, expect, it } from 'vitest';

import type { RevisionId } from '@/drawing';
import {
  assertSelectionRevision,
  DrawingSpatialRegionProtocolError,
  parseSemanticRegionProposal,
  parseSpatialEditStrategy,
  type SpatialSelection,
} from './drawing-spatial-region';

describe('drawing spatial-region protocol', () => {
  it('accepts a semantic grounding proposal without primitive ids', () => {
    const proposal = parseSemanticRegionProposal({
      ...validProposal(),
      anchors: [
        { id: 'seed', role: 'target-seed', point: [0.6, 0.5], confidence: 0.94 },
        { id: 'port', role: 'boundary', point: [0.2, 0.5], confidence: 0.92 },
      ],
    }, {
      allowedViewIds: ['view_overview'],
      allowedEvidenceRefs: ['view_overview'],
    });

    expect(proposal).toMatchObject({
      operation: 'modify-existing',
      preferredEditMode: 'geometric-edit',
      sourceViewId: 'view_overview',
    });
    expect(JSON.stringify(proposal)).not.toContain('nodeId');
  });

  it.each([
    ['point outside the normalized image', {
      ...validProposal(), contours: [[[0.2, 0.2], [1.01, 0.2], [0.2, 0.8]]],
    }, 'regionProposal.contours[0][1][0]'],
    ['unobserved view', {
      ...validProposal(), sourceViewId: 'invented_view',
    }, 'regionProposal.sourceViewId'],
    ['empty contour set', {
      ...validProposal(), contours: [],
    }, 'regionProposal.contours'],
    ['domain-specific anchor role', {
      ...validProposal(),
      anchors: [{ id: 'invalid', role: 'domain-part', point: [0.5, 0.5], confidence: 0.8 }],
    }, 'regionProposal.anchors[0].role'],
    ['primitive-bound payload', {
      ...validProposal(), nodeIds: ['line_1'],
    }, 'regionProposal.nodeIds'],
  ])('rejects %s', (_name, value, path) => {
    expect(() => parseSemanticRegionProposal(value, {
      allowedViewIds: ['view_overview'],
      allowedEvidenceRefs: ['view_overview'],
    })).toThrow(expect.objectContaining({ path }));
  });

  it('accepts an explicit hybrid strategy with generic guarantees', () => {
    const strategy = parseSpatialEditStrategy({
      mode: 'hybrid-edit', regionId: 'region_target',
      preserveRegionIds: ['region_protected'], boundaryAnchorIds: ['anchor_interface'],
      requiredGuarantees: ['outside-region-unchanged', 'protected-region-unchanged'],
      primaryReason: 'combine topology-preserving geometry and local redraw',
      fallbackMode: 'geometric-edit',
    }, {
      allowedRegionIds: ['region_target', 'region_protected'],
      allowedAnchorIds: ['anchor_interface'],
    });

    expect(strategy).toEqual(expect.objectContaining({
      mode: 'hybrid-edit', regionId: 'region_target', fallbackMode: 'geometric-edit',
    }));
  });

  it('rejects a selection bound to a stale drawing revision', () => {
    const selection = {
      regionId: 'region_target', revision: 'revision_old' as RevisionId,
      wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
      boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
    } satisfies SpatialSelection;

    expect(() => assertSelectionRevision(selection, 'revision_new' as RevisionId))
      .toThrowError(new DrawingSpatialRegionProtocolError(
        'selection.revision',
        'SPATIAL_SELECTION_STALE: expected revision_new, received revision_old',
      ));
  });
});

function validProposal() {
  return {
    label: 'target component',
    operation: 'modify-existing',
    preferredEditMode: 'geometric-edit',
    sourceViewId: 'view_overview',
    contours: [[[0.2, 0.2], [0.8, 0.2], [0.2, 0.8]]],
    holes: [], anchors: [], confidence: 0.8, evidenceRefs: ['view_overview'],
  };
}
