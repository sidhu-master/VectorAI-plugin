import type { SemanticSupport } from '../drawing-grounding/index.js';
import type { GroundCandidateInput } from './tool-inputs.js';
import type { WorldModelSlice } from './types.js';

export function summarizeWorld(world: WorldModelSlice, includeSamples: boolean) {
  return {
    drawingId: world.drawingId,
    revision: world.revision,
    compilerVersion: world.compilerVersion,
    inputDigest: world.inputDigest,
    frameId: world.frameId,
    ...(world.scopeBounds ? { scopeBounds: world.scopeBounds } : {}),
    knowledge: world.knowledge,
    ...(world.continuationToken ? { continuationToken: world.continuationToken } : {}),
    counts: {
      sourceSpans: world.sourceSpans.length,
      vertices: world.vertices.length,
      halfEdges: world.halfEdges.length,
      faces: world.faces.length,
      incidenceEdges: world.incidenceEdges.length,
      connectedEdges: world.connectedEdges.length,
    },
    sourceSpans: world.sourceSpans.map((span) => ({
      id: span.id,
      sourceNodeId: span.sourceNodeId,
      parameterRange: span.parameterRange,
      halfEdgeIds: span.halfEdgeIds,
      derivation: span.derivation,
      bounds: span.bounds,
      ...(includeSamples ? { samples: span.samples } : {}),
    })),
    vertices: world.vertices,
    halfEdges: world.halfEdges,
    faces: world.faces,
    incidenceEdges: world.incidenceEdges,
    connectedEdges: world.connectedEdges,
    diagnostics: world.diagnostics,
  };
}

export function inspectReferences(world: WorldModelSlice, refs: string[], includeSamples: boolean): {
  entities: unknown[];
  missingRefs: string[];
  nodeIds: string[];
} {
  const byRef = referenceEntities(world, includeSamples);
  const entities = refs.flatMap((ref) => byRef.get(ref) ?? []);
  const missingRefs = refs.filter((ref) => !byRef.has(ref));
  const nodeIdsValue = unique(entities.flatMap((entity) => {
    const record = entity as { nodeId?: string; sourceNodeId?: string; nodeIds?: string[] };
    return record.nodeIds ?? [record.nodeId, record.sourceNodeId]
      .filter((id): id is string => Boolean(id));
  })).sort();
  return { entities, missingRefs, nodeIds: nodeIdsValue };
}

export function referenceEntities(
  world: WorldModelSlice,
  includeSamples: boolean,
): Map<string, unknown[]> {
  const result = new Map<string, unknown[]>();
  const spans = new Map(world.sourceSpans.map((span) => [span.id, span]));
  const add = (ref: string, entity: unknown) => result.set(ref, [structuredClone(entity)]);
  for (const span of world.sourceSpans) {
    const spanEntity: Record<string, unknown> = {
      kind: 'source-span', ...span,
    };
    if (!includeSamples) delete spanEntity.samples;
    add(span.id, spanEntity);
    const nodeEntity = {
      kind: 'node', nodeId: span.sourceNodeId,
      sourceSpanIds: world.sourceSpans
        .filter((item) => item.sourceNodeId === span.sourceNodeId)
        .map((item) => item.id),
    };
    add(span.sourceNodeId, nodeEntity);
    add(`node:${span.sourceNodeId}`, nodeEntity);
  }
  for (const halfEdge of world.halfEdges) {
    const span = spans.get(halfEdge.sourceSpanId);
    add(halfEdge.id, { kind: 'half-edge', ...halfEdge, sourceNodeId: span?.sourceNodeId });
  }
  for (const vertex of world.vertices) add(vertex.id, { kind: 'vertex', ...vertex });
  for (const face of world.faces) add(face.id, { kind: 'face', ...face });
  for (const edge of world.incidenceEdges) add(edge.id, { kind: 'incidence', ...edge });
  for (const edge of world.connectedEdges) add(edge.id, { kind: 'connection', ...edge });
  return result;
}

export function validateGroundingReferences(
  world: WorldModelSlice,
  candidates: GroundCandidateInput[],
): string[] {
  const refs = semanticReferenceKinds(world);
  const allRefs = referenceEntities(world, false);
  return unique(candidates.flatMap((candidate) => [
    ...candidate.supports
      .filter((support) => refs.get(support.ref) !== support.kind)
      .map((support) => support.ref),
    ...[...candidate.excludedSupports, ...candidate.interfaceRefs]
      .filter((ref) => !allRefs.has(ref)),
  ]));
}

export function unresolvedSupportsAcrossSlices(
  worlds: WorldModelSlice[],
  supports: SemanticSupport[],
): string[] {
  return supports
    .filter((support) => !worlds.some((world) => (
      semanticReferenceKinds(world).get(support.ref) === support.kind
    )))
    .map((support) => support.ref);
}

export function groundedNodeIds(
  world: WorldModelSlice,
  candidates: GroundCandidateInput[],
): string[] {
  return supportsToNodeIds([world], candidates.flatMap((candidate) => candidate.supports));
}

export function supportsToNodeIds(
  worlds: WorldModelSlice[],
  supports: SemanticSupport[],
): string[] {
  const ids = supports.flatMap((support) => worlds.flatMap((world) => {
    if (support.kind === 'node') return [support.ref.replace(/^node:/, '')];
    if (support.kind === 'source-span') {
      return world.sourceSpans.filter((span) => span.id === support.ref).map((span) => span.sourceNodeId);
    }
    if (support.kind === 'half-edge') {
      const edge = world.halfEdges.find((item) => item.id === support.ref);
      const span = edge && world.sourceSpans.find((item) => item.id === edge.sourceSpanId);
      return span ? [span.sourceNodeId] : [];
    }
    if (support.kind === 'face') {
      const face = world.faces.find((item) => item.id === support.ref);
      if (!face) return [];
      return face.outerHalfEdgeIds.flatMap((edgeId) => {
        const edge = world.halfEdges.find((item) => item.id === edgeId);
        const span = edge && world.sourceSpans.find((item) => item.id === edge.sourceSpanId);
        return span ? [span.sourceNodeId] : [];
      });
    }
    return [];
  }));
  return unique(ids).sort();
}

export function nodeIds(world: WorldModelSlice): string[] {
  return unique(world.sourceSpans.map((span) => span.sourceNodeId)).sort();
}

function semanticReferenceKinds(world: WorldModelSlice): Map<string, SemanticSupport['kind']> {
  const result = new Map<string, SemanticSupport['kind']>();
  for (const span of world.sourceSpans) {
    result.set(span.sourceNodeId, 'node');
    result.set(`node:${span.sourceNodeId}`, 'node');
    result.set(span.id, 'source-span');
  }
  for (const halfEdge of world.halfEdges) result.set(halfEdge.id, 'half-edge');
  for (const face of world.faces) result.set(face.id, 'face');
  return result;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
