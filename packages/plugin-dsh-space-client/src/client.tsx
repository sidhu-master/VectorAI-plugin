// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { UseSession } from '@deepseek-ai/dsh-client-ui-session/client';
import type { SessionId } from '@deepseek-ai/dsh-session';
import {
  DrawingWorkspace,
  DrawingWorkspaceProvider,
} from '@vectorai/drawing-viewer-react';
import '@vectorai/drawing-viewer-react/styles.css';
import './client.css';
import {
  createDrawingSurfaceRuntime,
  createDrawingWorkspaceStore,
  type DrawingWorkspacePort,
} from '@vectorai/drawing-workspace';
import { DRAWING_SURFACE_REFRESH_EVENT, type DrawingSurfaceRefreshDetail, type DrawingSurfaceRegistry } from '@vectorai/drawing-surface-api';
import { useEffect, useMemo, useRef } from 'react';

import { createDshDrawingWorkspacePort } from './dsh-workspace-port';
import { DRAWING_SPACE_REMOTE } from './remote';
import { DrawingSurfaceHost } from './DrawingSurfaceHost';
import { createDrawingSurfaceRegistry } from './surface-registry';
import { VectorAIWorkspaceOverlay, type DrawingPresence } from './VectorAIWorkspaceOverlay';
import { createDrawingFileExport, type DrawingFileExport } from './drawing-export';
import {
  stageDraftAttachments,
  type DshDraftConversation,
  type DshInputActions,
} from './dsh-draft-attachments';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingSurfaceRegistry: DrawingSurfaceRegistry;
    drawingFileExport: DrawingFileExport;
  }
}

// DSH discovers entry metadata and lifecycle exports from this client module.
// eslint-disable-next-line react-refresh/only-export-components
export const inject = ['slots', 'remote', 'conversation', 'uiConversation'];

interface DrawingConversationViewProps {
  useSession: UseSession;
  sessionId: string;
  surfaceRegistry: DrawingSurfaceRegistry;
  workspacePort: DrawingWorkspacePort;
  inputActions: DshInputActions;
  conversation: DshDraftConversation;
  releaseSources(): void;
  drawingFileExport: DrawingFileExport;
}

function sessionIsRunning(snapshot: unknown): boolean {
  if (typeof snapshot !== 'object' || snapshot === null) return false;
  if ('running' in snapshot) return snapshot.running === true;
  return 'runningCalls' in snapshot
    && Array.isArray(snapshot.runningCalls)
    && snapshot.runningCalls.length > 0;
}

export function DrawingConversationView({
  sessionId,
  surfaceRegistry,
  useSession,
  workspacePort,
  inputActions,
  conversation,
  releaseSources,
  drawingFileExport,
}: DrawingConversationViewProps) {
  const running = useSession(sessionIsRunning);
  const store = useMemo(
    () => createDrawingWorkspaceStore({ port: workspacePort }),
    [workspacePort],
  );
  const surfaceRuntime = useMemo(() => createDrawingSurfaceRuntime(store), [store]);
  const didObserveInitialCallCount = useRef(false);

  useEffect(() => {
    if (didObserveInitialCallCount.current) void store.getState().refresh();
    else didObserveInitialCallCount.current = true;
  }, [running, store]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<DrawingSurfaceRefreshDetail>).detail;
      if (detail?.sessionId === sessionId) void store.getState().refresh();
    };
    window.addEventListener(DRAWING_SURFACE_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(DRAWING_SURFACE_REFRESH_EVENT, refresh);
  }, [sessionId, store]);

  useEffect(() => releaseSources, [releaseSources]);

  const uploadDrawing = (files: readonly File[]) => {
    if (!stageDraftAttachments({ sessionId, files, conversation, inputActions })) return;
    inputActions.setDraft('请将上传的图片导入并矢量化为可编辑图纸');
    inputActions.submit();
  };

  return (
    <DrawingWorkspaceProvider store={store}>
      <DrawingSurfaceHost
        sessionId={sessionId}
        registry={surfaceRegistry}
        runtime={surfaceRuntime}
        fallback={<div
          className="vai-dsh-workspace-host"
          data-conversation-workspace-active=""
        >
          <DrawingWorkspace
            onUploadFiles={uploadDrawing}
            onExport={() => {
              const snapshot = store.getState().displaySnapshot;
              if (snapshot !== null) void drawingFileExport.download(sessionId, snapshot).catch(() => undefined);
            }}
          />
        </div>}
      />
    </DrawingWorkspaceProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function apply(ctx: Context) {
  const surfaceRegistry = createDrawingSurfaceRegistry();
  const drawingFileExport = createDrawingFileExport();
  const disposeRegistry = ctx.provide('drawingSurfaceRegistry', surfaceRegistry);
  const disposeFileExport = ctx.provide('drawingFileExport', drawingFileExport);
  const remote = ctx.get('remote');
  const slots = ctx.get('slots');
  const disposeRemote = await remote.$mount(DRAWING_SPACE_REMOTE);
  const overlayFiber = ctx.inject(['remote.drawingSpace'], (scope) => {
    const drawingSpace = scope.get('remote').drawingSpace;
    const presence: DrawingPresence = {
      async hasDrawing(sessionId) {
        const result = await drawingSpace.getSnapshot(sessionId);
        return result.ok === true && result.value !== null;
      },
      subscribe(sessionId, listener) {
        if (typeof window === 'undefined') return () => undefined;
        const refresh = (event: Event) => {
          const detail = (event as CustomEvent<DrawingSurfaceRefreshDetail>).detail;
          if (detail?.sessionId === sessionId) listener();
        };
        window.addEventListener(DRAWING_SURFACE_REFRESH_EVENT, refresh);
        return () => window.removeEventListener(DRAWING_SURFACE_REFRESH_EVENT, refresh);
      },
    };
    return slots.inject('shell.overlay', () => slots.register({
      name: 'shell.overlay',
      id: 'vectorai-drawing-workspace',
      order: -100,
      children: {
        'vectorai.drawing.workspace': { kind: 'single', scope: 'session' },
      },
      inject: () => ({ drawingPresence: presence }),
    } as never, VectorAIWorkspaceOverlay as never));
  });
  const viewFiber = ctx.inject(['remote.drawingSpace', 'remote.commands', 'conversation', 'uiConversation'], (scope) => {
    const drawingSpace = scope.get('remote').drawingSpace;
    const commands = scope.get('remote').commands;
    const conversation = scope.get('conversation') as unknown as DshDraftConversation;
    const uiConversation = scope.get('uiConversation') as unknown as {
      imageUrl(sessionId: SessionId, attachment: ImageAttachmentRef): Promise<string>;
    };
    return slots.inject('vectorai.drawing.workspace', () => slots.register({
      name: 'vectorai.drawing.workspace',
      inject: (sessionId) => {
        const id = String(sessionId);
        return {
          surfaceRegistry,
          workspacePort: createDshDrawingWorkspacePort({
            sessionId: id,
            remote: drawingSpace,
            commands,
            resolveImage: (ownerId: string, attachment: ImageAttachmentRef) => (
              uiConversation.imageUrl(ownerId as SessionId, attachment)
            ),
          }),
          conversation,
          releaseSources: () => undefined,
          drawingFileExport,
        };
      },
    } as never, DrawingConversationView as never));
  });
  return async () => {
    await viewFiber.dispose();
    await overlayFiber.dispose();
    await disposeRegistry();
    await disposeFileExport();
    await disposeRemote();
  };
}
