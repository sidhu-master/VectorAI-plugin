// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import type {
  DimensionPlanSessionSnapshot,
  DimensionSchemeEditCommand,
  DrawingRef,
} from '@vectorai/plugin-space-contracts';

export interface DimensionPlanRemote {
  getDimensionPlan(sessionId: string): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  editDimensionScheme(sessionId: string, command: DimensionSchemeEditCommand): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  confirmDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  cancelDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  undoDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
  redoDimensionPlan(sessionId: string, expected: DrawingRef): Promise<RemoteResult<DimensionPlanSessionSnapshot>>;
}

export interface DimensionChainControllerState {
  plan: DimensionPlanSessionSnapshot;
  busy: boolean;
  previewHeld: boolean;
  error: string | null;
}
type DimensionEditWithoutRef = DimensionSchemeEditCommand extends infer Command
  ? Command extends DimensionSchemeEditCommand ? Omit<Command, 'expectedDrawingRef'> : never
  : never;

export interface DimensionChainController {
  state: DrawingSurfaceObservable<DimensionChainControllerState>;
  actions: {
    refresh(): Promise<void>;
    setDisplayed(candidateId: string, displayed: boolean): Promise<void>;
    chooseClosure(chainId: string, candidateId: string): Promise<void>;
    moveCandidate(candidateId: string, normalOffset: number): Promise<void>;
    confirm(): Promise<void>; cancel(): Promise<void>; undo(): Promise<void>; redo(): Promise<void>;
    setPreviewHeld(value: boolean): void;
  };
  dispose(): void;
}

export function createDimensionChainController(
  sessionId: string,
  remoteSource: DimensionPlanRemote | (() => DimensionPlanRemote),
): DimensionChainController {
  let current: DimensionChainControllerState = {
    plan: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 },
    busy: false, previewHeld: false, error: null,
  };
  const listeners = new Set<() => void>();
  let queue = Promise.resolve();
  let disposed = false;
  const update = (changes: Partial<DimensionChainControllerState>) => {
    if (disposed) return;
    current = { ...current, ...changes };
    for (const listener of listeners) listener();
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
  const ref = () => {
    if (!current.plan.drawingRef) throw new Error('DIMENSION_DRAWING_REQUIRED');
    return current.plan.drawingRef;
  };
  const edit = (command: DimensionEditWithoutRef) => run(() => (
    remote().editDimensionScheme(sessionId, { ...command, expectedDrawingRef: ref() } as DimensionSchemeEditCommand)
  ));
  return {
    state: {
      getSnapshot: () => current,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    },
    actions: {
      refresh: () => run(() => remote().getDimensionPlan(sessionId)),
      setDisplayed: (candidateId, displayed) => edit({ type: 'candidate.display', candidateId, displayed }),
      chooseClosure: (chainId, candidateId) => edit({ type: 'closure.choose', chainId, candidateId }),
      moveCandidate: (candidateId, normalOffset) => edit({ type: 'candidate.layout', candidateId, normalOffset }),
      confirm: () => run(() => remote().confirmDimensionPlan(sessionId, ref())),
      cancel: () => run(() => remote().cancelDimensionPlan(sessionId, ref())),
      undo: () => run(() => remote().undoDimensionPlan(sessionId, ref())),
      redo: () => run(() => remote().redoDimensionPlan(sessionId, ref())),
      setPreviewHeld: (previewHeld) => update({ previewHeld }),
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}

function unwrap(result: RemoteResult<DimensionPlanSessionSnapshot>): DimensionPlanSessionSnapshot {
  if (result.ok !== true) throw new Error(result.error.message);
  return structuredClone(result.value);
}
