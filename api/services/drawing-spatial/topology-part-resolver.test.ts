import { describe, expect, it } from 'vitest';

import type { SemanticAnchorRole } from '../../../src/contracts/drawing-spatial-region.js';

import type {
  DrawingDocument,
  GeometryId,
  GeometryNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import { buildGeometryTopologyGraph } from './atomic-graph.js';
import { TopologyPartResolver } from './topology-part-resolver.js';

const REVISION = 'revision_part' as RevisionId;

describe('TopologyPartResolver', () => {
  it('extracts the subgraph between semantic boundary ports without selecting a crossing decoy', () => {
    const document = partFixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION, tolerance: 0.001 });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [
        anchor('target', 'target-seed', [20, 10]),
        anchor('lower_port', 'boundary', [0, 5]),
        anchor('upper_port', 'boundary', [0, 15]),
        anchor('protected', 'protected-seed', [0, 10]),
      ],
      searchBounds: { minX: -2, minY: 2, maxX: 24, maxY: 18 },
      tolerance: 0.001,
      maxSegments: 32,
    });

    expect(result.accepted).toBe(true);
    expect(new Set(result.selection.wholeNodes)).toEqual(new Set([
      'target_loop', 'lower_connector', 'upper_connector',
    ]));
    expect(result.selection.protectedNodes).toEqual(expect.arrayContaining([
      'protected_outline', 'crossing_decoy',
    ]));
    expect(result.selectedSegmentIds).not.toEqual(expect.arrayContaining(
      graph.segmentsFor('crossing_decoy').map((segment) => segment.id),
    ));
    expect(result.snappedAnchors.filter((item) => item.role === 'boundary'))
      .toHaveLength(2);
  });

  it('rejects a traversal that reaches protected topology without a boundary port', () => {
    const document = partFixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION, tolerance: 0.001 });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [
        anchor('target', 'target-seed', [20, 10]),
        anchor('protected', 'protected-seed', [0, 10]),
      ],
      searchBounds: { minX: -2, minY: 2, maxX: 24, maxY: 18 },
      tolerance: 0.001,
      maxSegments: 32,
    });

    expect(result.accepted).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('UNBOUNDED_PROTECTED_CONTACT');
  });

  it('rejects stale revisions before traversal', () => {
    const document = partFixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION });

    expect(() => new TopologyPartResolver().resolve({
      document,
      revision: 'revision_stale' as RevisionId,
      graph,
      anchors: [anchor('target', 'target-seed', [20, 10])],
      searchBounds: { minX: 0, minY: 0, maxX: 25, maxY: 20 },
      tolerance: 0.001,
      maxSegments: 32,
    })).toThrow('TOPOLOGY_REVISION_MISMATCH');
  });

  it('selects only the target interval of a shared polyline and protects the remainder', () => {
    const sharedPath = node({
      id: 'shared_path', type: 'polyline', closed: false,
      vertices: [
        { point: [0, 0] }, { point: [10, 0] },
        { point: [20, 0] }, { point: [30, 0] },
      ],
    });
    const document = {
      ...partFixture(),
      geometry: [sharedPath],
    };
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION, tolerance: 0.001 });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [
        anchor('target', 'target-seed', [5, 0]),
        anchor('boundary', 'boundary', [20, 0]),
        anchor('protected', 'protected-seed', [25, 0]),
      ],
      searchBounds: { minX: -1, minY: -1, maxX: 31, maxY: 1 },
      tolerance: 0.001,
      maxSegments: 16,
    });

    expect(result.accepted).toBe(true);
    expect(result.selection.wholeNodes).toEqual([]);
    expect(result.selection.crossingNodes).toEqual(['shared_path']);
    expect(result.selection.partialSegments).toHaveLength(2);
    expect(result.selection.splitPlan).toEqual([expect.objectContaining({
      nodeId: 'shared_path',
      ranges: [
        { role: 'target', range: [0, 2] },
        { role: 'protected', range: [2, 3] },
      ],
    })]);
  });

  it('charges a sampled analytic arc as one traversal member', () => {
    const arc = node({
      id: 'analytic_arc', type: 'arc', center: [0, 0], radius: 20,
      startAngle: 0, endAngle: 270, counterClockwise: true,
    });
    const document = { ...partFixture(), geometry: [arc] };
    const graph = buildGeometryTopologyGraph({
      document, revision: REVISION, curveSamples: 64, tolerance: 0.001,
    });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [anchor('target', 'target-seed', [20, 0])],
      searchBounds: { minX: -22, minY: -22, maxX: 22, maxY: 22 },
      tolerance: 0.001,
      maxSegments: 1,
    });

    expect(graph.segmentsFor('analytic_arc').length).toBeGreaterThan(12);
    expect(result.accepted).toBe(true);
    expect(result.complexityCost).toBe(1);
    expect(new Set(result.traversalOrder)).toEqual(new Set(result.selectedSegmentIds));
    expect(result.selection.wholeNodes).toEqual(['analytic_arc']);
  });

  it('resolves a target seed placed inside the smallest closed geometry', () => {
    const hand = node({ id: 'hand', type: 'circle', center: [20, 10], radius: 5 });
    const enclosingBody = node({ id: 'body', type: 'circle', center: [20, 10], radius: 30 });
    const document = { ...partFixture(), geometry: [enclosingBody, hand] };
    const graph = buildGeometryTopologyGraph({
      document, revision: REVISION, curveSamples: 64, tolerance: 0.001,
    });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [anchor('hand_center', 'target-seed', [20, 10])],
      searchBounds: { minX: 10, minY: 0, maxX: 30, maxY: 20 },
      tolerance: 0.001,
      maxSegments: 4,
    });

    expect(result.accepted).toBe(true);
    expect(result.snappedAnchors[0]).toMatchObject({
      id: 'hand_center', role: 'target-seed', segmentId: expect.any(String),
    });
    expect(result.snappedAnchors[0].distance).toBe(0);
    expect(result.selection.wholeNodes).toEqual(['hand']);
  });

  it('keeps required destination anchors as constraints without snapping current topology', () => {
    const document = partFixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION, tolerance: 0.001 });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [
        anchor('target', 'target-seed', [20, 10]),
        anchor('future_position', 'required', [200, 200]),
      ],
      searchBounds: { minX: -2, minY: 2, maxX: 210, maxY: 210 },
      tolerance: 0.001,
      maxSegments: 32,
    });

    expect(result.accepted).toBe(true);
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      anchorId: 'future_position', code: 'ANCHOR_OUTSIDE_TOPOLOGY',
    }));
    expect(result.snappedAnchors).not.toContainEqual(expect.objectContaining({
      id: 'future_position',
    }));
  });

  it('does not traverse connected topology outside the semantic search envelope', () => {
    const document = partFixture();
    const graph = buildGeometryTopologyGraph({ document, revision: REVISION, tolerance: 0.001 });

    const result = new TopologyPartResolver().resolve({
      document,
      revision: REVISION,
      graph,
      anchors: [anchor('target', 'target-seed', [20, 10])],
      searchBounds: { minX: 9, minY: 4, maxX: 23, maxY: 16 },
      tolerance: 0.001,
      maxSegments: 8,
    });

    expect(result.accepted).toBe(true);
    expect(result.selection.wholeNodes).toEqual(expect.arrayContaining([
      'target_loop', 'lower_connector', 'upper_connector',
    ]));
    expect(result.selection.protectedNodes).toEqual(expect.arrayContaining([
      'protected_outline', 'crossing_decoy',
    ]));
  });
});

function partFixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_part' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      node({
        id: 'protected_outline', type: 'polyline', closed: false,
        vertices: [
          { point: [0, 0] }, { point: [0, 5] },
          { point: [0, 15] }, { point: [0, 20] },
        ],
      }),
      node({ id: 'lower_connector', type: 'line', start: [0, 5], end: [10, 5] }),
      node({ id: 'upper_connector', type: 'line', start: [10, 15], end: [0, 15] }),
      node({
        id: 'target_loop', type: 'polyline', closed: true,
        vertices: [
          { point: [10, 5] }, { point: [20, 5] },
          { point: [20, 15] }, { point: [10, 15] },
        ],
      }),
      node({ id: 'crossing_decoy', type: 'line', start: [15, 0], end: [15, 20] }),
    ],
    annotations: [], relations: [], features: [],
  };
}

function anchor(id: string, role: SemanticAnchorRole, point: readonly [number, number]) {
  return { id, role, point, confidence: 0.99 };
}

function node(value: { id: string; type: GeometryNode['type'] } & Record<string, unknown>): GeometryNode {
  return {
    ...value,
    id: value.id as GeometryId,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as unknown as GeometryNode;
}
