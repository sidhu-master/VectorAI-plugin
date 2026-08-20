import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  DrawingId,
  GeometryId,
  RevisionId,
} from '../../../src/drawing/index.js';
import { resolveSpatialPoint } from './point-resolver.js';

describe('resolveSpatialPoint', () => {
  it('inverts an observation affine transform including the image-down Y axis', () => {
    const document = emptyDocument();
    const point = resolveSpatialPoint({
      kind: 'observation',
      observationId: 'view_overview_1',
      normalized: [0.25, 0.5],
    }, {
      document,
      drawingId: document.id,
      revision: 'revision_1' as RevisionId,
      readObservationView: () => ({
        drawingId: document.id,
        revision: 'revision_1' as RevisionId,
        cacheScope: 'canonical',
        view: {
          id: 'view_overview_1',
          purpose: 'overview',
          cacheKey: 'key',
          image: { handle: 'image', mimeType: 'image/png' },
          width: 200,
          height: 100,
          worldBounds: { minX: -5, minY: -5, maxX: 95, maxY: 45 },
          worldToImage: [2, 0, 0, -2, 10, 90],
          grounding: [],
        },
      }),
    });

    expect(point).toEqual([20, 20]);
  });

  it('rejects an observation owned by another revision instead of guessing', () => {
    const document = emptyDocument();

    expect(() => resolveSpatialPoint({
      kind: 'observation',
      observationId: 'view_stale',
      normalized: [0.5, 0.5],
    }, {
      document,
      drawingId: document.id,
      revision: 'revision_current' as RevisionId,
      readObservationView: () => ({
        drawingId: document.id,
        revision: 'revision_old' as RevisionId,
        cacheScope: 'canonical',
        view: {
          id: 'view_stale', purpose: 'overview', cacheKey: 'key',
          image: { handle: 'image', mimeType: 'image/png' },
          width: 100, height: 100,
          worldBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
          worldToImage: [1, 0, 0, -1, 0, 100], grounding: [],
        },
      }),
    })).toThrow(expect.objectContaining({
      code: 'SPATIAL_OBSERVATION_REVISION_MISMATCH',
    }));
  });

  it('accepts an explicit point in the document coordinate frame', () => {
    const document = emptyDocument();

    const point = resolveSpatialPoint({
      kind: 'world',
      frameId: 'frame_document',
      point: [12.5, -8],
    }, {
      document,
      drawingId: document.id,
      revision: 'revision_1' as RevisionId,
      readObservationView: () => null,
    });

    expect(point).toEqual([12.5, -8]);
  });

  it('resolves exact node anchors without asking the model for coordinates', () => {
    const document = emptyDocument();
    document.geometry.push(
      {
        id: 'circle_1' as GeometryId,
        type: 'circle', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [30, 40], radius: 5,
      },
      {
        id: 'point_1' as GeometryId,
        type: 'point', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        x: 7, y: 9,
      },
      {
        id: 'ellipse_1' as GeometryId,
        type: 'ellipse', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [80, 25], majorAxis: [12, 0], ratio: 0.5,
      },
      {
        id: 'path_1' as GeometryId,
        type: 'polyline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        vertices: [{ point: [0, 0] }, { point: [10, 20] }, { point: [30, 20] }],
        closed: false,
      },
      {
        id: 'line_1' as GeometryId,
        type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        start: [-10, 5], end: [10, 5],
      },
      {
        id: 'spline_1' as GeometryId,
        type: 'spline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        degree: 1, controlPoints: [[1, 2], [3, 4]], knots: [0, 0, 1, 1],
        closed: false, periodic: false,
      },
      {
        id: 'arc_1' as GeometryId,
        type: 'arc', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        center: [50, 50], radius: 10, startAngle: 0, endAngle: 90,
        counterClockwise: true,
      },
    );
    const context = {
      document,
      drawingId: document.id,
      revision: 'revision_1' as RevisionId,
      readObservationView: () => null,
    };

    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'circle_1', anchor: 'center',
    }, context)).toEqual([30, 40]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'point_1', anchor: 'center',
    }, context)).toEqual([7, 9]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'ellipse_1', anchor: 'center',
    }, context)).toEqual([80, 25]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'path_1', anchor: 'start',
    }, context)).toEqual([0, 0]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'path_1', anchor: 'end',
    }, context)).toEqual([30, 20]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'path_1', anchor: 'vertex', index: 1,
    }, context)).toEqual([10, 20]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'line_1', anchor: 'end',
    }, context)).toEqual([10, 5]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'spline_1', anchor: 'start',
    }, context)).toEqual([1, 2]);
    expect(resolveSpatialPoint({
      kind: 'node_anchor', nodeId: 'arc_1', anchor: 'end',
    }, context)).toEqual([50, 60]);
  });

  it('reports a stable spatial error when an observation transform is singular', () => {
    const document = emptyDocument();

    expect(() => resolveSpatialPoint({
      kind: 'observation', observationId: 'view_singular', normalized: [0.5, 0.5],
    }, {
      document,
      drawingId: document.id,
      revision: 'revision_1' as RevisionId,
      readObservationView: () => ({
        drawingId: document.id,
        revision: 'revision_1' as RevisionId,
        cacheScope: 'canonical',
        view: {
          id: 'view_singular', purpose: 'overview', cacheKey: 'key',
          image: { handle: 'image', mimeType: 'image/png' },
          width: 100, height: 100,
          worldBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
          worldToImage: [1, 2, 2, 4, 0, 0], grounding: [],
        },
      }),
    })).toThrow(expect.objectContaining({ code: 'SPATIAL_REFERENCE_UNRESOLVED' }));
  });
});

function emptyDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_spatial_program' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [],
    annotations: [],
    relations: [],
    features: [],
  };
}
