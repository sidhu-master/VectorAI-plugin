// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingDocument,
  DrawingId,
  GeometryNode,
  RevisionId,
  Vec2,
} from '@vectorai/drawing-core';

import type { SpatialBounds2D } from './query';

export const WORLD_MODEL_COMPILER_VERSION = 'world-model-0.1.0' as const;

export type WorldModelKnowledgeStateKind = 'resolved' | 'partial' | 'unknown' | 'stale';

export interface WorldModelKnowledgeState {
  state: WorldModelKnowledgeStateKind;
  scopeDigest: string;
  unresolvedBoundaryRefs: string[];
  continuationToken?: string;
  reason?: string;
}

export interface WorldModelCompileRequest {
  nodeIds?: string[];
  bounds?: SpatialBounds2D;
  limit?: number;
  continuationToken?: string;
  curveSamples?: number;
  tolerance?: number;
}

export interface WorldModelDiagnostic {
  code:
    | 'WORLD_MODEL_NODE_NOT_FOUND'
    | 'WORLD_MODEL_UNBOUNDED_GEOMETRY'
    | 'WORLD_MODEL_CONTINUATION_INVALID'
    | 'ARRANGEMENT_SAMPLED_FALLBACK'
    | 'ARRANGEMENT_INEXACT';
  severity: 'info' | 'warning' | 'error';
  message: string;
  nodeIds: string[];
  sourceSpanIds: string[];
}

export interface SourceSpan {
  id: string;
  sourceNodeId: string;
  parameterRange: readonly [number, number];
  halfEdgeIds: string[];
  derivation: 'analytic' | 'polyline-exact' | 'sampled-fallback';
  tolerance: number;
  bounds: SpatialBounds2D;
  samples: Vec2[];
}

export interface ArrangementVertex {
  id: string;
  point: Vec2;
  incidentHalfEdgeIds: string[];
  source: 'endpoint' | 'intersection' | 'closed-curve-anchor';
}

export interface ArrangementHalfEdge {
  id: string;
  twinId: string;
  sourceSpanId: string;
  originVertexId: string;
  destinationVertexId: string;
  direction: 'forward' | 'reverse';
}

export interface ArrangementFace {
  id: string;
  outerHalfEdgeIds: string[];
  holeHalfEdgeIds: string[][];
  bounds: SpatialBounds2D;
  area: number;
}

export interface ArrangementIncidenceEdge {
  id: string;
  kind: 'crossing' | 'touching' | 'overlap';
  nodeIds: readonly [string, string];
  sourceSpanIds: string[];
  point?: Vec2;
}

export interface ArrangementConnectedEdge {
  id: string;
  source: 'authored' | 'shared-endpoint';
  nodeIds: string[];
  sourceSpanIds: string[];
  relationId?: string;
  point?: Vec2;
}

export interface WorldModelSlice {
  drawingId: DrawingId;
  revision: RevisionId;
  compilerVersion: typeof WORLD_MODEL_COMPILER_VERSION;
  inputDigest: string;
  frameId: string;
  scopeBounds?: SpatialBounds2D;
  sourceSpans: SourceSpan[];
  vertices: ArrangementVertex[];
  halfEdges: ArrangementHalfEdge[];
  faces: ArrangementFace[];
  incidenceEdges: ArrangementIncidenceEdge[];
  connectedEdges: ArrangementConnectedEdge[];
  diagnostics: WorldModelDiagnostic[];
  knowledge: WorldModelKnowledgeState;
  continuationToken?: string;
}

export interface WorldModelCompilerPorts {
  digest(value: string): string;
}

interface SpanDraft {
  sourceNodeId: string;
  parameterRange: readonly [number, number];
  derivation: SourceSpan['derivation'];
  samples: Vec2[];
}

export class WorldModelCompiler {
  readonly #ports: WorldModelCompilerPorts;

  constructor(ports: WorldModelCompilerPorts = { digest: portableDigest }) {
    this.#ports = ports;
  }

  compile(
    document: DrawingDocument,
    revision: RevisionId,
    request: WorldModelCompileRequest = {},
  ): WorldModelSlice {
    const tolerance = positive(request.tolerance, 1e-6);
    const curveSamples = integer(request.curveSamples, 8, 512, 64);
    const limit = integer(request.limit, 1, 2_000, 2_000);
    const requested = request.nodeIds ? new Set(request.nodeIds) : null;
    const allCandidates = document.geometry.filter((node) => (
      (!requested || requested.has(String(node.id)))
      && (!request.bounds || boundsIntersect(geometryBounds(node), request.bounds))
    ));
    const effectiveScopeBounds = request.bounds
      ? structuredClone(request.bounds)
      : unionSpatialBounds(allCandidates.map(geometryBounds));
    const missing = request.nodeIds?.filter((id) => !document.geometry.some((node) => node.id === id)) ?? [];
    const scopeDigest = this.#ports.digest(stableStringify({
      drawingId: document.id,
      revision,
      nodeIds: request.nodeIds?.slice().sort(),
      bounds: request.bounds,
      tolerance,
      curveSamples,
    }));
    const offset = parseContinuation(request.continuationToken, scopeDigest);
    const page = allCandidates.slice(offset, offset + limit);
    const hasMore = offset + page.length < allCandidates.length;
    const continuationToken = hasMore ? `world:${scopeDigest}:${offset + page.length}` : undefined;
    const diagnostics: WorldModelDiagnostic[] = missing.map((id) => ({
      code: 'WORLD_MODEL_NODE_NOT_FOUND', severity: 'error',
      message: `Geometry ${id} does not exist.`, nodeIds: [id], sourceSpanIds: [],
    }));
    const unsupported = page.filter((node) => node.type === 'ray' || node.type === 'xline');
    diagnostics.push(...unsupported.map((node): WorldModelDiagnostic => ({
      code: 'WORLD_MODEL_UNBOUNDED_GEOMETRY', severity: 'warning',
      message: `Unbounded geometry ${node.id} cannot form a bounded arrangement span.`,
      nodeIds: [String(node.id)], sourceSpanIds: [],
    })));
    const unsplitDrafts = page.flatMap((node) => spansForNode(node, curveSamples));
    const drafts = splitLinearDraftsAtIntersections(unsplitDrafts, tolerance);
    const sourceSpans: SourceSpan[] = drafts.map((draft) => {
      const id = stableId(this.#ports, 'span', {
        drawingId: document.id, revision, nodeId: draft.sourceNodeId,
        range: draft.parameterRange, samples: draft.samples,
      });
      return {
        id,
        sourceNodeId: draft.sourceNodeId,
        parameterRange: draft.parameterRange,
        halfEdgeIds: [`half:${id}:forward`, `half:${id}:reverse`],
        derivation: draft.derivation,
        tolerance,
        bounds: pointsBounds(draft.samples),
        samples: structuredClone(draft.samples),
      };
    });
    const vertices: ArrangementVertex[] = [];
    const halfEdges: ArrangementHalfEdge[] = [];
    const vertexFor = (point: Vec2, source: ArrangementVertex['source']) => {
      const existing = vertices.find((vertex) => distance(vertex.point, point) <= tolerance);
      if (existing) return existing;
      const vertex: ArrangementVertex = {
        id: stableId(this.#ports, 'vertex', { point: quantize(point, tolerance) }),
        point: structuredClone(point), incidentHalfEdgeIds: [], source,
      };
      vertices.push(vertex);
      return vertex;
    };
    for (const span of sourceSpans) {
      const first = span.samples[0];
      const last = span.samples.at(-1);
      if (!first || !last) continue;
      const origin = vertexFor(first, distance(first, last) <= tolerance ? 'closed-curve-anchor' : 'endpoint');
      const destination = vertexFor(last, distance(first, last) <= tolerance ? 'closed-curve-anchor' : 'endpoint');
      const forward = span.halfEdgeIds[0]!;
      const reverse = span.halfEdgeIds[1]!;
      halfEdges.push(
        { id: forward, twinId: reverse, sourceSpanId: span.id, originVertexId: origin.id, destinationVertexId: destination.id, direction: 'forward' },
        { id: reverse, twinId: forward, sourceSpanId: span.id, originVertexId: destination.id, destinationVertexId: origin.id, direction: 'reverse' },
      );
      origin.incidentHalfEdgeIds.push(forward, reverse);
      if (destination !== origin) destination.incidentHalfEdgeIds.push(forward, reverse);
    }
    const incidenceEdges = compileIncidence(unsplitDrafts, sourceSpans, tolerance, this.#ports);
    const connectedEdges = compileConnectivity(document, sourceSpans, vertices, tolerance, this.#ports);
    const unresolved = [
      ...allCandidates.slice(0, offset).map((node) => `node:${node.id}`),
      ...allCandidates.slice(offset + page.length).map((node) => `node:${node.id}`),
      ...unsupported.map((node) => `node:${node.id}`),
      ...missing.map((id) => `node:${id}`),
    ];
    const state: WorldModelKnowledgeStateKind = unsupported.length > 0 || missing.length > 0
      ? 'unknown'
      : hasMore || offset > 0 ? 'partial' : 'resolved';
    const knowledge: WorldModelKnowledgeState = {
      state,
      scopeDigest,
      unresolvedBoundaryRefs: [...new Set(unresolved)],
      ...(continuationToken ? { continuationToken } : {}),
    };
    return {
      drawingId: document.id,
      revision,
      compilerVersion: WORLD_MODEL_COMPILER_VERSION,
      inputDigest: this.#ports.digest(stableStringify({ document: document.geometry, request, revision })),
      frameId: document.coordinateFrames.find(({ kind }) => kind === 'document')?.id ?? 'document',
      ...(effectiveScopeBounds ? { scopeBounds: effectiveScopeBounds } : {}),
      sourceSpans,
      vertices: vertices.sort((a, b) => a.id.localeCompare(b.id)),
      halfEdges: halfEdges.sort((a, b) => a.id.localeCompare(b.id)),
      faces: [],
      incidenceEdges,
      connectedEdges,
      diagnostics,
      knowledge,
      ...(continuationToken ? { continuationToken } : {}),
    };
  }
}

function spansForNode(node: GeometryNode, curveSamples: number): SpanDraft[] {
  if (node.type === 'ray' || node.type === 'xline' || node.type === 'point') return [];
  if (node.type === 'line') return [{
    sourceNodeId: String(node.id), parameterRange: [0, 1], derivation: 'analytic',
    samples: [structuredClone(node.start), structuredClone(node.end)],
  }];
  if (node.type === 'polyline') {
    const count = Math.max(1, node.vertices.length - (node.closed ? 0 : 1));
    return Array.from({ length: count }, (_, index) => {
      const next = (index + 1) % node.vertices.length;
      return {
        sourceNodeId: String(node.id),
        parameterRange: [index / count, (index + 1) / count] as const,
        derivation: 'polyline-exact' as const,
        samples: [structuredClone(node.vertices[index]!.point), structuredClone(node.vertices[next]!.point)],
      };
    });
  }
  const samples = sampleCurve(node, curveSamples);
  return samples.length < 2 ? [] : [{
    sourceNodeId: String(node.id), parameterRange: [0, 1],
    derivation: node.type === 'circle' || node.type === 'arc' || node.type === 'ellipse'
      ? 'analytic' : 'sampled-fallback',
    samples,
  }];
}

function splitLinearDraftsAtIntersections(drafts: SpanDraft[], tolerance: number): SpanDraft[] {
  const cuts = drafts.map(() => new Set([0, 1]));
  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    const left = drafts[leftIndex]!;
    if (left.samples.length !== 2) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const right = drafts[rightIndex]!;
      if (right.sourceNodeId === left.sourceNodeId || right.samples.length !== 2) continue;
      const parameters = segmentIntersectionParameters(
        left.samples[0]!, left.samples[1]!, right.samples[0]!, right.samples[1]!, tolerance,
      );
      if (!parameters) continue;
      if (parameters.left > tolerance && parameters.left < 1 - tolerance) cuts[leftIndex]!.add(parameters.left);
      if (parameters.right > tolerance && parameters.right < 1 - tolerance) cuts[rightIndex]!.add(parameters.right);
    }
  }
  return drafts.flatMap((draft, index) => {
    if (draft.samples.length !== 2) return [draft];
    const parameters = [...cuts[index]!].sort((left, right) => left - right);
    return parameters.slice(0, -1).map((start, parameterIndex): SpanDraft => {
      const end = parameters[parameterIndex + 1]!;
      const rangeStart = draft.parameterRange[0]
        + (draft.parameterRange[1] - draft.parameterRange[0]) * start;
      const rangeEnd = draft.parameterRange[0]
        + (draft.parameterRange[1] - draft.parameterRange[0]) * end;
      return {
        ...draft,
        parameterRange: [rangeStart, rangeEnd],
        samples: [pointAt(draft.samples[0]!, draft.samples[1]!, start), pointAt(draft.samples[0]!, draft.samples[1]!, end)],
      };
    });
  });
}

function sampleCurve(node: Exclude<GeometryNode, { type: 'point' | 'line' | 'ray' | 'xline' | 'polyline' }>, count: number): Vec2[] {
  if (node.type === 'spline') return structuredClone(node.controlPoints);
  if (node.type === 'circle') return Array.from({ length: count + 1 }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return [node.center[0] + node.radius * Math.cos(angle), node.center[1] + node.radius * Math.sin(angle)] as Vec2;
  });
  if (node.type === 'arc') return Array.from({ length: count + 1 }, (_, index) => {
    const start = node.startAngle * Math.PI / 180;
    const raw = (node.endAngle - node.startAngle) * Math.PI / 180;
    const span = node.counterClockwise ? raw : -raw;
    const angle = start + span * index / count;
    return [node.center[0] + node.radius * Math.cos(angle), node.center[1] + node.radius * Math.sin(angle)] as Vec2;
  });
  const major = node.majorAxis;
  const minor: Vec2 = [-major[1] * node.ratio, major[0] * node.ratio];
  const start = node.startParam ?? 0;
  const end = node.endParam ?? Math.PI * 2;
  return Array.from({ length: count + 1 }, (_, index) => {
    const parameter = start + (end - start) * index / count;
    return [
      node.center[0] + major[0] * Math.cos(parameter) + minor[0] * Math.sin(parameter),
      node.center[1] + major[1] * Math.cos(parameter) + minor[1] * Math.sin(parameter),
    ] as Vec2;
  });
}

function compileIncidence(
  drafts: SpanDraft[],
  spans: SourceSpan[],
  tolerance: number,
  ports: WorldModelCompilerPorts,
): ArrangementIncidenceEdge[] {
  const result: ArrangementIncidenceEdge[] = [];
  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    const left = drafts[leftIndex]!;
    if (left.samples.length !== 2) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const right = drafts[rightIndex]!;
      if (right.sourceNodeId === left.sourceNodeId || right.samples.length !== 2) continue;
      const hit = segmentIntersection(left.samples[0]!, left.samples[1]!, right.samples[0]!, right.samples[1]!, tolerance);
      if (!hit) continue;
      const sourceSpanIds = spans
        .filter((span) => (
          (span.sourceNodeId === left.sourceNodeId || span.sourceNodeId === right.sourceNodeId)
          && (!hit.point || pointOnBounds(hit.point, span.bounds, tolerance))
        ))
        .map(({ id }) => id);
      result.push({
        id: stableId(ports, 'incidence', { left: left.sourceNodeId, right: right.sourceNodeId, hit }),
        kind: hit.kind,
        nodeIds: [left.sourceNodeId, right.sourceNodeId],
        sourceSpanIds,
        ...(hit.point ? { point: hit.point } : {}),
      });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function pointOnBounds(point: Vec2, bounds: SpatialBounds2D, tolerance: number): boolean {
  return point[0] >= bounds.minX - tolerance && point[0] <= bounds.maxX + tolerance
    && point[1] >= bounds.minY - tolerance && point[1] <= bounds.maxY + tolerance;
}

function compileConnectivity(
  document: DrawingDocument,
  spans: SourceSpan[],
  vertices: ArrangementVertex[],
  tolerance: number,
  ports: WorldModelCompilerPorts,
): ArrangementConnectedEdge[] {
  const byNode = new Map<string, string[]>();
  for (const span of spans) byNode.set(span.sourceNodeId, [...(byNode.get(span.sourceNodeId) ?? []), span.id]);
  const result: ArrangementConnectedEdge[] = document.relations.flatMap((relation) => {
    if (relation.type !== 'topology' || relation.kind !== 'connected') return [];
    const nodeIds = relation.nodeIds.filter((id) => byNode.has(id));
    return nodeIds.length < 2 ? [] : [{
      id: stableId(ports, 'connected', { relationId: relation.id, nodeIds }),
      source: 'authored' as const,
      nodeIds,
      sourceSpanIds: nodeIds.flatMap((id) => byNode.get(id) ?? []),
      relationId: String(relation.id),
    }];
  });
  for (const vertex of vertices) {
    const nodeIds = [...new Set(spans.flatMap((span) => {
      const first = span.samples[0];
      const last = span.samples.at(-1);
      const atAuthoredStart = span.parameterRange[0] <= tolerance
        && first && distance(first, vertex.point) <= tolerance;
      const atAuthoredEnd = span.parameterRange[1] >= 1 - tolerance
        && last && distance(last, vertex.point) <= tolerance;
      return atAuthoredStart || atAuthoredEnd ? [span.sourceNodeId] : [];
    }))];
    if (nodeIds.length < 2) continue;
    const authored = result.some((edge) => nodeIds.every((id) => edge.nodeIds.includes(id)));
    if (!authored) result.push({
      id: stableId(ports, 'connected', { point: quantize(vertex.point, tolerance), nodeIds }),
      source: 'shared-endpoint', nodeIds,
      sourceSpanIds: nodeIds.flatMap((id) => byNode.get(id) ?? []), point: vertex.point,
    });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2, tolerance: number): { kind: 'crossing' | 'touching' | 'overlap'; point?: Vec2 } | null {
  const parameters = segmentIntersectionParameters(a, b, c, d, tolerance);
  if (!parameters) return null;
  const point = pointAt(a, b, parameters.left);
  const touching = parameters.left <= tolerance || parameters.left >= 1 - tolerance
    || parameters.right <= tolerance || parameters.right >= 1 - tolerance;
  return { kind: touching ? 'touching' : 'crossing', point: cleanPoint(point) };
}

function segmentIntersectionParameters(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
  tolerance: number,
): { left: number; right: number } | null {
  const r: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const s: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross(r, s);
  const offset: Vec2 = [c[0] - a[0], c[1] - a[1]];
  if (Math.abs(denominator) <= tolerance) return null;
  const t = cross(offset, s) / denominator;
  const u = cross(offset, r) / denominator;
  if (t < -tolerance || t > 1 + tolerance || u < -tolerance || u > 1 + tolerance) return null;
  return { left: Math.max(0, Math.min(1, t)), right: Math.max(0, Math.min(1, u)) };
}

function pointAt(start: Vec2, end: Vec2, parameter: number): Vec2 {
  return cleanPoint([
    start[0] + (end[0] - start[0]) * parameter,
    start[1] + (end[1] - start[1]) * parameter,
  ]);
}

function geometryBounds(node: GeometryNode): SpatialBounds2D {
  if (node.type === 'point') return pointsBounds([[node.x, node.y]]);
  if (node.type === 'line') return pointsBounds([node.start, node.end]);
  if (node.type === 'ray' || node.type === 'xline') return pointsBounds([node.origin]);
  if (node.type === 'circle' || node.type === 'arc') return {
    minX: node.center[0] - node.radius, minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius, maxY: node.center[1] + node.radius,
  };
  if (node.type === 'ellipse') {
    const radius = Math.hypot(...node.majorAxis);
    return { minX: node.center[0] - radius, minY: node.center[1] - radius, maxX: node.center[0] + radius, maxY: node.center[1] + radius };
  }
  if (node.type === 'polyline') return pointsBounds(node.vertices.map(({ point }) => point));
  return pointsBounds(node.controlPoints);
}

function pointsBounds(points: Vec2[]): SpatialBounds2D {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)), maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function boundsIntersect(left: SpatialBounds2D, right: SpatialBounds2D): boolean {
  return left.minX <= right.maxX && left.maxX >= right.minX
    && left.minY <= right.maxY && left.maxY >= right.minY;
}

function parseContinuation(token: string | undefined, scopeDigest: string): number {
  if (!token) return 0;
  const prefix = `world:${scopeDigest}:`;
  if (!token.startsWith(prefix)) throw new Error('WORLD_MODEL_CONTINUATION_INVALID');
  const offset = Number(token.slice(prefix.length));
  if (!Number.isInteger(offset) || offset < 0) throw new Error('WORLD_MODEL_CONTINUATION_INVALID');
  return offset;
}

function unionSpatialBounds(bounds: SpatialBounds2D[]): SpatialBounds2D | undefined {
  if (bounds.length === 0) return undefined;
  return {
    minX: Math.min(...bounds.map((item) => item.minX)),
    minY: Math.min(...bounds.map((item) => item.minY)),
    maxX: Math.max(...bounds.map((item) => item.maxX)),
    maxY: Math.max(...bounds.map((item) => item.maxY)),
  };
}

function stableId(ports: WorldModelCompilerPorts, kind: string, value: unknown): string {
  return `${kind}_${ports.digest(stableStringify(value)).replace(/^sha256:/, '').slice(0, 24)}`;
}

function portableDigest(value: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 3266489917) >>> 0;
  }
  return `sha256:${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function integer(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error('WORLD_MODEL_REQUEST_INVALID');
  return value;
}

function positive(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) throw new Error('WORLD_MODEL_REQUEST_INVALID');
  return value;
}

function quantize(point: Vec2, tolerance: number): Vec2 {
  return [Math.round(point[0] / tolerance) * tolerance, Math.round(point[1] / tolerance) * tolerance];
}

function cleanPoint(point: Vec2): Vec2 {
  return [Number(point[0].toFixed(12)), Number(point[1].toFixed(12))];
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}
