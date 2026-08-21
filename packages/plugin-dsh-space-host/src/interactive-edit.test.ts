// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import type { DrawingDurableState } from './durable-envelope';
import { InteractiveEditService } from './interactive-edit';
import { InMemoryDrawingRepository, type DrawingRepositoryStorage } from './repository';

class Storage implements DrawingRepositoryStorage {
  state: DrawingDurableState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_id: string, entry: DrawingDurableState['entry']) { this.state = { version: 2, entry, commits: [], operations: [] }; }
  loadDurable() { return this.state; }
  saveDurable(_id: string, state: DrawingDurableState) { this.state = structuredClone(state); }
}

async function setup() {
  const storage = new Storage();
  const drawings = new InMemoryDrawingRepository({
    storage, drawingId: () => 'drawing-1', now: () => 5,
    vectorizer: { async vectorize({ drawingId }) {
      const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
      document.geometry = [{
        id: 'line-1' as never, type: 'line', start: [0, 0], end: [10, 0], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
      }];
      return { document, bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, provisional: false };
    } },
  });
  const attachment: ImageAttachmentRef = { attachmentId: 'source' as never, mediaType: 'image/png', bytes: 1, width: 10, height: 10 };
  drawings.bindPending('session-1', attachment);
  await drawings.importPending('session-1', { data: new Uint8Array([1]), signal: new AbortController().signal });
  let id = 0;
  return { drawings, storage, edits: new InteractiveEditService(drawings, {
    id: (kind) => `${kind}-${++id}`,
    digest: (value) => `sha256:${value.length}:${id}`,
    now: () => 10,
  }) };
}

describe('InteractiveEditService', () => {
  it('stages without mutation and applies exactly once with opaque tokens', async () => {
    const { drawings, storage, edits } = await setup();
    const staged = edits.stage('session-1', {
      expectedRevision: 1,
      commands: [{
        type: 'node.update', id: 'line-1',
        changes: { end: [10, 5] }, expected: { end: [10, 0] },
      }],
    });
    expect(staged.status).toBe('staged');
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(1);
    if (staged.status !== 'staged') throw new Error('expected staged');

    const first = edits.apply('session-1', staged);
    const second = edits.apply('session-1', staged);

    expect(first).toEqual(second);
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(2);
    expect(storage.state?.commits).toHaveLength(1);
    expect(storage.state?.commits[0]?.mode).toBe('interactive');
  });

  it('rejects identity mutation and stale revisions before staging', async () => {
    const { edits } = await setup();
    expect(edits.stage('session-1', {
      expectedRevision: 0,
      commands: [{ type: 'node.delete', id: 'line-1' }],
    }).status).toBe('conflict');
    expect(edits.stage('session-1', {
      expectedRevision: 1,
      commands: [{
        type: 'node.update', id: 'line-1', changes: { id: 'forged' }, expected: { id: 'line-1' },
      }],
    })).toMatchObject({ status: 'rejected', code: 'INTERACTIVE_FIELD_FORBIDDEN' });
  });
});
