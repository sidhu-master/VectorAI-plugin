import { describe, expect, it } from 'vitest';

import type { DrawingDocument, GeometryNode } from '../../../src/drawing/index.js';
import { compareDrawingRegion } from './residual-comparator.js';
import { renderDrawingRegion } from './source-renderer.js';

const REQUEST = {
  region: { x: 0, y: 0, width: 120, height: 120 },
  documentToSource: [1, 0, 0, -1, 0, 120] as const,
  strokeWidthPixels: 1,
};

describe('compareDrawingRegion', () => {
  it('reports improvement after a wrong circle is corrected to an arc', () => {
    const source = renderDrawingRegion(drawing([arc()]), REQUEST);
    const wrong = renderDrawingRegion(drawing([circle()]), REQUEST);
    const corrected = renderDrawingRegion(drawing([arc()]), REQUEST);

    const before = compareDrawingRegion({
      sourceEdges: source.combined,
      rendered: wrong,
      region: REQUEST.region,
      tolerancePixels: 1,
    });
    const after = compareDrawingRegion({
      sourceEdges: source.combined,
      rendered: corrected,
      region: REQUEST.region,
      tolerancePixels: 1,
      previousGeometry: before.geometry,
    });

    expect(after.geometry.fitP95).toBeLessThan(before.geometry.fitP95);
    expect(after.geometry.edgeF1).toBeGreaterThan(before.geometry.edgeF1);
    expect(after.improved).toBe(true);
    expect(after.residualRegions).toHaveLength(0);
  });

  it('does not claim improvement when confirmed topology regresses', () => {
    const source = renderDrawingRegion(drawing([arc()]), REQUEST);
    const report = compareDrawingRegion({
      sourceEdges: source.combined,
      rendered: source,
      region: REQUEST.region,
      tolerancePixels: 1,
      previousGeometry: { edgePrecision: 0.5, edgeRecall: 0.5, edgeF1: 0.5, fitP50: 2, fitP95: 3, fitMax: 4 },
      topologyFailures: ['connected:arc_1:line_1'],
    });

    expect(report.geometry.edgeF1).toBe(1);
    expect(report.improved).toBe(false);
    expect(report.topologyFailures).toEqual(['connected:arc_1:line_1']);
  });
});

function drawing(geometry: GeometryNode[]): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_compare' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry, annotations: [], relations: [], features: [],
  };
}

function circle(): GeometryNode {
  return common({ type: 'circle', center: [60, 60], radius: 30 });
}

function arc(): GeometryNode {
  return common({
    type: 'arc', center: [60, 60], radius: 30,
    startAngle: 20, endAngle: 160, counterClockwise: true,
  });
}

function common(value: Record<string, unknown> & { type: GeometryNode['type'] }): GeometryNode {
  return {
    ...value,
    id: 'shape_1' as GeometryNode['id'], visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as GeometryNode;
}
