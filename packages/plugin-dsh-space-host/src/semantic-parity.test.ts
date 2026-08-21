// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { InMemoryDrawingRepository } from './repository';
import { SemanticEditService } from './semantic-edit-service';

describe('DSH semantic edit production parity', () => {
  it('observes a current image and returns bounded vector/topology context', async () => {
    const drawings = new InMemoryDrawingRepository({
      drawingId: () => 'drawing-parity',
      vectorizer: {
        async vectorize({ drawingId }) {
          const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
          document.geometry = [
            {
              id: 'carrier' as GeometryId, type: 'circle', center: [0, 0], radius: 10,
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
            {
              id: 'connector' as GeometryId, type: 'line', start: [10, 0], end: [30, 0],
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          ];
          return {
            document,
            bounds: { minX: -10, minY: -10, maxX: 30, maxY: 10 },
            provisional: false,
          };
        },
      },
    });
    const attachment: ImageAttachmentRef = {
      attachmentId: 'source' as never, mediaType: 'image/png', bytes: 1, width: 80, height: 40,
    };
    drawings.bindPending('session-parity', attachment);
    await drawings.importPending('session-parity', {
      data: new Uint8Array([1]), signal: new AbortController().signal,
    });
    let sequence = 0;
    const service = new SemanticEditService(drawings, {
      id: (kind) => `${kind}-${++sequence}`,
      now: () => 100,
      digest: (value) => `sha256:${value.length}`,
    });
    const task = service.startTask('session-parity', {
      objective: 'Move the connected component upward',
      rootUserMessageDigest: 'sha256:user',
      policy: 'auto-safe',
    });

    const observation = service.observe('session-parity', { taskId: task.taskId }) as unknown as {
      artifactRefs: unknown[];
    };
    expect(observation.artifactRefs).toHaveLength(1);

    const context = service.buildContext('session-parity', {
      taskId: task.taskId,
      observationId: (observation as unknown as { observationId: string }).observationId,
    }) as unknown as {
      geometryFacts: unknown[];
      connectedCarrierFacts: unknown[];
      knowledge: { status: string };
    };
    expect(context.geometryFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'carrier', type: 'circle' }),
      expect.objectContaining({ nodeId: 'connector', type: 'line' }),
    ]));
    expect(context.connectedCarrierFacts).toEqual([
      expect.objectContaining({ carrierNodeId: 'carrier', contactedPortCount: 1 }),
    ]);
    expect(context.knowledge.status).toBe('complete');
  });
});
