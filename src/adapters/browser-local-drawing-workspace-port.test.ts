// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationId,
  type DrawingDocument,
  type GeometryId,
} from '@vectorai/drawing-core';
import type {
  DrawingWorkspacePort,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import { describe, expect, it } from 'vitest';

import {
  BROWSER_LOCAL_DRAWING_KEY,
  createBrowserLocalDrawingWorkspacePort,
} from './browser-local-drawing-workspace-port';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('browser-local Drawing workspace port', () => {
  it('creates and persists one canonical local Drawing', async () => {
    const storage = new MemoryStorage();
    const first = createBrowserLocalDrawingWorkspacePort({
      storage,
      now: () => 1,
      id: () => 'local-drawing',
    });

    const initial = await first.load();
    const second = createBrowserLocalDrawingWorkspacePort({
      storage,
      now: () => 2,
      id: () => 'unused-drawing',
    });
    const reloaded = await second.load();

    expect(initial?.ref).toEqual({ drawingId: 'local-drawing', revision: 1 });
    expect(reloaded?.ref).toEqual(initial?.ref);
    expect(reloaded?.document.protocol).toBe('VectorAI-Drawing');
    expect(JSON.parse(storage.getItem(BROWSER_LOCAL_DRAWING_KEY) ?? '{}')).toMatchObject({
      version: 1,
      revision: 1,
    });
  });

  it('replaces malformed persisted state with a valid Drawing', async () => {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_LOCAL_DRAWING_KEY, '{not-json');
    const port = createBrowserLocalDrawingWorkspacePort({
      storage,
      now: () => 3,
      id: () => 'recovered-drawing',
    });

    const snapshot = await port.load();

    expect(snapshot?.ref).toEqual({ drawingId: 'recovered-drawing', revision: 1 });
    expect(snapshot?.document.schemaVersion).toBe('1.0');
  });

  it('commits an expected update atomically and rejects a stale revision', async () => {
    const port = createFixturePort();
    const initial = await requiredSnapshot(port);
    let changes = 0;
    const unsubscribe = port.subscribe?.(() => { changes += 1; });

    const committed = await port.commit({
      expectedRevision: initial.ref.revision,
      commands: [{
        type: 'node.update',
        id: 'circle-1',
        changes: { radius: 9 },
        expected: { radius: 5 },
      }],
    });
    const stale = await port.commit({
      expectedRevision: initial.ref.revision,
      commands: [{ type: 'node.delete', id: 'circle-1' }],
    });

    expect(committed.status).toBe('committed');
    expect(radiusOf(committed)).toBe(9);
    expect(stale.status).toBe('conflict');
    expect(radiusOf(stale)).toBe(9);
    expect(changes).toBe(1);
    unsubscribe?.();
  });

  it('publishes no partial write when a later command fails', async () => {
    const port = createFixturePort();
    const initial = await requiredSnapshot(port);

    const result = await port.commit({
      expectedRevision: initial.ref.revision,
      commands: [
        {
          type: 'node.update', id: 'circle-1',
          changes: { radius: 9 }, expected: { radius: 5 },
        },
        {
          type: 'node.update', id: 'circle-1',
          changes: { center: [99, 99] }, expected: { center: [0, 0] },
        },
      ],
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'EXPECTED_VALUE_MISMATCH' });
    expect((await requiredSnapshot(port)).ref.revision).toBe(1);
    expect(radiusOfSnapshot(await requiredSnapshot(port))).toBe(5);
  });

  it('creates, moves, and deletes nodes through workspace commands', async () => {
    const port = createFixturePort();
    const initial = await requiredSnapshot(port);
    const created = await port.commit({
      expectedRevision: initial.ref.revision,
      commands: [{
        type: 'node.create',
        plane: 'annotation',
        node: {
          id: 'label-1' as AnnotationId,
          type: 'text',
          content: 'TOP',
          position: [1, 2],
          height: 3,
          rotation: 0,
          alignment: 'center',
          verticalAlignment: 'middle',
          visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
        },
      }],
    });
    expect(created.status).toBe('committed');
    if (created.status !== 'committed') return;

    const moved = await port.commit({
      expectedRevision: created.snapshot.ref.revision,
      commands: [{
        type: 'annotation.move-text',
        id: 'label-1',
        position: [8, 9],
        expectedPosition: [1, 2],
      }],
    });
    expect(moved.status).toBe('committed');
    if (moved.status !== 'committed') return;
    expect(moved.snapshot.document.annotations[0]).toMatchObject({ position: [8, 9] });

    const deleted = await port.commit({
      expectedRevision: moved.snapshot.ref.revision,
      commands: [{ type: 'node.delete', id: 'circle-1' }],
    });
    expect(deleted.status).toBe('committed');
    if (deleted.status === 'committed') expect(deleted.snapshot.document.geometry).toEqual([]);
  });

  it('rejects a duplicate node ID without publishing a revision', async () => {
    const port = createFixturePort();
    const initial = await requiredSnapshot(port);

    const result = await port.commit({
      expectedRevision: initial.ref.revision,
      commands: [{
        type: 'node.create',
        plane: 'geometry',
        node: {
          id: 'circle-1' as GeometryId,
          type: 'point', x: 1, y: 2, visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
        },
      }],
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'DUPLICATE_NODE_ID' });
    expect((await requiredSnapshot(port)).ref.revision).toBe(1);
  });

  it('supports Undo and Redo as new workspace revisions', async () => {
    const port = createFixturePort();
    const initial = await requiredSnapshot(port);
    const changed = await port.commit({
      expectedRevision: initial.ref.revision,
      commands: [{
        type: 'node.update', id: 'circle-1',
        changes: { radius: 9 }, expected: { radius: 5 },
      }],
    });
    expect(changed.status).toBe('committed');
    if (changed.status !== 'committed') return;

    const undone = await port.undoLast?.(changed.snapshot);
    expect(undone?.status).toBe('committed');
    expect(undone && radiusOf(undone)).toBe(5);
    if (!undone || undone.status !== 'committed') return;

    const redone = await port.redoLast?.(undone.snapshot);
    expect(redone?.status).toBe('committed');
    expect(redone && radiusOf(redone)).toBe(9);
    if (redone?.status === 'committed') {
      expect(redone.snapshot.ref.revision).toBe(4);
    }
  });
});

function createFixturePort(): DrawingWorkspacePort {
  const document = fixtureDocument();
  return createBrowserLocalDrawingWorkspacePort({
    storage: new MemoryStorage(),
    now: () => 10,
    id: () => 'fixture-drawing',
    initialDocument: document,
  });
}

function fixtureDocument(): DrawingDocument {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'fixture-drawing' },
    now: () => 1,
  });
  document.geometry = [{
    id: 'circle-1' as GeometryId,
    type: 'circle',
    center: [10, 20],
    radius: 5,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  return document;
}

async function requiredSnapshot(port: DrawingWorkspacePort): Promise<DrawingWorkspaceSnapshot> {
  const snapshot = await port.load();
  if (!snapshot) throw new Error('fixture did not load');
  return snapshot;
}

function radiusOf(result: {
  status: string;
  snapshot?: DrawingWorkspaceSnapshot;
}): number | undefined {
  return result.snapshot ? radiusOfSnapshot(result.snapshot) : undefined;
}

function radiusOfSnapshot(snapshot: DrawingWorkspaceSnapshot): number | undefined {
  const node = snapshot.document.geometry.find(({ id }) => id === 'circle-1');
  return node?.type === 'circle' ? node.radius : undefined;
}
