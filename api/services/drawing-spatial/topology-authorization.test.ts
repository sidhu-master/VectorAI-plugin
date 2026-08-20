import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  GeometryId,
  RevisionId,
} from '../../../src/drawing/index.js';
import { buildGeometryTopologyGraph } from './atomic-graph.js';
import { authorizeTopologySelection } from './topology-authorization.js';

const REVISION = 'revision_authorization' as RevisionId;

describe('authorizeTopologySelection', () => {
  it('derives exact editable and protected targets without a second model decision', () => {
    const document = fixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION });
    const selected = graph.segmentsFor('target')[0];
    const authorization = authorizeTopologySelection({
      document,
      graph,
      selectedSegmentIds: [selected.id],
      selection: {
        regionId: 'selection_scope', revision: REVISION,
        wholeNodes: ['target' as GeometryId], partialSegments: [], crossingNodes: [],
        protectedNodes: ['protected'], boundaryAnchors: [],
        classifications: [], uncertainParts: [], splitPlan: [],
      },
      locality: {
        areaRatio: 0.1, widthRatio: 0.2, heightRatio: 0.2,
        targetCenterDistanceRatio: 0, wholeNodes: 1, crossingNodes: 0,
        boundaryAnchors: 0, candidateFragments: 1,
      },
    });

    expect(authorization.editableTargetIds).toEqual(['node:target']);
    expect(authorization.protectedTargetIds).toContain('node:protected');
    expect(authorization.protectedHashes['node:protected']).toBeTruthy();
    expect(authorization.topologyResolutionId).toMatch(/^topology_resolution_/);
  });

  it('rejects a stale graph', () => {
    const document = fixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION });
    expect(() => authorizeTopologySelection({
      document,
      graph,
      selectedSegmentIds: [],
      selection: {
        regionId: 'selection_scope', revision: 'revision_other' as RevisionId,
        wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      locality: {
        areaRatio: 0, widthRatio: 0, heightRatio: 0, targetCenterDistanceRatio: null,
        wholeNodes: 0, crossingNodes: 0, boundaryAnchors: 0, candidateFragments: 0,
      },
    })).toThrow('TOPOLOGY_AUTHORIZATION_REVISION_MISMATCH');
  });
});

function fixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_authorization' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [{
      id: 'target' as GeometryId, type: 'line', start: [0, 0], end: [10, 0],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }, {
      id: 'protected' as GeometryId, type: 'line', start: [0, 5], end: [10, 5],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }],
    annotations: [], relations: [], features: [],
  };
}
