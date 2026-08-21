// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import type { DrawingDurableState } from './durable-envelope';
import type { DrawingEntry, DrawingRepositoryStorage, ImageVectorizer } from './repository';
import { InMemoryDrawingRepository } from './repository';

function attachment(
  attachmentId: string,
  width = 120,
  height = 80,
): ImageAttachmentRef {
  return {
    attachmentId: attachmentId as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png',
    bytes: 4,
    width,
    height,
    name: `${attachmentId}.png`,
  };
}

function vectorizer(): ImageVectorizer & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async vectorize({ attachment: source }) {
      calls.push(String(source.attachmentId));
      const document = createEmptyDrawing({
        idFactory: { next: () => 'drawing_fixture' },
        now: () => 1,
      });
      const fixtureLines: Array<[
        string,
        readonly [number, number],
        readonly [number, number],
      ]> = [
        ['top', [0, 0], [120, 0]],
        ['right', [120, 0], [120, 80]],
        ['bottom', [120, 80], [0, 80]],
        ['left', [0, 80], [0, 0]],
      ];
      document.geometry = fixtureLines.map(([id, start, end]) => ({
        id: id as typeof document.geometry[number]['id'],
        type: 'line' as const,
        start,
        end,
        visible: true,
        quality: { status: 'candidate' as const, evidenceRefs: [] },
      }));
      return {
        document,
        bounds: { minX: 0, minY: 0, maxX: source.width, maxY: source.height },
        provisional: true,
      };
    },
  };
}

function repository(
  imageVectorizer: ImageVectorizer = vectorizer(),
  previewOptions: { previewHandle?: () => string; now?: () => number } = {},
) {
  return new InMemoryDrawingRepository({
    vectorizer: imageVectorizer,
    drawingId: (_sessionId, source) => `drawing_${String(source.attachmentId)}`,
    ...previewOptions,
  });
}

describe('InMemoryDrawingRepository', () => {
  it('promotes a legacy version-1 drawing into durable history on first semantic commit', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing_legacy' }, now: () => 1 });
    document.geometry = [{
      id: 'top' as never, type: 'line', start: [0, 0], end: [10, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const legacy: DrawingEntry = {
      attachmentId: 'legacy-source', document, drawingId: 'drawing_legacy',
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, revision: 1,
      source: { id: 'legacy-source', mediaType: 'image/png', bytes: 1, width: 10, height: 10 },
      provisional: false,
    };
    let saved: DrawingDurableState | null = null;
    const storage: DrawingRepositoryStorage = {
      load: () => structuredClone(legacy),
      save() {},
      loadDurable: () => null,
      saveDurable: (_sessionId, state) => { saved = structuredClone(state); },
    };
    const drawings = new InMemoryDrawingRepository({ vectorizer: vectorizer(), storage, now: () => 2 });

    const receipt = drawings.commitSemantic('legacy-session', {
      expectedRef: { drawingId: 'drawing_legacy', revision: 1 },
      operationId: 'upgrade-operation', operationBindingDigest: 'sha256:upgrade-binding',
      candidateDigest: 'sha256:upgrade-candidate', mode: 'confirmed',
      forward: [{ type: 'node.update', id: 'top', expected: { visible: true }, changes: { visible: false } }],
      inverse: [{ type: 'node.update', id: 'top', expected: { visible: false }, changes: { visible: true } }],
    });

    expect(receipt).toMatchObject({
      status: 'committed', resultingRef: { drawingId: 'drawing_legacy', revision: 2 },
    });
    expect(saved).toMatchObject({ version: 2, entry: { revision: 2 }, commits: [{ mode: 'confirmed' }] });
  });

  it('keeps only the latest pending image in one session', () => {
    const drawings = repository();

    drawings.bindPending('session-a', attachment('first'));
    drawings.bindPending('session-a', attachment('second'));

    expect(drawings.getPending('session-a')).toEqual(attachment('second'));
  });

  it('stores a projection and summary with the same drawing reference', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));

    const result = await drawings.importPending('session-a', {
      data: new Uint8Array([1, 2, 3, 4]),
      signal: new AbortController().signal,
    });

    expect(result).toEqual({
      status: 'imported',
      ref: { drawingId: 'drawing_source', revision: 1 },
      provisional: true,
    });
    expect(drawings.getSnapshot('session-a')?.ref).toEqual(result.ref);
    expect(drawings.getSnapshot('session-a')).toMatchObject({
      version: 1,
      ref: result.ref,
      source: {
        id: 'source',
        mediaType: 'image/png',
        bytes: 4,
        width: 120,
        height: 80,
        name: 'source.png',
      },
      capabilities: {
        edit: true,
        delete: true,
        annotations: true,
        sourceUnderlay: true,
      },
      provisional: true,
    });
    expect(drawings.getSnapshot('session-a')?.source).not.toHaveProperty('dataUrl');
    expect(drawings.summarize('session-a')).toEqual({
      ref: result.ref,
      unit: 'mm',
      bounds: { minX: 0, minY: 0, maxX: 120, maxY: 80 },
      geometryByType: { line: 4 },
      provisional: true,
    });
  });

  it('commits workspace commands atomically and advances the revision', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    const result = drawings.commit('session-a', {
      expectedRevision: 1,
      commands: [{
        type: 'node.update',
        id: 'top',
        changes: { visible: false },
        expected: { visible: true },
      }],
    });

    expect(result.status).toBe('committed');
    if (result.status !== 'committed') throw new Error('expected committed result');
    expect(result.snapshot.ref.revision).toBe(2);
    expect(result.snapshot.document.geometry.find((node) => node.id === 'top')?.visible).toBe(false);
    expect(drawings.getSnapshot('session-a')?.ref.revision).toBe(2);
  });

  it('returns the authoritative snapshot for stale revisions without mutating', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    const result = drawings.commit('session-a', {
      expectedRevision: 0,
      commands: [{ type: 'node.delete', id: 'top' }],
    });

    expect(result).toMatchObject({
      status: 'conflict',
      snapshot: { ref: { revision: 1 } },
    });
    expect(drawings.getSnapshot('session-a')?.document.geometry).toHaveLength(4);
  });

  it('rejects failed preconditions and leaves the document unchanged', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    const result = drawings.commit('session-a', {
      expectedRevision: 1,
      commands: [{
        type: 'node.update',
        id: 'top',
        changes: { visible: false },
        expected: { visible: false },
      }],
    });

    expect(result).toEqual({
      status: 'rejected',
      message: 'Precondition failed for node top property visible',
      code: 'PRECONDITION_FAILED',
    });
    expect(drawings.getSnapshot('session-a')?.document.geometry[0]?.visible).toBe(true);
  });

  it('reuses an import of the same attachment without vectorizing twice', async () => {
    const imageVectorizer = vectorizer();
    const drawings = repository(imageVectorizer);
    drawings.bindPending('session-a', attachment('source'));
    const input = {
      data: new Uint8Array([1, 2, 3, 4]),
      signal: new AbortController().signal,
    };

    await drawings.importPending('session-a', input);
    const second = await drawings.importPending('session-a', input);

    expect(second.status).toBe('already-imported');
    expect(imageVectorizer.calls).toEqual(['source']);
  });

  it('does not commit a drawing when vectorization fails', async () => {
    const drawings = repository({
      async vectorize() {
        throw new Error('vectorizer failed');
      },
    });
    drawings.bindPending('session-a', attachment('source'));

    await expect(drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    })).rejects.toThrow('vectorizer failed');
    expect(drawings.getSnapshot('session-a')).toBeNull();
  });

  it('does not commit a drawing when cancellation wins after vectorization', async () => {
    const controller = new AbortController();
    const drawings = repository({
      async vectorize(input) {
        controller.abort(new Error('cancelled'));
        return vectorizer().vectorize(input);
      },
    });
    drawings.bindPending('session-a', attachment('source'));

    await expect(drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: controller.signal,
    })).rejects.toThrow('cancelled');
    expect(drawings.getSnapshot('session-a')).toBeNull();
  });

  it('isolates sessions and removes all state on disposal', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    expect(drawings.getSnapshot('session-b')).toBeNull();
    drawings.disposeSession('session-a');

    expect(drawings.getPending('session-a')).toBeNull();
    expect(drawings.getSnapshot('session-a')).toBeNull();
  });

  it('queries the exact current Drawing revision and clones the result', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    const request = {
      kind: 'world-slice' as const,
      ref: { drawingId: 'drawing_source', revision: 1 },
      bounds: { minX: -1, minY: -1, maxX: 121, maxY: 1 },
      limit: 20,
    };
    const first = drawings.query('session-a', request);

    expect(first.ref).toEqual(request.ref);
    expect(first.kind).toBe('world-slice');
    if (first.kind !== 'world-slice') throw new Error('expected world slice');
    expect(first.nodes.map(({ node }) => node.id)).toEqual(['top', 'right', 'left']);
    (first.nodes[0]?.node as { visible: boolean }).visible = false;
    const second = drawings.query('session-a', request);
    if (second.kind !== 'world-slice') throw new Error('expected world slice');
    expect(second.nodes[0]?.node.visible).toBe(true);
  });

  it('rejects queries for missing, stale and different drawings', async () => {
    const drawings = repository();
    const query = {
      kind: 'node' as const,
      ref: { drawingId: 'drawing_source', revision: 1 },
      id: 'top',
    };

    expect(() => drawings.query('session-a', query)).toThrow('DRAWING_REQUIRED');
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    expect(() => drawings.query('session-a', {
      ...query,
      ref: { ...query.ref, revision: 0 },
    })).toThrow('DRAWING_STALE');
    expect(() => drawings.query('session-a', {
      ...query,
      ref: { ...query.ref, drawingId: 'drawing_other' },
    })).toThrow('DRAWING_STALE');
  });

  it('creates a Preview without changing the formal snapshot', async () => {
    const drawings = repository(vectorizer(), {
      previewHandle: () => 'preview-1',
      now: () => 42,
    });
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    const result = drawings.createPreview('session-a', {
      ref: { drawingId: 'drawing_source', revision: 1 },
      summary: 'hide top edge',
      commands: [{
        type: 'node.update',
        id: 'top',
        changes: { visible: false },
        expected: { visible: true },
      }],
    });

    expect(result.status).toBe('previewed');
    if (result.status !== 'previewed') throw new Error('expected previewed result');
    expect(result.preview).toMatchObject({
      handle: 'preview-1',
      baseRef: { drawingId: 'drawing_source', revision: 1 },
      createdAt: 42,
      summary: 'hide top edge',
      diff: { createdNodeIds: [], updatedNodeIds: ['top'], deletedNodeIds: [] },
    });
    expect(result.preview.candidate.document.geometry[0]?.visible).toBe(false);
    expect(drawings.getSnapshot('session-a')?.document.geometry[0]?.visible).toBe(true);
    expect(drawings.getSnapshot('session-a')?.ref.revision).toBe(1);
  });

  it('previews newly created annotation and relation nodes through public commands', async () => {
    const drawings = repository(vectorizer(), { previewHandle: () => 'preview-create' });
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    const result = drawings.createPreview('session-a', {
      ref: { drawingId: 'drawing_source', revision: 1 },
      commands: [{
        type: 'node.create',
        plane: 'annotation',
        node: {
          id: 'label-1' as never,
          type: 'text',
          content: 'TOP',
          position: [60, 5],
          height: 3,
          rotation: 0,
          alignment: 'center',
          verticalAlignment: 'middle',
          visible: true,
          quality: { status: 'candidate', evidenceRefs: [] },
        },
      }, {
        type: 'node.create',
        plane: 'relation',
        node: {
          id: 'association-1' as never,
          type: 'association',
          plane: 'association',
          kind: 'annotation-target',
          annotationId: 'label-1' as never,
          geometryIds: ['top' as never],
          visible: true,
          quality: { status: 'candidate', evidenceRefs: [] },
        },
      }],
    });

    expect(result.status).toBe('previewed');
    if (result.status !== 'previewed') throw new Error('expected previewed result');
    expect(result.preview.diff.createdNodeIds).toEqual(['label-1', 'association-1']);
    expect(result.preview.candidate.document.annotations[0]?.id).toBe('label-1');
    expect(result.preview.candidate.document.relations[0]?.id).toBe('association-1');
    expect(drawings.getSnapshot('session-a')?.document.annotations).toEqual([]);
  });

  it('commits one current Preview as exactly one formal revision', async () => {
    const drawings = repository(vectorizer(), { previewHandle: () => 'preview-commit' });
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });
    drawings.createPreview('session-a', {
      ref: { drawingId: 'drawing_source', revision: 1 },
      commands: [{ type: 'node.delete', id: 'top' }, { type: 'node.delete', id: 'bottom' }],
    });

    const result = drawings.commitPreview('session-a', { handle: 'preview-commit' });

    expect(result.status).toBe('committed');
    if (result.status !== 'committed') throw new Error('expected committed result');
    expect(result.snapshot.ref.revision).toBe(2);
    expect(result.snapshot.document.geometry.map(({ id }) => id)).toEqual(['right', 'left']);
    expect(drawings.getPreview('session-a')).toBeNull();
  });

  it('discards a Preview without changing the formal revision', async () => {
    const drawings = repository(vectorizer(), { previewHandle: () => 'preview-discard' });
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });
    drawings.createPreview('session-a', {
      ref: { drawingId: 'drawing_source', revision: 1 },
      commands: [{ type: 'node.delete', id: 'top' }],
    });

    expect(drawings.discardPreview('session-a', { handle: 'preview-discard' })).toEqual({
      status: 'discarded',
      ref: { drawingId: 'drawing_source', revision: 1 },
    });
    expect(drawings.getPreview('session-a')).toBeNull();
    expect(drawings.getSnapshot('session-a')?.document.geometry).toHaveLength(4);
  });

  it('replaces the current Preview and rejects old or foreign handles', async () => {
    const handles = ['preview-old', 'preview-new'];
    const drawings = repository(vectorizer(), { previewHandle: () => handles.shift() ?? 'preview-extra' });
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });
    const request = {
      ref: { drawingId: 'drawing_source', revision: 1 },
      commands: [{ type: 'node.delete' as const, id: 'top' }],
    };
    drawings.createPreview('session-a', request);
    drawings.createPreview('session-a', request);

    expect(drawings.commitPreview('session-a', { handle: 'preview-old' })).toEqual({
      status: 'rejected',
      message: 'Preview preview-old is not current',
      code: 'PREVIEW_NOT_CURRENT',
    });
    expect(drawings.discardPreview('session-b', { handle: 'preview-new' })).toEqual({
      status: 'rejected',
      message: 'No current Preview exists',
      code: 'PREVIEW_NOT_FOUND',
    });
  });

  it('invalidates Preview after a direct formal commit or new import', async () => {
    const drawings = repository(vectorizer(), { previewHandle: () => 'preview-stale' });
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });
    const previewRequest = {
      ref: { drawingId: 'drawing_source', revision: 1 },
      commands: [{ type: 'node.delete' as const, id: 'top' }],
    };
    drawings.createPreview('session-a', previewRequest);
    drawings.commit('session-a', {
      expectedRevision: 1,
      commands: [{ type: 'node.delete', id: 'bottom' }],
    });
    expect(drawings.getPreview('session-a')).toBeNull();

    drawings.createPreview('session-a', {
      ...previewRequest,
      ref: { ...previewRequest.ref, revision: 2 },
    });
    drawings.bindPending('session-a', attachment('replacement'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([2]),
      signal: new AbortController().signal,
    });
    expect(drawings.getPreview('session-a')).toBeNull();
  });
});
