// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { DrawingDocument } from '@vectorai/drawing-core';
import type {
  DrawingCanvasProjection,
  DrawingImportResult,
  DrawingSummary,
} from '@vectorai/plugin-space-contracts';

import type { ImageVectorizer } from './vectorizer';

export type { ImageVectorizer } from './vectorizer';

interface DrawingEntry {
  attachmentId: string;
  document: DrawingDocument;
  projection: DrawingCanvasProjection;
}

export class InMemoryDrawingRepository {
  readonly #pending = new Map<string, ImageAttachmentRef>();
  readonly #drawings = new Map<string, DrawingEntry>();
  readonly #vectorizer: ImageVectorizer;
  readonly #drawingId: (sessionId: string, attachment: ImageAttachmentRef) => string;

  constructor(input: {
    vectorizer: ImageVectorizer;
    drawingId?: (sessionId: string, attachment: ImageAttachmentRef) => string;
  }) {
    this.#vectorizer = input.vectorizer;
    this.#drawingId = input.drawingId ?? ((_sessionId, attachment) => (
      `drawing_${String(attachment.attachmentId)}`
    ));
  }

  bindPending(sessionId: string, attachment: ImageAttachmentRef): void {
    this.#pending.set(sessionId, structuredClone(attachment));
  }

  getPending(sessionId: string): ImageAttachmentRef | null {
    const attachment = this.#pending.get(sessionId);
    return attachment === undefined ? null : structuredClone(attachment);
  }

  async importPending(
    sessionId: string,
    input: { data: Uint8Array; signal: AbortSignal },
  ): Promise<DrawingImportResult> {
    const attachment = this.#pending.get(sessionId);
    if (attachment === undefined) throw new Error('PENDING_DRAWING_SOURCE_REQUIRED');
    const attachmentId = String(attachment.attachmentId);
    const current = this.#drawings.get(sessionId);
    if (current?.attachmentId === attachmentId) {
      return {
        status: 'already-imported',
        ref: structuredClone(current.projection.ref),
        provisional: current.projection.provisional,
      };
    }

    input.signal.throwIfAborted();
    const drawingId = this.#drawingId(sessionId, attachment);
    const vectorized = await this.#vectorizer.vectorize({
      drawingId,
      attachment: structuredClone(attachment),
      data: input.data.slice(),
      signal: input.signal,
    });
    input.signal.throwIfAborted();
    const projection: DrawingCanvasProjection = {
      version: 1,
      ref: { drawingId, revision: 1 },
      source: structuredClone(vectorized.source),
      bounds: structuredClone(vectorized.bounds),
      geometry: structuredClone(vectorized.geometry),
      provisional: vectorized.provisional,
    };
    this.#drawings.set(sessionId, {
      attachmentId,
      document: structuredClone(vectorized.document),
      projection,
    });
    return {
      status: 'imported',
      ref: structuredClone(projection.ref),
      provisional: projection.provisional,
    };
  }

  getProjection(sessionId: string): DrawingCanvasProjection | null {
    const entry = this.#drawings.get(sessionId);
    return entry === undefined ? null : structuredClone(entry.projection);
  }

  summarize(sessionId: string): DrawingSummary | null {
    const entry = this.#drawings.get(sessionId);
    if (entry === undefined) return null;
    const geometryByType: Record<string, number> = {};
    for (const node of entry.document.geometry) {
      geometryByType[node.type] = (geometryByType[node.type] ?? 0) + 1;
    }
    return {
      ref: structuredClone(entry.projection.ref),
      unit: entry.document.unitSystem.length,
      bounds: structuredClone(entry.projection.bounds),
      geometryByType,
      provisional: entry.projection.provisional,
    };
  }

  disposeSession(sessionId: string): void {
    this.#pending.delete(sessionId);
    this.#drawings.delete(sessionId);
  }
}
