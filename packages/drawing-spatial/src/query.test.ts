import type {
  AnnotationId,
  DrawingDocument,
  DrawingId,
  EvidenceId,
  FeatureId,
  GeometryId,
  RelationId,
} from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { queryDrawing } from './query';

const evidenceRefs = [] as EvidenceId[];

function documentFixture(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_spatial' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'frame_document',
      kind: 'document',
      transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry: [{
      id: 'line_a' as GeometryId,
      type: 'line',
      start: [0, 0],
      end: [10, 10],
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }, {
      id: 'circle_b' as GeometryId,
      type: 'circle',
      center: [30, 30],
      radius: 5,
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }, {
      id: 'polyline_c' as GeometryId,
      type: 'polyline',
      vertices: [{ point: [-8, -4] }, { point: [-2, -1] }],
      closed: false,
      visible: true,
      quality: { status: 'candidate', evidenceRefs },
    }],
    annotations: [{
      id: 'text_a' as AnnotationId,
      type: 'text',
      content: 'A',
      position: [4, 3],
      height: 2,
      rotation: 0,
      alignment: 'left',
      verticalAlignment: 'baseline',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }, {
      id: 'dimension_b' as AnnotationId,
      type: 'dimension',
      dimensionKind: 'linear',
      associationStatus: 'resolved',
      targets: [{ geometryId: 'circle_b' as GeometryId, anchor: { kind: 'center' } }],
      textPosition: [32, 39],
      definitionPoints: [[25, 35], [35, 35]],
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }],
    relations: [{
      id: 'connected_a' as RelationId,
      type: 'topology',
      plane: 'topology',
      kind: 'connected',
      nodeIds: ['line_a', 'text_a'],
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }],
    features: [{
      id: 'feature_a' as FeatureId,
      type: 'feature',
      semanticType: 'edge-label',
      geometryIds: ['line_a' as GeometryId],
      annotationIds: ['text_a' as AnnotationId],
      relationIds: ['connected_a' as RelationId],
      properties: {},
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }],
  };
}

describe('queryDrawing', () => {
  it('returns intersecting nodes in deterministic plane and document order', () => {
    const result = queryDrawing(documentFixture(), {
      kind: 'world-slice',
      bounds: { minX: -1, minY: -1, maxX: 12, maxY: 12 },
      limit: 20,
    });

    expect(result).toEqual({
      kind: 'world-slice',
      bounds: { minX: -1, minY: -1, maxX: 12, maxY: 12 },
      nodes: [
        { plane: 'geometry', node: documentFixture().geometry[0] },
        { plane: 'annotation', node: documentFixture().annotations[0] },
        { plane: 'relation', node: documentFixture().relations[0] },
        { plane: 'feature', node: documentFixture().features[0] },
      ],
      totalByPlane: { geometry: 1, annotation: 1, relation: 1, feature: 1 },
      truncated: false,
    });
  });

  it('uses circle, polyline and dimension extents for intersection', () => {
    const positive = queryDrawing(documentFixture(), {
      kind: 'world-slice',
      bounds: { minX: 34, minY: 34, maxX: 36, maxY: 40 },
      planes: ['geometry', 'annotation'],
    });
    const negative = queryDrawing(documentFixture(), {
      kind: 'world-slice',
      bounds: { minX: -9, minY: -5, maxX: -7, maxY: -3 },
      planes: ['geometry'],
    });

    expect(positive.nodes.map(({ node }) => node.id)).toEqual(['circle_b', 'dimension_b']);
    expect(negative.nodes.map(({ node }) => node.id)).toEqual(['polyline_c']);
  });

  it('does not report empty space inside a spline control polygon as curve geometry', () => {
    const document = documentFixture();
    document.geometry = [{
      id: 'spline_exact' as GeometryId,
      type: 'spline',
      degree: 2,
      controlPoints: [[0, 0], [0, 10], [10, 0]],
      knots: [0, 0, 0, 1, 1, 1],
      closed: false,
      periodic: false,
      visible: true,
      quality: { status: 'confirmed', evidenceRefs },
    }];
    document.annotations = [];
    document.relations = [];
    document.features = [];

    expect(queryDrawing(document, {
      kind: 'world-slice',
      bounds: { minX: -0.5, minY: 8.5, maxX: 0.5, maxY: 9.5 },
      planes: ['geometry'],
    }).nodes).toEqual([]);
  });

  it('applies the default limit and reports counts before truncation', () => {
    const document = documentFixture();
    document.geometry = Array.from({ length: 101 }, (_, index) => ({
      ...document.geometry[0],
      id: `line_${index}` as GeometryId,
    }));
    document.annotations = [];
    document.relations = [];
    document.features = [];

    const result = queryDrawing(document, {
      kind: 'world-slice',
      bounds: { minX: -1, minY: -1, maxX: 12, maxY: 12 },
    });

    expect(result.nodes).toHaveLength(100);
    expect(result.nodes[99]?.node.id).toBe('line_99');
    expect(result.totalByPlane).toEqual({ geometry: 101, annotation: 0, relation: 0, feature: 0 });
    expect(result.truncated).toBe(true);
  });

  it('rejects reversed, non-finite and over-limit queries', () => {
    const document = documentFixture();

    expect(() => queryDrawing(document, {
      kind: 'world-slice',
      bounds: { minX: 2, minY: 0, maxX: 1, maxY: 1 },
    })).toThrow('INVALID_QUERY_BOUNDS');
    expect(() => queryDrawing(document, {
      kind: 'world-slice',
      bounds: { minX: 0, minY: 0, maxX: Number.POSITIVE_INFINITY, maxY: 1 },
    })).toThrow('INVALID_QUERY_BOUNDS');
    expect(() => queryDrawing(document, {
      kind: 'world-slice',
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      limit: 201,
    })).toThrow('QUERY_LIMIT_EXCEEDED');
  });

  it('returns one node and depth-one reference neighbors', () => {
    const document = documentFixture();

    expect(queryDrawing(document, { kind: 'node', id: 'circle_b' })).toEqual({
      kind: 'node',
      node: { plane: 'geometry', node: document.geometry[1] },
    });
    expect(queryDrawing(document, { kind: 'neighbors', nodeId: 'line_a', limit: 20 })).toEqual({
      kind: 'neighbors',
      nodeId: 'line_a',
      nodes: [
        { plane: 'annotation', node: document.annotations[0] },
        { plane: 'relation', node: document.relations[0] },
        { plane: 'feature', node: document.features[0] },
      ],
      truncated: false,
    });
  });
});
