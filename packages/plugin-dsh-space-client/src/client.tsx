// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type {
  ConversationController,
  ConvViewProps,
} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionId } from '@deepseek-ai/dsh-session';
import {
  DrawingWorkspace,
  DrawingWorkspaceProvider,
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

// DSH discovers entry metadata and lifecycle exports from this client module.
// eslint-disable-next-line react-refresh/only-export-components
export const inject = ['slots', 'remote', 'conversation'];

interface DrawingConversationViewProps extends ConvViewProps {
  workspacePort: DrawingWorkspacePort;
  releaseSources(): void;
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
    <div className="vai-dsh-workspace-host">
      <DrawingWorkspaceProvider store={store}>
        <DrawingWorkspace emptyMessage="还没有已导入的图纸" />
      </DrawingWorkspaceProvider>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function apply(ctx: Context) {
  const remote = ctx.get('remote');
  const slots = ctx.get('slots');
  const disposeRemote = await remote.$mount(DRAWING_SPACE_REMOTE);
  const viewFiber = ctx.inject(['remote.drawingSpace', 'conversation'], (scope) => {
    const drawingSpace = scope.get('remote').drawingSpace;
    const conversation = scope.get('conversation') as unknown as Pick<
      ConversationController,
      'resolveImage' | 'releaseSessionImages'
    >;
    return slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view',
      id: 'drawing',
      order: 20,
      label: () => '图纸',
      inject: (sessionId) => {
        const id = String(sessionId);
        return {
          workspacePort: createDshDrawingWorkspacePort({
            sessionId: id,
            remote: drawingSpace,
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
