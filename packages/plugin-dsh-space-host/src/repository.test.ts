// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import type { ImageVectorizer } from './repository';
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

function repository(imageVectorizer: ImageVectorizer = vectorizer()) {
  return new InMemoryDrawingRepository({
    vectorizer: imageVectorizer,
    drawingId: (_sessionId, source) => `drawing_${String(source.attachmentId)}`,
  });
}

describe('InMemoryDrawingRepository', () => {
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
});
