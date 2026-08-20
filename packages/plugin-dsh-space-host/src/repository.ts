// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { DrawingDocument } from '@vectorai/drawing-core';
import type {
  DrawingCanvasProjection,
  DrawingImportResult,
  DrawingSummary,
  DrawingWorkspaceCommand,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspaceSnapshot,
} from '@vectorai/plugin-space-contracts';
import { isDeepStrictEqual } from 'node:util';

import type { ImageVectorizer } from './vectorizer';

export type { ImageVectorizer } from './vectorizer';

interface DrawingEntry {
  attachmentId: string;
  document: DrawingDocument;
  projection: DrawingCanvasProjection;
  revision: number;
  source: NonNullable<DrawingWorkspaceSnapshot['source']>;
  provisional: boolean;
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
      revision: 1,
      source: {
        id: attachmentId,
        mediaType: attachment.mediaType,
        bytes: attachment.bytes,
        width: attachment.width,
        height: attachment.height,
        ...(attachment.name === undefined ? {} : { name: attachment.name }),
      },
      provisional: vectorized.provisional,
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

  getSnapshot(sessionId: string): DrawingWorkspaceSnapshot | null {
    const entry = this.#drawings.get(sessionId);
    if (entry === undefined) return null;
    return snapshotOf(entry);
  }

  commit(
    sessionId: string,
    request: DrawingWorkspaceCommitRequest,
  ): DrawingWorkspaceCommitResult {
    const entry = this.#drawings.get(sessionId);
    if (entry === undefined) {
      return { status: 'rejected', message: 'No drawing is loaded', code: 'DRAWING_REQUIRED' };
    }
    if (request.expectedRevision !== entry.revision) {
      return {
        status: 'conflict',
        message: `Expected revision ${request.expectedRevision}, current revision is ${entry.revision}`,
        snapshot: snapshotOf(entry),
      };
    }

    const document = structuredClone(entry.document);
    for (const command of request.commands) {
      const rejection = applyCommand(document, command);
      if (rejection !== null) return rejection;
    }
    document.metadata.updatedAt = Date.now();
    entry.document = document;
    entry.revision += 1;
    entry.projection.ref.revision = entry.revision;
    return { status: 'committed', snapshot: snapshotOf(entry) };
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

function snapshotOf(entry: DrawingEntry): DrawingWorkspaceSnapshot {
  return structuredClone({
    version: 1,
    ref: { drawingId: entry.projection.ref.drawingId, revision: entry.revision },
    document: entry.document,
    source: entry.source,
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: true,
    },
    provisional: entry.provisional,
  });
}

function applyCommand(
  document: DrawingDocument,
  command: DrawingWorkspaceCommand,
): Extract<DrawingWorkspaceCommitResult, { status: 'rejected' }> | null {
  if (command.type === 'node.delete') return deleteNode(document, command.id);
  const node = findNode(document, command.id);
  if (node === undefined) {
    return { status: 'rejected', message: `Node ${command.id} was not found`, code: 'NODE_NOT_FOUND' };
  }

  if (command.type === 'annotation.move-text') {
    const key = node.type === 'text' ? 'position' : node.type === 'dimension' ? 'textPosition' : null;
    if (key === null) {
      return { status: 'rejected', message: `Node ${command.id} has no movable text`, code: 'INVALID_COMMAND' };
    }
    if (!isDeepStrictEqual(node[key], command.expectedPosition)) {
      return {
        status: 'rejected',
        message: `Precondition failed for node ${command.id} property ${key}`,
        code: 'PRECONDITION_FAILED',
      };
    }
    node[key] = structuredClone(command.position) as never;
    return null;
  }

  const mutable = node as unknown as Record<string, unknown>;
  for (const [key, expected] of Object.entries(command.expected)) {
    if (!isDeepStrictEqual(mutable[key], expected)) {
      return {
        status: 'rejected',
        message: `Precondition failed for node ${command.id} property ${key}`,
        code: 'PRECONDITION_FAILED',
      };
    }
  }
  for (const [key, value] of Object.entries(command.changes)) {
    if (key === 'id' || key === 'type' || key === 'plane' || !(key in mutable)) {
      return {
        status: 'rejected',
        message: `Property ${key} cannot be updated on node ${command.id}`,
        code: 'INVALID_COMMAND',
      };
    }
    mutable[key] = structuredClone(value);
  }
  return null;
}

function findNode(document: DrawingDocument, id: string) {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].find((node) => node.id === id);
}

function deleteNode(
  document: DrawingDocument,
  id: string,
): Extract<DrawingWorkspaceCommitResult, { status: 'rejected' }> | null {
  const node = findNode(document, id);
  if (node === undefined) {
    return { status: 'rejected', message: `Node ${id} was not found`, code: 'NODE_NOT_FOUND' };
  }
  document.geometry = document.geometry.filter((candidate) => candidate.id !== id);
  document.annotations = document.annotations.filter((candidate) => candidate.id !== id);
  document.relations = document.relations.filter((relation) => {
    if (relation.id === id) return false;
    if (relation.type === 'topology' || relation.type === 'semantic') return !relation.nodeIds.includes(id);
    if (relation.type === 'constraint') return !relation.geometryIds.includes(id as never);
    return relation.annotationId !== id && !relation.geometryIds.includes(id as never);
  });
  document.features = document.features.filter((feature) => (
    feature.id !== id
    && !feature.geometryIds.includes(id as never)
    && !feature.annotationIds.includes(id as never)
    && !feature.relationIds.includes(id as never)
  ));
  return null;
}
