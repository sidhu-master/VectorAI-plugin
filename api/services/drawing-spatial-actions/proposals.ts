import { createHash } from 'node:crypto';

import type { SourceSpan, WorldModelSlice } from '../drawing-world-model/types.js';
import type {
  SpatialActionMethod,
  SpatialActionProposal,
  SpatialActionProposalRequest,
  SpatialActionSplitRequirement,
} from './types.js';

const DEFAULT_METHODS: readonly SpatialActionMethod[] = [
  'transform', 'deform', 'solve', 'replace', 'redraw', 'hybrid', 'raw',
];

/**
 * Computes deterministic action affordances from already-resolved spatial facts.
 * It does not choose the semantic target, authorize a write, or mutate Drawing IR.
 */
export function proposeSpatialActions(
  request: SpatialActionProposalRequest,
): SpatialActionProposal[] {
  const methods = unique(request.methods ?? DEFAULT_METHODS);
  const refs = indexReferences(request.world);
  const resolvedTargets = request.targetRefs
    .map((ref) => refs.get(ref))
    .filter((value): value is ResolvedReference => Boolean(value));
  const unresolvedTargetRefs = request.targetRefs.filter((ref) => !refs.has(ref));
  const affectedNodeIds = unique(resolvedTargets.flatMap((target) => target.nodeIds)).sort();
  const targetSpans = uniqueBy(
    resolvedTargets.flatMap((target) => target.spans),
    (span) => span.id,
  );
  const requiredSplits = splitRequirements(targetSpans);

  return methods.map((method) => {
    const diagnostics: SpatialActionProposal['diagnostics'] = [];
    if (unresolvedTargetRefs.length > 0) {
      diagnostics.push({
        code: 'TARGET_REF_UNRESOLVED',
        refs: [...unresolvedTargetRefs],
        detail: 'Resolve only these target references before relying on this proposal.',
      });
    }
    if (requiredSplits.length > 0 && needsWholeSource(method)) {
      diagnostics.push({
        code: 'SOURCE_SPLIT_REQUIRED',
        refs: targetSpans
          .filter((span) => !isComplete(span.parameterRange))
          .map((span) => span.id),
        detail: 'The target is a SourceSpan fragment; keep the split virtual until a Preview needs it.',
      });
    }
    if (method === 'solve' && request.world.connectedEdges.length === 0) {
      diagnostics.push({
        code: 'METHOD_NEEDS_RELATIONS',
        refs: [...request.targetRefs],
        detail: 'No resolved connection relation is available in this slice.',
      });
    }
    const feasibility = unresolvedTargetRefs.length === request.targetRefs.length
      || request.targetRefs.length === 0
      ? 'unsupported'
      : unresolvedTargetRefs.length > 0
        || requiredSplits.length > 0 && needsWholeSource(method)
        || method === 'solve' && request.world.connectedEdges.length === 0
        ? 'ambiguous'
        : 'ready';
    return {
      id: stableId({
        revision: request.world.revision,
        inputDigest: request.world.inputDigest,
        goalDescription: request.goalDescription,
        method,
        targetRefs: request.targetRefs,
        preserveRefs: request.preserveRefs,
        interfaceRefs: request.interfaceRefs,
      }),
      method,
      feasibility,
      targetRefs: [...request.targetRefs],
      affectedNodeIds,
      preserveRefs: [...request.preserveRefs],
      fixedInterfaceRefs: [...request.interfaceRefs],
      requiredSplits: needsWholeSource(method) ? requiredSplits : [],
      diagnostics,
      estimatedCost: {
        modelDecisions: 1,
        geometryOperations: Math.max(1, affectedNodeIds.length),
        verificationScope: 'local',
      },
    } satisfies SpatialActionProposal;
  });
}

interface ResolvedReference {
  nodeIds: string[];
  spans: SourceSpan[];
}

function indexReferences(world: WorldModelSlice): Map<string, ResolvedReference> {
  const result = new Map<string, ResolvedReference>();
  const spans = new Map(world.sourceSpans.map((span) => [span.id, span]));
  const spansByNode = groupBy(world.sourceSpans, (span) => span.sourceNodeId);
  for (const [nodeId, nodeSpans] of spansByNode) {
    const value = { nodeIds: [nodeId], spans: nodeSpans };
    result.set(nodeId, value);
    result.set(`node:${nodeId}`, value);
  }
  for (const span of world.sourceSpans) {
    result.set(span.id, { nodeIds: [span.sourceNodeId], spans: [span] });
  }
  for (const halfEdge of world.halfEdges) {
    const span = spans.get(halfEdge.sourceSpanId);
    if (span) result.set(halfEdge.id, { nodeIds: [span.sourceNodeId], spans: [span] });
  }
  for (const vertex of world.vertices) {
    const vertexSpans = uniqueBy(vertex.incidentHalfEdgeIds.flatMap((halfEdgeId) => {
      const halfEdge = world.halfEdges.find((item) => item.id === halfEdgeId);
      const span = halfEdge ? spans.get(halfEdge.sourceSpanId) : undefined;
      return span ? [span] : [];
    }), (span) => span.id);
    result.set(vertex.id, {
      nodeIds: unique(vertexSpans.map((span) => span.sourceNodeId)),
      spans: vertexSpans,
    });
  }
  for (const face of world.faces) {
    const faceSpans = uniqueBy(face.outerHalfEdgeIds.flatMap((halfEdgeId) => {
      const halfEdge = world.halfEdges.find((item) => item.id === halfEdgeId);
      const span = halfEdge ? spans.get(halfEdge.sourceSpanId) : undefined;
      return span ? [span] : [];
    }), (span) => span.id);
    result.set(face.id, {
      nodeIds: unique(faceSpans.map((span) => span.sourceNodeId)),
      spans: faceSpans,
    });
  }
  return result;
}

function splitRequirements(spans: SourceSpan[]): SpatialActionSplitRequirement[] {
  return [...groupBy(
    spans.filter((span) => !isComplete(span.parameterRange)),
    (span) => span.sourceNodeId,
  )].map(([nodeId, nodeSpans]) => ({
    nodeId,
    parameterRanges: nodeSpans.map((span) => span.parameterRange),
  }));
}

function needsWholeSource(method: SpatialActionMethod): boolean {
  return method === 'transform' || method === 'deform' || method === 'solve';
}

function isComplete(range: readonly [number, number]): boolean {
  return Math.abs(range[0]) <= 1e-9 && Math.abs(range[1] - 1) <= 1e-9;
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    const group = result.get(groupKey) ?? [];
    group.push(value);
    result.set(groupKey, group);
  }
  return result;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const itemKey = key(value);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
}

function stableId(value: unknown): string {
  return `spatial_action_${createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 24)}`;
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
