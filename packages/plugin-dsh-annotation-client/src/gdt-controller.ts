// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import type {
  DimensionPlanSessionSnapshot,
  DrawingRef,
  GeometricToleranceEditCommand,
} from '@vectorai/plugin-space-contracts';

export interface GdtRemote {
  getDimensionPlan(sessionId: string): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  editGeometricTolerance(sessionId: string, command: GeometricToleranceEditCommand): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  confirmDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  cancelDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  undoDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  redoDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
}

export interface GdtControllerState {
  plan: DimensionPlanSessionSnapshot;
  busy: boolean;
  previewHeld: boolean;
  error: string | null;
}

type EditWithoutContext = GeometricToleranceEditCommand extends infer Command
  ? Command extends GeometricToleranceEditCommand ? Omit<Command, 'expectedDrawingRef'> : never
  : never;

export interface GdtController {
  state: DrawingSurfaceObservable<GdtControllerState>;
  actions: {
    refresh(): Promise<void>;
    edit(command: EditWithoutContext): Promise<void>;
    moveDatum(datumId: string, position: readonly [number, number]): Promise<void>;
    moveFrame(intentIds: readonly string[], position: readonly [number, number]): Promise<void>;
    setOverride(intentId: string, value: number): Promise<void>;
    clearOverride(intentId: string): Promise<void>;
    confirm(): Promise<void>; cancel(): Promise<void>; undo(): Promise<void>; redo(): Promise<void>;
    setPreviewHeld(value: boolean): void;
  };
  dispose(): void;
}

export function createGdtController(sessionId: string, remoteSource: GdtRemote | (() => GdtRemote)): GdtController {
  let current: GdtControllerState = {
    plan: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 },
    busy: false, previewHeld: false, error: null,
  };
  const listeners = new Set<() => void>();
  let queue = Promise.resolve();
  let disposed = false;
  const update = (changes: Partial<GdtControllerState>) => {
    if (disposed) return;
    current = { ...current, ...changes };
    listeners.forEach((listener) => listener());
  };
  const remote = () => typeof remoteSource === 'function' ? remoteSource() : remoteSource;
  const run = (operation: () => Promise<RemoteResult<DimensionPlanSessionSnapshot>>) => {
    const task = queue.then(async () => {
      update({ busy: true, error: null });
      try { update({ plan: unwrap(await operation()) }); }
      catch (error) { update({ error: error instanceof Error ? error.message : String(error) }); throw error; }
      finally { update({ busy: false }); }
    });
    queue = task.catch(() => undefined);
    return task;
  };
  const drawingRef = () => {
    if (!current.plan.drawingRef) throw new Error('GDT_DRAWING_REQUIRED');
    return current.plan.drawingRef;
  };
  const edit = (command: EditWithoutContext) => run(() => remote().editGeometricTolerance(
    sessionId,
    { ...command, expectedDrawingRef: drawingRef() } as GeometricToleranceEditCommand,
  ));
  return {
    state: { getSnapshot: () => current, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } },
    actions: {
      refresh: () => run(() => remote().getDimensionPlan(sessionId)),
      edit,
      moveDatum: (datumId, position) => edit({ type: 'datum.layout', datumId, position: [...position] as [number, number] }),
      moveFrame: (intentIds, position) => edit({ type: 'frame.layout', intentIds: [...intentIds], position: [...position] as [number, number] }),
      setOverride: (intentId, value) => edit({ type: 'override.set', intentId, value }),
      clearOverride: (intentId) => edit({ type: 'override.clear', intentId }),
      confirm: () => run(() => remote().confirmDimensionPlan(sessionId, drawingRef())),
      cancel: () => run(() => remote().cancelDimensionPlan(sessionId, drawingRef())),
      undo: () => run(() => remote().undoDimensionPlan(sessionId, drawingRef())),
      redo: () => run(() => remote().redoDimensionPlan(sessionId, drawingRef())),
      setPreviewHeld: (previewHeld) => update({ previewHeld }),
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}

function unwrap(result: RemoteResult<DimensionPlanSessionSnapshot>): DimensionPlanSessionSnapshot {
  if (result.ok !== true) throw new Error(result.error.message);
  return structuredClone(result.value);
}
