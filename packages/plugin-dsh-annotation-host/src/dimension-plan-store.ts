// SPDX-License-Identifier: Apache-2.0

import {
  analyzeDimensionChain,
  applyFitTolerance,
  applyGeometricToleranceEdit,
  applyDimensionSchemeEdit,
  applyManualTolerance,
  applySingleTolerance,
  clearToleranceOverride,
  mergeAxialDimensionProjection,
  orderDimensionIntents,
  projectAxialDimensionScheme,
  setToleranceOverride,
  validateEngineeringDraft,
  withSwitchableClosureAlternatives,
  type AxialDimensionScheme,
  type EngineeringAnnotationDraft,
  type EngineeringDiagnostic,
  type ResolvedFit,
  type ResolvedStandardTolerance,
} from '@vectorai/engineering-annotation';
import {
  dimensionPlanSessionSnapshotSchema,
  engineeringAnnotationDraftSchema,
  engineeringAnnotationRevisionSchema,
  type DimensionPlanSessionSnapshot,
  type DimensionSchemeEditCommand,
  type DrawingRef,
  type GeometricToleranceEditCommand,
  type ToleranceEditCommand,
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

export type ToleranceEditResolution = ResolvedStandardTolerance | ResolvedFit | undefined;
export type ReconcileTolerances = (draft: EngineeringAnnotationDraft) => EngineeringAnnotationDraft;

export class DimensionPlanStore {
  readonly #states = new Map<string, DimensionPlanEnvelope>();

  constructor(
    private readonly storage?: DimensionPlanStorage,
    private readonly ports: { now(): number; id(): string } = {
      now: Date.now,
      id: () => `dimension_plan_${globalThis.crypto.randomUUID()}`,
    },
    private readonly reconcileTolerances: ReconcileTolerances = (draft) => draft,
  ) {}

  get(sessionId: string): DimensionPlanSessionSnapshot {
    return hydrateClosureAlternatives(structuredClone(this.#envelope(sessionId).snapshot));
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
    const parsedDraft = engineeringAnnotationDraftSchema.parse(compact(this.reconcileTolerances(structuredClone(draft))));
    return this.#push(sessionId, {
      version: 1,
      phase: 'editing',
      drawingRef: parsedDraft.drawingRef,
      draft: parsedDraft as unknown as DimensionPlanSessionSnapshot['draft'],
      ...(state.snapshot.confirmed === undefined ? {} : { confirmed: state.snapshot.confirmed }),
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now(),
    });
  }

  editScheme(sessionId: string, command: DimensionSchemeEditCommand): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, command.expectedDrawingRef);
    if ((command.type === 'chain.layout' || command.type === 'candidate.layout' || command.type === 'closure.choose')
      && state.snapshot.phase === 'confirmed'
      && state.snapshot.confirmed?.axialScheme) {
      const edit = command.type === 'chain.layout'
        ? { type: command.type, chainId: command.chainId, normalOffset: command.normalOffset } as const
        : command.type === 'candidate.layout'
          ? { type: command.type, candidateId: command.candidateId, normalOffset: command.normalOffset } as const
          : { type: command.type, chainId: command.chainId, candidateId: command.candidateId } as const;
      const scheme = applyDimensionSchemeEdit(
        withSwitchableClosureAlternatives(state.snapshot.confirmed.axialScheme as unknown as AxialDimensionScheme),
        edit,
      );
      return this.#push(sessionId, {
        ...state.snapshot,
        phase: 'confirmed',
        confirmed: {
          ...state.snapshot.confirmed,
          axialScheme: scheme as unknown as NonNullable<DimensionPlanSessionSnapshot['confirmed']>['axialScheme'],
        },
        canUndo: true,
        canRedo: false,
        updatedAt: this.ports.now(),
      });
    }
    const draft = (state.snapshot.draft as unknown as EngineeringAnnotationDraft | undefined)
      ?? editableDraftFrom(state.snapshot.confirmed);
    if (!draft?.axialScheme) throw new Error('DIMENSION_SCHEME_DRAFT_REQUIRED');
    const edit = command.type === 'candidate.display'
      ? { type: command.type, candidateId: command.candidateId, displayed: command.displayed } as const
      : command.type === 'closure.choose'
        ? { type: command.type, chainId: command.chainId, candidateId: command.candidateId } as const
        : command.type === 'candidate.layout'
          ? { type: command.type, candidateId: command.candidateId, normalOffset: command.normalOffset } as const
          : { type: command.type, chainId: command.chainId, normalOffset: command.normalOffset } as const;
    const scheme = applyDimensionSchemeEdit(
      withSwitchableClosureAlternatives(draft.axialScheme as unknown as AxialDimensionScheme),
      edit,
    );
    return this.setDraft(sessionId, mergeAxialDimensionProjection(draft, projectAxialDimensionScheme({
      scheme,
      ...(draft.baseRevisionId === undefined ? {} : { baseRevisionId: draft.baseRevisionId }),
    })));
  }

  editGeometricTolerance(sessionId: string, command: GeometricToleranceEditCommand): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, command.expectedDrawingRef);
    if (command.type === 'datum.layout') {
      const move = <T extends { datums: Array<{ id: string; labelPosition?: unknown }> }>(value: T): T => {
        const index = value.datums.findIndex(({ id }) => id === command.datumId);
        if (index < 0) throw new Error('GDT_DATUM_UNKNOWN');
        const datums = [...value.datums];
        datums[index] = { ...datums[index]!, labelPosition: [...command.position] as [number, number] };
        return { ...value, datums } as T;
      };
      if (state.snapshot.phase === 'confirmed' && state.snapshot.confirmed) {
        return this.#push(sessionId, {
          ...state.snapshot,
          phase: 'confirmed',
          confirmed: move(state.snapshot.confirmed),
          canUndo: true,
          canRedo: false,
          updatedAt: this.ports.now(),
        });
      }
      if (!state.snapshot.draft) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
      return this.#push(sessionId, {
        ...state.snapshot,
        draft: engineeringAnnotationDraftSchema.parse(compact(move(state.snapshot.draft))),
        canUndo: true,
        canRedo: false,
        updatedAt: this.ports.now(),
      });
    }
    if (command.type === 'frame.layout') {
      const move = <T extends { geometricTolerances: Array<{ id: string; framePosition?: unknown }> }>(value: T): T => {
        const ids = new Set(command.intentIds);
        if (ids.size !== command.intentIds.length || value.geometricTolerances.filter(({ id }) => ids.has(id)).length !== ids.size) {
          throw new Error('GDT_INTENT_UNKNOWN');
        }
        return {
          ...value,
          geometricTolerances: value.geometricTolerances.map((intent) => ids.has(intent.id)
            ? { ...intent, framePosition: [...command.position] as [number, number] }
            : intent),
        } as T;
      };
      if (state.snapshot.phase === 'confirmed' && state.snapshot.confirmed) {
        return this.#push(sessionId, {
          ...state.snapshot,
          phase: 'confirmed',
          confirmed: move(state.snapshot.confirmed),
          canUndo: true,
          canRedo: false,
          updatedAt: this.ports.now(),
        });
      }
      if (!state.snapshot.draft) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
      return this.#push(sessionId, {
        ...state.snapshot,
        draft: engineeringAnnotationDraftSchema.parse(compact(move(state.snapshot.draft))),
        canUndo: true,
        canRedo: false,
        updatedAt: this.ports.now(),
      });
    }
    const draft = (state.snapshot.draft as unknown as EngineeringAnnotationDraft | undefined)
      ?? editableDraftFrom(state.snapshot.confirmed);
    if (!draft) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
    const index = draft.geometricTolerances.findIndex(({ id }) => id === command.intentId);
    if (index < 0) throw new Error('GDT_INTENT_UNKNOWN');
    const { intentId: _intentId, expectedDrawingRef: _expectedDrawingRef, ...edit } = command;
    const geometricTolerances = [...draft.geometricTolerances];
    geometricTolerances[index] = applyGeometricToleranceEdit(
      geometricTolerances[index]! as Parameters<typeof applyGeometricToleranceEdit>[0],
      edit as Parameters<typeof applyGeometricToleranceEdit>[1],
    ) as typeof geometricTolerances[number];
    return this.setDraft(sessionId, { ...draft, geometricTolerances });
  }

  editTolerance(
    sessionId: string,
    command: ToleranceEditCommand,
    resolved: ToleranceEditResolution,
  ): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, command.expectedDrawingRef);
    const draft = (state.snapshot.draft as unknown as EngineeringAnnotationDraft | undefined)
      ?? editableDraftFrom(state.snapshot.confirmed);
    if (!draft) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
    let edited: EngineeringAnnotationDraft;
    if (command.type === 'standard.single.apply') {
      if (!resolved || !('featureClass' in resolved)) throw new Error('TOLERANCE_RESULT_REQUIRED');
      edited = applySingleTolerance(draft, resolved, {
        dimensionIntentId: command.dimensionIntentId,
        selectionSource: command.selectionSource,
        displayPreference: command.displayPreference,
        evidenceRefs: command.evidenceRefs,
      });
    } else if (command.type === 'standard.fit.apply') {
      if (!resolved || !('hole' in resolved)) throw new Error('TOLERANCE_RESULT_REQUIRED');
      edited = applyFitTolerance(draft, resolved, {
        fitGroupId: `fit:${command.holeDimensionIntentId}:${command.shaftDimensionIntentId}`,
        holeDimensionIntentId: command.holeDimensionIntentId,
        shaftDimensionIntentId: command.shaftDimensionIntentId,
        selectionSource: command.selectionSource,
        displayPreference: command.displayPreference,
        evidenceRefs: command.evidenceRefs,
      });
    } else if (command.type === 'manual.apply') {
      edited = applyManualTolerance(draft, {
        dimensionIntentId: command.dimensionIntentId,
        mode: command.mode,
        ...(command.upperDeviation === undefined ? {} : { upperDeviation: command.upperDeviation }),
        ...(command.lowerDeviation === undefined ? {} : { lowerDeviation: command.lowerDeviation }),
        displayPreference: command.displayPreference,
        evidenceRefs: command.evidenceRefs,
      });
    } else if (command.type === 'standard.override.set') {
      edited = setToleranceOverride(draft, command.dimensionIntentId, {
        upperDeviation: command.upperDeviation, lowerDeviation: command.lowerDeviation,
      });
    } else {
      edited = clearToleranceOverride(draft, command.dimensionIntentId);
    }
    const parsedDraft = engineeringAnnotationDraftSchema.parse(compact(edited));
    return this.#push(sessionId, {
      version: 1,
      phase: 'editing',
      drawingRef: parsedDraft.drawingRef,
      draft: parsedDraft as unknown as DimensionPlanSessionSnapshot['draft'],
      ...(state.snapshot.confirmed === undefined ? {} : { confirmed: state.snapshot.confirmed }),
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now(),
    });
  }

  confirm(sessionId: string, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const state = this.#envelope(sessionId);
    requireRef(state.snapshot, expected);
    if (state.snapshot.phase === 'needs-rebase') throw new Error('ANNOTATION_PLAN_DRAWING_STALE');
    if (!state.snapshot.draft) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
    const draft = state.snapshot.draft as unknown as EngineeringAnnotationDraft;
    if (!sameRef(draft.drawingRef, expected)) throw new Error('ANNOTATION_PLAN_DRAWING_STALE');
    const previous = latestConfirmed(state);
    if (draft.baseRevisionId !== undefined && draft.baseRevisionId !== previous?.id) {
      throw new Error('ANNOTATION_PLAN_BASE_STALE');
    }
    const order = orderDimensionIntents({ intents: draft.intents, dependencies: draft.dependencies });
    const diagnostics = confirmationDiagnostics(draft, order.diagnostics);
    if (diagnostics.some(({ severity }) => severity === 'error')) throw new Error('ANNOTATION_PLAN_INVALID');

    const revision = engineeringAnnotationRevisionSchema.parse(compact({
      version: 1,
      drawingRef: draft.drawingRef,
      datums: draft.datums,
      intents: draft.intents,
      tolerances: draft.tolerances,
      fitAssignments: draft.fitAssignments,
      geometricTolerances: draft.geometricTolerances,
      chains: draft.chains,
      dependencies: draft.dependencies,
      diagnostics: [...draft.diagnostics, ...diagnostics],
      ...(draft.axialScheme === undefined ? {} : { axialScheme: draft.axialScheme }),
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
    const draft = state.snapshot.draft === undefined ? undefined : {
      ...state.snapshot.draft,
      geometricTolerances: state.snapshot.draft.geometricTolerances.map((intent) => ({
        ...intent,
        computed: { ...intent.computed, status: 'stale' as const },
        status: 'stale' as const,
      })),
      ...(state.snapshot.draft.axialScheme === undefined ? {} : {
        axialScheme: { ...state.snapshot.draft.axialScheme, status: 'stale' as const },
      }),
    };
    return this.#replace(sessionId, {
      ...state.snapshot,
      phase: 'needs-rebase',
      drawingRef: currentRef,
      ...(draft === undefined ? {} : { draft }),
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

function editableDraftFrom(
  revision: DimensionPlanSessionSnapshot['confirmed'],
): EngineeringAnnotationDraft | undefined {
  if (!revision) return undefined;
  return {
    version: revision.version,
    drawingRef: revision.drawingRef,
    datums: revision.datums,
    intents: revision.intents,
    tolerances: revision.tolerances,
    fitAssignments: revision.fitAssignments,
    geometricTolerances: revision.geometricTolerances,
    chains: revision.chains,
    dependencies: revision.dependencies,
    diagnostics: revision.diagnostics,
    ...(revision.axialScheme === undefined ? {} : { axialScheme: revision.axialScheme }),
    baseRevisionId: revision.id,
  } as unknown as EngineeringAnnotationDraft;
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
  if (draft.axialScheme && draft.axialScheme.status !== 'resolved') {
    diagnostics.push(problem('DIMENSION_SCHEME_UNRESOLVED', draft.axialScheme.inputDigest));
  }
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
  for (const intent of draft.geometricTolerances) {
    if (intent.status === 'conflict' || intent.status === 'stale') diagnostics.push(problem('GDT_INTENT_CONFLICT', intent.id));
    if (intent.status === 'confirmed' && intent.override?.value === undefined && intent.computed.value === undefined) {
      diagnostics.push(problem('GDT_EFFECTIVE_VALUE_REQUIRED', intent.id));
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
  return diagnostics.sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
}

function hydrateClosureAlternatives(snapshot: DimensionPlanSessionSnapshot): DimensionPlanSessionSnapshot {
  if (snapshot.draft?.axialScheme) {
    snapshot.draft.axialScheme = withSwitchableClosureAlternatives(
      snapshot.draft.axialScheme as unknown as AxialDimensionScheme,
    ) as unknown as typeof snapshot.draft.axialScheme;
  }
  if (snapshot.confirmed?.axialScheme) {
    snapshot.confirmed.axialScheme = withSwitchableClosureAlternatives(
      snapshot.confirmed.axialScheme as unknown as AxialDimensionScheme,
    ) as unknown as typeof snapshot.confirmed.axialScheme;
  }
  return snapshot;
}

function requireRef(snapshot: DimensionPlanSessionSnapshot, expected: DrawingRef): void {
  if (!snapshot.drawingRef || !sameRef(snapshot.drawingRef, expected)) {
    throw new Error('ANNOTATION_PLAN_DRAWING_STALE');
  }
}

function sameRef(first: DrawingRef, second: DrawingRef): boolean {
  return first.drawingId === second.drawingId && first.revision === second.revision;
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
