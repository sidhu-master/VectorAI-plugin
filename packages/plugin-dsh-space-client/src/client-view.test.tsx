// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type {
  DrawingWorkspacePort,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { DrawingConversationView } from './client';

const useIdleSession = ((selector: (state: { runningCalls: unknown[] }) => unknown) => (
  selector({ runningCalls: [] })
)) as never;

function drawingSnapshot(): DrawingWorkspaceSnapshot {
  return {
    version: 1,
    ref: { drawingId: 'drawing-1', revision: 1 },
    document: createEmptyDrawing({
      idFactory: { next: () => 'drawing-1' },
      now: () => 1,
    }),
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: true,
    },
  };
}

describe('DrawingConversationView', () => {
  it('does not mount the embedded drawing page when the session has no drawing', async () => {
    const workspacePort: DrawingWorkspacePort = {
      load: async () => null,
      commit: async () => ({ status: 'rejected', message: 'not available' }),
    };
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <DrawingConversationView
          useSession={useIdleSession}
          workspacePort={workspacePort}
          releaseSources={() => undefined}
        />,
      );
    });

    expect(renderer!.toJSON()).toBeNull();

    act(() => renderer.unmount());
  });

  it('mounts the embedded drawing page when the session has a drawing', async () => {
    const workspacePort: DrawingWorkspacePort = {
      load: async () => drawingSnapshot(),
      commit: async () => ({ status: 'rejected', message: 'not available' }),
    };
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <DrawingConversationView
          useSession={useIdleSession}
          workspacePort={workspacePort}
          releaseSources={() => undefined}
        />,
      );
    });

    expect(renderer!.root.findByProps({
      className: 'vai-dsh-workspace-host',
      'data-conversation-workspace-active': '',
    })).toBeDefined();

    act(() => renderer.unmount());
  });
});
