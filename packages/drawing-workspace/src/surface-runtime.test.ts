// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type GeometryId,
} from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  createDrawingSurfaceRuntime,
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from './index';

function initialSnapshot(): DrawingWorkspaceSnapshot {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
  document.geometry = [{
    id: 'line-1' as GeometryId,
    type: 'line',
    start: [0, 0],
    end: [10, 0],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  return {
    version: 1,
    ref: { drawingId: 'drawing-1', revision: 1 },
    document,
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false },
  };
}

class RuntimePort implements DrawingWorkspacePort {
  current = initialSnapshot();

  async load() {
    return structuredClone(this.current);
  }

  async commit(request: DrawingWorkspaceCommitRequest): Promise<DrawingWorkspaceCommitResult> {
    if (request.expectedRevision !== this.current.ref.revision) {
      return { status: 'conflict', message: 'stale', snapshot: structuredClone(this.current) };
    }
    const line = this.current.document.geometry[0];
    const update = request.commands[0];
    if (line?.type === 'line' && update?.type === 'node.update') {
      Object.assign(line, structuredClone(update.changes));
    }
    this.current.ref.revision += 1;
    return { status: 'committed', snapshot: structuredClone(this.current) };
  }
}

describe('drawing surface runtime', () => {
  it('exposes cloned readonly projections instead of the Store API', async () => {
    const store = createDrawingWorkspaceStore({ port: new RuntimePort() });
    await store.getState().load();
    const runtime = createDrawingSurfaceRuntime(store);

    const exposed = runtime.snapshot.getSnapshot();
    expect(exposed).not.toBe(store.getState().snapshot);
    expect(Object.keys(runtime.actions).sort()).toEqual([
      'query', 'redo', 'setSelection', 'setViewport', 'stage', 'undo',
    ]);
    expect(runtime).not.toHaveProperty('getState');
    if (exposed !== null) {
      (exposed.document.geometry as unknown as unknown[]).length = 0;
    }
    expect(store.getState().snapshot?.document.geometry).toHaveLength(1);
  });

  it('publishes selection changes without repeating equal projections', async () => {
    const store = createDrawingWorkspaceStore({ port: new RuntimePort() });
    await store.getState().load();
    const runtime = createDrawingSurfaceRuntime(store);
    let notifications = 0;
    const dispose = runtime.selection.subscribe(() => { notifications += 1; });

    runtime.actions.setSelection(['line-1']);
    runtime.actions.setSelection(['line-1']);

    expect(runtime.selection.getSnapshot()).toEqual(['line-1']);
    expect(notifications).toBe(1);
    dispose();
  });

  it('queries locally and rejects a stale staged request before commit', async () => {
    const store = createDrawingWorkspaceStore({ port: new RuntimePort() });
    await store.getState().load();
    const runtime = createDrawingSurfaceRuntime(store);

    const result = await runtime.actions.query({ kind: 'node', id: 'line-1' });
    expect(result).toMatchObject({ kind: 'node', node: { plane: 'geometry' } });
    await expect(runtime.actions.stage({
      expectedRevision: 0,
      commands: [{
        type: 'node.update', id: 'line-1', changes: { end: [20, 0] }, expected: { end: [10, 0] },
      }],
    })).resolves.toBe(false);
    expect(store.getState().snapshot?.ref.revision).toBe(1);
  });
});
