import { describe, expect, it } from 'vitest';

import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  RevisionId,
} from '../index';
import { compileDrawingScene } from '../scene';

describe('compileDrawingScene', () => {
  it('compiles every MVP geometry into a render-neutral scene', () => {
    const scene = compileDrawingScene(documentWith(allGeometry()), {
      revision: 'revision_scene_1' as RevisionId,
      viewBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    });

    expect(scene.rendererVersion).toBe('scene-1.0');
    expect(scene.primitives.map((item) => [item.nodeId, item.kind])).toEqual([
      ['point', 'marker'],
      ['line', 'path'],
      ['ray', 'path'],
      ['xline', 'path'],
      ['circle', 'path'],
      ['arc', 'path'],
      ['ellipse', 'path'],
      ['polyline', 'path'],
      ['spline', 'path'],
    ]);
    expect(scene.nodeIndex.circle.worldBounds).toEqual({
      minX: 10, minY: 10, maxX: 30, maxY: 30,
    });
    expect(scene.worldBounds).toEqual({
      minX: 0, minY: -100, maxX: 100, maxY: 100,
    });
  });

  it('compiles text and dimensions into shared annotation primitives', () => {
    const scene = compileDrawingScene(documentWith([], annotations()), {
      revision: 'revision_scene_2' as RevisionId,
      viewBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
      scale: 2,
    });
    const label = scene.primitives.filter((item) => item.nodeId === 'label');
    const dimension = scene.primitives.filter((item) => item.nodeId === 'dimension_linear');

    expect(label).toEqual([
      expect.objectContaining({
        kind: 'text', content: 'R20', position: [12, 8],
        height: 5, rotation: 15, alignment: 'center',
      }),
    ]);
    expect(dimension.map((item) => item.semanticRole)).toEqual([
      'dimension-extension',
      'dimension-extension',
      'dimension-measure',
      'dimension-arrow',
      'dimension-arrow',
      'dimension-text',
    ]);
    expect(dimension.at(-1)).toMatchObject({
      kind: 'text', content: '25 mm', position: [12.5, 15], height: 5.5,
    });
    expect(scene.nodeIndex.dimension_linear.primitiveKeys).toHaveLength(6);
  });

  it('keeps analytic arcs and polyline bulges as shared arc commands', () => {
    const scene = compileDrawingScene(documentWith(allGeometry()), {
      revision: 'revision_scene_1' as RevisionId,
      viewBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    });
    const circle = scene.primitives.find((item) => item.nodeId === 'circle');
    const arc = scene.primitives.find((item) => item.nodeId === 'arc');
    const polyline = scene.primitives.find((item) => item.nodeId === 'polyline');

    expect(circle).toMatchObject({
      kind: 'path',
      commands: [
        { op: 'M', point: [30, 20] },
        { op: 'A', center: [20, 20], radiusX: 10, radiusY: 10 },
      ],
    });
    expect(arc).toMatchObject({
      kind: 'path',
      commands: expect.arrayContaining([
        expect.objectContaining({ op: 'A', counterClockwise: true }),
      ]),
    });
    expect(polyline).toMatchObject({
      kind: 'path',
      commands: expect.arrayContaining([
        expect.objectContaining({ op: 'A', counterClockwise: true }),
      ]),
    });
  });

  it('clips ray and xline geometry to the requested view bounds', () => {
    const scene = compileDrawingScene(documentWith(allGeometry()), {
      revision: 'revision_scene_1' as RevisionId,
      viewBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    });
    const ray = scene.primitives.find((item) => item.nodeId === 'ray');
    const xline = scene.primitives.find((item) => item.nodeId === 'xline');

    expect(ray).toMatchObject({
      kind: 'path',
      commands: [{ op: 'M', point: [0, 0] }, { op: 'L', point: [100, 0] }],
    });
    expect(xline).toMatchObject({
      kind: 'path',
      commands: [{ op: 'M', point: [0, -100] }, { op: 'L', point: [0, 100] }],
    });
  });
});

function allGeometry(): GeometryNode[] {
  const quality = { status: 'confirmed' as const, evidenceRefs: [] };
  return [
    { id: 'point' as never, type: 'point', visible: true, quality, x: 1, y: 2 },
    { id: 'line' as never, type: 'line', visible: true, quality, start: [0, 0], end: [5, 5] },
    { id: 'ray' as never, type: 'ray', visible: true, quality, origin: [0, 0], direction: [1, 0] },
    { id: 'xline' as never, type: 'xline', visible: true, quality, origin: [0, 0], direction: [0, 1] },
    { id: 'circle' as never, type: 'circle', visible: true, quality, center: [20, 20], radius: 10 },
    {
      id: 'arc' as never, type: 'arc', visible: true, quality,
      center: [40, 20], radius: 8, startAngle: 0, endAngle: 180, counterClockwise: true,
    },
    {
      id: 'ellipse' as never, type: 'ellipse', visible: true, quality,
      center: [60, 20], majorAxis: [10, 0], ratio: 0.5,
    },
    {
      id: 'polyline' as never, type: 'polyline', visible: true, quality, closed: false,
      vertices: [{ point: [0, 40], bulge: 1 }, { point: [20, 40] }, { point: [30, 45] }],
    },
    {
      id: 'spline' as never, type: 'spline', visible: true, quality,
      degree: 2, controlPoints: [[0, 60], [10, 70], [20, 60]],
      knots: [0, 0, 0, 1, 1, 1], closed: false, periodic: false,
    },
  ];
}

function annotations(): AnnotationNode[] {
  const quality = { status: 'confirmed' as const, evidenceRefs: [] };
  return [{
    id: 'label' as never,
    type: 'text',
    visible: true,
    quality,
    content: 'R20',
    position: [12, 8],
    height: 5,
    rotation: 15,
    alignment: 'center',
    verticalAlignment: 'middle',
  }, {
    id: 'dimension_linear' as never,
    type: 'dimension',
    visible: true,
    quality,
    dimensionKind: 'linear',
    associationStatus: 'resolved',
    targets: [],
    observedValue: 25,
    unit: 'mm',
    textPosition: [12.5, 15],
    definitionPoints: [[0, 0], [25, 0], [0, 10], [25, 10]],
  }];
}

function documentWith(
  geometry: GeometryNode[],
  annotations: AnnotationNode[] = [],
): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_scene' as never,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry, annotations, relations: [], features: [],
  };
}
