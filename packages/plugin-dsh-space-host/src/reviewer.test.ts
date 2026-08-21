// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import { createDshReviewer } from './reviewer';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function document(y: number) {
  const value = createEmptyDrawing({ idFactory: { next: () => 'drawing-review' }, now: () => 1 });
  value.geometry = [{
    id: 'arm' as GeometryId, type: 'line', start: [0, y], end: [100, y], visible: true, quality,
  }];
  return value;
}

describe('createDshReviewer', () => {
  it('sends a locally rendered before-after image to the read-only reviewer', async () => {
    let request: { prompt: Array<{ type: string; attachment?: ImageAttachmentRef }> } | undefined;
    const attachment: ImageAttachmentRef = {
      attachmentId: 'review-image' as ImageAttachmentRef['attachmentId'],
      mediaType: 'image/png', bytes: 2048, width: 1280, height: 720,
    };
    const saveImage = vi.fn(async () => attachment);
    const dispose = vi.fn(async () => {});
    const review = createDshReviewer({
      agents: { get: () => ({ id: 'session-1' } as Agent) },
      attachments: { saveImage },
      subagents: {
        list: () => ['local'],
        getProvider: () => ({ capabilities: { outputSchema: true, toolFilter: true, depthLimit: true, persona: true } }),
        async start(_name: string, input: typeof request) {
          request = input;
          return {
            result: Promise.resolve({
              stopReason: 'completed', output: [],
              structured: { outcome: 'satisfied', defects: [] },
            }),
            dispose,
          };
        },
      },
    } as never);

    const result = await review({
      sessionId: 'session-1', objective: '抬手',
      beforeSemanticDigest: 'sha256:before', afterSemanticDigest: 'sha256:after',
      effectDigest: 'sha256:effect', changedNodeIds: ['arm'], diagnostics: [],
      beforeDocument: document(0), afterDocument: document(40),
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
    });

    expect(saveImage).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'image/png' }));
    expect(request?.prompt).toEqual(expect.arrayContaining([
      { type: 'image', attachment },
    ]));
    expect(result).toMatchObject({
      outcome: 'satisfied',
      render: { width: 1280, height: 720, contentDigest: expect.stringMatching(/^sha256:/) },
    });
    expect(dispose).toHaveBeenCalledOnce();
  });
});
