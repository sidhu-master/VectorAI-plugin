import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../document/types';
import { annotationBounds, geometryBounds, unionBounds } from '../query/bounds';
import type { Bounds2D } from '../query/types';
import { compileGeometryPath } from './path';
import {
  SCENE_RENDERER_VERSION,
  type CompileSceneOptions,
  type RenderScene,
  type ScenePrimitive,
} from './types';

export function compileDrawingScene(
  document: DrawingDocument,
  options: CompileSceneOptions,
): RenderScene {
  const primitives: ScenePrimitive[] = [];
  const nodeIndex: RenderScene['nodeIndex'] = {};
  const visibleGeometry = document.geometry.filter((node) => node.visible);
  const visibleAnnotations = document.annotations.filter((node) => node.visible);

  for (const node of visibleGeometry) {
    const compiled = compileDrawingNode(node, options);
    const bounds = geometryBounds(node, options.viewBounds);
    primitives.push(...compiled);
    if (bounds && compiled.length > 0) {
      nodeIndex[node.id] = {
        nodeId: node.id,
        nodeType: node.type,
        worldBounds: bounds,
        primitiveKeys: compiled.map((item) => item.key),
      };
    }
  }
  for (const node of visibleAnnotations) {
    const compiled = compileAnnotationNode(node, options.scale ?? 1);
    const bounds = annotationBounds(node);
    primitives.push(...compiled);
    if (compiled.length > 0) {
      nodeIndex[node.id] = {
        nodeId: node.id,
        nodeType: node.type,
        worldBounds: bounds,
        primitiveKeys: compiled.map((item) => item.key),
      };
    }
  }

  const bounds = unionBounds(Object.values(nodeIndex).map((item) => item.worldBounds));
  return {
    drawingId: document.id,
    revision: options.revision,
    rendererVersion: SCENE_RENDERER_VERSION,
    worldBounds: bounds ?? null,
    primitives,
    nodeIndex,
  };
}

export function compileDrawingNode(
  node: GeometryNode,
  options: Pick<CompileSceneOptions, 'viewBounds'> = {},
): ScenePrimitive[] {
  const plane = node.type === 'ray' || node.type === 'xline' ? 'construction' : 'geometry';
  const role = plane === 'construction' ? 'construction' : 'primary';
  if (node.type === 'point') {
    return [{
      kind: 'marker',
      key: `${node.id}:0`,
      nodeId: node.id,
      nodeType: node.type,
      plane,
      role,
      quality: structuredClone(node.quality),
      position: [node.x, node.y],
      marker: 'point',
    }];
  }
  const commands = compileGeometryPath(node, options.viewBounds);
  if (commands.length === 0) return [];
  return [{
    kind: 'path',
    key: `${node.id}:0`,
    nodeId: node.id,
    nodeType: node.type,
    plane,
    role,
    quality: structuredClone(node.quality),
    commands,
  }];
}

export function compileAnnotationNode(node: AnnotationNode, scale = 1): ScenePrimitive[] {
  const safeScale = Math.max(scale, 0.001);
  if (node.type === 'text') {
    return [{
      kind: 'text',
      key: `${node.id}:0`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'text',
      role: 'text',
      semanticRole: 'annotation-text',
      quality: structuredClone(node.quality),
      content: node.content,
      position: node.position,
      height: node.height,
      rotation: node.rotation,
      alignment: node.alignment,
      verticalAlignment: node.verticalAlignment,
    }];
  }

  if (node.type === 'leader') {
    const first = node.points[0];
    const second = node.points[1];
    const textPosition = node.points.at(-1) ?? first;
    return [{
      kind: 'path',
      key: `${node.id}:0`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'annotation',
      role: 'annotation',
      semanticRole: 'leader-line',
      quality: structuredClone(node.quality),
      commands: [
        { op: 'M', point: first },
        ...node.points.slice(1).map((point) => ({ op: 'L' as const, point })),
      ],
    }, {
      kind: 'path',
      key: `${node.id}:1`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'annotation',
      role: 'annotation',
      semanticRole: 'leader-arrow',
      quality: structuredClone(node.quality),
      commands: pathCommands(arrowPoints(first, second, 7 / safeScale), true),
    }, {
      kind: 'text',
      key: `${node.id}:2`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'text',
      role: 'annotation',
      semanticRole: 'leader-text',
      quality: structuredClone(node.quality),
      content: node.content,
      position: textPosition,
      height: node.textHeight,
      rotation: 0,
      alignment: 'left',
      verticalAlignment: 'bottom',
    }];
  }

  if (node.type === 'centerline') {
    const dx = node.end[0] - node.start[0];
    const dy = node.end[1] - node.start[1];
    const length = Math.hypot(dx, dy);
    const ux = length > 0 ? dx / length : 1;
    const uy = length > 0 ? dy / length : 0;
    const start: Vec2 = [
      node.start[0] - ux * node.extension,
      node.start[1] - uy * node.extension,
    ];
    const end: Vec2 = [
      node.end[0] + ux * node.extension,
      node.end[1] + uy * node.extension,
    ];
    return [{
      kind: 'path',
      key: `${node.id}:0`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'annotation',
      role: 'annotation',
      semanticRole: 'centerline',
      quality: structuredClone(node.quality),
      commands: [{ op: 'M', point: start }, { op: 'L', point: end }],
    }];
  }

  if (node.type === 'section-hatch') {
    const commands = node.segments.flatMap(({ start, end }) => [
      { op: 'M' as const, point: start },
      { op: 'L' as const, point: end },
    ]);
    if (commands.length === 0) return [];
    return [{
      kind: 'path',
      key: `${node.id}:0`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'annotation',
      role: 'annotation',
      semanticRole: 'section-hatch',
      quality: structuredClone(node.quality),
      commands,
    }];
  }

  const primitives: ScenePrimitive[] = [];
  const addPath = (
    points: readonly Vec2[],
    semanticRole: string,
    closed = false,
  ): void => {
    if (points.length === 0) return;
    primitives.push({
      kind: 'path',
      key: `${node.id}:${primitives.length}`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'annotation',
      role: 'dimension',
      semanticRole,
      quality: structuredClone(node.quality),
      commands: [
        { op: 'M', point: points[0] },
        ...points.slice(1).map((point) => ({ op: 'L' as const, point })),
        ...(closed ? [{ op: 'Z' as const }] : []),
      ],
    });
  };
  const addArrow = (tip: Vec2, toward: Vec2): void => {
    addPath(arrowPoints(tip, toward, 7 / safeScale), 'dimension-arrow', true);
  };
  const points = node.definitionPoints;
  if ((node.dimensionKind === 'linear' || node.dimensionKind === 'aligned') && points.length >= 4) {
    const [sourceStart, sourceEnd, measureStart, measureEnd] = points;
    addPath([sourceStart, measureStart], 'dimension-extension');
    addPath([sourceEnd, measureEnd], 'dimension-extension');
    addPath([measureStart, measureEnd], 'dimension-measure');
    addArrow(measureStart, measureEnd);
    addArrow(measureEnd, measureStart);
  } else if (node.dimensionKind === 'angular' && points.length >= 5) {
    const [vertex, firstExtension, secondExtension, arcStart, arcEnd] = points;
    const firstRadius = Math.hypot(arcStart[0] - vertex[0], arcStart[1] - vertex[1]);
    const secondRadius = Math.hypot(arcEnd[0] - vertex[0], arcEnd[1] - vertex[1]);
    const radius = (firstRadius + secondRadius) / 2;
    const startAngle = Math.atan2(arcStart[1] - vertex[1], arcStart[0] - vertex[0]);
    const endAngle = Math.atan2(arcEnd[1] - vertex[1], arcEnd[0] - vertex[0]);
    const sweep = angularSweep(
      startAngle,
      endAngle,
      node.observedValue ?? node.computedValue,
    );
    addPath([vertex, firstExtension], 'dimension-angular-extension');
    addPath([vertex, secondExtension], 'dimension-angular-extension');
    primitives.push({
      kind: 'path',
      key: `${node.id}:${primitives.length}`,
      nodeId: node.id,
      nodeType: node.type,
      plane: 'annotation',
      role: 'dimension',
      semanticRole: 'dimension-angular-arc',
      quality: structuredClone(node.quality),
      commands: [{ op: 'M', point: arcStart }, {
        op: 'A',
        center: vertex,
        radiusX: radius,
        radiusY: radius,
        rotation: 0,
        startAngle,
        endAngle,
        counterClockwise: sweep.counterClockwise,
      }],
    });
    const tangentStep = Math.min(Math.abs(sweep.signedRadians) * 0.08, 0.15);
    const direction = sweep.counterClockwise ? 1 : -1;
    addArrow(arcStart, pointOnCircle(vertex, radius, startAngle + direction * tangentStep));
    addArrow(arcEnd, pointOnCircle(vertex, radius, endAngle - direction * tangentStep));
  } else if (node.dimensionKind === 'radius' && points.length >= 2) {
    const center = points[0];
    const edge = points[1];
    const leaderEnd = points[2] ?? edge;
    addPath([center, leaderEnd], 'dimension-leader');
    addArrow(edge, center);
    addCenterMark(center, 5 / safeScale, addPath);
  } else if (node.dimensionKind === 'diameter' && points.length >= 2) {
    const first = points[0];
    const second = points[1];
    const center = midpoint(first, second);
    addPath([first, second], 'dimension-measure');
    addArrow(first, second);
    addArrow(second, first);
    if (Math.hypot(
      node.textPosition[0] - center[0],
      node.textPosition[1] - center[1],
    ) > 1e-8) {
      addPath([center, node.textPosition], 'dimension-label-leader');
    }
    addCenterMark(center, 5 / safeScale, addPath);
  } else if (points.length >= 2) {
    const first = points[0];
    const second = points[1];
    addPath([first, second], 'dimension-measure');
    addArrow(first, second);
    addArrow(second, first);
    addCenterMark(midpoint(first, second), 5 / safeScale, addPath);
  } else {
    addPath(points, 'dimension-measure');
  }
  primitives.push({
    kind: 'text',
    key: `${node.id}:${primitives.length}`,
    nodeId: node.id,
    nodeType: node.type,
    plane: 'text',
    role: 'dimension',
    semanticRole: 'dimension-text',
    quality: structuredClone(node.quality),
    content: dimensionLabel(node),
    position: node.textPosition,
    height: (node.dimensionKind === 'diameter' ? 8 : 11) / safeScale,
    rotation: 0,
    alignment: 'center',
    verticalAlignment: 'middle',
  });
  return primitives;
}

function dimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  if (node.displayText) return node.displayText;
  const value = node.observedValue ?? node.computedValue;
  return `${node.prefix ?? ''}${value === undefined ? '—' : value}${node.unit ? ` ${node.unit}` : ''}${node.suffix ?? ''}`;
}

function arrowPoints(tip: Vec2, toward: Vec2, size: number): Vec2[] {
  const dx = toward[0] - tip[0];
  const dy = toward[1] - tip[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return [tip];
  const ux = dx / length;
  const uy = dy / length;
  const normal: Vec2 = [-uy, ux];
  const base: Vec2 = [tip[0] + ux * size, tip[1] + uy * size];
  const halfWidth = size * 0.36;
  return [
    tip,
    [base[0] + normal[0] * halfWidth, base[1] + normal[1] * halfWidth],
    [base[0] - normal[0] * halfWidth, base[1] - normal[1] * halfWidth],
  ];
}

function pathCommands(points: readonly Vec2[], closed: boolean): Extract<ScenePrimitive, { kind: 'path' }>['commands'] {
  if (points.length === 0) return [];
  return [
    { op: 'M', point: points[0] },
    ...points.slice(1).map((point) => ({ op: 'L' as const, point })),
    ...(closed ? [{ op: 'Z' as const }] : []),
  ];
}

function addCenterMark(
  center: Vec2,
  size: number,
  addPath: (points: readonly Vec2[], semanticRole: string, closed?: boolean) => void,
): void {
  addPath([
    [center[0] - size, center[1]],
    [center[0] + size, center[1]],
  ], 'dimension-center');
  addPath([
    [center[0], center[1] - size],
    [center[0], center[1] + size],
  ], 'dimension-center');
}

function midpoint(first: Vec2, second: Vec2): Vec2 {
  return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
}

function angularSweep(
  start: number,
  end: number,
  targetDegrees: number | undefined,
): { counterClockwise: boolean; signedRadians: number } {
  const full = Math.PI * 2;
  const counterClockwise = positiveModulo(end - start, full);
  const clockwise = counterClockwise - full;
  const target = targetDegrees === undefined
    ? Math.min(counterClockwise, Math.abs(clockwise))
    : Math.abs(targetDegrees) * Math.PI / 180;
  const useCounterClockwise = Math.abs(counterClockwise - target)
    <= Math.abs(Math.abs(clockwise) - target);
  return {
    counterClockwise: useCounterClockwise,
    signedRadians: useCounterClockwise ? counterClockwise : clockwise,
  };
}

function pointOnCircle(center: Vec2, radius: number, angle: number): Vec2 {
  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + Math.sin(angle) * radius,
  ];
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export function expandBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}
