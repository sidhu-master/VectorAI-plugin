import type {
  Bounds2D,
  DrawingId,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';

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
  bounds?: Bounds2D;
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
  bounds: Bounds2D;
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
  bounds: Bounds2D;
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
  scopeBounds?: Bounds2D;
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
