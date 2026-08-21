import type { AtomicSegmentRef } from './topology-types';
import type {
  DrawingDocument,
  RevisionId,
  Vec2,
} from '@vectorai/drawing-core';
import type { SpatialBounds2D } from './query';
import { portableDigest } from './digest';
import {
  roughGeometryBounds,
  sampleGeometryRanges,
} from './geometry-sampling.js';

const graphCache = new WeakMap<DrawingDocument, Map<string, GeometryTopologyGraph>>();

export interface AtomicGraphSegment extends AtomicSegmentRef {
  samples: Vec2[];
  startVertexId: string;
  endVertexId: string;
}

export interface TopologyVertex {
  id: string;
  point: Vec2;
  incidentSegmentIds: string[];
}

/**
 * Revision-scoped geometry topology. Search regions are deliberately absent:
 * observation may be local, but connectivity must remain globally consistent.
 */
export class GeometryTopologyGraph {
  readonly segments: readonly AtomicGraphSegment[];
  readonly vertices: readonly TopologyVertex[];
  readonly #byNode = new Map<string, readonly AtomicGraphSegment[]>();
  readonly #segmentById = new Map<string, AtomicGraphSegment>();
  readonly #vertexById = new Map<string, TopologyVertex>();

  constructor(
    readonly revision: RevisionId,
    segments: AtomicGraphSegment[],
    vertices: TopologyVertex[],
    readonly tolerance: number,
  ) {
    this.segments = segments;
    this.vertices = vertices;
    for (const segment of segments) {
      const existing = this.#byNode.get(segment.nodeId) ?? [];
      this.#byNode.set(segment.nodeId, [...existing, segment]);
      this.#segmentById.set(segment.id, segment);
    }
    vertices.forEach((vertex) => this.#vertexById.set(vertex.id, vertex));
  }

  segmentsFor(nodeId: string): readonly AtomicGraphSegment[] {
    return this.#byNode.get(nodeId) ?? [];
  }

  segment(id: string): AtomicGraphSegment | undefined {
    return this.#segmentById.get(id);
  }

  vertex(id: string): TopologyVertex | undefined {
    return this.#vertexById.get(id);
  }
}

export function buildGeometryTopologyGraph(input: {
  document: DrawingDocument;
  revision: RevisionId;
  curveSamples?: number;
  tolerance?: number;
}): GeometryTopologyGraph {
  const curveSamples = normalizedCurveSamples(input.curveSamples);
  const samplingBounds = documentSamplingBounds(input.document);
  const tolerance = normalizedTolerance(input.tolerance, samplingBounds);
  const cacheKey = JSON.stringify({
    revision: input.revision,
    curveSamples,
    tolerance,
  });
  const cached = graphCache.get(input.document)?.get(cacheKey);
  if (cached) return cached;

  const unresolvedSegments = input.document.geometry.flatMap((node) => (
    sampleGeometryRanges(node, { curveSamples, localBounds: samplingBounds }).map((sample) => ({
      id: atomicId(input.revision, node.id, sample),
      revision: input.revision,
      nodeId: node.id,
      kind: sample.kind,
      ...(sample.vertexRange ? { vertexRange: sample.vertexRange } : {}),
      ...(sample.parameterRange ? { parameterRange: sample.parameterRange } : {}),
      start: sample.start,
      end: sample.end,
      bounds: sample.bounds,
      adjacentSegmentIds: [],
      samples: sample.samples,
    }))
  ));
  const { segments, vertices } = resolveEndpointTopology(
    unresolvedSegments,
    input.revision,
    tolerance,
  );
  connectExplicitRelations(segments, input.document);
  normalizeAdjacency(segments);

  const graph = new GeometryTopologyGraph(input.revision, segments, vertices, tolerance);
  const documentCache = graphCache.get(input.document) ?? new Map<string, GeometryTopologyGraph>();
  documentCache.set(cacheKey, graph);
  while (documentCache.size > 16) documentCache.delete(documentCache.keys().next().value!);
  graphCache.set(input.document, documentCache);
  return graph;
}

type UnresolvedSegment = Omit<AtomicGraphSegment, 'startVertexId' | 'endVertexId'>;

interface Endpoint {
  segmentIndex: number;
  side: 'start' | 'end';
  point: Vec2;
  identity: string;
}

function resolveEndpointTopology(
  unresolved: UnresolvedSegment[],
  revision: RevisionId,
  tolerance: number,
): { segments: AtomicGraphSegment[]; vertices: TopologyVertex[] } {
  const endpoints: Endpoint[] = unresolved.flatMap((segment, segmentIndex) => ([
    { segmentIndex, side: 'start' as const, point: segment.start, identity: `${segment.id}:start` },
    { segmentIndex, side: 'end' as const, point: segment.end, identity: `${segment.id}:end` },
  ]));
  const parent = endpoints.map((_, index) => index);
  const buckets = new Map<string, number[]>();

  endpoints.forEach((endpoint, index) => {
    const [cellX, cellY] = endpointCell(endpoint.point, tolerance);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (const candidateIndex of buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
          if (distance(endpoint.point, endpoints[candidateIndex].point) <= tolerance) {
            union(parent, index, candidateIndex);
          }
        }
      }
    }
    const key = `${cellX}:${cellY}`;
    buckets.set(key, [...(buckets.get(key) ?? []), index]);
  });

  const components = new Map<number, number[]>();
  endpoints.forEach((_, index) => {
    const root = find(parent, index);
    components.set(root, [...(components.get(root) ?? []), index]);
  });
  const endpointVertexIds = new Map<number, string>();
  const vertices = [...components.values()].map((component): TopologyVertex => {
    const identities = component.map((index) => endpoints[index].identity).sort();
    const id = `vertex_${digest(JSON.stringify({ revision, identities })).slice(0, 24)}`;
    const point: Vec2 = [
      component.reduce((sum, index) => sum + endpoints[index].point[0], 0) / component.length,
      component.reduce((sum, index) => sum + endpoints[index].point[1], 0) / component.length,
    ];
    const incidentSegmentIds = unique(component.map((index) => (
      unresolved[endpoints[index].segmentIndex].id
    ))).sort();
    component.forEach((index) => endpointVertexIds.set(index, id));
    return { id, point, incidentSegmentIds };
  }).sort((left, right) => left.id.localeCompare(right.id));

  const segments = unresolved.map((segment, index): AtomicGraphSegment => {
    const startVertexId = endpointVertexIds.get(index * 2)!;
    const endVertexId = endpointVertexIds.get(index * 2 + 1)!;
    const adjacentSegmentIds = unique([
      ...vertices.find((vertex) => vertex.id === startVertexId)?.incidentSegmentIds ?? [],
      ...vertices.find((vertex) => vertex.id === endVertexId)?.incidentSegmentIds ?? [],
    ]).filter((id) => id !== segment.id);
    return { ...segment, startVertexId, endVertexId, adjacentSegmentIds };
  });
  return { segments, vertices };
}

function connectExplicitRelations(
  segments: AtomicGraphSegment[],
  document: DrawingDocument,
): void {
  const byNode = new Map<string, AtomicGraphSegment[]>();
  segments.forEach((segment) => {
    byNode.set(segment.nodeId, [...(byNode.get(segment.nodeId) ?? []), segment]);
  });
  for (const relation of document.relations) {
    if (relation.plane !== 'topology' || relation.kind !== 'connected') continue;
    relation.nodeIds.forEach((leftId, leftIndex) => {
      relation.nodeIds.slice(leftIndex + 1).forEach((rightId) => {
        const pair = closestEndpointPair(byNode.get(leftId) ?? [], byNode.get(rightId) ?? []);
        if (!pair) return;
        pair[0].adjacentSegmentIds.push(pair[1].id);
        pair[1].adjacentSegmentIds.push(pair[0].id);
      });
    });
  }
}

function closestEndpointPair(
  left: AtomicGraphSegment[],
  right: AtomicGraphSegment[],
): readonly [AtomicGraphSegment, AtomicGraphSegment] | null {
  let best: { pair: readonly [AtomicGraphSegment, AtomicGraphSegment]; distance: number } | null = null;
  for (const leftSegment of left) {
    for (const rightSegment of right) {
      const separation = Math.min(
        distance(leftSegment.start, rightSegment.start),
        distance(leftSegment.start, rightSegment.end),
        distance(leftSegment.end, rightSegment.start),
        distance(leftSegment.end, rightSegment.end),
      );
      if (!best || separation < best.distance) {
        best = { pair: [leftSegment, rightSegment], distance: separation };
      }
    }
  }
  return best?.pair ?? null;
}

function normalizeAdjacency(segments: AtomicGraphSegment[]): void {
  segments.forEach((segment) => {
    segment.adjacentSegmentIds = unique(segment.adjacentSegmentIds)
      .filter((id) => id !== segment.id)
      .sort();
  });
}

function documentSamplingBounds(document: DrawingDocument): SpatialBounds2D {
  const finite = document.geometry.flatMap((node): SpatialBounds2D[] => {
    const bounds = roughGeometryBounds(node);
    if (bounds) return [bounds];
    if (node.type === 'ray' || node.type === 'xline') {
      return [{
        minX: node.origin[0], minY: node.origin[1],
        maxX: node.origin[0], maxY: node.origin[1],
      }];
    }
    return [];
  });
  if (finite.length === 0) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const bounds = {
    minX: Math.min(...finite.map((item) => item.minX)),
    minY: Math.min(...finite.map((item) => item.minY)),
    maxX: Math.max(...finite.map((item) => item.maxX)),
    maxY: Math.max(...finite.map((item) => item.maxY)),
  };
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  return {
    minX: bounds.minX - span,
    minY: bounds.minY - span,
    maxX: bounds.maxX + span,
    maxY: bounds.maxY + span,
  };
}

function normalizedTolerance(value: number | undefined, bounds: SpatialBounds2D): number {
  if (value !== undefined) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('TOPOLOGY_TOLERANCE_INVALID');
    return value;
  }
  const scale = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    Math.abs(bounds.minX), Math.abs(bounds.minY),
    Math.abs(bounds.maxX), Math.abs(bounds.maxY),
    Number.MIN_VALUE,
  );
  // Fitted/vectorized drawings contain sub-pixel endpoint gaps. Treat a small,
  // drawing-relative distance as the same topological port so connectivity is
  // stable across source resolutions and unit systems.
  return Math.max(scale * 4e-4, scale * Number.EPSILON * 64);
}

function normalizedCurveSamples(value: number | undefined): number {
  const samples = value ?? 64;
  if (!Number.isFinite(samples) || samples < 2) throw new Error('TOPOLOGY_CURVE_SAMPLES_INVALID');
  return Math.max(8, Math.min(512, Math.floor(samples)));
}

function atomicId(
  revision: RevisionId,
  nodeId: string,
  range: Pick<AtomicGraphSegment, 'kind' | 'vertexRange' | 'parameterRange'>,
): string {
  return `atomic_${digest(JSON.stringify({
    revision,
    nodeId,
    kind: range.kind,
    vertexRange: range.vertexRange,
    parameterRange: range.parameterRange,
  })).slice(0, 24)}`;
}

function endpointCell(point: Vec2, tolerance: number): readonly [number, number] {
  return [Math.floor(point[0] / tolerance), Math.floor(point[1] / tolerance)];
}

function find(parent: number[], index: number): number {
  if (parent[index] !== index) parent[index] = find(parent, parent[index]);
  return parent[index];
}

function union(parent: number[], left: number, right: number): void {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);
  if (leftRoot === rightRoot) return;
  if (leftRoot < rightRoot) parent[rightRoot] = leftRoot;
  else parent[leftRoot] = rightRoot;
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(right[0] - left[0], right[1] - left[1]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function digest(value: string): string {
  return portableDigest(value);
}
