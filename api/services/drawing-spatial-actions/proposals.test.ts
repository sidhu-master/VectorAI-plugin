import { describe, expect, it } from 'vitest';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import type { WorldModelSlice } from '../drawing-world-model/types.js';
import { proposeSpatialActions } from './proposals.js';

describe('proposeSpatialActions', () => {
  it('treats a complete source span as a transformable target without granting write authority', () => {
    const proposals = proposeSpatialActions({
      goalDescription: 'move the selected member upward',
      world: world({ parameterRange: [0, 1] }),
      targetRefs: ['span_target'],
      preserveRefs: ['node:neighbor'],
      interfaceRefs: ['vertex_joint'],
      methods: ['transform', 'redraw', 'raw'],
    });

    expect(proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: 'transform', feasibility: 'ready', affectedNodeIds: ['target'],
        requiredSplits: [], fixedInterfaceRefs: ['vertex_joint'],
      }),
      expect.objectContaining({ method: 'redraw', feasibility: 'ready' }),
      expect.objectContaining({ method: 'raw', feasibility: 'ready' }),
    ]));
    expect(JSON.stringify(proposals)).not.toContain('authorized');
    expect(JSON.stringify(proposals)).not.toContain('permission');
  });

  it('reports a virtual split for a partial source span while keeping replacement methods available', () => {
    const proposals = proposeSpatialActions({
      goalDescription: 'replace only the selected boundary fragment',
      world: world({ parameterRange: [0.25, 0.75] }),
      targetRefs: ['span_target'],
      preserveRefs: [],
      interfaceRefs: [],
      methods: ['transform', 'replace', 'redraw'],
    });

    expect(proposals).toEqual([
      expect.objectContaining({
        method: 'transform', feasibility: 'ambiguous',
        requiredSplits: [{ nodeId: 'target', parameterRanges: [[0.25, 0.75]] }],
      }),
      expect.objectContaining({ method: 'replace', feasibility: 'ready' }),
      expect.objectContaining({ method: 'redraw', feasibility: 'ready' }),
    ]);
  });

  it('does not let unrelated unresolved geometry invalidate a resolved target', () => {
    const slice = world({ parameterRange: [0, 1] });
    slice.knowledge = {
      state: 'partial', scopeDigest: 'scope',
      unresolvedBoundaryRefs: ['node:far-away'], continuationToken: 'next',
    };

    const [proposal] = proposeSpatialActions({
      goalDescription: 'edit the resolved target',
      world: slice,
      targetRefs: ['span_target'],
      preserveRefs: [],
      interfaceRefs: [],
      methods: ['raw'],
    });

    expect(proposal).toMatchObject({ method: 'raw', feasibility: 'ready' });
    expect(proposal.diagnostics).toEqual([]);
  });
});

function world(input: { parameterRange: readonly [number, number] }): WorldModelSlice {
  return {
    drawingId: 'drawing_1' as DrawingId, revision: 'revision_1' as RevisionId,
    compilerVersion: 'world-model-0.1.0', inputDigest: 'digest', frameId: 'document',
    sourceSpans: [{
      id: 'span_target', sourceNodeId: 'target', parameterRange: input.parameterRange,
      halfEdgeIds: ['halfedge_forward', 'halfedge_reverse'], derivation: 'analytic',
      tolerance: 0.01, bounds: { minX: 0, minY: 0, maxX: 10, maxY: 0 },
      samples: [[0, 0], [10, 0]],
    }],
    vertices: [{
      id: 'vertex_joint', point: [0, 0], incidentHalfEdgeIds: ['halfedge_forward'],
      source: 'endpoint',
    }],
    halfEdges: [{
      id: 'halfedge_forward', twinId: 'halfedge_reverse', sourceSpanId: 'span_target',
      originVertexId: 'vertex_joint', destinationVertexId: 'vertex_end', direction: 'forward',
    }, {
      id: 'halfedge_reverse', twinId: 'halfedge_forward', sourceSpanId: 'span_target',
      originVertexId: 'vertex_end', destinationVertexId: 'vertex_joint', direction: 'reverse',
    }],
    faces: [], incidenceEdges: [], connectedEdges: [], diagnostics: [],
    knowledge: { state: 'resolved', scopeDigest: 'scope', unresolvedBoundaryRefs: [] },
  };
}
