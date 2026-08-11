import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
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
    const compiled = compileAnnotationNode(node);
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

function compileAnnotationNode(node: AnnotationNode): ScenePrimitive[] {
  void node;
  return [];
}

export function expandBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}
