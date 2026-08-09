import { createHash } from 'node:crypto';

import type {
  ObservationSlot,
  SlotCandidateType,
  SlotEvidenceRef,
  SlotLineageAction,
  SlotObservationInput,
} from './types.js';

const CLOSED_PRIMITIVES = new Set(['circle', 'ellipse']);

export class MemoryObservationSlotStore {
  readonly #slots = new Map<string, ObservationSlot>();

  observe(
    input: SlotObservationInput,
    options: { preferredSlotId?: string } = {},
  ): ObservationSlot {
    validateObservation(input);
    if (options.preferredSlotId) {
      const current = this.#required(options.preferredSlotId);
      if (current.sourceId !== input.sourceId) throw new Error('SLOT_SOURCE_MISMATCH');
      if (!current.evidenceRefs.includes(input.evidence.handle)) {
        current.evidenceRefs.push(input.evidence.handle);
        current.evidence.push(structuredClone(input.evidence));
      }
      current.candidateTypes = mergeCandidateTypes(current.candidateTypes, input.candidateTypes);
      current.revision += 1;
      current.status = hasTypeConflict(current.candidateTypes) ? 'conflict' : 'candidate';
      current.lineage.push(lineage(current.revision, 'update'));
      return structuredClone(current);
    }

    const id = stableSlotId(input.sourceId, input.evidence.handle);
    const existing = this.#slots.get(id);
    if (existing) return structuredClone(existing);
    const slot: ObservationSlot = {
      id,
      sourceId: input.sourceId,
      evidenceRefs: [input.evidence.handle],
      evidence: [structuredClone(input.evidence)],
      candidateTypes: normalizeCandidateTypes(input.candidateTypes),
      drawingEntityIds: [],
      status: 'candidate',
      revision: 1,
      lineage: [lineage(1, 'create')],
    };
    this.#slots.set(id, slot);
    return structuredClone(slot);
  }

  confirm(id: string, options: { wholeObjectValidated?: boolean } = {}): ObservationSlot {
    const slot = this.#required(id);
    const leadingType = slot.candidateTypes[0]?.type;
    const onlyPartial = slot.evidence.every((item) => item.touchesRegionEdge);
    if (leadingType && CLOSED_PRIMITIVES.has(leadingType)
      && onlyPartial && !options.wholeObjectValidated) {
      throw new Error('SLOT_CLOSED_PRIMITIVE_PARTIAL');
    }
    slot.status = 'committed';
    slot.revision += 1;
    slot.lineage.push(lineage(slot.revision, 'update'));
    return structuredClone(slot);
  }

  recordDrawingChange(id: string, change: {
    action: Exclude<SlotLineageAction, 'merge' | 'split'>;
    removedDrawingEntityIds?: string[];
    addedDrawingEntityIds?: string[];
  }): ObservationSlot {
    const slot = this.#required(id);
    const removed = unique(change.removedDrawingEntityIds ?? []);
    const added = unique(change.addedDrawingEntityIds ?? []);
    slot.drawingEntityIds = unique([
      ...slot.drawingEntityIds.filter((entityId) => !removed.includes(entityId)),
      ...added,
    ]);
    slot.status = change.action === 'delete' || change.action === 'reject'
      ? 'rejected'
      : 'committed';
    slot.revision += 1;
    slot.lineage.push(lineage(slot.revision, change.action, [], removed, added));
    return structuredClone(slot);
  }

  merge(parentSlotIds: string[], input: Omit<SlotObservationInput, 'sourceId'>): ObservationSlot {
    if (parentSlotIds.length < 2) throw new Error('SLOT_MERGE_REQUIRES_MULTIPLE');
    const parents = unique(parentSlotIds).map((id) => this.#required(id));
    const sourceId = parents[0].sourceId;
    if (parents.some((slot) => slot.sourceId !== sourceId)) throw new Error('SLOT_SOURCE_MISMATCH');
    const merged = this.observe({ sourceId, ...input });
    const stored = this.#required(merged.id);
    stored.lineage[stored.lineage.length - 1] = lineage(
      stored.revision,
      'merge',
      parents.map((slot) => slot.id),
    );
    for (const parent of parents) parent.status = 'rejected';
    return structuredClone(stored);
  }

  split(parentSlotId: string, parts: Array<Omit<SlotObservationInput, 'sourceId'>>): ObservationSlot[] {
    if (parts.length < 2) throw new Error('SLOT_SPLIT_REQUIRES_MULTIPLE');
    const parent = this.#required(parentSlotId);
    const children = parts.map((part) => {
      const child = this.observe({ sourceId: parent.sourceId, ...part });
      const stored = this.#required(child.id);
      stored.lineage[stored.lineage.length - 1] = lineage(
        stored.revision,
        'split',
        [parent.id],
      );
      return structuredClone(stored);
    });
    parent.status = 'rejected';
    return children;
  }

  read(id: string): ObservationSlot {
    return structuredClone(this.#required(id));
  }

  list(sourceId?: string): ObservationSlot[] {
    return [...this.#slots.values()]
      .filter((slot) => sourceId === undefined || slot.sourceId === sourceId)
      .map((slot) => structuredClone(slot));
  }

  #required(id: string): ObservationSlot {
    const slot = this.#slots.get(id);
    if (!slot) throw new Error('OBSERVATION_SLOT_NOT_FOUND');
    return slot;
  }
}

function stableSlotId(sourceId: string, firstEvidenceHandle: string): string {
  return `slot_${createHash('sha256')
    .update(`${sourceId}\0${firstEvidenceHandle}`)
    .digest('hex')
    .slice(0, 24)}`;
}

function validateObservation(input: SlotObservationInput): void {
  if (!input.sourceId || !input.evidence.handle || input.candidateTypes.length === 0) {
    throw new Error('SLOT_OBSERVATION_INVALID');
  }
  if (!Number.isFinite(input.evidence.confidence)
    || input.evidence.confidence < 0 || input.evidence.confidence > 1) {
    throw new Error('SLOT_EVIDENCE_CONFIDENCE_INVALID');
  }
  for (const candidate of input.candidateTypes) {
    if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
      throw new Error('SLOT_CANDIDATE_SCORE_INVALID');
    }
  }
}

function normalizeCandidateTypes(types: SlotCandidateType[]): SlotCandidateType[] {
  return [...types]
    .sort((left, right) => right.score - left.score)
    .map((item) => ({ ...item }));
}

function mergeCandidateTypes(
  current: SlotCandidateType[],
  incoming: SlotCandidateType[],
): SlotCandidateType[] {
  const scores = new Map(current.map((item) => [item.type, item.score]));
  for (const item of incoming) scores.set(item.type, Math.max(scores.get(item.type) ?? 0, item.score));
  return normalizeCandidateTypes([...scores].map(([type, score]) => ({ type, score })));
}

function hasTypeConflict(types: SlotCandidateType[]): boolean {
  return types.length > 1 && types[0].score - types[1].score < 0.05;
}

function lineage(
  revision: number,
  action: SlotLineageAction,
  parentSlotIds: string[] = [],
  removedDrawingEntityIds: string[] = [],
  addedDrawingEntityIds: string[] = [],
) {
  return {
    revision,
    action,
    parentSlotIds: [...parentSlotIds],
    removedDrawingEntityIds: [...removedDrawingEntityIds],
    addedDrawingEntityIds: [...addedDrawingEntityIds],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
