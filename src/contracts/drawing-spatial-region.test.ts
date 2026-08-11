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
  it('accepts a semantic region proposal without primitive ids', () => {
    const proposal = parseSemanticRegionProposal({
      label: 'right arm',
      sourceViewId: 'view_overview',
      contours: [[
        [0.69, 0.43], [0.91, 0.52], [0.91, 0.72], [0.70, 0.64],
      ]],
      holes: [],
      anchors: [{
        id: 'shoulder', role: 'body-connection', point: [0.70, 0.60], confidence: 0.94,
      }],
      confidence: 0.92,
      evidenceRefs: ['view_overview'],
    }, {
      allowedViewIds: ['view_overview'],
      allowedEvidenceRefs: ['view_overview'],
    });

    expect(proposal).toMatchObject({
      label: 'right arm',
      sourceViewId: 'view_overview',
      confidence: 0.92,
    });
    expect(JSON.stringify(proposal)).not.toContain('nodeId');
  });

  it.each([
    ['point outside the normalized image', {
      label: 'arm', sourceViewId: 'view_overview',
      contours: [[[0.2, 0.2], [1.01, 0.2], [0.2, 0.8]]], holes: [], anchors: [],
      confidence: 0.8, evidenceRefs: ['view_overview'],
    }, 'regionProposal.contours[0][1][0]'],
    ['non-finite point', {
      label: 'arm', sourceViewId: 'view_overview',
      contours: [[[0.2, 0.2], [Number.NaN, 0.2], [0.2, 0.8]]], holes: [], anchors: [],
      confidence: 0.8, evidenceRefs: ['view_overview'],
    }, 'regionProposal.contours[0][1][0]'],
    ['unobserved view', {
      label: 'arm', sourceViewId: 'invented_view',
      contours: [[[0.2, 0.2], [0.8, 0.2], [0.2, 0.8]]], holes: [], anchors: [],
      confidence: 0.8, evidenceRefs: ['view_overview'],
    }, 'regionProposal.sourceViewId'],
    ['empty contour set', {
      label: 'arm', sourceViewId: 'view_overview', contours: [], holes: [], anchors: [],
      confidence: 0.8, evidenceRefs: ['view_overview'],
    }, 'regionProposal.contours'],
    ['primitive-bound payload', {
      label: 'arm', sourceViewId: 'view_overview',
      contours: [[[0.2, 0.2], [0.8, 0.2], [0.2, 0.8]]], holes: [], anchors: [],
      confidence: 0.8, evidenceRefs: ['view_overview'], nodeIds: ['line_1'],
    }, 'regionProposal.nodeIds'],
  ])('rejects %s', (_name, value, path) => {
    expect(() => parseSemanticRegionProposal(value, {
      allowedViewIds: ['view_overview'],
      allowedEvidenceRefs: ['view_overview'],
    })).toThrow(expect.objectContaining({ path }));
  });

  it('accepts an automatic hybrid strategy with explicit guarantees', () => {
    const strategy = parseSpatialEditStrategy({
      mode: 'hybrid-edit',
      regionId: 'region_hair',
      preserveRegionIds: ['region_face', 'region_eyes'],
      boundaryAnchorIds: ['anchor_hairline'],
      requiredGuarantees: ['outside-region-unchanged', 'protected-region-unchanged'],
      primaryReason: '自由轮廓需要生成，眼睛与脸部必须保持',
      fallbackMode: 'geometric-edit',
    }, {
      allowedRegionIds: ['region_hair', 'region_face', 'region_eyes'],
      allowedAnchorIds: ['anchor_hairline'],
    });

    expect(strategy).toEqual(expect.objectContaining({
      mode: 'hybrid-edit',
      regionId: 'region_hair',
      fallbackMode: 'geometric-edit',
    }));
  });

  it('rejects a selection bound to a stale drawing revision', () => {
    const selection = {
      regionId: 'region_arm',
      revision: 'revision_old' as RevisionId,
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
