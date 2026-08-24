// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import type { DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';
import { describe, expect, it } from 'vitest';

import type { DrawingDurableState, DurableDrawingRepositoryStorage } from './durable-envelope';
import { InMemoryDrawingRepository, type DrawingRepositoryStorage } from './repository';

class MemoryDurableStorage implements DrawingRepositoryStorage, DurableDrawingRepositoryStorage {
  state: DrawingDurableState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_sessionId: string, entry: DrawingDurableState['entry']) {
    this.state = { version: 2, entry: structuredClone(entry), commits: [], operations: [] };
  }
  loadDurable() { return this.state === null ? null : structuredClone(this.state); }
  saveDurable(_sessionId: string, state: DrawingDurableState) { this.state = structuredClone(state); }
}

function repository(storage: MemoryDurableStorage) {
  return new InMemoryDrawingRepository({
    storage,
    now: (() => { let now = 10; return () => now++; })(),
    vectorizer: {
      async vectorize({ drawingId }) {
        const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
        document.geometry = [{
          id: 'hand' as never,
          type: 'circle', center: [10, 10], radius: 2, visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
        }];
        return { document, bounds: { minX: 0, minY: 0, maxX: 30, maxY: 30 }, provisional: false };
      },
    },
    drawingId: () => 'drawing-1',
  });
}

async function imported(storage: MemoryDurableStorage) {
  const drawings = repository(storage);
  const attachment: ImageAttachmentRef = {
    attachmentId: 'image-1' as never, mediaType: 'image/png', bytes: 1, width: 30, height: 30,
  };
  drawings.bindPending('session-1', attachment);
  await drawings.importPending('session-1', { data: new Uint8Array([1]), signal: new AbortController().signal });
  return drawings;
}

describe('durable semantic commits', () => {
  it('commits exactly once, persists inverse history, and replays the receipt', async () => {
    const storage = new MemoryDurableStorage();
    const drawings = await imported(storage);
    const forward: DrawingTransactionCommand[] = [{
      type: 'node.update', id: 'hand', changes: { center: [12, 20] }, expected: { center: [10, 10] },
    }];
    const inverse: DrawingTransactionCommand[] = [{
      type: 'node.update', id: 'hand', changes: { center: [10, 10] }, expected: { center: [12, 20] },
    }];
    const request = {
      expectedRef: { drawingId: 'drawing-1', revision: 1 },
      operationId: 'op-semantic-1',
      operationBindingDigest: 'sha256:binding',
      candidateDigest: 'sha256:candidate',
      forward,
      inverse,
      mode: 'auto-safe' as const,
    };

    const first = drawings.commitSemantic('session-1', request);
    const second = drawings.commitSemantic('session-1', request);

    expect(first.status).toBe('committed');
    expect(second).toEqual(first);
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(2);
    expect(storage.state?.commits).toHaveLength(1);
    expect(storage.state?.operations).toHaveLength(1);
    expect(drawings.getOperation('session-1', 'op-semantic-1', 'sha256:binding')).toEqual({
      status: 'committed', receipt: first,
    });
  });

  it('undoes the latest semantic commit as a new revision', async () => {
    const storage = new MemoryDurableStorage();
    const drawings = await imported(storage);
    const committed = drawings.commitSemantic('session-1', {
      expectedRef: { drawingId: 'drawing-1', revision: 1 },
      operationId: 'op-semantic-1', operationBindingDigest: 'sha256:binding',
      candidateDigest: 'sha256:candidate', mode: 'auto-safe',
      forward: [{ type: 'node.update', id: 'hand', changes: { center: [12, 20] }, expected: { center: [10, 10] } }],
      inverse: [{ type: 'node.update', id: 'hand', changes: { center: [10, 10] }, expected: { center: [12, 20] } }],
    });
    if (committed.status !== 'committed') throw new Error('expected semantic commit');

    const undone = drawings.undoCommit('session-1', {
      targetCommitId: committed.commitId,
      expectedCurrentRef: committed.resultingRef,
      operationId: 'op-undo-1',
      operationBindingDigest: 'sha256:undo-binding',
    });

    expect(undone.status).toBe('committed');
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(3);
    expect(drawings.getSnapshot('session-1')?.document.geometry[0]).toMatchObject({ center: [10, 10] });
    expect(storage.state?.commits.map(({ mode }) => mode)).toEqual(['auto-safe', 'undo']);
  });

  it('redoes the latest undo as a new durable revision', async () => {
    const storage = new MemoryDurableStorage();
    const drawings = await imported(storage);
    const committed = drawings.commitSemantic('session-1', {
      expectedRef: { drawingId: 'drawing-1', revision: 1 },
      operationId: 'op-semantic-1', operationBindingDigest: 'sha256:binding',
      candidateDigest: 'sha256:candidate', mode: 'auto-safe',
      forward: [{ type: 'node.update', id: 'hand', changes: { center: [12, 20] }, expected: { center: [10, 10] } }],
      inverse: [{ type: 'node.update', id: 'hand', changes: { center: [10, 10] }, expected: { center: [12, 20] } }],
    });
    if (committed.status !== 'committed') throw new Error('expected semantic commit');
    const undone = drawings.undoCommit('session-1', {
      targetCommitId: committed.commitId,
      expectedCurrentRef: committed.resultingRef,
      operationId: 'op-undo-1', operationBindingDigest: 'sha256:undo-binding',
    });
    if (undone.status !== 'committed') throw new Error('expected undo commit');

    const redone = drawings.redoCommit('session-1', {
      targetCommitId: undone.commitId,
      expectedCurrentRef: undone.resultingRef,
      operationId: 'op-redo-1', operationBindingDigest: 'sha256:redo-binding',
    });

    expect(redone.status).toBe('committed');
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(4);
    expect(drawings.getSnapshot('session-1')?.document.geometry[0]).toMatchObject({ center: [12, 20] });
    expect(storage.state?.commits.map(({ mode }) => mode)).toEqual(['auto-safe', 'undo', 'redo']);
  });

  it('rejects idempotency key reuse with a different binding', async () => {
    const drawings = await imported(new MemoryDurableStorage());
    const base = {
      expectedRef: { drawingId: 'drawing-1', revision: 1 },
      operationId: 'op-1', operationBindingDigest: 'sha256:a', candidateDigest: 'sha256:candidate',
      mode: 'auto-safe' as const,
      forward: [{ type: 'node.update' as const, id: 'hand', changes: { center: [12, 20] }, expected: { center: [10, 10] } }],
      inverse: [{ type: 'node.update' as const, id: 'hand', changes: { center: [10, 10] }, expected: { center: [12, 20] } }],
    };
    drawings.commitSemantic('session-1', base);

    expect(() => drawings.commitSemantic('session-1', { ...base, operationBindingDigest: 'sha256:b' }))
      .toThrow('IDEMPOTENCY_KEY_REUSED');
  });
});
