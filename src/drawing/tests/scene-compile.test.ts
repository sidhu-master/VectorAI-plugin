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

  it('compiles leaders and centerlines as display-only annotation primitives', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const scene = compileDrawingScene(documentWith(allGeometry(), [{
      id: 'leader' as never,
      type: 'leader',
      visible: true,
      quality,
      target: { geometryId: 'circle' as never, anchor: { kind: 'center' } },
      points: [[20, 20], [30, 30], [38, 30]],
      content: 'C0.5',
      textHeight: 2.5,
    }, {
      id: 'centerline' as never,
      type: 'centerline',
      visible: true,
      quality,
      targets: ['circle' as never],
      start: [5, 20],
      end: [35, 20],
      extension: 3,
    }]), {
      revision: 'revision_scene_annotations' as RevisionId,
      viewBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
      scale: 2,
    });

    expect(scene.primitives.filter((item) => item.nodeId === 'leader').map((item) => (
      [item.plane, item.semanticRole, item.kind]
    ))).toEqual([
      ['annotation', 'leader-line', 'path'],
      ['annotation', 'leader-arrow', 'path'],
      ['text', 'leader-text', 'text'],
    ]);
    expect(scene.primitives.filter((item) => item.nodeId === 'centerline')).toEqual([
      expect.objectContaining({
        plane: 'annotation', semanticRole: 'centerline', kind: 'path',
        commands: [{ op: 'M', point: [2, 20] }, { op: 'L', point: [38, 20] }],
      }),
    ]);
  });

  it('compiles angular dimensions into two boundary rays, a circular arc, and tangent arrows', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const angular: AnnotationNode = {
      id: 'dimension_angular' as never,
      type: 'dimension',
      visible: true,
      quality,
      dimensionKind: 'angular',
      associationStatus: 'resolved',
      targets: [],
      computedValue: 60,
      displayText: '60°',
      unit: 'deg',
      textPosition: [7, 12.124356],
      definitionPoints: [
        [0, 0],
        [20, 0],
        [10, 17.320508],
        [10, 0],
        [5, 8.660254],
      ],
    };

    const scene = compileDrawingScene(documentWith([], [angular]), {
      revision: 'revision_scene_angular' as RevisionId,
      scale: 1,
    });
    const primitives = scene.primitives.filter((item) => item.nodeId === angular.id);
    expect(primitives.map((item) => item.semanticRole)).toEqual([
      'dimension-angular-extension',
      'dimension-angular-extension',
      'dimension-angular-arc',
      'dimension-arrow',
      'dimension-arrow',
      'dimension-text',
    ]);
    expect(primitives[2]).toMatchObject({
      kind: 'path',
      commands: [{ op: 'M', point: [10, 0] }, {
        op: 'A', center: [0, 0], rotation: 0, startAngle: 0, counterClockwise: true,
      }],
    });
    const arc = primitives[2].kind === 'path' ? primitives[2].commands[1] : undefined;
    expect(arc?.op).toBe('A');
    if (arc?.op === 'A') {
      expect(arc.radiusX).toBeCloseTo(10, 6);
      expect(arc.radiusY).toBeCloseTo(10, 6);
      expect(arc.endAngle).toBeCloseTo(Math.PI / 3, 6);
    }
  });

  it('compiles a section hatch as one display-only path with disconnected segments', () => {
    const hatch = {
      id: 'hatch_1',
      type: 'section-hatch',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      pattern: 'ANSI31',
      angle: 45,
      spacing: 2,
      segments: [
        { start: [0, 0], end: [4, 4] },
        { start: [0, 2], end: [2, 4] },
      ],
    } as unknown as AnnotationNode;

    const scene = compileDrawingScene(documentWith([], [hatch]), {
      revision: 'revision_scene_hatch' as RevisionId,
    });
    const primitive = scene.primitives.find((item) => item.semanticRole === 'section-hatch');

    expect(primitive).toMatchObject({ kind: 'path', plane: 'annotation', role: 'annotation' });
    expect(primitive?.kind === 'path' ? primitive.commands : []).toEqual([
      { op: 'M', point: [0, 0] }, { op: 'L', point: [4, 4] },
      { op: 'M', point: [0, 2] }, { op: 'L', point: [2, 4] },
    ]);
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
