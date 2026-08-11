import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  GeometryId,
  GeometryNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import { buildAtomicGeometryGraph } from './atomic-graph.js';

describe('Virtual Atomic Geometry Graph', () => {
  it('lazily expands every finite 2D geometry family without changing Drawing IR', () => {
    const document = fixtureDocument();
    const before = structuredClone(document);
    const graph = buildAtomicGeometryGraph({
      document,
      revision: 'revision_atomic' as RevisionId,
      regionBounds: { minX: -20, minY: -20, maxX: 40, maxY: 40 },
      padding: 2,
      curveSamples: 16,
    });

    expect(document).toEqual(before);
    expect(graph.segmentsFor('point')).toHaveLength(1);
    expect(graph.segmentsFor('line')).toHaveLength(1);
    expect(graph.segmentsFor('polyline')).toHaveLength(2);
    expect(graph.segmentsFor('circle').length).toBeGreaterThanOrEqual(16);
    expect(graph.segmentsFor('arc').length).toBeGreaterThanOrEqual(4);
    expect(graph.segmentsFor('ellipse').length).toBeGreaterThanOrEqual(16);
    expect(graph.segmentsFor('spline').length).toBeGreaterThanOrEqual(2);
    expect(graph.segmentsFor('far_line')).toEqual([]);
    expect(graph.segmentsFor('polyline')[0]).toMatchObject({
      kind: 'vertex-range', vertexRange: [0, 1], revision: 'revision_atomic',
    });
    expect(graph.segmentsFor('circle')[0]).toMatchObject({
      kind: 'parameter-range', parameterRange: [0, expect.any(Number)],
    });
  });

  it('samples bulge segments as arcs instead of endpoint-only chords', () => {
    const graph = buildAtomicGeometryGraph({
      document: fixtureDocument(),
      revision: 'revision_atomic' as RevisionId,
      regionBounds: { minX: -20, minY: -20, maxX: 40, maxY: 40 },
      curveSamples: 16,
    });

    const bulge = graph.segmentsFor('polyline')[0];
    expect(bulge.samples.length).toBeGreaterThan(2);
    expect(bulge.samples.some((point) => Math.abs(point[1]) > 0.01)).toBe(true);
  });

  it('keeps a bulge whose arc crosses the region even when its endpoints do not', () => {
    const graph = buildAtomicGeometryGraph({
      document: fixtureDocument(),
      revision: 'revision_atomic' as RevisionId,
      regionBounds: { minX: 14, minY: -3, maxX: 16, maxY: -2 },
      curveSamples: 32,
    });

    expect(graph.segmentsFor('polyline')).not.toEqual([]);
  });

  it('derives deterministic ids and endpoint adjacency across source nodes', () => {
    const input = {
      document: fixtureDocument(),
      revision: 'revision_atomic' as RevisionId,
      regionBounds: { minX: -20, minY: -20, maxX: 40, maxY: 40 },
      curveSamples: 16,
    };
    const first = buildAtomicGeometryGraph(input);
    const second = buildAtomicGeometryGraph(input);
    const line = first.segmentsFor('line')[0];
    const polyline = first.segmentsFor('polyline')[0];

    expect(first.segments.map((segment) => segment.id))
      .toEqual(second.segments.map((segment) => segment.id));
    expect(line.id).toMatch(/^atomic_[a-f0-9]{24}$/);
    expect(line.adjacentSegmentIds).toContain(polyline.id);
    expect(polyline.adjacentSegmentIds).toContain(line.id);
  });

  it('reuses an identical revision-bound lazy graph request', () => {
    const input = {
      document: fixtureDocument(),
      revision: 'revision_atomic' as RevisionId,
      regionBounds: { minX: -20, minY: -20, maxX: 40, maxY: 40 },
      curveSamples: 16,
    };

    expect(buildAtomicGeometryGraph(input)).toBe(buildAtomicGeometryGraph(input));
  });
});

function fixtureDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_atomic' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      node({ id: 'point', type: 'point', x: 1, y: 1 }),
      node({ id: 'line', type: 'line', start: [0, 0], end: [10, 0] }),
      node({
        id: 'polyline', type: 'polyline', closed: false,
        vertices: [
          { point: [10, 0], bulge: 0.5 },
          { point: [20, 0] },
          { point: [25, 5] },
        ],
      }),
      node({ id: 'circle', type: 'circle', center: [10, 15], radius: 4 }),
      node({
        id: 'arc', type: 'arc', center: [20, 15], radius: 5,
        startAngle: 0, endAngle: 180, counterClockwise: true,
      }),
      node({ id: 'ellipse', type: 'ellipse', center: [10, 28], majorAxis: [5, 0], ratio: 0.5 }),
      node({
        id: 'spline', type: 'spline', degree: 2,
        controlPoints: [[20, 25], [25, 35], [30, 25]],
        knots: [0, 0, 0, 1, 1, 1], closed: false, periodic: false,
      }),
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
