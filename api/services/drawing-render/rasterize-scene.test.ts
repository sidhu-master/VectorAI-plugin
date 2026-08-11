import { describe, expect, it } from 'vitest';

import {
  compileDrawingScene,
  type DrawingDocument,
  type GeometryNode,
  type RevisionId,
} from '../../../src/drawing/index.js';
import { rasterizeScene } from './rasterize-scene.js';

describe('rasterizeScene', () => {
  it('rasterizes shared scene primitives and reports only written node pixels', () => {
    const scene = compileDrawingScene(documentWith([
      geometry({ id: 'visible', type: 'line', start: [10, 10], end: [30, 10] }),
      geometry({ id: 'offscreen', type: 'circle', center: [500, 500], radius: 20 }),
    ]), {
      revision: 'revision_raster' as RevisionId,
      viewBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    });

    const result = rasterizeScene(scene, {
      width: 100,
      height: 100,
      worldToImage: [1, 0, 0, -1, 0, 100],
      background: [0, 0, 0, 255],
      colorForPrimitive: () => [255, 255, 255, 255],
      strokeWidthPixels: () => 1,
    });

    expect(result.rgba.some((value) => value === 255)).toBe(true);
    expect(result.nodeBounds.get('visible')).toMatchObject({
      x: 9, y: 89, width: 23, height: 3,
    });
    expect(result.nodeBounds.has('offscreen')).toBe(false);
  });
});

function geometry(input: Record<string, unknown> & { id: string; type: GeometryNode['type'] }): GeometryNode {
  return {
    ...input,
    id: input.id as GeometryNode['id'],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as unknown as GeometryNode;
}

function documentWith(geometryItems: GeometryNode[]): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_raster' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: geometryItems, annotations: [], relations: [], features: [],
  };
}
