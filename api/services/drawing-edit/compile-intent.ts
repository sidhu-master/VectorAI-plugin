import type {
  EditIntent,
  SpatialTransform,
} from '../../../src/contracts/drawing-spatial-agent.js';
import {
  compileDrawingScene,
  type Bounds2D,
  type DrawingCommand,
  type DrawingDocument,
  type EvidenceId,
  type GeometryNode,
  type RevisionId,
  type Vec2,
} from '../../../src/drawing/index.js';
import type {
  CompileEditIntentContext,
  CompiledEditCandidate,
} from './strategy-types.js';

export function compileEditIntent(
  intent: EditIntent,
  context: CompileEditIntentContext,
): CompiledEditCandidate {
  const targets = intent.targetNodeIds.map((id) => {
    const node = context.document.geometry.find((item) => item.id === id);
    if (!node) throw new Error(`EDIT_TARGET_NOT_GEOMETRY:${id}`);
    return node;
  });
  const preserveNodeIds = [...new Set([
    ...intent.preserveNodeIds,
    ...outsideTargetIds(intent, context.document),
  ])].filter((id) => !intent.targetNodeIds.includes(id));
  const allowedBounds = editBounds(context.document, intent, context.anchorTolerance ?? 5);
  if (intent.operation === 'transform') {
    if (!intent.transform) throw new Error('EDIT_TRANSFORM_REQUIRED');
    return candidate(intent, preserveNodeIds, allowedBounds, 'exact-transform',
      targets.map((node) => transformCommand(node, intent.transform!)));
  }
  if (intent.operation === 'deform') {
    const candidates = requireCandidates(context.candidateGeometry);
    const byId = new Map(candidates.map((node) => [node.id, node]));
    const commands = targets.map((node) => {
      const replacement = byId.get(node.id);
      if (!replacement || replacement.type !== node.type) {
        throw new Error(`EDIT_DEFORM_CANDIDATE_MISSING:${node.id}`);
      }
      if (!geometryInsideBounds(replacement, context.document, allowedBounds)) {
        throw new Error(`EDIT_DEFORM_OUTSIDE_ALLOWED_BOUNDS:${node.id}`);
      }
      return updateCommand(node, withIntentQuality(replacement, intent));
    });
    return candidate(intent, preserveNodeIds, allowedBounds, 'bounded-deform', commands);
  }
  const replacements = requireCandidates(context.candidateGeometry).map((node) => structuredClone(node));
  assertNoCandidateCollisions(context.document, intent.targetNodeIds, replacements);
  snapAnchors(replacements, intent, context.anchorTolerance ?? 5);
  const commands: DrawingCommand[] = [
    ...targets.map((node): DrawingCommand => ({ type: 'geometry.delete', id: node.id })),
    ...replacements.map((node): DrawingCommand => ({
      type: 'geometry.create',
      value: withIntentQuality(node, intent),
    })),
  ];
  return candidate(intent, preserveNodeIds, allowedBounds, 'local-replacement', commands);
}

function candidate(
  intent: EditIntent,
  preserveNodeIds: string[],
  allowedBounds: Bounds2D,
  strategy: CompiledEditCandidate['strategy'],
  commands: DrawingCommand[],
): CompiledEditCandidate {
  return {
    intent: structuredClone(intent),
    commands,
    targetNodeIds: [...intent.targetNodeIds],
    preserveNodeIds,
    allowedBounds,
    strategy,
  };
}

function transformCommand(node: GeometryNode, transform: SpatialTransform): DrawingCommand {
  const transformed = transformGeometry(node, transform);
  return updateCommand(node, transformed);
}

function updateCommand(before: GeometryNode, after: GeometryNode): DrawingCommand {
  const changes: Record<string, unknown> = {};
  const expected: Record<string, unknown> = {};
  for (const key of geometryPropertyKeys(before)) {
    const oldValue = (before as unknown as Record<string, unknown>)[key];
    const nextValue = (after as unknown as Record<string, unknown>)[key];
    if (deepEqual(oldValue, nextValue)) continue;
    changes[key] = structuredClone(nextValue);
    expected[key] = structuredClone(oldValue);
  }
  return {
    type: 'geometry.update',
    id: before.id,
    changes,
    expected,
  };
}

function transformGeometry(node: GeometryNode, transform: SpatialTransform): GeometryNode {
  const clone = structuredClone(node);
  const movePoint = (point: Vec2) => transformPoint(point, transform);
  const moveVector = (vector: Vec2) => transformVector(vector, transform);
  switch (clone.type) {
    case 'point': {
      const moved = movePoint([clone.x, clone.y]);
      clone.x = moved[0]; clone.y = moved[1];
      break;
    }
    case 'line': clone.start = movePoint(clone.start); clone.end = movePoint(clone.end); break;
    case 'ray':
    case 'xline':
      clone.origin = movePoint(clone.origin);
      clone.direction = moveVector(clone.direction);
      break;
    case 'circle':
      clone.center = movePoint(clone.center);
      if (transform.kind === 'scale') clone.radius = clean(clone.radius * transform.factor);
      break;
    case 'arc':
      clone.center = movePoint(clone.center);
      if (transform.kind === 'scale') clone.radius = clean(clone.radius * transform.factor);
      if (transform.kind === 'rotate') {
        clone.startAngle = clean(clone.startAngle + transform.angleDegrees);
        clone.endAngle = clean(clone.endAngle + transform.angleDegrees);
      }
      break;
    case 'ellipse':
      clone.center = movePoint(clone.center);
      clone.majorAxis = moveVector(clone.majorAxis);
      break;
    case 'polyline':
      clone.vertices = clone.vertices.map((vertex) => ({ ...vertex, point: movePoint(vertex.point) }));
      break;
    case 'spline': clone.controlPoints = clone.controlPoints.map(movePoint); break;
  }
  return clone;
}

function transformPoint(point: Vec2, transform: SpatialTransform): Vec2 {
  if (transform.kind === 'translate') {
    return [clean(point[0] + transform.offset[0]), clean(point[1] + transform.offset[1])];
  }
  const center = transform.center;
  const x = point[0] - center[0];
  const y = point[1] - center[1];
  if (transform.kind === 'scale') {
    return [clean(center[0] + x * transform.factor), clean(center[1] + y * transform.factor)];
  }
  const radians = transform.angleDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    clean(center[0] + x * cosine - y * sine),
    clean(center[1] + x * sine + y * cosine),
  ];
}

function transformVector(vector: Vec2, transform: SpatialTransform): Vec2 {
  if (transform.kind === 'translate') return [...vector];
  if (transform.kind === 'scale') {
    return [clean(vector[0] * transform.factor), clean(vector[1] * transform.factor)];
  }
  const radians = transform.angleDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    clean(vector[0] * cosine - vector[1] * sine),
    clean(vector[0] * sine + vector[1] * cosine),
  ];
}

function snapAnchors(
  candidates: GeometryNode[],
  intent: EditIntent,
  tolerance: number,
): void {
  for (const anchor of intent.anchors) {
    if (!anchor.point) continue;
    const points = candidates.flatMap(editablePoints);
    const nearest = points.reduce<EditablePoint | null>((best, current) => {
      const distance = Math.hypot(
        current.get()[0] - anchor.point![0],
        current.get()[1] - anchor.point![1],
      );
      return !best || distance < best.distance ? { ...current, distance } : best;
    }, null);
    if (!nearest || nearest.distance > tolerance) {
      throw new Error(`EDIT_ANCHOR_UNSNAPPABLE:${anchor.nodeId}:${anchor.role}`);
    }
    nearest.set(anchor.point);
  }
}

interface EditablePoint {
  get: () => Vec2;
  set: (point: Vec2) => void;
  distance: number;
}

function editablePoints(node: GeometryNode): EditablePoint[] {
  const point = (get: () => Vec2, set: (value: Vec2) => void): EditablePoint => ({
    get, set, distance: Number.POSITIVE_INFINITY,
  });
  switch (node.type) {
    case 'point': return [point(() => [node.x, node.y], (value) => {
      node.x = value[0]; node.y = value[1];
    })];
    case 'line': return [
      point(() => node.start, (value) => { node.start = value; }),
      point(() => node.end, (value) => { node.end = value; }),
    ];
    case 'ray':
    case 'xline': return [point(() => node.origin, (value) => { node.origin = value; })];
    case 'circle':
    case 'arc':
    case 'ellipse': return [point(() => node.center, (value) => { node.center = value; })];
    case 'polyline': return node.vertices.map((vertex) => (
      point(() => vertex.point, (value) => { vertex.point = value; })
    ));
    case 'spline': return node.controlPoints.map((_value, index) => (
      point(() => node.controlPoints[index], (value) => { node.controlPoints[index] = value; })
    ));
  }
}

function withIntentQuality(node: GeometryNode, intent: EditIntent): GeometryNode {
  const clone = structuredClone(node);
  clone.quality = intent.confidence < 0.6
    ? {
        status: 'candidate', confidence: intent.confidence,
        evidenceRefs: intent.evidenceRefs as EvidenceId[],
      }
    : { status: 'confirmed', evidenceRefs: intent.evidenceRefs as EvidenceId[] };
  return clone;
}

function assertNoCandidateCollisions(
  document: DrawingDocument,
  targetNodeIds: readonly string[],
  candidates: readonly GeometryNode[],
): void {
  const allowedReplacement = new Set(targetNodeIds);
  const existing = new Set(document.geometry.map((node) => node.id));
  for (const node of candidates) {
    if (existing.has(node.id) && !allowedReplacement.has(node.id)) {
      throw new Error(`EDIT_CANDIDATE_ID_COLLISION:${node.id}`);
    }
  }
  if (new Set(candidates.map((node) => node.id)).size !== candidates.length) {
    throw new Error('EDIT_CANDIDATE_ID_DUPLICATE');
  }
}

function requireCandidates(candidates: GeometryNode[] | undefined): GeometryNode[] {
  if (!candidates || candidates.length === 0) throw new Error('EDIT_CANDIDATE_GEOMETRY_REQUIRED');
  return candidates;
}

function outsideTargetIds(intent: EditIntent, document: DrawingDocument): string[] {
  if (!intent.preserveRules.some((rule) => rule.type === 'outside-target-unchanged')) return [];
  const targets = new Set(intent.targetNodeIds);
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => node.id).filter((id) => !targets.has(id));
}

function editBounds(document: DrawingDocument, intent: EditIntent, padding: number): Bounds2D {
  const scene = compileDrawingScene(document, {
    revision: 'revision_edit_bounds' as RevisionId,
  });
  const bounds = intent.targetNodeIds
    .map((id) => scene.nodeIndex[id]?.worldBounds)
    .filter((item): item is Bounds2D => Boolean(item));
  for (const anchor of intent.anchors) {
    if (!anchor.point) continue;
    bounds.push({
      minX: anchor.point[0], minY: anchor.point[1],
      maxX: anchor.point[0], maxY: anchor.point[1],
    });
  }
  if (bounds.length === 0) throw new Error('EDIT_TARGET_BOUNDS_MISSING');
  return {
    minX: Math.min(...bounds.map((item) => item.minX)) - padding,
    minY: Math.min(...bounds.map((item) => item.minY)) - padding,
    maxX: Math.max(...bounds.map((item) => item.maxX)) + padding,
    maxY: Math.max(...bounds.map((item) => item.maxY)) + padding,
  };
}

function geometryInsideBounds(
  node: GeometryNode,
  document: DrawingDocument,
  allowed: Bounds2D,
): boolean {
  const scene = compileDrawingScene({ ...document, geometry: [node] }, {
    revision: 'revision_edit_candidate_bounds' as RevisionId,
    viewBounds: allowed,
  });
  const bounds = scene.nodeIndex[node.id]?.worldBounds;
  return Boolean(bounds
    && bounds.minX >= allowed.minX
    && bounds.minY >= allowed.minY
    && bounds.maxX <= allowed.maxX
    && bounds.maxY <= allowed.maxY);
}

function geometryPropertyKeys(node: GeometryNode): string[] {
  return Object.keys(node).filter((key) => !['id', 'type', 'visible', 'quality'].includes(key));
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clean(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10));
}
