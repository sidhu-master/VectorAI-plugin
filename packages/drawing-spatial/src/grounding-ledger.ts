// SPDX-License-Identifier: Apache-2.0

import type { DrawingId, RevisionId } from '@vectorai/drawing-core';

export type SemanticSupportKind = 'node' | 'source-span' | 'half-edge' | 'face';
export type SemanticSupportRole = 'interior' | 'boundary' | 'interface' | 'context';

export interface SemanticSupport {
  kind: SemanticSupportKind;
  ref: string;
  weight: number;
  role: SemanticSupportRole;
}

export interface GroundingProvenance {
  provider: string;
  evidenceRefs: string[];
  createdAt: number;
  modelCallId?: string;
  compilerVersion?: string;
  inputDigest?: string;
}

export interface SemanticEntityHypothesis {
  id: string;
  drawingId: DrawingId;
  revision: RevisionId;
  label: string;
  referringExpression: string;
  observationRefs: string[];
  regionRefs: string[];
  supports: SemanticSupport[];
  excludedSupports: string[];
  interfaceRefs: string[];
  confidence: number;
  provenance: GroundingProvenance;
  supersedes?: string[];
}

export type GroundingEvidenceEventKind =
  | 'proposed' | 'selected' | 'refined' | 'rejected' | 'superseded' | 'promoted';

export interface GroundingEvidenceEvent {
  id: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  hypothesisId: string;
  kind: GroundingEvidenceEventKind;
  hypothesis?: SemanticEntityHypothesis;
  evidenceRefs: string[];
  supportDelta?: { added: SemanticSupport[]; removed: string[] };
  confidence?: number;
  reasonCode: string;
  createdAt: number;
}

export type GroundingHypothesisStatus = 'active' | 'selected' | 'rejected' | 'superseded' | 'promoted';

export interface GroundingHypothesisState {
  hypothesisId: string;
  status: GroundingHypothesisStatus;
  hypothesis: SemanticEntityHypothesis;
  lastEventId: string;
  lastEventCursor: number;
}

export interface GroundingLedgerDelta {
  fromCursor: number;
  nextCursor: number;
  events: GroundingEvidenceEvent[];
  current: GroundingHypothesisState[];
}

export type TaskSemanticRelationKind =
  | 'part-of' | 'contains' | 'connected-to' | 'boundary-of' | 'interface-with' | 'context-for';

export interface TaskSemanticRelation {
  kind: TaskSemanticRelationKind;
  from: string;
  to: string;
  confidence: number;
  evidenceRefs: string[];
}

export interface TaskRelevantView {
  id: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  goalDigest: string;
  entities: SemanticEntityHypothesis[];
  relations: TaskSemanticRelation[];
  abstraction: 'detail' | 'part' | 'object' | 'region';
  evidenceRefs: string[];
  evidenceDigest: string;
}

export class GroundingLedger {
  readonly #episodeId: string;
  readonly #drawingId: DrawingId;
  readonly #revision: RevisionId;
  readonly #events: GroundingEvidenceEvent[] = [];
  readonly #eventIds = new Set<string>();
  readonly #current = new Map<string, GroundingHypothesisState>();

  constructor(input: { episodeId: string; drawingId: DrawingId; revision: RevisionId }) {
    this.#episodeId = input.episodeId;
    this.#drawingId = input.drawingId;
    this.#revision = input.revision;
  }

  append(event: GroundingEvidenceEvent): { cursor: number; event: GroundingEvidenceEvent } {
    this.#assertScope(event);
    if (this.#eventIds.has(event.id)) throw new Error(`GROUNDING_EVENT_DUPLICATE: ${event.id}`);
    const safeEvent = structuredClone(event);
    this.#validateEvent(safeEvent);
    const cursor = this.#events.length + 1;
    this.#events.push(safeEvent);
    this.#eventIds.add(safeEvent.id);
    this.#apply(safeEvent, cursor);
    return { cursor, event: structuredClone(safeEvent) };
  }

  current(hypothesisId: string): GroundingHypothesisState | undefined {
    const state = this.#current.get(hypothesisId);
    return state ? structuredClone(state) : undefined;
  }

  currentStates(input: { includeInactive?: boolean } = {}): GroundingHypothesisState[] {
    return [...this.#current.values()]
      .filter((state) => input.includeInactive || state.status === 'active' || state.status === 'selected')
      .sort((first, second) => first.lastEventCursor - second.lastEventCursor)
      .map((state) => structuredClone(state));
  }

  events(): GroundingEvidenceEvent[] {
    return structuredClone(this.#events);
  }

  deltaSince(cursor: number): GroundingLedgerDelta {
    const safeCursor = Math.max(0, Math.min(this.#events.length, Math.floor(cursor)));
    const events = this.#events.slice(safeCursor);
    const changedIds = new Set(events.flatMap((event) => [event.hypothesisId, ...(event.hypothesis?.supersedes ?? [])]));
    return {
      fromCursor: safeCursor,
      nextCursor: this.#events.length,
      events: structuredClone(events),
      current: [...changedIds]
        .map((id) => this.#current.get(id))
        .filter((state): state is GroundingHypothesisState => Boolean(state))
        .sort((first, second) => first.lastEventCursor - second.lastEventCursor)
        .map((state) => structuredClone(state)),
    };
  }

  #apply(event: GroundingEvidenceEvent, cursor: number): void {
    const prior = this.#current.get(event.hypothesisId);
    const hypothesis = event.hypothesis
      ? structuredClone(event.hypothesis)
      : prior ? structuredClone(prior.hypothesis) : undefined;
    if (!hypothesis) throw new Error(`GROUNDING_HYPOTHESIS_MISSING: ${event.hypothesisId}`);
    if (event.supportDelta) hypothesis.supports = applySupportDelta(hypothesis.supports, event.supportDelta);
    if (event.confidence !== undefined) hypothesis.confidence = event.confidence;
    const status: GroundingHypothesisState['status'] = event.kind === 'selected'
      ? 'selected' : event.kind === 'rejected'
        ? 'rejected' : event.kind === 'superseded'
          ? 'superseded' : event.kind === 'promoted'
            ? 'promoted' : prior?.status === 'selected' ? 'selected' : 'active';
    this.#current.set(event.hypothesisId, {
      hypothesisId: event.hypothesisId, status, hypothesis,
      lastEventId: event.id, lastEventCursor: cursor,
    });
    for (const supersededId of event.hypothesis?.supersedes ?? []) {
      const superseded = this.#current.get(supersededId);
      if (superseded) this.#current.set(supersededId, {
        ...superseded, status: 'superseded', lastEventId: event.id, lastEventCursor: cursor,
      });
    }
  }

  #assertScope(event: GroundingEvidenceEvent): void {
    if (event.episodeId !== this.#episodeId
      || event.drawingId !== this.#drawingId
      || event.revision !== this.#revision
      || event.hypothesis && (
        event.hypothesis.drawingId !== this.#drawingId || event.hypothesis.revision !== this.#revision
      )) throw new Error('GROUNDING_SCOPE_MISMATCH');
  }

  #validateEvent(event: GroundingEvidenceEvent): void {
    if (!event.id || !event.hypothesisId || !event.reasonCode) throw new Error('GROUNDING_EVENT_INVALID');
    if (event.hypothesis && event.hypothesis.id !== event.hypothesisId) {
      throw new Error('GROUNDING_HYPOTHESIS_ID_MISMATCH');
    }
    if (event.confidence !== undefined
      && (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1)) {
      throw new Error('GROUNDING_CONFIDENCE_INVALID');
    }
    if (event.kind === 'proposed' && !event.hypothesis) throw new Error('GROUNDING_PROPOSAL_MISSING_HYPOTHESIS');
    if (!event.hypothesis && !this.#current.has(event.hypothesisId)) {
      throw new Error(`GROUNDING_HYPOTHESIS_MISSING: ${event.hypothesisId}`);
    }
  }
}

function applySupportDelta(
  current: SemanticSupport[],
  delta: NonNullable<GroundingEvidenceEvent['supportDelta']>,
): SemanticSupport[] {
  const removed = new Set(delta.removed);
  const result = new Map(current
    .filter((support) => !removed.has(support.ref))
    .map((support) => [supportKey(support), structuredClone(support)]));
  for (const support of delta.added) result.set(supportKey(support), structuredClone(support));
  return [...result.values()];
}

function supportKey(support: SemanticSupport): string {
  return `${support.kind}\0${support.ref}\0${support.role}`;
}

export function cloneHypothesis(value: SemanticEntityHypothesis): SemanticEntityHypothesis {
  return structuredClone(value);
}
