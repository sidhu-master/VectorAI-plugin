import { createHash } from 'node:crypto';

import type {
  Bounds2D,
  DrawingDocument,
  GeometryNode,
  RevisionId,
  TopologyRelation,
  Vec2,
} from '../../../src/drawing/index.js';
import { boundsIntersect, unionBounds } from '../../../src/drawing/query/bounds.js';
import {
  roughGeometryBounds,
  sampleGeometryRanges,
} from '../drawing-spatial/geometry-sampling.js';
import {
  WORLD_MODEL_COMPILER_VERSION,
  type ArrangementConnectedEdge,
  type ArrangementHalfEdge,
  type ArrangementIncidenceEdge,
  type ArrangementVertex,
  type SourceSpan,
  type WorldModelCompileRequest,
  type WorldModelDiagnostic,
  type WorldModelKnowledgeStateKind,
  type WorldModelSlice,
} from './types.js';

const DEFAULT_TOLERANCE = 1e-6;
const DEFAULT_CURVE_SAMPLES = 64;
const MAX_LIMIT = 2_000;

interface SpanDraft {
  node: GeometryNode;
  parameterRange: readonly [number, number];
  derivation: SourceSpan['derivation'];
  samples: Vec2[];
  bounds: Bounds2D;
}

interface LinearDraft extends SpanDraft {
  samples: [Vec2, Vec2];
}

interface PairIntersection {
  kind: ArrangementIncidenceEdge['kind'];
  first: LinearDraft;
  second: LinearDraft;
  point?: Vec2;
}

export class WorldModelCompiler {
  compile(
    document: DrawingDocument,
    revision: RevisionId,
    request: WorldModelCompileRequest = {},
  ): WorldModelSlice {
    const tolerance = finitePositive(request.tolerance, DEFAULT_TOLERANCE);
    const curveSamples = integerInRange(request.curveSamples, 8, 512, DEFAULT_CURVE_SAMPLES);
    const limit = integerInRange(request.limit, 1, MAX_LIMIT, MAX_LIMIT);
    const inputDigest = digest({
      drawingId: document.id,
      revision,
      compilerVersion: WORLD_MODEL_COMPILER_VERSION,
      request,
      geometry: document.geometry,
      topology: document.relations.filter((relation) => relation.type === 'topology'),
    });
    const scopeDigest = digest({ revision, request });
    const requestedIds = request.nodeIds ? new Set(request.nodeIds) : null;
    const byId = new Map(document.geometry.map((node) => [node.id as string, node]));
    const diagnostics: WorldModelDiagnostic[] = [];
    const unresolved = new Set<string>();

    if (requestedIds) {
      for (const nodeId of requestedIds) {
        if (byId.has(nodeId)) continue;
        unresolved.add(`node:${nodeId}`);
        diagnostics.push({
          code: 'WORLD_MODEL_NODE_NOT_FOUND',
          severity: 'warning',
          message: `Drawing IR node ${nodeId} does not exist at ${revision}`,
          nodeIds: [nodeId],
          sourceSpanIds: [],
        });
      }
    }

    const eligible = document.geometry.filter((node) => {
      if (requestedIds && !requestedIds.has(node.id)) return false;
      if (!request.bounds) return true;
      const bounds = roughGeometryBounds(node);
      return bounds ? boundsIntersect(bounds, request.bounds) : true;
    });
    const selected = eligible.slice(0, limit);
    for (const omitted of eligible.slice(limit)) unresolved.add(`node:${omitted.id}`);

    const drafts: SpanDraft[] = [];
    for (const node of selected) {
      const bounds = roughGeometryBounds(node);
      if (!bounds && !request.bounds) {
        unresolved.add(`node:${node.id}`);
        diagnostics.push({
          code: 'WORLD_MODEL_UNBOUNDED_GEOMETRY',
          severity: 'warning',
          message: `${node.type} ${node.id} requires a finite world-model scope`,
          nodeIds: [node.id],
          sourceSpanIds: [],
        });
        continue;
      }
      drafts.push(...draftsForNode(
        node,
        request.bounds ?? bounds!,
        curveSamples,
        tolerance,
        diagnostics,
      ));
    }

    const intersections = linearIntersections(drafts, tolerance);
    const splitDrafts = splitLinearDrafts(drafts, intersections, tolerance);
    const vertices = new Map<string, ArrangementVertex>();
    const sourceSpans: SourceSpan[] = [];
    const halfEdges: ArrangementHalfEdge[] = [];
    for (const draft of splitDrafts) {
      const spanId = stableId('span', revision, draft.node.id, draft.parameterRange);
      const start = draft.samples[0];
      const end = draft.samples.at(-1)!;
      const startVertex = ensureVertex(vertices, revision, start, tolerance, 'endpoint');
      const closed = distance(start, end) <= tolerance && draft.samples.length > 2;
      const endVertex = closed
        ? startVertex
        : ensureVertex(vertices, revision, end, tolerance, 'endpoint');
      const forwardId = stableId('halfedge', spanId, 'forward');
      const reverseId = stableId('halfedge', spanId, 'reverse');
      halfEdges.push(
        {
          id: forwardId,
          twinId: reverseId,
          sourceSpanId: spanId,
          originVertexId: startVertex.id,
          destinationVertexId: endVertex.id,
          direction: 'forward',
        },
        {
          id: reverseId,
          twinId: forwardId,
          sourceSpanId: spanId,
          originVertexId: endVertex.id,
          destinationVertexId: startVertex.id,
          direction: 'reverse',
        },
      );
      startVertex.incidentHalfEdgeIds.push(forwardId, reverseId);
      if (endVertex !== startVertex) endVertex.incidentHalfEdgeIds.push(forwardId, reverseId);
      sourceSpans.push({
        id: spanId,
        sourceNodeId: draft.node.id,
        parameterRange: draft.parameterRange,
        halfEdgeIds: [forwardId, reverseId],
        derivation: draft.derivation,
        tolerance,
        bounds: draft.bounds,
        samples: draft.samples,
      });
    }

    const spansByNode = groupBy(sourceSpans, (span) => span.sourceNodeId);
    const incidenceEdges = toIncidenceEdges(intersections, sourceSpans, revision, tolerance);
    for (const incidence of incidenceEdges) {
      if (!incidence.point) continue;
      ensureVertex(vertices, revision, incidence.point, tolerance, 'intersection');
    }
    const connectedEdges = authoredConnections(document, selected, spansByNode, revision);
    connectedEdges.push(...sharedEndpointConnections(
      sourceSpans,
      selected,
      revision,
      tolerance,
      connectedEdges,
    ));

    const continuationToken = unresolved.size > 0
      ? `world:${scopeDigest.slice(7, 31)}:${selected.length}`
      : undefined;
    const state: WorldModelKnowledgeStateKind = unresolved.size === 0
      ? 'resolved'
      : sourceSpans.length > 0
        ? 'partial'
        : 'unknown';
    const scopeBounds = request.bounds ?? unionBounds(sourceSpans.map((span) => span.bounds));
    return {
      drawingId: document.id,
      revision,
      compilerVersion: WORLD_MODEL_COMPILER_VERSION,
      inputDigest,
      frameId: document.coordinateFrames.find((frame) => frame.kind === 'document')?.id
        ?? 'frame_document',
      ...(scopeBounds ? { scopeBounds } : {}),
      sourceSpans,
      vertices: [...vertices.values()].map((vertex) => ({
        ...vertex,
        incidentHalfEdgeIds: [...new Set(vertex.incidentHalfEdgeIds)],
      })),
      halfEdges,
      faces: [],
      incidenceEdges,
      connectedEdges,
      diagnostics,
      knowledge: {
        state,
        scopeDigest,
        unresolvedBoundaryRefs: [...unresolved].sort(),
        ...(continuationToken ? { continuationToken } : {}),
        ...(state === 'resolved' ? {} : {
          reason: state === 'partial'
            ? 'The bounded result is usable, but relevant geometry remains unresolved.'
            : 'No finite, supported geometry was resolved for the requested scope.',
        }),
      },
      ...(continuationToken ? { continuationToken } : {}),
    };
  }
}

function draftsForNode(
  node: GeometryNode,
  localBounds: Bounds2D,
  curveSamples: number,
  tolerance: number,
  diagnostics: WorldModelDiagnostic[],
): SpanDraft[] {
  const ranges = sampleGeometryRanges(node, { curveSamples, localBounds });
  if (node.type === 'polyline') {
    const count = Math.max(1, ranges.length);
    return ranges.map((range, index) => ({
      node,
      parameterRange: [index / count, (index + 1) / count],
      derivation: 'polyline-exact',
      samples: range.samples,
      bounds: range.bounds,
    }));
  }
  if (node.type === 'spline') {
    const samples = stitchSamples(ranges);
    const spanId = stableId('span-diagnostic', node.id, 0, 1);
    diagnostics.push({
      code: 'ARRANGEMENT_SAMPLED_FALLBACK',
      severity: 'warning',
      message: `Spline ${node.id} uses an adaptive sampled fallback with tolerance ${tolerance}`,
      nodeIds: [node.id],
      sourceSpanIds: [spanId],
    });
    return [{
      node,
      parameterRange: [0, 1],
      derivation: 'sampled-fallback',
      samples,
      bounds: boundsOf(samples),
    }];
  }
  const samples = stitchSamples(ranges);
  return samples.length === 0 ? [] : [{
    node,
    parameterRange: [0, 1],
    derivation: 'analytic',
    samples,
    bounds: boundsOf(samples),
  }];
}

function stitchSamples(ranges: ReturnType<typeof sampleGeometryRanges>): Vec2[] {
  const result: Vec2[] = [];
  for (const range of ranges) {
    for (const sample of range.samples) {
      if (result.length === 0 || distance(result.at(-1)!, sample) > 1e-12) result.push(sample);
    }
  }
  return result;
}

function linearIntersections(drafts: SpanDraft[], tolerance: number): PairIntersection[] {
  const linear = drafts.filter(isLinearDraft);
  const result: PairIntersection[] = [];
  for (let firstIndex = 0; firstIndex < linear.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < linear.length; secondIndex += 1) {
      const first = linear[firstIndex];
      const second = linear[secondIndex];
      if (first.node.id === second.node.id) continue;
      const intersection = segmentIntersection(first.samples, second.samples, tolerance);
      if (intersection) result.push({ ...intersection, first, second });
    }
  }
  return result;
}

function isLinearDraft(draft: SpanDraft): draft is LinearDraft {
  return draft.samples.length === 2
    && (draft.node.type === 'line'
      || draft.node.type === 'polyline'
      || draft.node.type === 'ray'
      || draft.node.type === 'xline');
}

function segmentIntersection(
  first: [Vec2, Vec2],
  second: [Vec2, Vec2],
  tolerance: number,
): { kind: ArrangementIncidenceEdge['kind']; point?: Vec2 } | null {
  const [a, b] = first;
  const [c, d] = second;
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross(r, s);
  const delta: Vec2 = [c[0] - a[0], c[1] - a[1]];
  if (Math.abs(denominator) <= tolerance) {
    if (Math.abs(cross(delta, r)) > tolerance) return null;
    if (!boundsIntersect(expand(boundsOf(first), tolerance), boundsOf(second))) return null;
    return { kind: 'overlap' };
  }
  const t = cross(delta, s) / denominator;
  const u = cross(delta, r) / denominator;
  if (t < -tolerance || t > 1 + tolerance || u < -tolerance || u > 1 + tolerance) return null;
  const point: Vec2 = [a[0] + r[0] * clamp01(t), a[1] + r[1] * clamp01(t)];
  const endpoint = nearEndpoint(t, tolerance) || nearEndpoint(u, tolerance);
  return { kind: endpoint ? 'touching' : 'crossing', point };
}

function splitLinearDrafts(
  drafts: SpanDraft[],
  intersections: PairIntersection[],
  tolerance: number,
): SpanDraft[] {
  const splitParameters = new Map<SpanDraft, number[]>();
  for (const draft of drafts) splitParameters.set(draft, [0, 1]);
  for (const intersection of intersections) {
    if (!intersection.point || intersection.kind === 'overlap') continue;
    for (const draft of [intersection.first, intersection.second]) {
      const local = parameterOnSegment(draft.samples[0], draft.samples[1], intersection.point);
      if (local > tolerance && local < 1 - tolerance) splitParameters.get(draft)!.push(local);
    }
  }
  return drafts.flatMap((draft) => {
    if (!isLinearDraft(draft)) return [draft];
    const cuts = [...new Set(splitParameters.get(draft)!.map((value) => clean(value)))].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((start, index): SpanDraft => {
      const end = cuts[index + 1];
      const parameterStart = interpolate(draft.parameterRange[0], draft.parameterRange[1], start);
      const parameterEnd = interpolate(draft.parameterRange[0], draft.parameterRange[1], end);
      const samples: Vec2[] = [
        lerpPoint(draft.samples[0], draft.samples[1], start),
        lerpPoint(draft.samples[0], draft.samples[1], end),
      ];
      return {
        ...draft,
        parameterRange: [clean(parameterStart), clean(parameterEnd)],
        samples,
        bounds: boundsOf(samples),
      };
    });
  });
}

function toIncidenceEdges(
  intersections: PairIntersection[],
  spans: SourceSpan[],
  revision: RevisionId,
  tolerance: number,
): ArrangementIncidenceEdge[] {
  return intersections.map((intersection) => {
    const sortedNodeIds = [
      intersection.first.node.id as string,
      intersection.second.node.id as string,
    ].sort();
    const nodeIds: [string, string] = [sortedNodeIds[0], sortedNodeIds[1]];
    const sourceSpanIds = spans.filter((span) => (
      nodeIds.includes(span.sourceNodeId)
      && (!intersection.point || pointOnBounds(intersection.point, span.bounds, tolerance))
    )).map((span) => span.id);
    return {
      id: stableId('incidence', revision, nodeIds, intersection.kind, intersection.point),
      kind: intersection.kind,
      nodeIds,
      sourceSpanIds,
      ...(intersection.point ? { point: intersection.point } : {}),
    };
  });
}

function authoredConnections(
  document: DrawingDocument,
  selected: GeometryNode[],
  spansByNode: Map<string, SourceSpan[]>,
  revision: RevisionId,
): ArrangementConnectedEdge[] {
  const selectedIds = new Set(selected.map((node) => node.id as string));
  return document.relations.filter((relation): relation is TopologyRelation => (
    relation.type === 'topology'
    && relation.kind === 'connected'
    && relation.nodeIds.every((nodeId) => selectedIds.has(nodeId))
  )).map((relation) => ({
    id: stableId('connected', revision, relation.id),
    source: 'authored' as const,
    nodeIds: [...relation.nodeIds],
    sourceSpanIds: relation.nodeIds.flatMap((nodeId) => (
      spansByNode.get(nodeId)?.map((span) => span.id) ?? []
    )),
    relationId: relation.id,
  }));
}

function sharedEndpointConnections(
  spans: SourceSpan[],
  nodes: GeometryNode[],
  revision: RevisionId,
  tolerance: number,
  existing: ArrangementConnectedEdge[],
): ArrangementConnectedEdge[] {
  const result: ArrangementConnectedEdge[] = [];
  const authoredEndpoints = new Map(nodes.map((node) => [
    node.id as string,
    geometryAuthoredEndpoints(node),
  ]));
  const existingPairs = new Set(existing.map((edge) => [...edge.nodeIds].sort().join('\0')));
  for (let firstIndex = 0; firstIndex < spans.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < spans.length; secondIndex += 1) {
      const first = spans[firstIndex];
      const second = spans[secondIndex];
      if (first.sourceNodeId === second.sourceNodeId) continue;
      const pair = [first.sourceNodeId, second.sourceNodeId].sort();
      if (existingPairs.has(pair.join('\0'))) continue;
      const shared = (authoredEndpoints.get(first.sourceNodeId) ?? []).find((point) => (
        (authoredEndpoints.get(second.sourceNodeId) ?? [])
          .some((candidate) => distance(point, candidate) <= tolerance)
      ));
      if (!shared) continue;
      existingPairs.add(pair.join('\0'));
      result.push({
        id: stableId('connected', revision, pair, shared),
        source: 'shared-endpoint',
        nodeIds: pair,
        sourceSpanIds: [first.id, second.id],
        point: shared,
      });
    }
  }
  return result;
}

function geometryAuthoredEndpoints(node: GeometryNode): Vec2[] {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'ray': return [node.origin];
    case 'xline': return [];
    case 'circle': return [];
    case 'arc': return [
      polar(node.center, node.radius, node.startAngle),
      polar(node.center, node.radius, node.endAngle),
    ];
    case 'ellipse': {
      if (node.startParam === undefined || node.endParam === undefined) return [];
      return [
        ellipsePoint(node, node.startParam),
        ellipsePoint(node, node.endParam),
      ];
    }
    case 'polyline': {
      if (node.closed || node.vertices.length === 0) return [];
      return [node.vertices[0].point, node.vertices.at(-1)!.point];
    }
    case 'spline': {
      if (node.closed || node.controlPoints.length === 0) return [];
      return [node.controlPoints[0], node.controlPoints.at(-1)!];
    }
  }
}

function polar(center: Vec2, radius: number, degrees: number): Vec2 {
  const radians = degrees * Math.PI / 180;
  return [center[0] + radius * Math.cos(radians), center[1] + radius * Math.sin(radians)];
}

function ellipsePoint(
  node: Extract<GeometryNode, { type: 'ellipse' }>,
  parameter: number,
): Vec2 {
  const minor: Vec2 = [-node.majorAxis[1] * node.ratio, node.majorAxis[0] * node.ratio];
  return [
    node.center[0] + node.majorAxis[0] * Math.cos(parameter) + minor[0] * Math.sin(parameter),
    node.center[1] + node.majorAxis[1] * Math.cos(parameter) + minor[1] * Math.sin(parameter),
  ];
}

function ensureVertex(
  vertices: Map<string, ArrangementVertex>,
  revision: RevisionId,
  point: Vec2,
  tolerance: number,
  source: ArrangementVertex['source'],
): ArrangementVertex {
  const quantized: Vec2 = [
    clean(Math.round(point[0] / tolerance) * tolerance),
    clean(Math.round(point[1] / tolerance) * tolerance),
  ];
  const id = stableId('vertex', revision, quantized);
  const existing = vertices.get(id);
  if (existing) {
    if (source === 'intersection') existing.source = 'intersection';
    return existing;
  }
  const vertex: ArrangementVertex = { id, point: quantized, incidentHalfEdgeIds: [], source };
  vertices.set(id, vertex);
  return vertex;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function parameterOnSegment(start: Vec2, end: Vec2, point: Vec2): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return 0;
  return ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
}

function pointOnBounds(point: Vec2, bounds: Bounds2D, tolerance: number): boolean {
  return point[0] >= bounds.minX - tolerance && point[0] <= bounds.maxX + tolerance
    && point[1] >= bounds.minY - tolerance && point[1] <= bounds.maxY + tolerance;
}

function boundsOf(points: readonly Vec2[]): Bounds2D {
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function expand(bounds: Bounds2D, amount: number): Bounds2D {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  };
}

function cross(first: Vec2, second: Vec2): number {
  return first[0] * second[1] - first[1] * second[0];
}

function nearEndpoint(value: number, tolerance: number): boolean {
  return Math.abs(value) <= tolerance || Math.abs(value - 1) <= tolerance;
}

function lerpPoint(start: Vec2, end: Vec2, amount: number): Vec2 {
  return [interpolate(start[0], end[0], amount), interpolate(start[1], end[1], amount)];
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function integerInRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, Math.floor(value)))
    : fallback;
}

function clean(value: number): number {
  const rounded = Math.round(value * 1e12) / 1e12;
  return Math.abs(rounded) < 1e-12 ? 0 : rounded;
}

function stableId(prefix: string, ...parts: unknown[]): string {
  return `${prefix}_${createHash('sha256').update(stableStringify(parts)).digest('hex').slice(0, 24)}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, nested]) => [key, canonicalize(nested)]));
}
