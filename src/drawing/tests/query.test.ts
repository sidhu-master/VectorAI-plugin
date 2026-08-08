import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../document/create';
import type {
  AnnotationId,
  DrawingDocument,
  GeometryId,
  GeometryNode,
} from '../document/types';
import { geometryBounds } from '../query/bounds';
import { inspectNode, queryDrawing } from '../query/query';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

type GeometryInput = GeometryNode extends infer Node
  ? Node extends GeometryNode
    ? Omit<Node, 'visible' | 'quality'>
    : never
  : never;

function geometry(value: GeometryInput): GeometryNode {
  return { ...value, visible: true, quality: confirmed } as GeometryNode;
}

function drawingWithEveryGeometry(): DrawingDocument {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_query' },
    now: () => 1,
  });
  document.geometry.push(
    geometry({ id: 'point_1' as GeometryId, type: 'point', x: 0, y: 0 }),
    geometry({ id: 'line_1' as GeometryId, type: 'line', start: [-1, -1], end: [1, 1] }),
    geometry({ id: 'ray_1' as GeometryId, type: 'ray', origin: [0, 0], direction: [1, 0] }),
    geometry({ id: 'xline_1' as GeometryId, type: 'xline', origin: [0, 0], direction: [0, 1] }),
    geometry({ id: 'circle_1' as GeometryId, type: 'circle', center: [10, 10], radius: 2 }),
    geometry({
      id: 'arc_1' as GeometryId,
      type: 'arc',
      center: [20, 20],
      radius: 5,
      startAngle: 0,
      endAngle: 90,
      counterClockwise: true,
    }),
    geometry({
      id: 'ellipse_1' as GeometryId,
      type: 'ellipse',
      center: [30, 30],
      majorAxis: [4, 0],
      ratio: 0.5,
    }),
    geometry({
      id: 'polyline_1' as GeometryId,
      type: 'polyline',
      vertices: [{ point: [40, 40], bulge: 1 }, { point: [44, 40] }, { point: [44, 44] }],
      closed: false,
    }),
    geometry({
      id: 'spline_1' as GeometryId,
      type: 'spline',
      degree: 2,
      controlPoints: [[50, 50], [52, 55], [54, 50]],
      knots: [0, 0, 0, 1, 1, 1],
      closed: false,
      periodic: false,
    }),
  );
  document.annotations.push({
    id: 'text_1' as AnnotationId,
    type: 'text',
    visible: true,
    quality: confirmed,
    content: 'CAD',
    position: [60, 60],
    height: 2,
    rotation: 0,
    alignment: 'left',
    verticalAlignment: 'baseline',
  });
  return document;
}

describe('geometryBounds', () => {
  it('computes analytic arc and rotated-ellipse bounds', () => {
    const document = drawingWithEveryGeometry();
    expect(geometryBounds(document.geometry[5])).toEqual({ minX: 20, minY: 20, maxX: 25, maxY: 25 });
    expect(geometryBounds(document.geometry[6])).toEqual({ minX: 26, minY: 28, maxX: 34, maxY: 32 });
  });

  it('clips rays and construction lines to the requested query bounds', () => {
    const document = drawingWithEveryGeometry();
    const clip = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
    expect(geometryBounds(document.geometry[2], clip)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 0 });
    expect(geometryBounds(document.geometry[3], clip)).toEqual({ minX: 0, minY: -10, maxX: 0, maxY: 10 });
  });
});

describe('queryDrawing', () => {
  it('returns bounded summaries for every supported geometry type', () => {
    const result = queryDrawing(drawingWithEveryGeometry(), {
      plane: 'geometry',
      bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    });

    expect(result.items).toHaveLength(9);
    expect(result.items.every((item) => item.summary.length > 0 && item.bounds !== undefined)).toBe(true);
    expect(result.items.at(-1)?.summary).toContain('control-hull bounds');
  });

  it('combines type, region, quality and limit selectors without reordering matches', () => {
    const document = drawingWithEveryGeometry();
    document.geometry[4].quality = { status: 'candidate', confidence: 0.5, evidenceRefs: [] };
    const result = queryDrawing(document, {
      plane: 'geometry',
      types: ['circle'],
      qualityStatus: 'candidate',
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      limit: 1,
    });

    expect(result).toEqual({
      items: [{
        id: 'circle_1',
        plane: 'geometry',
        type: 'circle',
        summary: 'circle center=[10,10] radius=2',
        bounds: { minX: 8, minY: 8, maxX: 12, maxY: 12 },
      }],
      truncated: false,
    });
  });

  it('returns cloned inspect results with relation and feature membership', () => {
    const document = drawingWithEveryGeometry();
    const inspected = inspectNode(document, 'circle_1');
    expect(inspected?.node).toEqual(document.geometry[4]);
    expect(inspected?.node).not.toBe(document.geometry[4]);
    expect(inspected?.bounds).toEqual({ minX: 8, minY: 8, maxX: 12, maxY: 12 });
  });
});
