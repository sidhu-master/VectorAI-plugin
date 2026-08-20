import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  GeometryId,
  GeometryNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import { buildGeometryTopologyGraph } from './atomic-graph.js';

describe('GeometryTopologyGraph', () => {
  it('indexes the complete revision instead of clipping geometry to a search region', () => {
    const document = fixtureDocument();
    const before = structuredClone(document);
    const graph = buildGeometryTopologyGraph({
      document,
      revision: 'revision_topology' as RevisionId,
      curveSamples: 16,
    });

    expect(document).toEqual(before);
    expect(graph.segmentsFor('line')).toHaveLength(1);
    expect(graph.segmentsFor('far_line')).toHaveLength(1);
    expect(graph.segmentsFor('polyline')).toHaveLength(2);
    expect(graph.vertices.length).toBeGreaterThan(0);
  });

  it('connects coincident endpoints across primitives but not interior visual crossings', () => {
    const graph = buildGeometryTopologyGraph({
      document: fixtureDocument(),
      revision: 'revision_topology' as RevisionId,
      curveSamples: 16,
      tolerance: 0.001,
    });
    const line = graph.segmentsFor('line')[0];
    const polyline = graph.segmentsFor('polyline')[0];
    const crossing = graph.segmentsFor('crossing')[0];

    expect(line.adjacentSegmentIds).toContain(polyline.id);
    expect(polyline.adjacentSegmentIds).toContain(line.id);
    expect(line.adjacentSegmentIds).not.toContain(crossing.id);
    expect(crossing.adjacentSegmentIds).not.toContain(line.id);
  });

  it('uses an explicit topology relation even when connected endpoints are not coincident', () => {
    const document = fixtureDocument();
    document.geometry.push(node({
      id: 'related', type: 'line', start: [10.2, 0], end: [20, 0],
    }));
    document.relations.push({
      id: 'relation_line_related' as never,
      type: 'topology', plane: 'topology', kind: 'connected',
      nodeIds: ['line', 'related'], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    });
    const graph = buildGeometryTopologyGraph({
      document,
      revision: 'revision_explicit' as RevisionId,
      tolerance: 0.001,
    });

    expect(graph.segmentsFor('line')[0].adjacentSegmentIds)
      .toContain(graph.segmentsFor('related')[0].id);
  });

  it('caches by document revision and sampling contract', () => {
    const input = {
      document: fixtureDocument(),
      revision: 'revision_topology' as RevisionId,
      curveSamples: 16,
      tolerance: 0.001,
    };

    expect(buildGeometryTopologyGraph(input)).toBe(buildGeometryTopologyGraph(input));
    expect(buildGeometryTopologyGraph({ ...input, revision: 'revision_next' as RevisionId }))
      .not.toBe(buildGeometryTopologyGraph(input));
  });

  it('uses a drawing-scale fitting tolerance when none is supplied', () => {
    const document = fixtureDocument();
    document.geometry.push(node({
      id: 'near_join', type: 'line', start: [10.4, 0], end: [20, 0],
    }));
    const graph = buildGeometryTopologyGraph({
      document,
      revision: 'revision_scaled_tolerance' as RevisionId,
      curveSamples: 16,
    });

    expect(graph.tolerance).toBeGreaterThan(0.4);
    expect(graph.segmentsFor('line')[0].adjacentSegmentIds)
      .toContain(graph.segmentsFor('near_join')[0].id);
  });
});

function fixtureDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_topology' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      node({ id: 'line', type: 'line', start: [0, 0], end: [10, 0] }),
      node({
        id: 'polyline', type: 'polyline', closed: false,
        vertices: [{ point: [10, 0] }, { point: [20, 0] }, { point: [25, 5] }],
      }),
      node({ id: 'crossing', type: 'line', start: [5, -5], end: [5, 5] }),
      node({ id: 'far_line', type: 'line', start: [1_000, 1_000], end: [1_010, 1_000] }),
    ],
    annotations: [], relations: [], features: [],
  };
}

function node(value: { id: string; type: GeometryNode['type'] } & Record<string, unknown>): GeometryNode {
  return {
    ...value,
    id: value.id as GeometryId,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as unknown as GeometryNode;
}
