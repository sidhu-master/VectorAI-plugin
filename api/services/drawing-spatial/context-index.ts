import type {
  Bounds2D,
  DrawingDocument,
  DrawingNode,
  DrawingRelation,
  SemanticFeature,
} from '../../../src/drawing/index.js';
import {
  annotationBounds,
  boundsIntersect,
  geometryBounds,
  unionBounds,
} from '../../../src/drawing/query/bounds.js';

type DrawingPlane = 'geometry' | 'annotation' | 'relation' | 'feature';
type Relevance = 'target' | 'relation' | 'neighbor';

interface LocatedNode {
  id: string;
  plane: DrawingPlane;
  type: string;
  node: DrawingNode;
  bounds?: Bounds2D;
}

export interface DrawingSpatialGlobalMap {
  unit: DrawingDocument['unitSystem']['length'];
  bounds?: Bounds2D;
  counts: Record<DrawingPlane, number>;
  geometryTypes: Record<string, number>;
  regions: Array<{
    id: string;
    depth: number;
    bounds: Bounds2D;
    nodeCount: number;
    geometryTypes: Record<string, number>;
  }>;
  topology: {
    relationCount: number;
    connectedComponentCount: number;
    largestComponentSize: number;
  };
}

export interface DrawingSpatialWorkingSet {
  bounds?: Bounds2D;
  nodes: Array<{
    id: string;
    plane: DrawingPlane;
    type: string;
    relevance: Relevance;
    bounds?: Bounds2D;
    node: DrawingNode;
  }>;
  truncated: boolean;
  requestedTargetIds: string[];
  missingTargetIds: string[];
}

export interface DrawingSpatialContextIndexOptions {
  maxLeafNodes?: number;
  maxDepth?: number;
  overlapRatio?: number;
  neighborPaddingRatio?: number;
}

const DEFAULTS = {
  maxLeafNodes: 24,
  maxDepth: 5,
  overlapRatio: 0.04,
  neighborPaddingRatio: 0.015,
};

/**
 * Revision-local read index. Regions overlap on purpose: they are retrieval scopes, not
 * ownership partitions, so a primitive crossing a boundary remains a single exact node.
 */
export class DrawingSpatialContextIndex {
  readonly #document: DrawingDocument;
  readonly #nodes: LocatedNode[];
  readonly #byId: Map<string, LocatedNode>;
  readonly #spatial: LocatedNode[];
  readonly #bounds?: Bounds2D;
  readonly #options: Required<DrawingSpatialContextIndexOptions>;
  readonly #regions: DrawingSpatialGlobalMap['regions'];

  constructor(document: DrawingDocument, options: DrawingSpatialContextIndexOptions = {}) {
    this.#document = structuredClone(document);
    this.#options = normalizeOptions(options);
    this.#nodes = collectNodes(this.#document);
    this.#byId = new Map(this.#nodes.map((item) => [item.id, item]));
    this.#spatial = this.#nodes.filter((item) => item.bounds !== undefined);
    this.#bounds = unionBounds(this.#spatial.flatMap((item) => item.bounds ? [item.bounds] : []));
    this.#regions = this.#bounds
      ? buildRegions(this.#spatial, this.#bounds, this.#options)
      : [];
  }

  query(bounds: Bounds2D): Array<Pick<LocatedNode, 'id' | 'plane' | 'type' | 'bounds'>> {
    return this.#spatial
      .filter((item) => item.bounds && boundsIntersect(item.bounds, bounds))
      .map(({ id, plane, type, bounds: itemBounds }) => ({
        id, plane, type, ...(itemBounds ? { bounds: { ...itemBounds } } : {}),
      }));
  }

  globalMap(): DrawingSpatialGlobalMap {
    const geometryTypes = typeCounts(this.#document.geometry.map((node) => node.type));
    const topology = topologySummary(this.#document.relations);
    return structuredClone({
      unit: this.#document.unitSystem.length,
      ...(this.#bounds ? { bounds: this.#bounds } : {}),
      counts: {
        geometry: this.#document.geometry.length,
        annotation: this.#document.annotations.length,
        relation: this.#document.relations.length,
        feature: this.#document.features.length,
      },
      geometryTypes,
      regions: this.#regions,
      topology,
    });
  }

  workingSet(targetNodeIds: string[], options: { limit?: number } = {}): DrawingSpatialWorkingSet {
    const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 48)));
    const requestedTargetIds = unique(targetNodeIds);
    const relevance = new Map<string, Relevance>();
    for (const id of requestedTargetIds) {
      if (this.#byId.has(id)) relevance.set(id, 'target');
    }
    const relationSeeds = [...relevance.keys()];
    for (const id of relationSeeds) {
      for (const relatedId of directlyRelatedIds(this.#document, id)) {
        if (this.#byId.has(relatedId) && !relevance.has(relatedId)) {
          relevance.set(relatedId, 'relation');
        }
      }
    }
    const focusBounds = unionBounds([...relevance.keys()].flatMap((id) => {
      const bounds = this.#byId.get(id)?.bounds;
      return bounds ? [bounds] : [];
    }));
    if (focusBounds && this.#bounds) {
      const padding = documentDiagonal(this.#bounds) * this.#options.neighborPaddingRatio;
      const neighborhood = expandBounds(focusBounds, padding);
      for (const item of this.#spatial) {
        if (!item.bounds || relevance.has(item.id)) continue;
        if (boundsIntersect(item.bounds, neighborhood)) relevance.set(item.id, 'neighbor');
      }
    }
    const priority: Record<Relevance, number> = { target: 0, relation: 1, neighbor: 2 };
    const ranked = [...relevance.entries()]
      .map(([id, itemRelevance]) => ({ item: this.#byId.get(id)!, relevance: itemRelevance }))
      .sort((left, right) => priority[left.relevance] - priority[right.relevance]
        || left.item.id.localeCompare(right.item.id));
    const selected = ranked.slice(0, limit);
    return {
      ...(unionBounds(selected.flatMap(({ item }) => item.bounds ? [item.bounds] : []))
        ? { bounds: unionBounds(selected.flatMap(({ item }) => item.bounds ? [item.bounds] : []))! }
        : {}),
      nodes: selected.map(({ item, relevance: itemRelevance }) => ({
        id: item.id,
        plane: item.plane,
        type: item.type,
        relevance: itemRelevance,
        ...(item.bounds ? { bounds: { ...item.bounds } } : {}),
        node: structuredClone(item.node),
      })),
      truncated: ranked.length > limit,
      requestedTargetIds,
      missingTargetIds: requestedTargetIds.filter((id) => !this.#byId.has(id)),
    };
  }
}

function collectNodes(document: DrawingDocument): LocatedNode[] {
  const geometryBoundsById = new Map(document.geometry.flatMap((node) => {
    const bounds = geometryBounds(node);
    return bounds ? [[node.id, bounds] as const] : [];
  }));
  const featureBounds = (feature: SemanticFeature) => unionBounds(feature.geometryIds.flatMap((id) => {
    const bounds = geometryBoundsById.get(id);
    return bounds ? [bounds] : [];
  }));
  return [
    ...document.geometry.map((node): LocatedNode => ({
      id: node.id, plane: 'geometry', type: node.type, node,
      ...(geometryBoundsById.get(node.id) ? { bounds: geometryBoundsById.get(node.id)! } : {}),
    })),
    ...document.annotations.map((node): LocatedNode => ({
      id: node.id, plane: 'annotation', type: node.type, node, bounds: annotationBounds(node),
    })),
    ...document.relations.map((node): LocatedNode => ({
      id: node.id, plane: 'relation', type: `${node.type}:${node.kind}`, node,
    })),
    ...document.features.map((node): LocatedNode => ({
      id: node.id, plane: 'feature', type: node.semanticType, node,
      ...(featureBounds(node) ? { bounds: featureBounds(node)! } : {}),
    })),
  ];
}

function buildRegions(
  entries: LocatedNode[],
  rootBounds: Bounds2D,
  options: Required<DrawingSpatialContextIndexOptions>,
): DrawingSpatialGlobalMap['regions'] {
  const leaves: DrawingSpatialGlobalMap['regions'] = [];
  const visit = (items: LocatedNode[], bounds: Bounds2D, depth: number, path: string): void => {
    if (items.length <= options.maxLeafNodes || depth >= options.maxDepth) {
      leaves.push(regionSummary(items, bounds, depth, path));
      return;
    }
    const children = quadrantBounds(bounds, options.overlapRatio).map((child) => ({
      bounds: child,
      items: items.filter((item) => item.bounds && boundsIntersect(item.bounds, child)),
    })).filter((child) => child.items.length > 0);
    const useful = children.length > 1 && children.some((child) => child.items.length < items.length);
    if (!useful) {
      leaves.push(regionSummary(items, bounds, depth, path));
      return;
    }
    children.forEach((child, index) => visit(child.items, child.bounds, depth + 1, `${path}.${index}`));
  };
  visit(entries, rootBounds, 0, 'r');
  return leaves.slice(0, 256);
}

function regionSummary(
  entries: LocatedNode[],
  bounds: Bounds2D,
  depth: number,
  id: string,
): DrawingSpatialGlobalMap['regions'][number] {
  return {
    id,
    depth,
    bounds: { ...bounds },
    nodeCount: entries.length,
    geometryTypes: typeCounts(entries.filter((item) => item.plane === 'geometry').map((item) => item.type)),
  };
}

function quadrantBounds(bounds: Bounds2D, overlapRatio: number): Bounds2D[] {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const overlapX = Math.max(1e-9, (bounds.maxX - bounds.minX) * overlapRatio / 2);
  const overlapY = Math.max(1e-9, (bounds.maxY - bounds.minY) * overlapRatio / 2);
  return [
    { minX: bounds.minX, minY: bounds.minY, maxX: midX + overlapX, maxY: midY + overlapY },
    { minX: midX - overlapX, minY: bounds.minY, maxX: bounds.maxX, maxY: midY + overlapY },
    { minX: bounds.minX, minY: midY - overlapY, maxX: midX + overlapX, maxY: bounds.maxY },
    { minX: midX - overlapX, minY: midY - overlapY, maxX: bounds.maxX, maxY: bounds.maxY },
  ];
}

function directlyRelatedIds(document: DrawingDocument, nodeId: string): string[] {
  const ids: string[] = [];
  for (const relation of document.relations) {
    const refs = relationIds(relation);
    if (relation.id === nodeId || refs.includes(nodeId)) ids.push(relation.id, ...refs);
  }
  for (const feature of document.features) {
    const refs: string[] = [
      feature.id, ...feature.geometryIds, ...feature.annotationIds, ...feature.relationIds,
    ];
    if (refs.includes(nodeId)) ids.push(...refs);
  }
  return unique(ids).filter((id) => id !== nodeId);
}

function relationIds(relation: DrawingRelation): string[] {
  if (relation.plane === 'topology') return relation.nodeIds;
  if (relation.plane === 'constraint') return relation.geometryIds;
  if (relation.plane === 'association') return [relation.annotationId, ...relation.geometryIds];
  return [relation.featureId, ...relation.nodeIds];
}

function topologySummary(relations: DrawingRelation[]): DrawingSpatialGlobalMap['topology'] {
  const topology = relations.filter((relation) => relation.plane === 'topology');
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const current = parent.get(id) ?? id;
    if (current === id) {
      parent.set(id, id);
      return id;
    }
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  for (const relation of topology) {
    relation.nodeIds.forEach((id) => find(id));
    for (let index = 1; index < relation.nodeIds.length; index += 1) {
      union(relation.nodeIds[0], relation.nodeIds[index]);
    }
  }
  const sizes = new Map<string, number>();
  for (const id of parent.keys()) {
    const root = find(id);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  return {
    relationCount: topology.length,
    connectedComponentCount: sizes.size,
    largestComponentSize: Math.max(0, ...sizes.values()),
  };
}

function typeCounts(types: string[]): Record<string, number> {
  return Object.fromEntries([...types.reduce((counts, type) => (
    counts.set(type, (counts.get(type) ?? 0) + 1)
  ), new Map<string, number>())].sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeOptions(
  options: DrawingSpatialContextIndexOptions,
): Required<DrawingSpatialContextIndexOptions> {
  return {
    maxLeafNodes: integerOption(options.maxLeafNodes, DEFAULTS.maxLeafNodes, 1, 200),
    maxDepth: integerOption(options.maxDepth, DEFAULTS.maxDepth, 0, 10),
    overlapRatio: ratioOption(options.overlapRatio, DEFAULTS.overlapRatio, 0, 0.45),
    neighborPaddingRatio: ratioOption(
      options.neighborPaddingRatio, DEFAULTS.neighborPaddingRatio, 0, 0.5,
    ),
  };
}

function integerOption(value: number | undefined, fallback: number, min: number, max: number): number {
  return value === undefined ? fallback : Math.min(max, Math.max(min, Math.floor(value)));
}

function ratioOption(value: number | undefined, fallback: number, min: number, max: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : Math.min(max, Math.max(min, value));
}

function documentDiagonal(bounds: Bounds2D): number {
  return Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

function expandBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
