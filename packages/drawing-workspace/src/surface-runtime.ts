// SPDX-License-Identifier: Apache-2.0

import {
  queryDrawing,
  type DrawingSpatialQuery,
  type DrawingSpatialQueryResult,
} from '@vectorai/drawing-spatial';

import type {
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceSnapshot,
} from './contracts';
import type {
  DrawingWorkspaceDisplay,
  DrawingWorkspaceError,
  DrawingWorkspaceStore,
  DrawingWorkspaceViewport,
} from './store';

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export interface DrawingSurfaceObservable<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export interface DrawingSurfacePresentationSnapshot {
  displaySnapshot: DeepReadonly<DrawingWorkspaceSnapshot> | null;
  preview: DeepReadonly<ReturnType<DrawingWorkspaceStore['getState']>['preview']>;
  groundingOverlay: DeepReadonly<ReturnType<DrawingWorkspaceStore['getState']>['groundingOverlay']>;
  motionRig: DeepReadonly<ReturnType<DrawingWorkspaceStore['getState']>['motionRig']>;
  sourceUrl: string | null;
  display: DeepReadonly<DrawingWorkspaceDisplay>;
  busy: boolean;
  error: DeepReadonly<DrawingWorkspaceError> | null;
}

export interface DrawingSurfaceActions {
  setViewport(viewport: DrawingWorkspaceViewport): void;
  setSelection(ids: readonly string[]): void;
  query(request: DrawingSpatialQuery, signal?: AbortSignal): Promise<DrawingSpatialQueryResult>;
  stage(request: DrawingWorkspaceCommitRequest, signal?: AbortSignal): Promise<boolean>;
  undo(signal?: AbortSignal): Promise<boolean>;
  redo(signal?: AbortSignal): Promise<boolean>;
}

export interface DrawingSurfaceRuntime {
  snapshot: DrawingSurfaceObservable<DeepReadonly<DrawingWorkspaceSnapshot> | null>;
  viewport: DrawingSurfaceObservable<DeepReadonly<DrawingWorkspaceViewport>>;
  selection: DrawingSurfaceObservable<readonly string[]>;
  presentation: DrawingSurfaceObservable<DrawingSurfacePresentationSnapshot>;
  actions: DrawingSurfaceActions;
}

export function createStoreObservable<State, Selected>(
  store: DrawingWorkspaceStore,
  selector: (state: ReturnType<DrawingWorkspaceStore['getState']>) => Selected,
  equals: (left: Selected, right: Selected) => boolean = Object.is,
): DrawingSurfaceObservable<DeepReadonly<Selected>> {
  let source = selector(store.getState());
  let snapshot = cloneProjection(source);

  const refresh = (): boolean => {
    const next = selector(store.getState());
    if (equals(source, next)) return false;
    source = next;
    snapshot = cloneProjection(next);
    return true;
  };

  return {
    getSnapshot() {
      refresh();
      return snapshot;
    },
    subscribe(listener) {
      return store.subscribe(() => {
        if (refresh()) listener();
      });
    },
  };
}

export function createDrawingSurfaceRuntime(store: DrawingWorkspaceStore): DrawingSurfaceRuntime {
  return {
    snapshot: createStoreObservable(store, (state) => state.snapshot),
    viewport: createStoreObservable(store, (state) => state.viewport, viewportEqual),
    selection: createStoreObservable(store, (state) => state.selectedIds, stringArrayEqual),
    presentation: createStoreObservable(store, (state) => ({
      displaySnapshot: state.displaySnapshot,
      preview: state.preview,
      groundingOverlay: state.groundingOverlay,
      motionRig: state.motionRig,
      sourceUrl: state.sourceResource?.url ?? null,
      display: state.display,
      busy: state.busy,
      error: state.error,
    }), presentationEqual),
    actions: {
      setViewport(viewport) {
        store.getState().setViewport({ ...viewport });
      },
      setSelection(ids) {
        store.getState().setSelection([...ids]);
      },
      async query(request, signal) {
        signal?.throwIfAborted();
        const snapshot = store.getState().snapshot;
        if (snapshot === null) throw new Error('DRAWING_SURFACE_EMPTY');
        return queryDrawing(snapshot.document, request);
      },
      async stage(request, signal) {
        signal?.throwIfAborted();
        if (store.getState().snapshot?.ref.revision !== request.expectedRevision) return false;
        return store.getState().commit({ commands: structuredClone(request.commands) });
      },
      async undo(signal) {
        signal?.throwIfAborted();
        return store.getState().undoLast();
      },
      async redo(signal) {
        signal?.throwIfAborted();
        return store.getState().redoLast();
      },
    },
  };
}

function cloneProjection<T>(value: T): DeepReadonly<T> {
  return structuredClone(value) as DeepReadonly<T>;
}

function viewportEqual(left: DrawingWorkspaceViewport, right: DrawingWorkspaceViewport): boolean {
  return left.x === right.x && left.y === right.y && left.scale === right.scale
    && left.width === right.width && left.height === right.height;
}

function stringArrayEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function presentationEqual(
  left: ReturnType<typeof presentationOf>,
  right: ReturnType<typeof presentationOf>,
): boolean {
  return left.displaySnapshot === right.displaySnapshot
    && left.preview === right.preview
    && left.groundingOverlay === right.groundingOverlay
    && left.motionRig === right.motionRig
    && left.sourceUrl === right.sourceUrl
    && left.display === right.display
    && left.busy === right.busy
    && left.error === right.error;
}

function presentationOf(state: ReturnType<DrawingWorkspaceStore['getState']>) {
  return {
    displaySnapshot: state.displaySnapshot,
    preview: state.preview,
    groundingOverlay: state.groundingOverlay,
    motionRig: state.motionRig,
    sourceUrl: state.sourceResource?.url ?? null,
    display: state.display,
    busy: state.busy,
    error: state.error,
  };
}
