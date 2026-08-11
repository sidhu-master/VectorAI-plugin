import { describe, expect, it } from 'vitest';

import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
} from '../../../src/drawing/index.js';
import { renderDrawingRegion } from './source-renderer.js';

describe('renderDrawingRegion', () => {
  it('renders every MVP entity into its semantic plane', () => {
    const rendered = renderDrawingRegion(documentWith(allGeometry(), annotations()), {
      region: { x: 0, y: 0, width: 100, height: 100 },
      documentToSource: [1, 0, 0, -1, 0, 100],
      strokeWidthPixels: 1,
    });

    expect(count(rendered.planes.geometry)).toBeGreaterThan(100);
    expect(count(rendered.planes.construction)).toBeGreaterThan(100);
    expect(count(rendered.planes.annotation)).toBeGreaterThan(10);
    expect(count(rendered.planes.text)).toBeGreaterThan(10);
    expect(count(rendered.combined)).toBeGreaterThan(count(rendered.planes.geometry));
  });

  it('converts CAD Y-up to source Y-down exactly once', () => {
    const rendered = renderDrawingRegion(documentWith([geometry({
      id: 'line_y', type: 'line', start: [10, 10], end: [20, 10],
    })]), {
      region: { x: 0, y: 0, width: 100, height: 100 },
      documentToSource: [1, 0, 0, -1, 0, 100],
      strokeWidthPixels: 1,
    });

    expect(pixel(rendered.planes.geometry, 100, 15, 90)).toBe(1);
    expect(pixel(rendered.planes.geometry, 100, 15, 10)).toBe(0);
  });

  it('renders polyline bulges as analytic arcs instead of straight chords', () => {
    const rendered = renderDrawingRegion(documentWith([geometry({
      id: 'bulged_polyline',
      type: 'polyline',
      vertices: [{ point: [10, 40], bulge: 1 }, { point: [30, 40] }],
      closed: false,
    })]), {
      region: { x: 0, y: 0, width: 100, height: 100 },
      documentToSource: [1, 0, 0, -1, 0, 100],
      strokeWidthPixels: 1,
    });

    expect(pixel(rendered.planes.geometry, 100, 20, 70)).toBe(1);
    expect(pixel(rendered.planes.geometry, 100, 20, 60)).toBe(0);
  });
});

function allGeometry(): GeometryNode[] {
  return [
    geometry({ id: 'point', type: 'point', x: 5, y: 5 }),
    geometry({ id: 'line', type: 'line', start: [10, 10], end: [20, 10] }),
    geometry({ id: 'ray', type: 'ray', origin: [10, 20], direction: [1, 0] }),
    geometry({ id: 'xline', type: 'xline', origin: [50, 25], direction: [0, 1] }),
    geometry({ id: 'circle', type: 'circle', center: [20, 40], radius: 8 }),
    geometry({
      id: 'arc', type: 'arc', center: [45, 40], radius: 8,
      startAngle: 0, endAngle: 180, counterClockwise: true,
    }),
    geometry({ id: 'ellipse', type: 'ellipse', center: [70, 40], majorAxis: [10, 0], ratio: 0.5 }),
    geometry({
      id: 'polyline', type: 'polyline',
      vertices: [{ point: [10, 60] }, { point: [20, 70] }, { point: [30, 60] }], closed: false,
    }),
    geometry({
      id: 'spline', type: 'spline', degree: 2,
      controlPoints: [[45, 60], [55, 72], [65, 60]], knots: [0, 0, 0, 1, 1, 1],
      closed: false, periodic: false,
    }),
  ];
}

function annotations(): AnnotationNode[] {
  const quality = { status: 'confirmed' as const, evidenceRefs: [] };
  return [{
    id: 'text_1' as AnnotationNode['id'], type: 'text', visible: true, quality,
    content: 'R20', position: [10, 85], height: 5, rotation: 0,
    alignment: 'left', verticalAlignment: 'baseline',
  }, {
    id: 'dimension_1' as AnnotationNode['id'], type: 'dimension', visible: true, quality,
    dimensionKind: 'linear', associationStatus: 'resolved', targets: [],
    observedValue: 20, displayText: '20', textPosition: [60, 85],
    definitionPoints: [[50, 80], [70, 80]],
  }];
}

function geometry(input: Record<string, unknown> & { id: string; type: GeometryNode['type'] }): GeometryNode {
  return {
    ...input,
    id: input.id as GeometryNode['id'],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as unknown as GeometryNode;
}

function documentWith(geometryItems: GeometryNode[], annotationItems: AnnotationNode[] = []): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_render' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: geometryItems, annotations: annotationItems, relations: [], features: [],
  };
}

function count(mask: Uint8Array): number {
  return mask.reduce((sum, value) => sum + (value > 0 ? 1 : 0), 0);
}

function pixel(mask: Uint8Array, width: number, x: number, y: number): number {
  return mask[y * width + x];
}
