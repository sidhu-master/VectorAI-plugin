import type {
  DrawingAgentCanvasOverlay,
  DrawingAgentSpatialMarker,
  DrawingAgentSpatialStroke,
  DrawingAgentSpatialVector,
} from '../../../src/contracts/drawing-agent.js';
import type {
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type {
  SemanticEntityHypothesis,
  SemanticSupport,
} from '../drawing-grounding/types.js';
import type {
  ArrangementHalfEdge,
  SourceSpan,
  WorldModelSlice,
} from '../drawing-world-model/types.js';
import {
  roughGeometryBounds,
  sampleGeometryRanges,
} from '../drawing-spatial/geometry-sampling.js';

const MAX_STROKES = 96;
const MAX_MARKERS = 96;
const MAX_VECTORS = 96;
const MAX_SAMPLES_PER_STROKE = 96;

export function projectGroundingFrame(input: {
  world: WorldModelSlice;
  candidates: SemanticEntityHypothesis[];
  selectedCandidateIds: string[];
}): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> {
  const selectedIds = new Set(input.selectedCandidateIds);
  const selected = input.candidates.filter((candidate) => selectedIds.has(candidate.id));
  const candidates = selected.length > 0 ? selected : input.candidates;
  const strokes: DrawingAgentSpatialStroke[] = [];
  const markers: DrawingAgentSpatialMarker[] = [];

  for (const candidate of candidates) {
    for (const support of candidate.supports) {
      strokes.push(...projectSupport(input.world, support, candidate.confidence));
    }
    for (const ref of candidate.excludedSupports) {
      strokes.push(...projectRef(input.world, ref, 'excluded'));
    }
    for (const ref of candidate.interfaceRefs) {
      markers.push(...projectInterface(input.world, ref));
    }
  }

  const uniqueStrokeList = uniqueStrokes(strokes);
  const uniqueMarkerList = uniqueMarkers(markers);
  const boundedStrokes = uniqueStrokeList.slice(0, MAX_STROKES);
  const boundedMarkers = uniqueMarkerList.slice(0, MAX_MARKERS);
  const truncated = uniqueStrokeList.length > boundedStrokes.length
    || uniqueMarkerList.length > boundedMarkers.length;
  return {
    kind: 'spatial',
    phase: 'grounding',
    ...(candidates[0]?.label ? { label: candidates[0].label } : {}),
    strokes: boundedStrokes,
    markers: boundedMarkers,
    vectors: [],
    ...(truncated ? { truncated: true } : {}),
  };
}

export function projectActionFrame(input: {
  world: WorldModelSlice;
  targetRefs: string[];
  preserveRefs: string[];
  interfaceRefs: string[];
  label?: string;
}): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> {
  const strokes = uniqueStrokes([
    ...input.targetRefs.flatMap((ref) => projectRef(input.world, ref, 'target')),
    ...input.preserveRefs.flatMap((ref) => projectRef(input.world, ref, 'context')),
  ]);
  const markers = uniqueMarkers(input.interfaceRefs.flatMap((ref) => (
    projectInterface(input.world, ref)
  )));
  return {
    kind: 'spatial',
    phase: 'planning',
    ...(input.label ? { label: input.label } : {}),
    strokes: strokes.slice(0, MAX_STROKES),
    markers: markers.slice(0, MAX_MARKERS),
    vectors: [],
    ...(strokes.length > MAX_STROKES || markers.length > MAX_MARKERS
      ? { truncated: true }
      : {}),
  };
}

export function mergeSpatialFrames(
  frames: Array<Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }>>,
  overrides: Partial<Pick<
    Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }>,
    'phase' | 'label'
  >> = {},
): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> {
  const strokes = uniqueStrokes(frames.flatMap((frame) => frame.strokes));
  const markers = uniqueMarkers(frames.flatMap((frame) => frame.markers));
  const vectors = uniqueVectors(frames.flatMap((frame) => frame.vectors));
  return {
    kind: 'spatial',
    phase: overrides.phase ?? frames.at(-1)?.phase ?? 'observing',
    ...(overrides.label ?? frames.at(-1)?.label
      ? { label: overrides.label ?? frames.at(-1)!.label }
      : {}),
    strokes: strokes.slice(0, MAX_STROKES),
    markers: markers.slice(0, MAX_MARKERS),
    vectors: vectors.slice(0, MAX_VECTORS),
    ...(frames.some((frame) => frame.truncated)
      || strokes.length > MAX_STROKES
      || markers.length > MAX_MARKERS
      || vectors.length > MAX_VECTORS
      ? { truncated: true }
      : {}),
  };
}

/**
 * Projects a tool's already-resolved intent against the canonical document.
 * This frame is deliberately computed locally so the canvas can react before
 * a potentially slow model or geometry tool has finished.
 */
export function projectDocumentIntentFrame(input: {
  document: DrawingDocument;
  nodeIds: string[];
  label?: string;
  strokes?: DrawingAgentSpatialStroke[];
  markers?: DrawingAgentSpatialMarker[];
  motions?: Array<{ id: string; nodeId: string; from?: Vec2; to: Vec2 }>;
}): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> {
  const nodesById = new Map(input.document.geometry.map((node) => [node.id as string, node]));
  const strokes = uniqueStrokes([
    ...[...new Set(input.nodeIds)]
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is GeometryNode => Boolean(node))
      .map((node) => nodeStroke(node, 'target')),
    ...(input.strokes ?? []).map((stroke) => ({
      ...stroke,
      points: boundedPoints(stroke.points),
    })),
  ]);
  const markers = uniqueMarkers((input.markers ?? []).map((item) => ({
    ...item,
    point: [...item.point],
  })));
  const vectors = uniqueVectors((input.motions ?? []).flatMap((motion) => {
    const node = nodesById.get(motion.nodeId);
    const from = motion.from ?? (node ? geometryCenter(node) : null);
    if (!from || samePoint(from, motion.to)) return [];
    return [{
      id: motion.id,
      role: 'motion' as const,
      from: [...from] as Vec2,
      to: [...motion.to] as Vec2,
    }];
  }));
  return {
    kind: 'spatial',
    phase: 'planning',
    ...(input.label ? { label: input.label } : {}),
    strokes: strokes.slice(0, MAX_STROKES),
    markers: markers.slice(0, MAX_MARKERS),
    vectors: vectors.slice(0, MAX_VECTORS),
    ...(strokes.length > MAX_STROKES
      || markers.length > MAX_MARKERS
      || vectors.length > MAX_VECTORS
      ? { truncated: true }
      : {}),
  };
}

export function projectDrawingDeltaFrame(input: {
  before: DrawingDocument;
  after: DrawingDocument;
  changedNodeIds: string[];
  phase: 'previewing' | 'verifying';
  label?: string;
  markers?: DrawingAgentSpatialMarker[];
}): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> {
  const beforeById = new Map(input.before.geometry.map((node) => [node.id as string, node]));
  const afterById = new Map(input.after.geometry.map((node) => [node.id as string, node]));
  const strokes: DrawingAgentSpatialStroke[] = [];
  const vectors: DrawingAgentSpatialVector[] = [];
  for (const nodeId of [...new Set(input.changedNodeIds)]) {
    const before = beforeById.get(nodeId);
    const after = afterById.get(nodeId);
    if (before) strokes.push(nodeStroke(before, 'before'));
    if (after) strokes.push(nodeStroke(after, 'after'));
    const beforeCenter = before ? geometryCenter(before) : null;
    const afterCenter = after ? geometryCenter(after) : null;
    if (beforeCenter && afterCenter && !samePoint(beforeCenter, afterCenter)) {
      vectors.push({
        id: `motion:${nodeId}`,
        role: 'motion',
        from: beforeCenter,
        to: afterCenter,
      });
    }
  }
  const boundedStrokes = strokes.slice(0, MAX_STROKES);
  const markers = uniqueMarkers(input.markers ?? []).slice(0, MAX_MARKERS);
  const boundedVectors = vectors.slice(0, MAX_VECTORS);
  const truncated = boundedStrokes.length < strokes.length
    || markers.length < (input.markers?.length ?? 0)
    || boundedVectors.length < vectors.length;
  return {
    kind: 'spatial',
    phase: input.phase,
    ...(input.label ? { label: input.label } : {}),
    strokes: boundedStrokes,
    markers,
    vectors: boundedVectors,
    ...(truncated ? { truncated: true } : {}),
  };
}

function projectSupport(
  world: WorldModelSlice,
  support: SemanticSupport,
  confidence: number,
): DrawingAgentSpatialStroke[] {
  const role = support.role === 'interior' ? 'target' : support.role;
  return projectRef(world, support.ref, role).map((stroke) => ({
    ...stroke,
    confidence: Math.min(confidence, support.weight),
  }));
}

function projectRef(
  world: WorldModelSlice,
  ref: string,
  role: DrawingAgentSpatialStroke['role'],
): DrawingAgentSpatialStroke[] {
  const nodeId = ref.startsWith('node:') ? ref.slice('node:'.length) : ref;
  const nodeSpans = world.sourceSpans.filter((span) => span.sourceNodeId === nodeId);
  if (nodeSpans.length > 0) return nodeSpans.map((span) => spanStroke(span, role, ref));

  const span = world.sourceSpans.find((item) => item.id === ref);
  if (span) return [spanStroke(span, role, ref)];

  const halfEdge = world.halfEdges.find((item) => item.id === ref);
  if (halfEdge) {
    const halfEdgeSpan = world.sourceSpans.find((item) => item.id === halfEdge.sourceSpanId);
    return halfEdgeSpan ? [halfEdgeStroke(halfEdgeSpan, halfEdge, role, ref)] : [];
  }

  const face = world.faces.find((item) => item.id === ref);
  if (!face) return [];
  return face.outerHalfEdgeIds.flatMap((halfEdgeId) => projectRef(world, halfEdgeId, role));
}

function spanStroke(
  span: SourceSpan,
  role: DrawingAgentSpatialStroke['role'],
  ref: string,
): DrawingAgentSpatialStroke {
  return {
    id: `stroke:${role}:${ref}:${span.id}`,
    ref,
    nodeId: span.sourceNodeId,
    role,
    points: boundedPoints(span.samples),
    closed: isClosed(span.samples),
  };
}

function nodeStroke(
  node: GeometryNode,
  role: DrawingAgentSpatialStroke['role'],
): DrawingAgentSpatialStroke {
  const points = sampleNode(node);
  return {
    id: `stroke:${role}:node:${node.id}`,
    ref: `node:${node.id}`,
    nodeId: node.id,
    role,
    points: boundedPoints(points),
    closed: isClosed(points),
  };
}

function sampleNode(node: GeometryNode): Vec2[] {
  const localBounds = roughGeometryBounds(node) ?? {
    minX: -1_000, minY: -1_000, maxX: 1_000, maxY: 1_000,
  };
  const result: Vec2[] = [];
  for (const range of sampleGeometryRanges(node, { curveSamples: 64, localBounds })) {
    for (const point of range.samples) {
      if (!result.at(-1) || !samePoint(result.at(-1)!, point)) result.push([...point]);
    }
  }
  return result;
}

function geometryCenter(node: GeometryNode): Vec2 | null {
  const points = sampleNode(node);
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const maxY = Math.max(...points.map((point) => point[1]));
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function halfEdgeStroke(
  span: SourceSpan,
  halfEdge: ArrangementHalfEdge,
  role: DrawingAgentSpatialStroke['role'],
  ref: string,
): DrawingAgentSpatialStroke {
  const samples = halfEdge.direction === 'forward' ? span.samples : [...span.samples].reverse();
  return {
    ...spanStroke({ ...span, samples }, role, ref),
    id: `stroke:${role}:${ref}`,
  };
}

function projectInterface(world: WorldModelSlice, ref: string): DrawingAgentSpatialMarker[] {
  const vertex = world.vertices.find((item) => item.id === ref);
  if (vertex) return [marker(ref, vertex.point)];
  const incidence = world.incidenceEdges.find((item) => item.id === ref);
  if (incidence?.point) return [marker(ref, incidence.point)];
  const connection = world.connectedEdges.find((item) => item.id === ref);
  if (connection?.point) return [marker(ref, connection.point)];

  const strokes = projectRef(world, ref, 'interface');
  return strokes.flatMap((stroke) => {
    const first = stroke.points[0];
    const last = stroke.points.at(-1);
    return [first, last].filter((point, index): point is Vec2 => (
      Boolean(point) && (index === 0 || !samePoint(point!, first!))
    )).map((point, index) => marker(`${ref}:${index}`, point));
  });
}

function marker(ref: string, point: Vec2): DrawingAgentSpatialMarker {
  return { id: `marker:interface:${ref}`, ref, role: 'interface', point: [...point] };
}

function boundedPoints(points: Vec2[]): Vec2[] {
  if (points.length <= MAX_SAMPLES_PER_STROKE) return points.map((point) => [...point]);
  return Array.from({ length: MAX_SAMPLES_PER_STROKE }, (_, index) => (
    [...points[Math.round(index * (points.length - 1) / (MAX_SAMPLES_PER_STROKE - 1))]]
  ));
}

function uniqueStrokes(strokes: DrawingAgentSpatialStroke[]): DrawingAgentSpatialStroke[] {
  const seen = new Set<string>();
  return strokes.filter((stroke) => {
    const key = `${stroke.role}:${stroke.ref ?? stroke.id}:${stroke.nodeId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueMarkers(markers: DrawingAgentSpatialMarker[]): DrawingAgentSpatialMarker[] {
  const seen = new Set<string>();
  return markers.filter((item) => {
    const key = `${item.role}:${item.point[0]}:${item.point[1]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueVectors(vectors: DrawingAgentSpatialVector[]): DrawingAgentSpatialVector[] {
  const seen = new Set<string>();
  return vectors.filter((vector) => {
    const key = `${vector.role}:${vector.from.join(',')}:${vector.to.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isClosed(points: Vec2[]): boolean {
  return points.length > 2 && samePoint(points[0], points.at(-1)!);
}

function samePoint(left: Vec2, right: Vec2): boolean {
  return Math.hypot(left[0] - right[0], left[1] - right[1]) <= 1e-9;
}
