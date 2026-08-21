// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingRef,
  ExplicitNumericConstraint,
} from '@vectorai/drawing-edit-protocol';

export interface BoundUserInstruction {
  rootUserMessageId: string;
  rootUserMessageDigest: string;
  objective: string;
  numericConstraints: ExplicitNumericConstraint[];
}

export type SemanticEpisodeStage =
  | 'canonical'
  | 'observed'
  | 'selected'
  | 'preview_ready'
  | 'needs_revision'
  | 'committed'
  | 'discarded'
  | 'invalidated';

export interface SemanticEditEpisode {
  episodeId: string;
  sessionId: string;
  instruction: BoundUserInstruction;
  drawingRef: DrawingRef;
  stateEpoch: number;
  stage: SemanticEpisodeStage;
  observation?: unknown;
  selection?: unknown;
  currentPreview?: unknown;
  currentEvaluation?: unknown;
  commitReceipt?: unknown;
  candidateCount: number;
}

export type SemanticEpisodeTransition =
  | { kind: 'observed'; observation: unknown }
  | { kind: 'selected'; semanticRequest: unknown; selection: unknown }
  | { kind: 'preview_ready'; semanticRequest: unknown; preview: unknown }
  | { kind: 'needs_revision'; evaluation: unknown }
  | { kind: 'committed'; receipt: unknown }
  | { kind: 'discarded' }
  | { kind: 'invalidated'; reason: string };

export interface SemanticEpisodeStorePorts {
  id(prefix: string): string;
  digest(value: string): string;
}

interface StoredEpisode extends SemanticEditEpisode {
  lastTransitionDigest?: string;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameInstruction(left: BoundUserInstruction, right: BoundUserInstruction): boolean {
  return left.rootUserMessageId === right.rootUserMessageId
    && left.rootUserMessageDigest === right.rootUserMessageDigest;
}

function sameDrawingRef(left: DrawingRef, right: DrawingRef): boolean {
  return left.drawingId === right.drawingId && left.revision === right.revision;
}

function publicClone(episode: StoredEpisode): SemanticEditEpisode {
  const { lastTransitionDigest: _lastTransitionDigest, ...visible } = episode;
  return structuredClone(visible);
}

export class SemanticEditEpisodeStore {
  readonly #instructions = new Map<string, BoundUserInstruction>();
  readonly #episodes = new Map<string, StoredEpisode>();
  readonly #epochs = new Map<string, number>();

  constructor(private readonly ports: SemanticEpisodeStorePorts) {}

  bindInstruction(sessionId: string, instruction: BoundUserInstruction): BoundUserInstruction {
    const normalized = structuredClone({ ...instruction, objective: instruction.objective.trim() });
    if (!normalized.rootUserMessageId || !normalized.rootUserMessageDigest || !normalized.objective) {
      throw new Error('EDIT_USER_INSTRUCTION_INVALID');
    }
    const current = this.#instructions.get(sessionId);
    if (current && sameInstruction(current, normalized)) return structuredClone(current);
    if (current) this.invalidate(sessionId, 'root-user-message-changed');
    this.#instructions.set(sessionId, normalized);
    return structuredClone(normalized);
  }

  boundInstruction(sessionId: string): BoundUserInstruction | null {
    const instruction = this.#instructions.get(sessionId);
    return instruction ? structuredClone(instruction) : null;
  }

  start(
    sessionId: string,
    instruction: BoundUserInstruction,
    drawingRef: DrawingRef,
  ): SemanticEditEpisode {
    const bound = this.bindInstruction(sessionId, instruction);
    const current = this.#episodes.get(sessionId);
    if (current && sameInstruction(current.instruction, bound) && sameDrawingRef(current.drawingRef, drawingRef)) {
      return publicClone(current);
    }
    if (current) this.invalidate(sessionId, 'episode-replaced');
    const stateEpoch = this.#nextEpoch(sessionId);
    const episode: StoredEpisode = {
      episodeId: this.ports.id('episode'),
      sessionId,
      instruction: structuredClone(bound),
      drawingRef: structuredClone(drawingRef),
      stateEpoch,
      stage: 'canonical',
      candidateCount: 0,
    };
    this.#episodes.set(sessionId, episode);
    return publicClone(episode);
  }

  current(sessionId: string, expectedDrawingRef?: DrawingRef): SemanticEditEpisode | null {
    const current = this.#episodes.get(sessionId);
    if (!current) return null;
    if (expectedDrawingRef && !sameDrawingRef(current.drawingRef, expectedDrawingRef)) {
      this.invalidate(sessionId, 'drawing-revision-changed');
      return null;
    }
    return publicClone(current);
  }

  transition(
    sessionId: string,
    expectedStateEpoch: number,
    transition: SemanticEpisodeTransition,
  ): SemanticEditEpisode {
    const current = this.#episodes.get(sessionId);
    if (!current) throw new Error('EDIT_EPISODE_REQUIRED');
    const transitionDigest = this.ports.digest(canonicalize(transition));
    if (current.lastTransitionDigest === transitionDigest) return publicClone(current);
    if (current.stateEpoch !== expectedStateEpoch) throw new Error('EDIT_EPISODE_STALE');

    const next: StoredEpisode = {
      ...current,
      stateEpoch: this.#nextEpoch(sessionId),
      stage: transition.kind,
      lastTransitionDigest: transitionDigest,
    };
    if (transition.kind === 'observed') next.observation = structuredClone(transition.observation);
    if (transition.kind === 'selected') next.selection = structuredClone(transition.selection);
    if (transition.kind === 'preview_ready') {
      next.currentPreview = structuredClone(transition.preview);
      next.currentEvaluation = undefined;
      next.candidateCount += 1;
    }
    if (transition.kind === 'needs_revision') next.currentEvaluation = structuredClone(transition.evaluation);
    if (transition.kind === 'committed') next.commitReceipt = structuredClone(transition.receipt);
    this.#episodes.set(sessionId, next);
    return publicClone(next);
  }

  invalidate(sessionId: string, _reason: string): void {
    if (!this.#episodes.has(sessionId)) return;
    this.#episodes.delete(sessionId);
    this.#nextEpoch(sessionId);
  }

  dispose(sessionId: string): void {
    this.#episodes.delete(sessionId);
    this.#instructions.delete(sessionId);
    this.#epochs.delete(sessionId);
  }

  #nextEpoch(sessionId: string): number {
    const next = (this.#epochs.get(sessionId) ?? 0) + 1;
    this.#epochs.set(sessionId, next);
    return next;
  }
}
