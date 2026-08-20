// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type DrawingCommand,
  type GeometryId,
  type RevisionId,
} from '@/drawing';
import { createStore } from 'zustand/vanilla';
import { describe, expect, it } from 'vitest';

import {
  createWebsiteDrawingWorkspacePort,
  type WebsiteDrawingState,
} from './website-drawing-workspace-port';

const revision1 = 'revision_1' as RevisionId;
const revision2 = 'revision_2' as RevisionId;

function stateStore() {
  const document = createEmptyDrawing({ idFactory: { next: () => 'website-drawing' }, now: () => 1 });
  document.geometry = [{
    id: 'circle-1' as GeometryId,
    type: 'circle', center: [10, 20], radius: 5, visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  const committed: DrawingCommand[][] = [];
  const store = createStore<WebsiteDrawingState>((set, get) => ({
    document,
    revision: revision1,
    drawingStatus: 'ready',
    drawingBusy: false,
    drawingError: null,
    async initializeDrawing() {},
    async commitDrawingCommands(commands) {
      committed.push(structuredClone(commands));
      const next = structuredClone(get().document)!;
      const circle = next.geometry[0];
      const update = commands[0];
      if (circle.type === 'circle' && update?.type === 'geometry.update') {
        Object.assign(circle, update.changes);
      }
      set({ document: next, revision: revision2, drawingError: null });
      return true;
    },
  }));
  return { store, committed };
}

describe('website drawing workspace port', () => {
  it('maps website authority into a complete versioned snapshot', async () => {
    const { store } = stateStore();
    const port = createWebsiteDrawingWorkspacePort(store);

    const snapshot = await port.load();

    expect(snapshot?.version).toBe(1);
    expect(snapshot?.ref).toEqual({ drawingId: 'website-drawing', revision: 1 });
    expect(snapshot?.document.geometry[0]).toMatchObject({ id: 'circle-1', radius: 5 });
    expect(snapshot?.capabilities).toEqual({
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: false,
    });
  });

  it('translates a shared update into one canonical website command batch', async () => {
    const { store, committed } = stateStore();
    const port = createWebsiteDrawingWorkspacePort(store);
    await port.load();

    const result = await port.commit({
      expectedRevision: 1,
      commands: [{
        type: 'node.update', id: 'circle-1',
        changes: { radius: 9 }, expected: { radius: 5 },
      }],
    });

    expect(committed).toEqual([[{
      type: 'geometry.update', id: 'circle-1',
      changes: { radius: 9 }, expected: { radius: 5 },
    }]]);
    expect(result.status).toBe('committed');
    if (result.status === 'committed') {
      expect(result.snapshot.ref.revision).toBe(2);
      expect(result.snapshot.document.geometry[0]).toMatchObject({ radius: 9 });
    }
  });

  it('returns the latest authoritative snapshot instead of applying a stale request', async () => {
    const { store, committed } = stateStore();
    const port = createWebsiteDrawingWorkspacePort(store);
    await port.load();
    store.setState({ revision: revision2 });

    const result = await port.commit({ expectedRevision: 1, commands: [{ type: 'node.delete', id: 'circle-1' }] });

    expect(result.status).toBe('conflict');
    expect(committed).toEqual([]);
    if (result.status === 'conflict') expect(result.snapshot?.ref.revision).toBe(2);
  });

  it('notifies subscribers only when website drawing authority changes', async () => {
    const { store } = stateStore();
    const port = createWebsiteDrawingWorkspacePort(store);
    await port.load();
    let changes = 0;
    const unsubscribe = port.subscribe?.(() => { changes += 1; });

    store.setState({ drawingBusy: true });
    store.setState({ revision: revision2 });

    expect(changes).toBe(1);
    unsubscribe?.();
    store.setState({ revision: revision1 });
    expect(changes).toBe(1);
  });
});
