// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { MotionRigService } from './motion-rig-service';
import { InMemoryDrawingRepository } from './repository';

async function fixture() {
  const drawings = new InMemoryDrawingRepository({
    drawingId: () => 'drawing-1',
    vectorizer: {
      async vectorize({ drawingId }) {
        const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
        document.geometry = [
          {
            id: 'hand' as GeometryId, type: 'circle', center: [20, 20], radius: 3,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
          {
            id: 'arm' as GeometryId, type: 'line', start: [0, 20], end: [17, 20],
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
          {
            id: 'other' as GeometryId, type: 'circle', center: [50, 20], radius: 2,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        ];
        return { document, bounds: { minX: 0, minY: 0, maxX: 52, maxY: 23 }, provisional: false };
      },
    },
  });
  const attachment: ImageAttachmentRef = {
    attachmentId: 'image-1' as never, mediaType: 'image/png', bytes: 1, width: 52, height: 23,
  };
  drawings.bindPending('session-1', attachment);
  await drawings.importPending('session-1', {
    data: new Uint8Array([1]), signal: new AbortController().signal,
  });
  return { drawings, service: new MotionRigService(drawings) };
}

describe('MotionRigService', () => {
  it('creates and returns one revision-bound rig from semantic geometry', async () => {
    const { service } = await fixture();

    const result = service.create('session-1', ['hand']);

    expect(result).toEqual({
      state: 'ready', summary: 'Temporary movement constraint is ready.',
      controlNodeCount: 1, connectorNodeCount: 1,
    });
    expect(service.current('session-1')).toMatchObject({
      version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 }, state: 'ready',
      controlBodyNodeIds: ['hand'],
      connectors: [{ nodeId: 'arm', movingEndpoint: 'end', fixedPoint: [0, 20] }],
    });
  });

  it('atomically keeps the previous valid rig when corrected selection is invalid', async () => {
    const { service } = await fixture();
    service.create('session-1', ['hand']);

    const result = service.rebuild('session-1', { drawingId: 'drawing-1', revision: 1 }, ['other']);

    expect(result).toMatchObject({ status: 'needs-correction' });
    expect(service.current('session-1')?.controlBodyNodeIds).toEqual(['hand']);
  });

  it('invalidates a rig after the Drawing revision changes', async () => {
    const { drawings, service } = await fixture();
    service.create('session-1', ['hand']);
    drawings.commit('session-1', {
      expectedRevision: 1,
      commands: [{ type: 'node.update', id: 'other', changes: { center: [51, 20] }, expected: { center: [50, 20] } }],
    });

    expect(service.current('session-1')).toBeNull();
    expect(service.rebuild('session-1', { drawingId: 'drawing-1', revision: 1 }, ['hand'])).toEqual({
      status: 'stale', currentRef: { drawingId: 'drawing-1', revision: 2 },
    });
  });

  it('discards explicitly and on session disposal without touching the Drawing', async () => {
    const { drawings, service } = await fixture();
    service.create('session-1', ['hand']);

    expect(service.discard('session-1', { drawingId: 'drawing-1', revision: 1 })).toEqual({ status: 'discarded' });
    expect(service.current('session-1')).toBeNull();
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(1);

    service.create('session-1', ['hand']);
    service.disposeSession('session-1');
    expect(service.current('session-1')).toBeNull();
  });

  it('returns drawing_required without importing or vectorizing anything', () => {
    let vectorizeCalls = 0;
    const drawings = new InMemoryDrawingRepository({
      vectorizer: { async vectorize() { vectorizeCalls += 1; throw new Error('not expected'); } },
    });
    const service = new MotionRigService(drawings);

    expect(service.create('empty-session', ['hand'])).toEqual({
      state: 'blocked', code: 'drawing_required', message: 'No editable vector Drawing is loaded.',
    });
    expect(vectorizeCalls).toBe(0);
  });
});
