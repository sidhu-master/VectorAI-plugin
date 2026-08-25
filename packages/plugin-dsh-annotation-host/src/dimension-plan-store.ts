// SPDX-License-Identifier: Apache-2.0

import {
  analyzeDimensionChain,
  orderDimensionIntents,
  validateEngineeringDraft,
  type EngineeringAnnotationDraft,
  type EngineeringDiagnostic,
} from '@vectorai/engineering-annotation';
import {
  dimensionPlanSessionSnapshotSchema,
  engineeringAnnotationDraftSchema,
  engineeringAnnotationRevisionSchema,
  type DimensionPlanSessionSnapshot,
  type DrawingRef,
} from '@vectorai/plugin-space-contracts';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DimensionPlanStorage {
  load(sessionId: string): unknown | null;
  save(sessionId: string, value: unknown): void;
}

interface DimensionPlanEnvelope {
  snapshot: DimensionPlanSessionSnapshot;
  undo: DimensionPlanSessionSnapshot[];
  redo: DimensionPlanSessionSnapshot[];
  lastConfirmed?: NonNullable<DimensionPlanSessionSnapshot['confirmed']>;
}

export class DimensionPlanStore {
  readonly #states = new Map<string, DimensionPlanEnvelope>();

  constructor(
    private readonly storage?: DimensionPlanStorage,
    private readonly ports: { now(): number; id(): string } = {
      now: Date.now,
      id: () => `dimension_plan_${globalThis.crypto.randomUUID()}`,
    },
  ) {}

  get(sessionId: string): DimensionPlanSessionSnapshot {
    return structuredClone(this.#envelope(sessionId).snapshot);
  }

  begin(sessionId: string, drawingRef: DrawingRef): DimensionPlanSessionSnapshot {
    const confirmed = latestConfirmed(this.#envelope(sessionId));
    return this.#replace(sessionId, {
      version: 1,
      phase: 'editing',
      drawingRef,
      ...(confirmed === undefined ? {} : { confirmed }),
      canUndo: false,
      canRedo: false,
      updatedAt: this.ports.now(),
    }, [], []);
  }

  setDraft(sessionId: string, draft: EngineeringAnnotationDraft): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, draft.drawingRef);
    const parsedDraft = engineeringAnnotationDraftSchema.parse(compact(draft));
    return this.#push(sessionId, {
      version: 1,
      phase: 'editing',
      drawingRef: parsedDraft.drawingRef,
      draft: parsedDraft,
      ...(state.snapshot.confirmed === undefined ? {} : { confirmed: state.snapshot.confirmed }),
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now(),
    });
  }

  confirm(sessionId: string, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    if (!state.snapshot.draft) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
    const draft = state.snapshot.draft as unknown as EngineeringAnnotationDraft;
    const order = orderDimensionIntents({ intents: draft.intents, dependencies: draft.dependencies });
    const diagnostics = confirmationDiagnostics(draft, order.diagnostics);
    if (diagnostics.some(({ severity }) => severity === 'error')) throw new Error('ANNOTATION_PLAN_INVALID');

    const previous = latestConfirmed(state);
    const revision = engineeringAnnotationRevisionSchema.parse(compact({
      version: 1,
      drawingRef: draft.drawingRef,
      datums: draft.datums,
      intents: draft.intents,
      tolerances: draft.tolerances,
      chains: draft.chains,
      dependencies: draft.dependencies,
      diagnostics: [...draft.diagnostics, ...diagnostics],
      id: this.ports.id(),
      ...(previous === undefined ? {} : { parentRevisionId: previous.id }),
      generationOrder: order.orderedIntentIds,
      confirmedAt: this.ports.now(),
    }));
    return this.#push(sessionId, {
      version: 1,
      phase: 'confirmed',
      drawingRef: revision.drawingRef,
      confirmed: revision,
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now(),
    });
  }

  cancel(sessionId: string, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const confirmed = latestConfirmed(state);
    return this.#push(sessionId, confirmed === undefined ? {
      version: 1, phase: 'idle', drawingRef: expected,
      canUndo: true, canRedo: false, updatedAt: this.ports.now(),
    } : {
      version: 1, phase: 'confirmed', drawingRef: expected, confirmed,
      canUndo: true, canRedo: false, updatedAt: this.ports.now(),
    });
  }

  undo(sessionId: string, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const previous = state.undo.at(-1);
    if (!previous) throw new Error('ANNOTATION_PLAN_UNDO_EMPTY');
    return this.#replace(sessionId, {
      ...structuredClone(previous),
      canUndo: state.undo.length > 1,
      canRedo: true,
      updatedAt: this.ports.now(),
    }, state.undo.slice(0, -1), [...state.redo, state.snapshot]);
  }

  redo(sessionId: string, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    const next = state.redo.at(-1);
    if (!next) throw new Error('ANNOTATION_PLAN_REDO_EMPTY');
    return this.#replace(sessionId, {
      ...structuredClone(next),
      canUndo: true,
      canRedo: state.redo.length > 1,
      updatedAt: this.ports.now(),
    }, [...state.undo, state.snapshot], state.redo.slice(0, -1));
  }

  markNeedsRebase(sessionId: string, currentRef: DrawingRef): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    return this.#replace(sessionId, {
      ...state.snapshot,
      phase: 'needs-rebase',
      drawingRef: currentRef,
      message: 'Drawing revision changed',
      updatedAt: this.ports.now(),
    }, state.undo, state.redo);
  }

  #push(sessionId: string, snapshot: DimensionPlanSessionSnapshot): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    return this.#replace(sessionId, snapshot, [...state.undo, state.snapshot], []);
  }

  #replace(
    sessionId: string,
    snapshot: DimensionPlanSessionSnapshot,
    undo: DimensionPlanSessionSnapshot[],
    redo: DimensionPlanSessionSnapshot[],
  ): DimensionPlanSessionSnapshot {
    const previousConfirmed = this.#states.get(sessionId)?.lastConfirmed;
    const parsedSnapshot = dimensionPlanSessionSnapshotSchema.parse(compact(snapshot));
    const envelope: DimensionPlanEnvelope = {
      snapshot: parsedSnapshot,
      undo: undo.map(compact).map((item) => dimensionPlanSessionSnapshotSchema.parse(item)),
      redo: redo.map(compact).map((item) => dimensionPlanSessionSnapshotSchema.parse(item)),
      ...(parsedSnapshot.confirmed === undefined && previousConfirmed === undefined
        ? {}
        : { lastConfirmed: parsedSnapshot.confirmed ?? previousConfirmed! }),
    };
    this.storage?.save(sessionId, envelope);
    this.#states.set(sessionId, envelope);
    return structuredClone(envelope.snapshot);
  }

  #envelope(sessionId: string): DimensionPlanEnvelope {
    const existing = this.#states.get(sessionId);
    if (existing) return existing;
    const loaded = parseEnvelope(this.storage?.load(sessionId));
    const initial: DimensionPlanEnvelope = loaded ?? {
      snapshot: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 },
      undo: [], redo: [],
    };
    this.#states.set(sessionId, initial);
    return initial;
  }
}

export class FileDimensionPlanStorage implements DimensionPlanStorage {
  constructor(private readonly directory: string) {}

  load(sessionId: string): unknown | null {
    const path = this.#path(sessionId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
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

function confirmationDiagnostics(
  draft: EngineeringAnnotationDraft,
  orderDiagnostics: EngineeringDiagnostic[],
): EngineeringDiagnostic[] {
  const diagnostics = [...validateEngineeringDraft(draft), ...orderDiagnostics];
  diagnostics.push(...draft.diagnostics.filter(({ severity }) => severity === 'error'));
  for (const datum of draft.datums) {
    if (datum.status === 'conflict' || datum.status === 'stale') {
      diagnostics.push(problem('DIMENSION_DATUM_CONFLICT', datum.id));
    }
  }
  for (const intent of draft.intents) {
    if (intent.status === 'conflict' || intent.status === 'stale') {
      diagnostics.push(problem('DIMENSION_INTENT_CONFLICT', intent.id));
    }
  }
  for (const tolerance of draft.tolerances) {
    if (!['resolved', 'confirmed'].includes(tolerance.status) || !tolerance.resolved || tolerance.source === 'ai-candidate') {
      diagnostics.push(problem('TOLERANCE_RESULT_REQUIRED', tolerance.id));
    }
  }
  for (const chain of draft.chains) {
    if (chain.status === 'conflict' || chain.status === 'stale') {
      diagnostics.push(problem('DIMENSION_CHAIN_CONFLICT', chain.id));
    }
    diagnostics.push(...analyzeDimensionChain({
      chain,
      intents: draft.intents,
      tolerances: draft.tolerances,
    }).diagnostics);
  }
  return diagnostics.sort((first, second) => first.id.localeCompare(second.id));
}

function requireRef(snapshot: DimensionPlanSessionSnapshot, expected: DrawingRef): void {
  if (!snapshot.drawingRef
    || snapshot.drawingRef.drawingId !== expected.drawingId
    || snapshot.drawingRef.revision !== expected.revision) {
    throw new Error('ANNOTATION_PLAN_DRAWING_STALE');
  }
}

function problem(code: string, entityId: string): EngineeringDiagnostic {
  return {
    id: `dimension-plan:${code}:${entityId}`,
    severity: 'error', code, message: code, entityIds: [entityId],
  };
}

function latestConfirmed(envelope: DimensionPlanEnvelope): NonNullable<DimensionPlanSessionSnapshot['confirmed']> | undefined {
  return envelope.lastConfirmed ?? [envelope.snapshot, ...envelope.undo, ...envelope.redo]
    .flatMap((snapshot) => snapshot.confirmed === undefined ? [] : [snapshot.confirmed])
    .sort((first, second) => second.confirmedAt - first.confirmedAt)[0];
}

function parseEnvelope(value: unknown): DimensionPlanEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as { snapshot?: unknown; undo?: unknown; redo?: unknown; lastConfirmed?: unknown };
  const snapshot = dimensionPlanSessionSnapshotSchema.safeParse(item.snapshot);
  if (!snapshot.success || !Array.isArray(item.undo) || !Array.isArray(item.redo)) return null;
  const undo = item.undo.map((entry) => dimensionPlanSessionSnapshotSchema.safeParse(entry));
  const redo = item.redo.map((entry) => dimensionPlanSessionSnapshotSchema.safeParse(entry));
  if (undo.some(({ success }) => !success) || redo.some(({ success }) => !success)) return null;
  const confirmed = item.lastConfirmed === undefined
    ? undefined
    : engineeringAnnotationRevisionSchema.safeParse(item.lastConfirmed);
  if (confirmed !== undefined && !confirmed.success) return null;
  return {
    snapshot: snapshot.data,
    undo: undo.map((entry) => entry.data!),
    redo: redo.map((entry) => entry.data!),
    ...(confirmed?.data === undefined ? {} : { lastConfirmed: confirmed.data }),
  };
}

function compact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
