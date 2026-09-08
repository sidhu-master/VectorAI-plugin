// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type DimensionAnnotation, type LeaderAnnotation } from '@vectorai/drawing-core';
import { invertDrawingTransaction } from '@vectorai/drawing-edit-core';
import type { DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';
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

async function setup(layout?: DimensionAnnotation['layout']) {
  const storage = new Storage();
  const drawings = new InMemoryDrawingRepository({
    storage, drawingId: () => 'drawing-1', now: () => 5,
    vectorizer: { async vectorize({ drawingId }) {
      const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
      document.geometry = [{
        id: 'line-1' as never, type: 'line', start: [0, 0], end: [10, 0], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
      }];
      document.annotations = [{
        id: 'dimension-1' as never, type: 'dimension', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        dimensionKind: 'diameter', associationStatus: 'resolved', targets: [],
        computedValue: 20, textPosition: [5, 12], definitionPoints: [[5, -10], [5, 10]],
        ...(layout === undefined ? {} : { layout }),
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
  it('creates a branched detail leader through the document contract, saves, reloads and undoes/redoes it', async () => {
    const { drawings, storage } = await setup();
    const before = drawings.getSnapshot('session-1')!;
    const leader: LeaderAnnotation = { id: 'leader' as never, type: 'leader', visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
      target: { geometryId: 'line-1' as never, anchor: { kind: 'start' } }, points: [[0, 0], [5, 8]], content: 'II', textHeight: 3.5,
      branches: [{ target: { geometryId: 'line-1' as never, anchor: { kind: 'end' } }, points: [[10, 0], [5, 8]] }], callout: { type: 'detail', radius: 3 } };
    const forward: DrawingTransactionCommand[] = [{ type: 'node.create', plane: 'annotation', node: structuredClone(leader) as never }];
    const applied = drawings.commitSemantic('session-1', {
      expectedRef: before.ref, operationId: 'create-leader', operationBindingDigest: 'sha256:create-leader', candidateDigest: 'sha256:leader-candidate',
      mode: 'confirmed', forward, inverse: invertDrawingTransaction(before.document, forward),
    });
    if (applied.status !== 'committed') throw new Error('expected leader commit');
    storage.state = JSON.parse(JSON.stringify(storage.state));
    const restored = new InMemoryDrawingRepository({ storage, now: () => 20, vectorizer: { async vectorize() { throw new Error('NO_REVECTORIZE'); } } });
    expect(restored.getSnapshot('session-1')!.document.annotations.at(-1)).toEqual(leader);
    const undo = restored.undoCommit('session-1', { operationId: 'undo-leader', operationBindingDigest: 'sha256:undo-leader', expectedCurrentRef: restored.getSnapshot('session-1')!.ref, targetCommitId: applied.commitId });
    if (undo.status !== 'committed') throw new Error('expected undo');
    expect(restored.getSnapshot('session-1')!.document.annotations).toEqual(before.document.annotations);
    restored.redoCommit('session-1', { operationId: 'redo-leader', operationBindingDigest: 'sha256:redo-leader', expectedCurrentRef: restored.getSnapshot('session-1')!.ref, targetCommitId: undo.commitId });
    expect(restored.getSnapshot('session-1')!.document.annotations.at(-1)).toEqual(leader);
    const invalid = { ...leader, id: 'invalid-leader' as never, branches: [{ ...leader.branches![0], target: { geometryId: 'missing' as never, anchor: { kind: 'start' as const } } }] };
    expect(restored.commit('session-1', { expectedRevision: restored.getSnapshot('session-1')!.ref.revision,
      commands: [{ type: 'node.create', plane: 'annotation', node: invalid }] })).toMatchObject({ status: 'rejected', code: 'DANGLING_REFERENCE' });
  });

  it.each([undefined, 'automatic', 'manual'] as const)('saves and restores %s placement ownership across reload, undo and redo', async (mode) => {
    const layout = mode === undefined ? undefined : { mode, generatedText: '⌀20' };
    const { drawings, storage, edits } = await setup(layout);
    const before = drawings.getSnapshot('session-1')!.document.annotations;
    const staged = edits.stage('session-1', {
      expectedRevision: 1,
      commands: [{
        type: 'node.update', id: 'dimension-1',
        changes: { textPosition: [15, 12], definitionPoints: [[15, -10], [15, 10]] },
        expected: { textPosition: [5, 12], definitionPoints: [[5, -10], [5, 10]] },
      }],
    });
    if (staged.status !== 'staged') throw new Error(JSON.stringify(staged));
    const applied = edits.apply('session-1', staged);
    if (applied.status !== 'committed') throw new Error('expected placement commit');
    const after = drawings.getSnapshot('session-1')!.document.annotations;
    expect(after[0]).toMatchObject({ layout: { mode: 'manual' }, textPosition: [15, 12] });
    storage.state = JSON.parse(JSON.stringify(storage.state));
    const restored = new InMemoryDrawingRepository({
      storage, now: () => 20,
      vectorizer: { async vectorize() { throw new Error('RELOAD_MUST_NOT_REVECTORIZE'); } },
    });
    expect(restored.getSnapshot('session-1')!.document.annotations).toEqual(after);
    const undone = restored.undoCommit('session-1', {
      operationId: 'undo-placement', operationBindingDigest: 'sha256:undo-placement',
      expectedCurrentRef: restored.getSnapshot('session-1')!.ref, targetCommitId: applied.commitId,
    });
    if (undone.status !== 'committed') throw new Error('expected undo commit');
    expect(restored.getSnapshot('session-1')!.document.annotations).toEqual(before);
    restored.redoCommit('session-1', {
      operationId: 'redo-placement', operationBindingDigest: 'sha256:redo-placement',
      expectedCurrentRef: restored.getSnapshot('session-1')!.ref, targetCommitId: undone.commitId,
    });
    expect(restored.getSnapshot('session-1')!.document.annotations).toEqual(after);
  });

  it('also claims legacy dimensions in direct workspace text and geometry commits', async () => {
    for (const command of [{
      type: 'annotation.move-text' as const, id: 'dimension-1',
      position: [15, 12] as [number, number], expectedPosition: [5, 12] as [number, number],
    }, {
      type: 'node.update' as const, id: 'dimension-1',
      changes: { definitionPoints: [[15, -10], [15, 10]] }, expected: {},
    }]) {
      const { drawings } = await setup();
      const result = drawings.commit('session-1', { expectedRevision: 1, commands: [command] });
      expect(result.status).toBe('committed');
      expect(drawings.getSnapshot('session-1')!.document.annotations[0]).toMatchObject({ layout: { mode: 'manual' } });
    }
  });

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
