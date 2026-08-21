// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type {
  ConversationController,
} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionId } from '@deepseek-ai/dsh-session';
import {
  DrawingWorkspace,
  DrawingWorkspaceProvider,
  useDrawingWorkspace,
} from '@vectorai/drawing-viewer-react';
import '@vectorai/drawing-viewer-react/styles.css';
import './client.css';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspacePort,
} from '@vectorai/drawing-workspace';
import { useEffect, useMemo, useRef } from 'react';

import { createDshDrawingWorkspacePort } from './dsh-workspace-port';
import { DRAWING_SPACE_REMOTE } from './remote';
import type { DrawingWorkspaceSlotProps } from './workspace-slot';

// DSH discovers entry metadata and lifecycle exports from this client module.
// eslint-disable-next-line react-refresh/only-export-components
export const inject = ['slots', 'remote', 'conversation'];

interface DrawingConversationViewProps extends Pick<DrawingWorkspaceSlotProps, 'useSession'> {
  workspacePort: DrawingWorkspacePort;
  releaseSources(): void;
}

function MountedDrawingWorkspace() {
  const hasDrawing = useDrawingWorkspace((state) => state.snapshot !== null);
  if (!hasDrawing) return null;

  return (
    <div
      className="vai-dsh-workspace-host"
      data-conversation-workspace-active=""
    >
      <DrawingWorkspace />
    </div>
  );
}

export function DrawingConversationView({
  useSession,
  workspacePort,
  releaseSources,
}: DrawingConversationViewProps) {
  const runningCallCount = useSession((snapshot) => snapshot.runningCalls.length);
  const store = useMemo(
    () => createDrawingWorkspaceStore({ port: workspacePort }),
    [workspacePort],
  );
  const didObserveInitialCallCount = useRef(false);

  useEffect(() => {
    if (didObserveInitialCallCount.current) void store.getState().refresh();
    else didObserveInitialCallCount.current = true;
  }, [runningCallCount, store]);

  useEffect(() => releaseSources, [releaseSources]);

  return (
    <DrawingWorkspaceProvider store={store}>
      <MountedDrawingWorkspace />
    </DrawingWorkspaceProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function apply(ctx: Context) {
  const remote = ctx.get('remote');
  const slots = ctx.get('slots');
  const disposeRemote = await remote.$mount(DRAWING_SPACE_REMOTE);
  const viewFiber = ctx.inject(['remote.drawingSpace', 'remote.commands', 'conversation'], (scope) => {
    const drawingSpace = scope.get('remote').drawingSpace;
    const commands = scope.get('remote').commands;
    const conversation = scope.get('conversation') as unknown as Pick<
      ConversationController,
      'resolveImage' | 'releaseSessionImages'
    >;
    return slots.inject('conversation.workspace', () => slots.register({
      name: 'conversation.workspace',
      inject: (sessionId) => {
        const id = String(sessionId);
        return {
          workspacePort: createDshDrawingWorkspacePort({
            sessionId: id,
            remote: drawingSpace,
            commands,
            resolveImage: (ownerId: string, attachment: ImageAttachmentRef) => (
              conversation.resolveImage(ownerId as SessionId, attachment)
            ),
          }),
          releaseSources: () => conversation.releaseSessionImages(id as SessionId),
        };
      },
    }, DrawingConversationView));
  });
  return async () => {
    await viewFiber.dispose();
    await disposeRemote();
  };
}
