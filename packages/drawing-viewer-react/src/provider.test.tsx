// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DrawingWorkspace,
  DrawingWorkspaceProvider,
  useDrawingWorkspace,
} from './index';

function snapshot(drawingId: string, revision: number): DrawingWorkspaceSnapshot {
  return {
    version: 1,
    ref: { drawingId, revision },
    document: createEmptyDrawing({
      idFactory: { next: () => drawingId },
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

class TestPort implements DrawingWorkspacePort {
  readonly listeners = new Set<() => void>();

  constructor(readonly value: DrawingWorkspaceSnapshot | null, readonly failure?: Error) {}

  async load(): Promise<DrawingWorkspaceSnapshot | null> {
    if (this.failure !== undefined) throw this.failure;
    return this.value;
  }

  async commit(): Promise<DrawingWorkspaceCommitResult> {
    if (this.value === null) return { status: 'rejected', message: 'no drawing' };
    return { status: 'committed', snapshot: this.value };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function RevisionProbe() {
  const revision = useDrawingWorkspace((state) => state.snapshot?.ref.revision ?? 0);
  return <output>{revision}</output>;
}

describe('DrawingWorkspaceProvider', () => {
  it('keeps selectors scoped to their nearest provider', async () => {
    const first = createDrawingWorkspaceStore({ port: new TestPort(snapshot('first', 2)) });
    const second = createDrawingWorkspaceStore({ port: new TestPort(snapshot('second', 9)) });
    await Promise.all([first.getState().load(), second.getState().load()]);

    const markup = renderToStaticMarkup(
      <div>
        <DrawingWorkspaceProvider store={first} autoLoad={false}>
          <RevisionProbe />
        </DrawingWorkspaceProvider>
        <DrawingWorkspaceProvider store={second} autoLoad={false}>
          <RevisionProbe />
        </DrawingWorkspaceProvider>
      </div>,
    );

    expect(markup).toMatch(/<output[^>]*>2<\/output>/);
    expect(markup).toMatch(/<output[^>]*>9<\/output>/);
  });

  it('renders empty, ready, and error states explicitly', async () => {
    const empty = createDrawingWorkspaceStore({ port: new TestPort(null) });
    const ready = createDrawingWorkspaceStore({ port: new TestPort(snapshot('ready-drawing', 3)) });
    const failed = createDrawingWorkspaceStore({ port: new TestPort(null, new Error('offline')) });
    await Promise.all([
      empty.getState().load(),
      ready.getState().load(),
      failed.getState().load(),
    ]);

    const emptyMarkup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={empty} autoLoad={false}>
        <DrawingWorkspace />
      </DrawingWorkspaceProvider>,
    );
    const readyMarkup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={ready} autoLoad={false}>
        <DrawingWorkspace />
      </DrawingWorkspaceProvider>,
    );
    const errorMarkup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={failed} autoLoad={false}>
        <DrawingWorkspace />
      </DrawingWorkspaceProvider>,
    );

    expect(emptyMarkup).toContain('data-workspace-state="empty"');
    expect(emptyMarkup).toContain('还没有图纸');
    expect(readyMarkup).toContain('data-workspace-state="ready"');
    expect(readyMarkup).toContain('data-layout="website-parity"');
    expect(readyMarkup).toContain('data-panel="inspector"');
    expect(readyMarkup).toMatch(/data-panel="inspector"[\s\S]*vai-object-list[\s\S]*vai-inspector[\s\S]*data-canvas-root="true"/);
    expect(readyMarkup).toContain('ready-drawing');
    expect(errorMarkup).toContain('data-workspace-state="error"');
    expect(errorMarkup).toContain('offline');
  });

  it('renders preview contributions from immutable snapshot and viewport inputs', async () => {
    const store = createDrawingWorkspaceStore({ port: new TestPort(snapshot('overlay-drawing', 6)) });
    await store.getState().load();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <DrawingWorkspace previewContributions={[{
          id: 'annotation-preview',
          render: ({ snapshot: current }) => <span>{current.ref.drawingId}</span>,
        }]} />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('data-preview-overlay="annotation-preview"');
    expect(markup).toContain('overlay-drawing');
  });
});
