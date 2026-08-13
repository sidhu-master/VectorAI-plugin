import { createHash } from 'node:crypto';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import type {
  SemanticEntityHypothesis,
  TaskRelevantView,
  TaskSemanticRelation,
} from './types.js';

export function createTaskRelevantView(input: {
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  goalDigest: string;
  hypotheses: SemanticEntityHypothesis[];
  entityIds: string[];
  relations: TaskSemanticRelation[];
  abstraction: TaskRelevantView['abstraction'];
  evidenceRefs: string[];
}): TaskRelevantView {
  if (!input.episodeId || !input.goalDigest) throw new Error('TASK_VIEW_INVALID_SCOPE');
  const byId = new Map(input.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis]));
  const entityIds = [...new Set(input.entityIds)];
  const entities = entityIds.map((entityId) => {
    const hypothesis = byId.get(entityId);
    if (!hypothesis) throw new Error(`TASK_VIEW_ENTITY_MISSING: ${entityId}`);
    if (hypothesis.drawingId !== input.drawingId || hypothesis.revision !== input.revision) {
      throw new Error(`TASK_VIEW_SCOPE_MISMATCH: ${entityId}`);
    }
    return structuredClone(hypothesis);
  });
  const selectedIds = new Set(entityIds);
  const relations = input.relations.map((relation) => {
    if (!selectedIds.has(relation.from) || !selectedIds.has(relation.to)) {
      throw new Error(`TASK_VIEW_DANGLING_RELATION: ${relation.from} -> ${relation.to}`);
    }
    if (!Number.isFinite(relation.confidence)
      || relation.confidence < 0
      || relation.confidence > 1) {
      throw new Error('TASK_VIEW_RELATION_CONFIDENCE_INVALID');
    }
    return structuredClone(relation);
  });
  const evidenceRefs = [...new Set([
    ...input.evidenceRefs,
    ...relations.flatMap((relation) => relation.evidenceRefs),
    ...entities.flatMap((entity) => entity.provenance.evidenceRefs),
  ])];
  const evidenceDigest = digest({
    goalDigest: input.goalDigest,
    entityIds,
    relations,
    evidenceRefs,
  });
  return {
    id: `task_view_${evidenceDigest.slice(7, 31)}`,
    episodeId: input.episodeId,
    drawingId: input.drawingId,
    revision: input.revision,
    goalDigest: input.goalDigest,
    entities,
    relations,
    abstraction: input.abstraction,
    evidenceRefs,
    evidenceDigest,
  };
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
