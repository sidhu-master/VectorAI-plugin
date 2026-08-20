// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { DrawingWorkspaceProvider, useDrawingWorkspace } from './index';

class LifecyclePort implements DrawingWorkspacePort {
  readonly listeners = new Set<() => void>();
  readonly value: DrawingWorkspaceSnapshot = {
    version: 1,
    ref: { drawingId: 'mounted', revision: 1 },
    document: createEmptyDrawing({ idFactory: { next: () => 'mounted' }, now: () => 1 }),
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
  };

  async load(): Promise<DrawingWorkspaceSnapshot> {
    return this.value;
  }

  async commit(_request: DrawingWorkspaceCommitRequest): Promise<DrawingWorkspaceCommitResult> {
    return { status: 'committed', snapshot: this.value };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function StatusProbe() {
  const status = useDrawingWorkspace((state) => state.status);
  return <output>{status}</output>;
}

describe('DrawingWorkspaceProvider lifecycle', () => {
  it('loads on mount and releases the workspace subscription on unmount', async () => {
    const port = new LifecyclePort();
    const store = createDrawingWorkspaceStore({ port });
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <DrawingWorkspaceProvider store={store}>
          <StatusProbe />
        </DrawingWorkspaceProvider>,
      );
    });

    expect(store.getState().status).toBe('ready');
    expect(port.listeners.size).toBe(1);

    act(() => renderer.unmount());

    expect(port.listeners.size).toBe(0);
  });
});
