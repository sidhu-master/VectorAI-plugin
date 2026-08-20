// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationId,
  DrawingCommand,
  DrawingDocument,
  FeatureId,
  GeometryId,
  RelationId,
  RevisionId,
} from '@/drawing';
import type {
  DrawingWorkspaceCommand,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspacePort,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';

export interface WebsiteDrawingState {
  document: DrawingDocument | null;
  revision: RevisionId | null;
  drawingStatus: 'loading' | 'ready' | 'error';
  drawingBusy: boolean;
  drawingError: string | null;
  initializeDrawing(): Promise<void>;
  commitDrawingCommands(commands: DrawingCommand[]): Promise<boolean>;
}

export interface WebsiteDrawingStore {
  getState(): WebsiteDrawingState;
  subscribe(listener: (state: WebsiteDrawingState, previous: WebsiteDrawingState) => void): () => void;
}

export function createWebsiteDrawingWorkspacePort(
  store: WebsiteDrawingStore,
): DrawingWorkspacePort {
  let lastDocument: DrawingDocument | null = null;
  let lastRevision: RevisionId | null = null;
  let workspaceRevision = 0;
  let suppressNotifications = false;
  let unsubscribeStore: (() => void) | undefined;
  const listeners = new Set<() => void>();

  const synchronizeRevision = (): boolean => {
    const state = store.getState();
    if (state.document === lastDocument && state.revision === lastRevision) return false;
    lastDocument = state.document;
    lastRevision = state.revision;
    if (state.document !== null && state.revision !== null) workspaceRevision += 1;
    return true;
  };

  const currentSnapshot = (): DrawingWorkspaceSnapshot | null => {
    synchronizeRevision();
    const state = store.getState();
    if (state.document === null || state.revision === null) return null;
    return {
      version: 1,
      ref: { drawingId: state.document.id, revision: workspaceRevision },
      document: structuredClone(state.document),
      capabilities: {
        edit: true,
        delete: true,
        annotations: true,
        sourceUnderlay: false,
      },
    };
  };

  return {
    async load(signal) {
      signal?.throwIfAborted();
      if (store.getState().drawingStatus === 'loading') {
        await store.getState().initializeDrawing();
      }
      signal?.throwIfAborted();
      const state = store.getState();
      if (state.drawingStatus === 'error') {
        throw new Error(state.drawingError ?? '无法打开本地图纸');
      }
      return currentSnapshot();
    },

    async commit(request: DrawingWorkspaceCommitRequest, signal): Promise<DrawingWorkspaceCommitResult> {
      signal?.throwIfAborted();
      const before = currentSnapshot();
      if (before === null) return { status: 'rejected', message: '当前没有可编辑图纸' };
      if (request.expectedRevision !== before.ref.revision) {
        return { status: 'conflict', message: '网站图纸版本已变化', snapshot: before };
      }
      const translated = translateCommands(before.document, request.commands);
      if ('error' in translated) return { status: 'rejected', message: translated.error };
      suppressNotifications = true;
      try {
        const committed = await store.getState().commitDrawingCommands(translated.commands);
        signal?.throwIfAborted();
        const snapshot = currentSnapshot();
        if (!committed || snapshot === null) {
          return {
            status: 'rejected',
            message: store.getState().drawingError ?? '网站图纸事务未提交',
          };
        }
        return { status: 'committed', snapshot };
      } finally {
        suppressNotifications = false;
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      if (unsubscribeStore === undefined) {
        unsubscribeStore = store.subscribe(() => {
          const changed = synchronizeRevision();
          if (!changed || suppressNotifications) return;
          for (const current of listeners) current();
        });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeStore?.();
          unsubscribeStore = undefined;
        }
      };
    },
  };
}

function translateCommands(
  document: DrawingDocument,
  commands: DrawingWorkspaceCommand[],
): { commands: DrawingCommand[] } | { error: string } {
  const translated: DrawingCommand[] = [];
  for (const command of commands) {
    const plane = nodePlane(document, command.id);
    if (plane === null) return { error: `节点 ${command.id} 不存在` };
    if (command.type === 'node.update') {
      translated.push(updateCommand(plane, command));
      continue;
    }
    if (command.type === 'node.delete') {
      translated.push(deleteCommand(plane, command.id));
      continue;
    }
    if (plane !== 'annotation') return { error: `节点 ${command.id} 不是可移动标注` };
    const annotation = document.annotations.find((node) => node.id === command.id);
    if (annotation?.type === 'text') {
      translated.push({
        type: 'annotation.update', id: annotation.id,
        changes: { position: command.position },
        expected: { position: command.expectedPosition },
      });
    } else if (annotation?.type === 'dimension') {
      translated.push({
        type: 'annotation.update', id: annotation.id,
        changes: { textPosition: command.position },
        expected: { textPosition: command.expectedPosition },
      });
    } else {
      return { error: `标注 ${command.id} 没有可移动文字位置` };
    }
  }
  return { commands: translated };
}

type NodePlane = 'geometry' | 'annotation' | 'relation' | 'feature';

function nodePlane(document: DrawingDocument, id: string): NodePlane | null {
  if (document.geometry.some((node) => node.id === id)) return 'geometry';
  if (document.annotations.some((node) => node.id === id)) return 'annotation';
  if (document.relations.some((node) => node.id === id)) return 'relation';
  if (document.features.some((node) => node.id === id)) return 'feature';
  return null;
}

function updateCommand(
  plane: NodePlane,
  command: Extract<DrawingWorkspaceCommand, { type: 'node.update' }>,
): DrawingCommand {
  const payload = { changes: command.changes, expected: command.expected };
  switch (plane) {
    case 'geometry': return { type: 'geometry.update', id: command.id as GeometryId, ...payload };
    case 'annotation': return { type: 'annotation.update', id: command.id as AnnotationId, ...payload };
    case 'relation': return { type: 'relation.update', id: command.id as RelationId, ...payload };
    case 'feature': return { type: 'feature.update', id: command.id as FeatureId, ...payload };
  }
}

function deleteCommand(plane: NodePlane, id: string): DrawingCommand {
  switch (plane) {
    case 'geometry': return { type: 'geometry.delete', id: id as GeometryId };
    case 'annotation': return { type: 'annotation.delete', id: id as AnnotationId };
    case 'relation': return { type: 'relation.delete', id: id as RelationId };
    case 'feature': return { type: 'feature.delete', id: id as FeatureId };
  }
}
