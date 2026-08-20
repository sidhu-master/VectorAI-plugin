// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
  Vec2,
} from '@vectorai/drawing-core';

export interface SpatialBounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type DrawingPlane = 'geometry' | 'annotation' | 'relation' | 'feature';
export type DrawingSpatialNode = GeometryNode | AnnotationNode | DrawingRelation | SemanticFeature;

export interface DrawingSpatialNodeResult {
  plane: DrawingPlane;
  node: DrawingSpatialNode;
}

export type DrawingSpatialQuery =
  | {
    kind: 'world-slice';
    bounds: SpatialBounds2D;
    planes?: DrawingPlane[];
    limit?: number;
  }
  | { kind: 'node'; id: string }
  | { kind: 'neighbors'; nodeId: string; limit?: number };

export type DrawingSpatialQueryResult =
  | {
    kind: 'world-slice';
    bounds: SpatialBounds2D;
    nodes: DrawingSpatialNodeResult[];
    totalByPlane: Record<DrawingPlane, number>;
    truncated: boolean;
  }
  | { kind: 'node'; node: DrawingSpatialNodeResult | null }
  | {
    kind: 'neighbors';
    nodeId: string;
    nodes: DrawingSpatialNodeResult[];
    truncated: boolean;
  };

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const PLANE_ORDER: DrawingPlane[] = ['geometry', 'annotation', 'relation', 'feature'];

export function queryDrawing(
  document: DrawingDocument,
  query: Extract<DrawingSpatialQuery, { kind: 'world-slice' }>,
): Extract<DrawingSpatialQueryResult, { kind: 'world-slice' }>;
export function queryDrawing(
  document: DrawingDocument,
  query: Extract<DrawingSpatialQuery, { kind: 'node' }>,
): Extract<DrawingSpatialQueryResult, { kind: 'node' }>;
export function queryDrawing(
  document: DrawingDocument,
  query: Extract<DrawingSpatialQuery, { kind: 'neighbors' }>,
): Extract<DrawingSpatialQueryResult, { kind: 'neighbors' }>;
export function queryDrawing(
  document: DrawingDocument,
  query: DrawingSpatialQuery,
): DrawingSpatialQueryResult;
export function queryDrawing(
  document: DrawingDocument,
  query: DrawingSpatialQuery,
): DrawingSpatialQueryResult {
  if (query.kind === 'node') {
    return { kind: 'node', node: cloneResult(findNode(document, query.id)) };
  }
  if (query.kind === 'neighbors') return queryNeighbors(document, query);
  return queryWorldSlice(document, query);
}

function queryWorldSlice(
  document: DrawingDocument,
  query: Extract<DrawingSpatialQuery, { kind: 'world-slice' }>,
): Extract<DrawingSpatialQueryResult, { kind: 'world-slice' }> {
  validateBounds(query.bounds);
  const limit = validateLimit(query.limit);
  const selectedPlanes = new Set(query.planes ?? PLANE_ORDER);
  const direct = new Map<DrawingPlane, DrawingSpatialNodeResult[]>();
  direct.set('geometry', selectedPlanes.has('geometry')
    ? document.geometry.filter((node) => intersectsNode(node, query.bounds)).map((node) => ({ plane: 'geometry', node }))
    : []);
  direct.set('annotation', selectedPlanes.has('annotation')
    ? document.annotations.filter((node) => intersectsNode(node, query.bounds)).map((node) => ({ plane: 'annotation', node }))
    : []);

  const directNodeIds = new Set<string>([
    ...(direct.get('geometry') ?? []).map(({ node }) => node.id),
    ...(direct.get('annotation') ?? []).map(({ node }) => node.id),
  ]);
  const relations = selectedPlanes.has('relation')
    ? document.relations.filter((node) => referencedIds(node).some((id) => (
      directNodeIds.has(id) || referencedNodeIntersects(document, id, query.bounds)
    ))).map((node) => ({ plane: 'relation' as const, node }))
    : [];
  direct.set('relation', relations);

  const matchedIds = new Set<string>([...directNodeIds, ...relations.map(({ node }) => node.id)]);
  direct.set('feature', selectedPlanes.has('feature')
    ? document.features.filter((node) => referencedIds(node).some((id) => (
      matchedIds.has(id) || referencedNodeIntersects(document, id, query.bounds)
    ))).map((node) => ({ plane: 'feature', node }))
    : []);

  const totalByPlane = Object.fromEntries(PLANE_ORDER.map((plane) => [
    plane,
    direct.get(plane)?.length ?? 0,
  ])) as Record<DrawingPlane, number>;
  const all = PLANE_ORDER.flatMap((plane) => direct.get(plane) ?? []);
  return {
    kind: 'world-slice',
    bounds: structuredClone(query.bounds),
    nodes: structuredClone(all.slice(0, limit)),
    totalByPlane,
    truncated: all.length > limit,
  };
}

function queryNeighbors(
  document: DrawingDocument,
  query: Extract<DrawingSpatialQuery, { kind: 'neighbors' }>,
): Extract<DrawingSpatialQueryResult, { kind: 'neighbors' }> {
  const limit = validateLimit(query.limit);
  if (findNode(document, query.nodeId) === null) {
    return { kind: 'neighbors', nodeId: query.nodeId, nodes: [], truncated: false };
  }
  const related = document.relations.filter((node) => referencedIds(node).includes(query.nodeId));
  const features = document.features.filter((node) => referencedIds(node).includes(query.nodeId)
    || related.some((relation) => node.relationIds.includes(relation.id)));
  const ids = new Set<string>();
  for (const node of [...related, ...features]) {
    for (const id of referencedIds(node)) ids.add(id);
  }
  ids.delete(query.nodeId);
  const nodes = orderedNodes(document).filter(({ node }) => (
    ids.has(node.id)
    || related.some((relation) => relation.id === node.id)
    || features.some((feature) => feature.id === node.id)
  ));
  return {
    kind: 'neighbors',
    nodeId: query.nodeId,
    nodes: structuredClone(nodes.slice(0, limit)),
    truncated: nodes.length > limit,
  };
}

function findNode(document: DrawingDocument, id: string): DrawingSpatialNodeResult | null {
  return orderedNodes(document).find(({ node }) => node.id === id) ?? null;
}

function orderedNodes(document: DrawingDocument): DrawingSpatialNodeResult[] {
  return [
    ...document.geometry.map((node) => ({ plane: 'geometry' as const, node })),
    ...document.annotations.map((node) => ({ plane: 'annotation' as const, node })),
    ...document.relations.map((node) => ({ plane: 'relation' as const, node })),
    ...document.features.map((node) => ({ plane: 'feature' as const, node })),
  ];
}

function cloneResult(result: DrawingSpatialNodeResult | null): DrawingSpatialNodeResult | null {
  return result === null ? null : structuredClone(result);
}

function validateBounds(bounds: SpatialBounds2D): void {
  const values = [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
  if (!values.every(Number.isFinite) || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
    throw new Error('INVALID_QUERY_BOUNDS');
  }
}

function validateLimit(limit: number | undefined): number {
  const value = limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1) throw new Error('INVALID_QUERY_LIMIT');
  if (value > MAX_LIMIT) throw new Error('QUERY_LIMIT_EXCEEDED');
  return value;
}

function referencedNodeIntersects(
  document: DrawingDocument,
  id: string,
  bounds: SpatialBounds2D,
): boolean {
  const result = findNode(document, id);
  return result !== null
    && (result.plane === 'geometry' || result.plane === 'annotation')
    && intersectsNode(result.node as GeometryNode | AnnotationNode, bounds);
}

function referencedIds(node: DrawingRelation | SemanticFeature): string[] {
  if (node.type === 'topology') return node.nodeIds;
  if (node.type === 'constraint') return node.geometryIds;
  if (node.type === 'association') return [node.annotationId, ...node.geometryIds];
  if (node.type === 'semantic') return [node.featureId, ...node.nodeIds];
  return [...node.geometryIds, ...node.annotationIds, ...node.relationIds];
}

function intersectsNode(node: GeometryNode | AnnotationNode, query: SpatialBounds2D): boolean {
  if (node.type === 'ray') return infiniteLineIntersects(node.origin, node.direction, query, true);
  if (node.type === 'xline') return infiniteLineIntersects(node.origin, node.direction, query, false);
  return intersects(boundsOfNode(node), query);
}

function boundsOfNode(node: Exclude<GeometryNode, { type: 'ray' | 'xline' }> | AnnotationNode): SpatialBounds2D {
  switch (node.type) {
    case 'point': return fromPoints([[node.x, node.y]]);
    case 'line': return fromPoints([node.start, node.end]);
    case 'circle': return radiusBounds(node.center, node.radius);
    case 'arc': return arcBounds(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
    case 'ellipse': {
      const [ax, ay] = node.majorAxis;
      const bx = -ay * node.ratio;
      const by = ax * node.ratio;
      return {
        minX: node.center[0] - Math.hypot(ax, bx),
        minY: node.center[1] - Math.hypot(ay, by),
        maxX: node.center[0] + Math.hypot(ax, bx),
        maxY: node.center[1] + Math.hypot(ay, by),
      };
    }
    case 'polyline': return fromPoints(node.vertices.map(({ point }) => point));
    case 'spline': return fromPoints(node.controlPoints);
    case 'text': {
      const width = node.maxWidth ?? Math.max(node.height, node.content.length * node.height * 0.6);
      return expandPoint(node.position, width, node.height);
    }
    case 'dimension': return fromPoints([...node.definitionPoints, node.textPosition]);
    case 'leader': return fromPoints(node.points);
    case 'centerline': return fromPoints([node.start, node.end]);
    case 'section-hatch': return fromPoints(node.segments.flatMap(({ start, end }) => [start, end]));
  }
}

function fromPoints(points: readonly Vec2[]): SpatialBounds2D {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function radiusBounds([x, y]: Vec2, radius: number): SpatialBounds2D {
  return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
}

function arcBounds(
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean,
): SpatialBounds2D {
  const angles = [startAngle, endAngle];
  for (const angle of [0, 90, 180, 270]) {
    if (angleOnArc(angle, startAngle, endAngle, counterClockwise)) angles.push(angle);
  }
  return fromPoints(angles.map((angle) => {
    const radians = angle * Math.PI / 180;
    return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)] as Vec2;
  }));
}

function angleOnArc(angle: number, start: number, end: number, counterClockwise: boolean): boolean {
  const normalize = (value: number) => ((value % 360) + 360) % 360;
  const a = normalize(angle);
  const s = normalize(start);
  const e = normalize(end);
  if (counterClockwise) return normalize(a - s) <= normalize(e - s);
  return normalize(s - a) <= normalize(s - e);
}

function expandPoint([x, y]: Vec2, width: number, height: number): SpatialBounds2D {
  return { minX: x - width, minY: y - height, maxX: x + width, maxY: y + height };
}

function intersects(a: SpatialBounds2D, b: SpatialBounds2D): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function infiniteLineIntersects(
  origin: Vec2,
  direction: Vec2,
  bounds: SpatialBounds2D,
  ray: boolean,
): boolean {
  const [dx, dy] = direction;
  if (dx === 0 && dy === 0) return intersects(fromPoints([origin]), bounds);
  let low = ray ? 0 : Number.NEGATIVE_INFINITY;
  let high = Number.POSITIVE_INFINITY;
  for (const [coordinate, delta, min, max] of [
    [origin[0], dx, bounds.minX, bounds.maxX],
    [origin[1], dy, bounds.minY, bounds.maxY],
  ] as const) {
    if (delta === 0) {
      if (coordinate < min || coordinate > max) return false;
      continue;
    }
    const first = (min - coordinate) / delta;
    const second = (max - coordinate) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
  }
  return low <= high;
}
