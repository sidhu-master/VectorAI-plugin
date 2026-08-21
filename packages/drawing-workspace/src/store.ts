// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type {
  DrawingSourceResource,
  DrawingGroundingOverlay,
  DrawingSelectionProjection,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspacePort,
  DrawingWorkspacePreview,
  DrawingWorkspaceSnapshot,
} from './contracts';
import {
  buildAnnotationTextMoveCommand,
  buildNodeDeleteCommands,
  buildNodeUpdateCommand,
} from './commands';

export type DrawingWorkspaceStatus = 'idle' | 'loading' | 'empty' | 'ready' | 'error';

export interface DrawingWorkspaceError {
  code: 'load_failed' | 'commit_failed' | 'revision_conflict' | 'source_failed' | 'undo_failed';
  message: string;
}

export interface DrawingWorkspaceViewport {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
}

export interface DrawingWorkspaceDisplay {
  grid: boolean;
  axes: boolean;
  relations: boolean;
  annotations: boolean;
  sourceUnderlay: boolean;
}

export interface DrawingWorkspaceState {
  status: DrawingWorkspaceStatus;
  snapshot: DrawingWorkspaceSnapshot | null;
  preview: DrawingWorkspacePreview | null;
  groundingOverlay: DrawingGroundingOverlay | null;
  displaySnapshot: DrawingWorkspaceSnapshot | null;
  sourceResource: DrawingSourceResource | null;
  busy: boolean;
  error: DrawingWorkspaceError | null;
  viewport: DrawingWorkspaceViewport;
  selectedIds: string[];
  selectionProjection: DrawingSelectionProjection | null;
  mouseWorld: Vec2 | null;
  display: DrawingWorkspaceDisplay;
  load(): Promise<void>;
  refresh(): Promise<void>;
  commit(request: Omit<DrawingWorkspaceCommitRequest, 'expectedRevision'>): Promise<boolean>;
  updateNode(id: string, changes: Record<string, unknown>): Promise<boolean>;
  deleteNodes(ids: string[]): Promise<boolean>;
  moveAnnotationText(id: string, position: Vec2): Promise<boolean>;
  undoLast(): Promise<boolean>;
  setViewport(viewport: DrawingWorkspaceViewport): void;
  setMouseWorld(point: Vec2 | null): void;
  setSelection(ids: string[]): void;
  setDisplay(display: Partial<DrawingWorkspaceDisplay>): void;
  clearError(): void;
  destroy(): void;
}

export type DrawingWorkspaceStore = StoreApi<DrawingWorkspaceState>;

const DEFAULT_VIEWPORT: DrawingWorkspaceViewport = {
  x: 0,
  y: 0,
  scale: 1,
  width: 0,
  height: 0,
};

const DEFAULT_DISPLAY: DrawingWorkspaceDisplay = {
  grid: true,
  axes: true,
  relations: true,
  annotations: true,
  sourceUnderlay: false,
};

export function createDrawingWorkspaceStore(input: {
  port: DrawingWorkspacePort;
}): DrawingWorkspaceStore {
  const { port } = input;
  let disposed = false;
  let unsubscribe: (() => void) | undefined;
  let requestController: AbortController | undefined;
  let sourceResource: DrawingSourceResource | null = null;
  let selectionSequence = 0;

  const store = createStore<DrawingWorkspaceState>((set, get) => {
    const replaceSnapshot = async (
      snapshot: DrawingWorkspaceSnapshot | null,
      preview: DrawingWorkspacePreview | null = null,
      groundingOverlay: DrawingGroundingOverlay | null = null,
    ): Promise<void> => {
      const currentPreview = previewMatchesSnapshot(preview, snapshot) ? preview : null;
      const displaySnapshot = currentPreview?.candidate ?? snapshot;
      const currentGroundingOverlay = groundingOverlayMatchesSnapshot(groundingOverlay, snapshot)
        ? structuredClone(groundingOverlay)
        : null;
      const nextIds = displaySnapshot === null ? new Set<string>() : drawingNodeIds(displaySnapshot);
      const selectedIds = get().selectedIds.filter((id) => nextIds.has(id));
      const previousSource = sourceResource;
      let nextSource: DrawingSourceResource | null = null;

      if (snapshot?.source !== undefined && port.loadSource !== undefined) {
        try {
          nextSource = await port.loadSource(snapshot.source, requestController?.signal);
        } catch (error) {
          if (requestController?.signal.aborted || disposed) return;
          set({ error: { code: 'source_failed', message: errorMessage(error) } });
        }
      }

      if (disposed) {
        nextSource?.dispose();
        return;
      }
      if (previousSource !== nextSource) previousSource?.dispose();
      sourceResource = nextSource;
      set({
        snapshot,
        preview: currentPreview,
        groundingOverlay: currentGroundingOverlay,
        displaySnapshot,
        sourceResource: nextSource,
        selectedIds,
        selectionProjection: null,
        status: snapshot === null ? 'empty' : 'ready',
      });
    };

    const refresh = async (initial: boolean): Promise<void> => {
      if (disposed) return;
      requestController?.abort();
      const controller = new AbortController();
      requestController = controller;
      if (initial) set({ status: 'loading', error: null });
      try {
        const [snapshot, preview, groundingOverlay] = await Promise.all([
          port.load(controller.signal),
          port.loadPreview?.(controller.signal) ?? Promise.resolve(null),
          port.loadGroundingOverlay?.(controller.signal) ?? Promise.resolve(null),
        ]);
        if (controller.signal.aborted || disposed) return;
        await replaceSnapshot(snapshot, preview, groundingOverlay);
      } catch (error) {
        if (controller.signal.aborted || disposed) return;
        set({
          status: get().snapshot === null ? 'error' : get().status,
          error: { code: 'load_failed', message: errorMessage(error) },
        });
      }
    };

    return {
      status: 'idle',
      snapshot: null,
      preview: null,
      groundingOverlay: null,
      displaySnapshot: null,
      sourceResource: null,
      busy: false,
      error: null,
      viewport: { ...DEFAULT_VIEWPORT },
      selectedIds: [],
      selectionProjection: null,
      mouseWorld: null,
      display: { ...DEFAULT_DISPLAY },
      async load() {
        disposed = false;
        if (unsubscribe === undefined && port.subscribe !== undefined) {
          unsubscribe = port.subscribe(() => {
            void refresh(false);
          });
        }
        await refresh(true);
      },
      async refresh() {
        await refresh(false);
      },
      async commit(request) {
        const current = get().snapshot;
        if (current === null || disposed) return false;
        set({ busy: true, error: null });
        const controller = new AbortController();
        requestController = controller;
        try {
          const result = await port.commit({
            expectedRevision: current.ref.revision,
            commands: request.commands,
          }, controller.signal);
          if (controller.signal.aborted || disposed) return false;
          if (result.status === 'committed') {
            await replaceSnapshot(result.snapshot, null);
            return true;
          }
          if (result.status === 'conflict') {
            if (result.snapshot !== undefined) await replaceSnapshot(result.snapshot);
            else await refresh(false);
            set({ error: { code: 'revision_conflict', message: result.message } });
            return false;
          }
          set({ error: { code: 'commit_failed', message: result.message } });
          return false;
        } catch (error) {
          if (controller.signal.aborted || disposed) return false;
          set({ error: { code: 'commit_failed', message: errorMessage(error) } });
          return false;
        } finally {
          if (!disposed) set({ busy: false });
        }
      },
      async updateNode(id, changes) {
        const snapshot = get().snapshot;
        if (snapshot === null || !snapshot.capabilities.edit) return false;
        const command = buildNodeUpdateCommand(snapshot.document, id, changes);
        return command === null ? false : get().commit({ commands: [command] });
      },
      async deleteNodes(ids) {
        const snapshot = get().snapshot;
        if (snapshot === null || !snapshot.capabilities.delete) return false;
        const commands = buildNodeDeleteCommands(snapshot.document, ids);
        return commands.length === 0 ? false : get().commit({ commands });
      },
      async moveAnnotationText(id, position) {
        const snapshot = get().snapshot;
        if (snapshot === null || !snapshot.capabilities.annotations) return false;
        const command = buildAnnotationTextMoveCommand(snapshot.document, id, position);
        return command === null ? false : get().commit({ commands: [command] });
      },
      async undoLast() {
        const snapshot = get().snapshot;
        if (!snapshot?.lastCommit?.undoable || !port.undoLast || disposed) return false;
        set({ busy: true, error: null });
        const controller = new AbortController();
        requestController = controller;
        try {
          const result = await port.undoLast(snapshot, controller.signal);
          if (controller.signal.aborted || disposed) return false;
          if (result.status === 'committed') {
            await replaceSnapshot(result.snapshot, null);
            return true;
          }
          set({ error: { code: 'undo_failed', message: result.message } });
          return false;
        } catch (error) {
          if (controller.signal.aborted || disposed) return false;
          set({ error: { code: 'undo_failed', message: errorMessage(error) } });
          return false;
        } finally {
          if (!disposed) set({ busy: false });
        }
      },
      setViewport(viewport) {
        set({ viewport: { ...viewport } });
      },
      setMouseWorld(point) {
        set({ mouseWorld: point === null ? null : [...point] as Vec2 });
      },
      setSelection(ids) {
        const displaySnapshot = get().displaySnapshot;
        const available = displaySnapshot === null ? new Set<string>() : drawingNodeIds(displaySnapshot);
        const selectedIds = [...new Set(ids)].filter((id) => available.has(id));
        const sequence = ++selectionSequence;
        set({ selectedIds, selectionProjection: null });
        const snapshot = get().snapshot;
        if (snapshot === null || port.projectSelection === undefined) return;
        void port.projectSelection(snapshot.ref, selectedIds).then((result) => {
          if (disposed || sequence !== selectionSequence || result.status !== 'projected') return;
          const current = get();
          if (
            current.snapshot?.ref.drawingId !== result.projection.drawingRef.drawingId
            || current.snapshot.ref.revision !== result.projection.drawingRef.revision
            || JSON.stringify(current.selectedIds) !== JSON.stringify(result.projection.nodeIds)
          ) return;
          set({ selectionProjection: result.projection });
        }).catch(() => {
          // Selection remains a local visual state when Host projection is unavailable.
        });
      },
      setDisplay(display) {
        set({ display: { ...get().display, ...display } });
      },
      clearError() {
        set({ error: null });
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        requestController?.abort();
        unsubscribe?.();
        unsubscribe = undefined;
        sourceResource?.dispose();
        sourceResource = null;
      },
    };
  });

  return store;
}

function drawingNodeIds(snapshot: DrawingWorkspaceSnapshot): Set<string> {
  const { document } = snapshot;
  return new Set([
    ...document.geometry.map((node) => node.id),
    ...document.annotations.map((node) => node.id),
    ...document.relations.map((node) => node.id),
    ...document.features.map((node) => node.id),
  ]);
}

function groundingOverlayMatchesSnapshot(
  overlay: DrawingGroundingOverlay | null,
  snapshot: DrawingWorkspaceSnapshot | null,
): overlay is DrawingGroundingOverlay {
  return overlay !== null
    && snapshot !== null
    && overlay.drawingRef.drawingId === snapshot.ref.drawingId
    && overlay.drawingRef.revision === snapshot.ref.revision;
}

function previewMatchesSnapshot(
  preview: DrawingWorkspacePreview | null,
  snapshot: DrawingWorkspaceSnapshot | null,
): boolean {
  return preview !== null
    && snapshot !== null
    && preview.baseRef.drawingId === snapshot.ref.drawingId
    && preview.baseRef.revision === snapshot.ref.revision;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
