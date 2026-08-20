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
        source: {
          attachmentId: String(source.attachmentId),
          mediaType: source.mediaType,
          width: source.width,
          height: source.height,
          name: source.name,
          dataUrl: 'data:image/png;base64,AQIDBA==',
        },
        bounds: { minX: 0, minY: 0, maxX: source.width, maxY: source.height },
        geometry: [
          { id: 'top', type: 'line', start: [0, 0], end: [120, 0], status: 'candidate' },
          { id: 'right', type: 'line', start: [120, 0], end: [120, 80], status: 'candidate' },
          { id: 'bottom', type: 'line', start: [120, 80], end: [0, 80], status: 'candidate' },
          { id: 'left', type: 'line', start: [0, 80], end: [0, 0], status: 'candidate' },
        ],
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
    expect(drawings.getProjection('session-a')?.ref).toEqual(result.ref);
    expect(drawings.summarize('session-a')).toEqual({
      ref: result.ref,
      unit: 'mm',
      bounds: { minX: 0, minY: 0, maxX: 120, maxY: 80 },
      geometryByType: { line: 4 },
      provisional: true,
    });
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
    expect(drawings.getProjection('session-a')).toBeNull();
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
    expect(drawings.getProjection('session-a')).toBeNull();
  });

  it('isolates sessions and removes all state on disposal', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment('source'));
    await drawings.importPending('session-a', {
      data: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    expect(drawings.getProjection('session-b')).toBeNull();
    drawings.disposeSession('session-a');

    expect(drawings.getPending('session-a')).toBeNull();
    expect(drawings.getProjection('session-a')).toBeNull();
  });
});
