// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import {
  createEmptyDrawing,
  type DrawingDocument,
  type DrawingId,
  type GeometryId,
  type LineGeometry,
} from '@vectorai/drawing-core';
import type {
  Bounds2D,
} from '@vectorai/plugin-space-contracts';

export interface VectorizedImage {
  document: DrawingDocument;
  bounds: Bounds2D;
  provisional: boolean;
}

export interface ImageVectorizer {
  vectorize(input: {
    drawingId: string;
    attachment: ImageAttachmentRef;
    data: Uint8Array;
    signal: AbortSignal;
  }): Promise<VectorizedImage>;
}

export class ProvisionalFootprintVectorizer implements ImageVectorizer {
  async vectorize(input: {
    drawingId: string;
    attachment: ImageAttachmentRef;
    data: Uint8Array;
    signal: AbortSignal;
  }): Promise<VectorizedImage> {
    input.signal.throwIfAborted();
    const { width, height } = input.attachment;
    const lines = footprintLines(width, height);
    const now = Date.now();
    const document = createEmptyDrawing({
      idFactory: { next: () => input.drawingId },
      now: () => now,
    });
    document.id = input.drawingId as DrawingId;
    document.geometry = lines.map((line): LineGeometry => ({
      id: line.id as GeometryId,
      type: 'line',
      start: line.start,
      end: line.end,
      visible: true,
      quality: {
        status: 'candidate',
        confidence: line.confidence,
        evidenceRefs: [],
      },
    }));

    return {
      document,
      bounds: { minX: 0, minY: 0, maxX: width, maxY: height },
      provisional: true,
    };
  }
}

interface FootprintLine {
  id: string;
  start: readonly [number, number];
  end: readonly [number, number];
  confidence: number;
}

function footprintLines(width: number, height: number): FootprintLine[] {
  const candidate = (id: string, start: readonly [number, number], end: readonly [number, number]): FootprintLine => ({
    id,
    start,
    end,
    confidence: 0.25,
  });
  return [
    candidate('source-boundary-top', [0, 0], [width, 0]),
    candidate('source-boundary-right', [width, 0], [width, height]),
    candidate('source-boundary-bottom', [width, height], [0, height]),
    candidate('source-boundary-left', [0, height], [0, 0]),
  ];
}
