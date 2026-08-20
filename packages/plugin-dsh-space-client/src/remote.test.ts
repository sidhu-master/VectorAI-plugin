// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { drawingCanvasProjectionSchema } from '@vectorai/plugin-space-contracts';
import {
  DRAWING_SPACE_REMOTE,
} from './remote';

describe('DRAWING_SPACE_REMOTE', () => {
  it('uses strict codecs for every JSON field exposed to the DSH client gateway', () => {
    const descriptor = DRAWING_SPACE_REMOTE.descriptors[0];

    expect(descriptor.parameters[0]?.codec.mode).toBe('strict');
    expect(descriptor.result.mode).toBe('strict');
  });

  it('accepts a canvas projection or null and rejects malformed projections', () => {
    expect(drawingCanvasProjectionSchema.parse(null)).toBeNull();
    expect(() => drawingCanvasProjectionSchema.parse({ version: 1 })).toThrow();
    expect(drawingCanvasProjectionSchema.parse({
      version: 1,
      ref: { drawingId: 'drawing-1', revision: 1 },
      source: {
        attachmentId: 'attachment-1',
        mediaType: 'image/png',
        width: 800,
        height: 600,
        dataUrl: 'data:image/png;base64,AAAA',
      },
      bounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 },
      geometry: [{
        id: 'line-1',
        type: 'line',
        start: [0, 0],
        end: [800, 0],
        status: 'candidate',
        confidence: 0.5,
      }],
      provisional: true,
    }).ref.drawingId).toBe('drawing-1');
  });
});
