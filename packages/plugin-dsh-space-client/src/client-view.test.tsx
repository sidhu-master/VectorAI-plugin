// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type {
  DrawingWorkspacePort,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { DrawingConversationView } from './client';
import { createDrawingSurfaceRegistry } from './surface-registry';

const useIdleSession = ((selector: (state: { running: boolean }) => unknown) => (
  selector({ running: false })
)) as never;
const inputActions = {
  setDraft: vi.fn(), addImages: vi.fn(() => true), removeImage: vi.fn(),
  dropImages: vi.fn(), pruneImages: vi.fn(), submit: vi.fn(),
} as never;
const createDraftImages = vi.fn(() => []);

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
          sessionId="session-1"
          surfaceRegistry={createDrawingSurfaceRegistry()}
          useSession={useIdleSession}
          workspacePort={workspacePort}
          inputActions={inputActions}
          createDraftImages={createDraftImages}
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
          sessionId="session-1"
          surfaceRegistry={createDrawingSurfaceRegistry()}
          useSession={useIdleSession}
          workspacePort={workspacePort}
          inputActions={inputActions}
          createDraftImages={createDraftImages}
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

  it('turns the toolbar upload gesture into an explicit drawing-import composer submission', async () => {
    const workspacePort: DrawingWorkspacePort = {
      load: async () => drawingSnapshot(),
      commit: async () => ({ status: 'rejected', message: 'not available' }),
    };
    const addImages = vi.fn(() => true);
    const setDraft = vi.fn();
    const submit = vi.fn();
    const localInputActions = {
      setDraft, addImages, submit,
      removeImage: vi.fn(), pruneImages: vi.fn(),
    } as never;
    const localCreateDraftImages = vi.fn(() => [{ id: 'draft-image-1' }]);
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <DrawingConversationView
          sessionId="session-1"
          surfaceRegistry={createDrawingSurfaceRegistry()}
          useSession={useIdleSession}
          workspacePort={workspacePort}
          inputActions={localInputActions}
          createDraftImages={localCreateDraftImages}
          releaseSources={() => undefined}
        />,
      );
    });
    const file = { name: 'drawing.png', type: 'image/png' } as File;
    act(() => renderer!.root.findByType('input').props.onChange({
      currentTarget: { files: [file], value: 'drawing.png' },
    }));

    expect(localCreateDraftImages).toHaveBeenCalledWith([file]);
    expect(addImages).toHaveBeenCalledWith(['draft-image-1']);
    expect(setDraft).toHaveBeenCalledWith('请将上传的图片导入并矢量化为可编辑图纸');
    expect(submit).toHaveBeenCalledOnce();
    act(() => renderer!.unmount());
  });
});
