// SPDX-License-Identifier: Apache-2.0

import {
  mergeBoundary, moveBoundary, splitSegment, updateSegmentMetadata, validatePartition,
  type PartitionDraft as DomainPartitionDraft,
  type PartitionRevision as DomainPartitionRevision,
} from '@vectorai/engineering-annotation';
import {
  partitionSessionSnapshotSchema,
  partitionDraftSchema,
  type DrawingRef,
  type PartitionEditCommand,
  type PartitionSessionSnapshot,
} from '@vectorai/plugin-space-contracts';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PartitionStorage { load(sessionId: string): unknown | null; save(sessionId: string, value: unknown): void }
interface Envelope {
  snapshot: PartitionSessionSnapshot;
  undo: PartitionSessionSnapshot[];
  redo: PartitionSessionSnapshot[];
  lastConfirmed?: PartitionSessionSnapshot['confirmed'];
  lastConfirmedDraft?: DomainPartitionDraft;
}

export class PartitionSessionStore {
  readonly #states = new Map<string, Envelope>();
  constructor(
    private readonly storage?: PartitionStorage,
    private readonly ports: { now(): number; id(): string } = { now: Date.now, id: () => `partition_${globalThis.crypto.randomUUID()}` },
  ) {}

  get(sessionId: string): PartitionSessionSnapshot {
    return structuredClone(this.#envelope(sessionId).snapshot);
  }

  beginAnalysis(sessionId: string, drawingRef: DrawingRef): PartitionSessionSnapshot {
    const confirmed = latestConfirmed(this.#envelope(sessionId));
    return this.#replace(sessionId, {
      version: 1, phase: 'analyzing', drawingRef,
      ...(confirmed === undefined ? {} : { confirmed }),
      canUndo: false, canRedo: false, updatedAt: this.ports.now(),
    }, [], []);
  }

  setDraft(sessionId: string, draft: DomainPartitionDraft): PartitionSessionSnapshot {
    const current = this.#envelope(sessionId);
    requireRef(current.snapshot, draft.drawingRef);
    return this.#replace(sessionId, {
      version: 1, phase: 'editing', drawingRef: draft.drawingRef,
      draft: draft as never,
      ...(current.snapshot.confirmed === undefined ? {} : { confirmed: current.snapshot.confirmed }),
      canUndo: false, canRedo: false, updatedAt: this.ports.now(),
    }, [], []);
  }

  edit(sessionId: string, command: PartitionEditCommand): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, command.expectedDrawingRef);
    if (state.snapshot.phase !== 'editing' || !state.snapshot.draft) throw new Error('PARTITION_DRAFT_REQUIRED');
    const draft = structuredClone(state.snapshot.draft) as unknown as DomainPartitionDraft;
    const next = command.type === 'boundary.move'
      ? moveBoundary(draft, { boundaryIndex: command.boundaryIndex, requestedZ: command.requestedZ, snapCandidates: draft.stepCandidates, snapTolerance: command.snapTolerance })
      : command.type === 'segment.split'
        ? splitSegment(draft, { segmentId: command.segmentId, z: command.z, snapCandidates: draft.stepCandidates, snapTolerance: command.snapTolerance })
        : command.type === 'boundary.merge'
          ? mergeBoundary(draft, { boundaryIndex: command.boundaryIndex })
          : updateSegmentMetadata(draft, { segmentId: command.segmentId, ...(command.name === undefined ? {} : { name: command.name }), ...(command.semanticType === undefined ? {} : { semanticType: command.semanticType }) });
    return this.#push(sessionId, { ...state.snapshot, draft: next as never, canUndo: true, canRedo: false, updatedAt: this.ports.now() });
  }

  confirm(sessionId: string, expected: DrawingRef): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    if (!state.snapshot.draft) throw new Error('PARTITION_DRAFT_REQUIRED');
    const draft = state.snapshot.draft as unknown as DomainPartitionDraft;
    if (validatePartition(draft).length) throw new Error('PARTITION_INVALID');
    const previous = latestConfirmed(state);
    const revision: DomainPartitionRevision = {
      version: 1, drawingRef: draft.drawingRef, axis: draft.axis, segments: draft.segments,
      semanticGroups: draft.semanticGroups, evidence: draft.evidence, diagnostics: draft.diagnostics,
      id: this.ports.id(), ...(previous === undefined ? {} : { parentRevisionId: previous.id }), confirmedAt: this.ports.now(),
    };
    return this.#push(
      sessionId,
      { ...state.snapshot, phase: 'confirmed', draft: undefined, confirmed: revision as never, canUndo: true, canRedo: false, updatedAt: this.ports.now() },
      draft,
    );
  }

  reopen(sessionId: string, expected: DrawingRef): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const confirmed = latestConfirmed(state);
    if (confirmed === undefined) throw new Error('PARTITION_CONFIRMED_REQUIRED');
    if (state.snapshot.phase === 'editing' && state.snapshot.draft?.basePartitionRevisionId === confirmed.id) {
      return structuredClone(state.snapshot);
    }
    const draft = state.lastConfirmedDraft === undefined
      ? reconstructDraft(confirmed as unknown as DomainPartitionRevision)
      : structuredClone(state.lastConfirmedDraft);
    draft.basePartitionRevisionId = confirmed.id;
    return this.#push(sessionId, {
      version: 1,
      phase: 'editing',
      drawingRef: expected,
      draft: draft as never,
      confirmed,
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now(),
    });
  }

  cancel(sessionId: string, expected: DrawingRef): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const confirmed = latestConfirmed(state);
    return this.#push(sessionId, confirmed === undefined
      ? { version: 1, phase: 'idle', drawingRef: expected, canUndo: true, canRedo: false, updatedAt: this.ports.now() }
      : { version: 1, phase: 'confirmed', drawingRef: expected, confirmed, canUndo: true, canRedo: false, updatedAt: this.ports.now() });
  }

  undo(sessionId: string, expected: DrawingRef): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const previous = state.undo.at(-1);
    if (!previous) throw new Error('PARTITION_UNDO_EMPTY');
    const restored = structuredClone(previous);
    return this.#replace(sessionId, { ...restored, canUndo: state.undo.length > 1, canRedo: true, updatedAt: this.ports.now() }, state.undo.slice(0, -1), [...state.redo, state.snapshot]);
  }

  redo(sessionId: string, expected: DrawingRef): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const next = state.redo.at(-1);
    if (!next) throw new Error('PARTITION_REDO_EMPTY');
    return this.#replace(sessionId, { ...next, canUndo: true, canRedo: state.redo.length > 1, updatedAt: this.ports.now() }, [...state.undo, state.snapshot], state.redo.slice(0, -1));
  }

  markNeedsRebase(sessionId: string, currentRef: DrawingRef): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    return this.#replace(sessionId, { ...state.snapshot, phase: 'needs-rebase', drawingRef: currentRef, message: 'Drawing revision changed', updatedAt: this.ports.now() }, state.undo, state.redo);
  }

  #push(sessionId: string, snapshot: PartitionSessionSnapshot, lastConfirmedDraft?: DomainPartitionDraft): PartitionSessionSnapshot {
    const state = this.#envelope(sessionId);
    return this.#replace(sessionId, snapshot, [...state.undo, state.snapshot], [], lastConfirmedDraft);
  }

  #replace(
    sessionId: string,
    snapshot: PartitionSessionSnapshot,
    undo: PartitionSessionSnapshot[],
    redo: PartitionSessionSnapshot[],
    confirmedDraft?: DomainPartitionDraft,
  ): PartitionSessionSnapshot {
    const previous = this.#states.get(sessionId);
    const previousConfirmed = previous?.lastConfirmed;
    const envelope: Envelope = {
      snapshot: partitionSessionSnapshotSchema.parse(compact(snapshot)),
      undo: undo.map(compact).map((item) => partitionSessionSnapshotSchema.parse(item)),
      redo: redo.map(compact).map((item) => partitionSessionSnapshotSchema.parse(item)),
      ...(snapshot.confirmed === undefined && previousConfirmed === undefined ? {} : { lastConfirmed: snapshot.confirmed ?? previousConfirmed }),
      ...(confirmedDraft === undefined && previous?.lastConfirmedDraft === undefined
        ? {}
        : { lastConfirmedDraft: structuredClone(confirmedDraft ?? previous!.lastConfirmedDraft!) }),
    };
    this.storage?.save(sessionId, envelope);
    this.#states.set(sessionId, envelope);
    return structuredClone(envelope.snapshot);
  }

  #envelope(sessionId: string): Envelope {
    const existing = this.#states.get(sessionId);
    if (existing) return existing;
    const loaded = parseEnvelope(this.storage?.load(sessionId));
    const initial: Envelope = loaded ?? { snapshot: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, undo: [], redo: [] };
    this.#states.set(sessionId, initial);
    return initial;
  }
}

export class FilePartitionStorage implements PartitionStorage {
  constructor(private readonly directory: string) {}
  load(sessionId: string): unknown | null {
    const path = this.#path(sessionId);
    if (!existsSync(path)) return null;
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
  }
  save(sessionId: string, value: unknown): void {
    mkdirSync(this.directory, { recursive: true });
    const path = this.#path(sessionId);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value)}\n`, 'utf8');
    renameSync(temporary, path);
  }
  #path(sessionId: string): string {
    return join(this.directory, `${createHash('sha256').update(sessionId).digest('hex')}.json`);
  }
}

function requireRef(snapshot: PartitionSessionSnapshot, expected: DrawingRef): void {
  if (!snapshot.drawingRef || snapshot.drawingRef.drawingId !== expected.drawingId || snapshot.drawingRef.revision !== expected.revision) throw new Error('PARTITION_DRAWING_STALE');
}
function compact<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function latestConfirmed(envelope: Envelope): PartitionSessionSnapshot['confirmed'] {
  return envelope.lastConfirmed ?? [envelope.snapshot, ...envelope.undo, ...envelope.redo]
    .flatMap((snapshot) => snapshot.confirmed === undefined ? [] : [snapshot.confirmed])
    .sort((a, b) => b.confirmedAt - a.confirmedAt)[0];
}
function parseEnvelope(value: unknown): Envelope | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as { snapshot?: unknown; undo?: unknown; redo?: unknown; lastConfirmed?: unknown; lastConfirmedDraft?: unknown };
  const snapshot = partitionSessionSnapshotSchema.safeParse(item.snapshot);
  if (!snapshot.success || !Array.isArray(item.undo) || !Array.isArray(item.redo)) return null;
  const undo = item.undo.map((entry) => partitionSessionSnapshotSchema.safeParse(entry));
  const redo = item.redo.map((entry) => partitionSessionSnapshotSchema.safeParse(entry));
  if (undo.some(({ success }) => !success) || redo.some(({ success }) => !success)) return null;
  const confirmed = item.lastConfirmed === undefined
    ? undefined
    : partitionSessionSnapshotSchema.shape.confirmed.safeParse(item.lastConfirmed);
  if (confirmed !== undefined && !confirmed.success) return null;
  const confirmedDraft = item.lastConfirmedDraft === undefined ? undefined : partitionDraftSchema.safeParse(item.lastConfirmedDraft);
  if (confirmedDraft !== undefined && !confirmedDraft.success) return null;
  return {
    snapshot: snapshot.data, undo: undo.map((entry) => entry.data!), redo: redo.map((entry) => entry.data!),
    ...(confirmed?.data === undefined ? {} : { lastConfirmed: confirmed.data }),
    ...(confirmedDraft?.data === undefined ? {} : { lastConfirmedDraft: confirmedDraft.data as unknown as DomainPartitionDraft }),
  };
}

function reconstructDraft(revision: DomainPartitionRevision): DomainPartitionDraft {
  const boundaries = revision.segments.slice(0, -1).map((segment) => segment.zEnd);
  return {
    version: 1,
    drawingRef: revision.drawingRef,
    axis: structuredClone(revision.axis),
    segments: structuredClone(revision.segments),
    semanticGroups: structuredClone(revision.semanticGroups),
    stepCandidates: boundaries.map((z, index) => ({
      id: `step:reopen:${index + 1}`,
      z,
      score: 1,
      evidenceIds: [],
      accepted: true,
    })),
    evidence: structuredClone(revision.evidence),
    diagnostics: [
      ...structuredClone(revision.diagnostics),
      {
        id: `diagnostic:reopen:${revision.id}`,
        severity: 'warning',
        code: 'PARTITION_REOPEN_DRAFT_RECONSTRUCTED',
        message: 'Editable partition state was reconstructed from a legacy confirmed revision.',
      },
    ],
    basePartitionRevisionId: revision.id,
  };
}
