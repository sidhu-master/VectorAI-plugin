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
  } else if (node.dimensionKind === 'radius' && points.length >= 2) {
    const center = points[0];
    const edge = points[1];
    const leaderEnd = points[2] ?? edge;
    addPath([center, leaderEnd], 'dimension-leader');
    addArrow(edge, center);
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
    height: 11 / safeScale,
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

export function expandBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}
