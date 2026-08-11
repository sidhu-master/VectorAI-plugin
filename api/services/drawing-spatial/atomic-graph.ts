import { createHash } from 'node:crypto';

import type { AtomicSegmentRef } from '../../../src/contracts/drawing-spatial-region.js';
import type {
  Bounds2D,
  DrawingDocument,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import {
  roughGeometryBounds,
  sampleGeometryRanges,
} from './geometry-sampling.js';
import { boundsIntersect } from './polygon.js';

const graphCache = new WeakMap<DrawingDocument, Map<string, AtomicGeometryGraph>>();

export interface AtomicGraphSegment extends AtomicSegmentRef {
  samples: Vec2[];
}

export class AtomicGeometryGraph {
  readonly segments: readonly AtomicGraphSegment[];
  readonly #byNode = new Map<string, readonly AtomicGraphSegment[]>();

  constructor(
    readonly revision: RevisionId,
    segments: AtomicGraphSegment[],
  ) {
    this.segments = segments;
    for (const segment of segments) {
      const existing = this.#byNode.get(segment.nodeId) ?? [];
      this.#byNode.set(segment.nodeId, [...existing, segment]);
    }
  }

  segmentsFor(nodeId: string): readonly AtomicGraphSegment[] {
    return this.#byNode.get(nodeId) ?? [];
  }
}

export function buildAtomicGeometryGraph(input: {
  document: DrawingDocument;
  revision: RevisionId;
  regionBounds: Bounds2D;
  padding?: number;
  curveSamples?: number;
}): AtomicGeometryGraph {
  const cacheKey = JSON.stringify({
    revision: input.revision,
    regionBounds: input.regionBounds,
    padding: input.padding ?? 0,
    curveSamples: input.curveSamples ?? 64,
  });
  const cached = graphCache.get(input.document)?.get(cacheKey);
  if (cached) return cached;
  const localBounds = expandBounds(input.regionBounds, input.padding ?? 0);
  const curveSamples = input.curveSamples ?? 64;
  const segments = input.document.geometry.flatMap((node): AtomicGraphSegment[] => {
    const roughBounds = roughGeometryBounds(node);
    if (roughBounds && !boundsIntersect(roughBounds, localBounds)) return [];
    return sampleGeometryRanges(node, { curveSamples, localBounds }).map((sample) => ({
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
    }));
  });
  connectAdjacentSegments(segments, geometryEpsilon(input.regionBounds), input.document);
  const graph = new AtomicGeometryGraph(input.revision, segments);
  const documentCache = graphCache.get(input.document) ?? new Map<string, AtomicGeometryGraph>();
  documentCache.set(cacheKey, graph);
  while (documentCache.size > 16) documentCache.delete(documentCache.keys().next().value!);
  graphCache.set(input.document, documentCache);
  return graph;
}

function atomicId(
  revision: RevisionId,
  nodeId: string,
  range: Pick<AtomicGraphSegment, 'kind' | 'vertexRange' | 'parameterRange'>,
): string {
  return `atomic_${createHash('sha256').update(JSON.stringify({
    revision,
    nodeId,
    kind: range.kind,
    vertexRange: range.vertexRange,
    parameterRange: range.parameterRange,
  })).digest('hex').slice(0, 24)}`;
}

function connectAdjacentSegments(
  segments: AtomicGraphSegment[],
  epsilon: number,
  document: DrawingDocument,
): void {
  const explicitConnections = new Set(document.relations
    .filter((relation): relation is Extract<typeof relation, { plane: 'topology' }> => (
      relation.plane === 'topology'
    ))
    .filter((relation) => relation.kind === 'connected')
    .flatMap((relation) => relation.nodeIds.flatMap((left, leftIndex) => (
      relation.nodeIds.slice(leftIndex + 1).map((right) => connectionKey(left, right))
    ))));
  const endpoints = new Map<string, AtomicGraphSegment[]>();
  for (const segment of segments) {
    for (const point of [segment.start, segment.end]) {
      const key = endpointKey(point, epsilon);
      endpoints.set(key, [...(endpoints.get(key) ?? []), segment]);
    }
  }
  for (const connected of endpoints.values()) {
    for (const segment of connected) {
      const adjacent = new Set(segment.adjacentSegmentIds);
      connected.forEach((candidate) => {
        if (candidate.id === segment.id) return;
        if (candidate.nodeId === segment.nodeId
          || explicitConnections.has(connectionKey(segment.nodeId, candidate.nodeId))) {
          adjacent.add(candidate.id);
        }
      });
      segment.adjacentSegmentIds = [...adjacent].sort();
    }
  }
}

function connectionKey(left: string, right: string): string {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

function endpointKey(point: Vec2, epsilon: number): string {
  return `${Math.round(point[0] / epsilon)}:${Math.round(point[1] / epsilon)}`;
}

function geometryEpsilon(bounds: Bounds2D): number {
  return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1) * 1e-9;
}

function expandBounds(bounds: Bounds2D, padding: number): Bounds2D {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}
