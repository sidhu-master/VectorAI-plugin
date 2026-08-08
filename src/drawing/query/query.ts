import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
} from '../document/types';
import { annotationBounds, boundsIntersect, geometryBounds, unionBounds } from './bounds';
import type {
  Bounds2D,
  DrawingInspectResult,
  DrawingNode,
  DrawingQueryItem,
  DrawingQueryResult,
  DrawingSelector,
} from './types';

interface LocatedNode {
  plane: NonNullable<DrawingSelector['plane']>;
  node: DrawingNode;
}

export function queryDrawing(
  document: DrawingDocument,
  selector: DrawingSelector = {},
): DrawingQueryResult {
  const ids = selector.ids ? new Set(selector.ids) : undefined;
  const types = selector.types ? new Set(selector.types) : undefined;
  const matches = collectNodes(document)
    .filter((item) => selector.plane === undefined || item.plane === selector.plane)
    .filter((item) => ids === undefined || ids.has(item.node.id))
    .filter((item) => types === undefined || types.has(item.node.type))
    .filter((item) => selector.qualityStatus === undefined
      || item.node.quality.status === selector.qualityStatus)
    .filter((item) => selector.relationKind === undefined
      || (item.plane === 'relation' && item.node.type !== 'feature'
        && 'kind' in item.node && item.node.kind === selector.relationKind))
    .filter((item) => {
      if (!selector.bounds) return true;
      const bounds = nodeBounds(document, item, selector.bounds);
      return bounds !== undefined && boundsIntersect(bounds, selector.bounds);
    });
  const limit = selector.limit === undefined
    ? matches.length
    : Math.max(0, Math.floor(selector.limit));
  return {
    items: matches.slice(0, limit).map((item) => toQueryItem(document, item, selector.bounds)),
    truncated: matches.length > limit,
  };
}

export function inspectNode(document: DrawingDocument, id: string): DrawingInspectResult | null {
  const located = collectNodes(document).find((item) => item.node.id === id);
  if (!located) return null;
  const relations = document.relations.filter((relation) => relationReferences(relation, id));
  const features = document.features.filter((feature) => featureReferences(feature, id));
  return structuredClone({
    node: located.node,
    relations,
    features,
    ...(nodeBounds(document, located) ? { bounds: nodeBounds(document, located) } : {}),
  });
}

function collectNodes(document: DrawingDocument): LocatedNode[] {
  return [
    ...document.geometry.map((node): LocatedNode => ({ plane: 'geometry', node })),
    ...document.annotations.map((node): LocatedNode => ({ plane: 'annotation', node })),
    ...document.relations.map((node): LocatedNode => ({ plane: 'relation', node })),
    ...document.features.map((node): LocatedNode => ({ plane: 'feature', node })),
  ];
}

function toQueryItem(
  document: DrawingDocument,
  item: LocatedNode,
  clip?: Bounds2D,
): DrawingQueryItem {
  const bounds = nodeBounds(document, item, clip);
  return {
    id: item.node.id,
    plane: item.plane,
    type: item.node.type,
    summary: summarize(item),
    ...(bounds ? { bounds } : {}),
  };
}

function nodeBounds(
  document: DrawingDocument,
  item: LocatedNode,
  clip?: Bounds2D,
): Bounds2D | undefined {
  if (item.plane === 'geometry') {
    return geometryBounds(item.node as GeometryNode, clip) ?? undefined;
  }
  if (item.plane === 'annotation') return annotationBounds(item.node as AnnotationNode);
  if (item.plane === 'feature') {
    const feature = item.node as SemanticFeature;
    return unionBounds(feature.geometryIds.flatMap((id) => {
      const geometry = document.geometry.find((node) => node.id === id);
      if (!geometry) return [];
      const bounds = geometryBounds(geometry, clip);
      return bounds ? [bounds] : [];
    }));
  }
  return undefined;
}

function relationReferences(relation: DrawingRelation, id: string): boolean {
  if (relation.id === id) return true;
  if (relation.plane === 'topology') return relation.nodeIds.includes(id);
  if (relation.plane === 'constraint') return relation.geometryIds.includes(id as never);
  if (relation.plane === 'association') {
    return relation.annotationId === id || relation.geometryIds.includes(id as never);
  }
  return relation.featureId === id || relation.nodeIds.includes(id);
}

function featureReferences(feature: SemanticFeature, id: string): boolean {
  return feature.id === id
    || feature.geometryIds.includes(id as never)
    || feature.annotationIds.includes(id as never)
    || feature.relationIds.includes(id as never);
}

function summarize(item: LocatedNode): string {
  const node = item.node;
  if (item.plane === 'geometry') return summarizeGeometry(node as GeometryNode);
  if (item.plane === 'annotation') {
    const annotation = node as AnnotationNode;
    return annotation.type === 'text'
      ? `text "${annotation.content}" at=[${annotation.position.join(',')}]`
      : `dimension ${annotation.dimensionKind} targets=${annotation.targets.length}`;
  }
  if (item.plane === 'feature') {
    const feature = node as SemanticFeature;
    return `feature ${feature.semanticType} geometry=${feature.geometryIds.length}`;
  }
  const relation = node as DrawingRelation;
  return `${relation.plane} relation ${relation.kind}`;
}

function summarizeGeometry(node: GeometryNode): string {
  switch (node.type) {
    case 'point': return `point [${node.x},${node.y}]`;
    case 'line': return `line [${node.start.join(',')}]->[${node.end.join(',')}]`;
    case 'ray': return `ray origin=[${node.origin.join(',')}] direction=[${node.direction.join(',')}]`;
    case 'xline': return `xline origin=[${node.origin.join(',')}] direction=[${node.direction.join(',')}]`;
    case 'circle': return `circle center=[${node.center.join(',')}] radius=${node.radius}`;
    case 'arc': return `arc center=[${node.center.join(',')}] radius=${node.radius} angles=${node.startAngle}->${node.endAngle}`;
    case 'ellipse': return `ellipse center=[${node.center.join(',')}] ratio=${node.ratio}`;
    case 'polyline': return `polyline vertices=${node.vertices.length} closed=${node.closed}`;
    case 'spline': return `spline degree=${node.degree} controlPoints=${node.controlPoints.length} (control-hull bounds)`;
  }
}
