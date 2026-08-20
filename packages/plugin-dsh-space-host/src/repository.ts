// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { DrawingDocument } from '@vectorai/drawing-core';
import { queryDrawing, type DrawingSpatialQuery } from '@vectorai/drawing-spatial';
import { drawingDocumentSchema } from '@vectorai/plugin-space-contracts';
import type {
  Bounds2D,
  DrawingImportResult,
  DrawingQueryRequest,
  DrawingQueryResult,
  DrawingSummary,
  DrawingWorkspacePreview,
  DrawingWorkspacePreviewControlRequest,
  DrawingWorkspacePreviewCreateRequest,
  DrawingWorkspacePreviewCreateResult,
  DrawingWorkspacePreviewDiscardResult,
  DrawingWorkspaceCommand,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspaceSnapshot,
} from '@vectorai/plugin-space-contracts';
import { isDeepStrictEqual } from 'node:util';

import type { ImageVectorizer } from './vectorizer';

export type { ImageVectorizer } from './vectorizer';

export interface DrawingEntry {
  attachmentId: string;
  document: DrawingDocument;
  drawingId: string;
  bounds: Bounds2D;
  revision: number;
  source: NonNullable<DrawingWorkspaceSnapshot['source']>;
  provisional: boolean;
}

export interface DrawingRepositoryStorage {
  load(sessionId: string): DrawingEntry | null;
  save(sessionId: string, entry: DrawingEntry): void;
}

export class InMemoryDrawingRepository {
  readonly #pending = new Map<string, ImageAttachmentRef>();
  readonly #drawings = new Map<string, DrawingEntry>();
  readonly #previews = new Map<string, DrawingWorkspacePreview>();
  readonly #vectorizer: ImageVectorizer;
  readonly #drawingId: (sessionId: string, attachment: ImageAttachmentRef) => string;
  readonly #storage?: DrawingRepositoryStorage;
  readonly #previewHandle: () => string;
  readonly #now: () => number;

  constructor(input: {
    vectorizer: ImageVectorizer;
    drawingId?: (sessionId: string, attachment: ImageAttachmentRef) => string;
    storage?: DrawingRepositoryStorage;
    previewHandle?: () => string;
    now?: () => number;
  }) {
    this.#vectorizer = input.vectorizer;
    this.#drawingId = input.drawingId ?? ((_sessionId, attachment) => (
      `drawing_${String(attachment.attachmentId)}`
    ));
    this.#storage = input.storage;
    this.#previewHandle = input.previewHandle ?? (() => `preview_${globalThis.crypto.randomUUID()}`);
    this.#now = input.now ?? Date.now;
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
    const current = this.#getDrawing(sessionId);
    if (current?.attachmentId === attachmentId) {
      return {
        status: 'already-imported',
        ref: { drawingId: current.drawingId, revision: current.revision },
        provisional: current.provisional,
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
    const entry: DrawingEntry = {
      attachmentId,
      document: structuredClone(vectorized.document),
      drawingId,
      bounds: structuredClone(vectorized.bounds),
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
    };
    this.#storage?.save(sessionId, structuredClone(entry));
    this.#drawings.set(sessionId, entry);
    this.#previews.delete(sessionId);
    return {
      status: 'imported',
      ref: { drawingId, revision: 1 },
      provisional: vectorized.provisional,
    };
  }

  getSnapshot(sessionId: string): DrawingWorkspaceSnapshot | null {
    const entry = this.#getDrawing(sessionId);
    if (entry === null) return null;
    return snapshotOf(entry);
  }

  commit(
    sessionId: string,
    request: DrawingWorkspaceCommitRequest,
  ): DrawingWorkspaceCommitResult {
    const entry = this.#getDrawing(sessionId);
    if (entry === null) {
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
    const invalid = validateDocument(document);
    if (invalid !== null) return invalid;
    document.metadata.updatedAt = this.#now();
    const nextEntry: DrawingEntry = {
      ...entry,
      document,
      revision: entry.revision + 1,
    };
    this.#storage?.save(sessionId, structuredClone(nextEntry));
    this.#drawings.set(sessionId, nextEntry);
    this.#previews.delete(sessionId);
    return { status: 'committed', snapshot: snapshotOf(nextEntry) };
  }

  summarize(sessionId: string): DrawingSummary | null {
    const entry = this.#getDrawing(sessionId);
    if (entry === null) return null;
    const geometryByType: Record<string, number> = {};
    for (const node of entry.document.geometry) {
      geometryByType[node.type] = (geometryByType[node.type] ?? 0) + 1;
    }
    return {
      ref: { drawingId: entry.drawingId, revision: entry.revision },
      unit: entry.document.unitSystem.length,
      bounds: structuredClone(entry.bounds),
      geometryByType,
      provisional: entry.provisional,
    };
  }

  query(sessionId: string, request: DrawingQueryRequest): DrawingQueryResult {
    const entry = this.#getDrawing(sessionId);
    if (entry === null) throw new Error('DRAWING_REQUIRED');
    if (
      request.ref.drawingId !== entry.drawingId
      || request.ref.revision !== entry.revision
    ) {
      throw new Error('DRAWING_STALE');
    }
    const result = queryDrawing(entry.document, spatialQueryOf(request));
    return structuredClone({ ...result, ref: request.ref } as DrawingQueryResult);
  }

  createPreview(
    sessionId: string,
    request: DrawingWorkspacePreviewCreateRequest,
  ): DrawingWorkspacePreviewCreateResult {
    const entry = this.#getDrawing(sessionId);
    if (entry === null) {
      return { status: 'rejected', message: 'No drawing is loaded', code: 'DRAWING_REQUIRED' };
    }
    if (
      request.ref.drawingId !== entry.drawingId
      || request.ref.revision !== entry.revision
    ) {
      return {
        status: 'conflict',
        message: `Preview base ${request.ref.drawingId}@${request.ref.revision} is stale`,
        snapshot: snapshotOf(entry),
      };
    }

    const document = structuredClone(entry.document);
    for (const command of request.commands) {
      const rejection = applyCommand(document, command);
      if (rejection !== null) return rejection;
    }
    const invalid = validateDocument(document);
    if (invalid !== null) return invalid;
    const createdAt = this.#now();
    document.metadata.updatedAt = createdAt;
    const preview: DrawingWorkspacePreview = {
      version: 1,
      handle: this.#previewHandle(),
      baseRef: structuredClone(request.ref),
      commands: structuredClone(request.commands),
      candidate: snapshotOf({ ...entry, document }),
      diff: diffDocuments(entry.document, document),
      createdAt,
      ...(request.summary === undefined ? {} : { summary: request.summary }),
    };
    this.#previews.set(sessionId, preview);
    return { status: 'previewed', preview: structuredClone(preview) };
  }

  getPreview(sessionId: string): DrawingWorkspacePreview | null {
    const preview = this.#previews.get(sessionId);
    if (preview === undefined) return null;
    const entry = this.#getDrawing(sessionId);
    if (
      entry === null
      || preview.baseRef.drawingId !== entry.drawingId
      || preview.baseRef.revision !== entry.revision
    ) {
      this.#previews.delete(sessionId);
      return null;
    }
    return structuredClone(preview);
  }

  commitPreview(
    sessionId: string,
    request: DrawingWorkspacePreviewControlRequest,
  ): DrawingWorkspaceCommitResult {
    const current = this.#previews.get(sessionId);
    if (current === undefined) {
      return { status: 'rejected', message: 'No current Preview exists', code: 'PREVIEW_NOT_FOUND' };
    }
    if (current.handle !== request.handle) {
      return {
        status: 'rejected',
        message: `Preview ${request.handle} is not current`,
        code: 'PREVIEW_NOT_CURRENT',
      };
    }
    const entry = this.#getDrawing(sessionId);
    if (
      entry === null
      || current.baseRef.drawingId !== entry.drawingId
      || current.baseRef.revision !== entry.revision
    ) {
      this.#previews.delete(sessionId);
      return { status: 'rejected', message: 'Preview base revision is stale', code: 'PREVIEW_STALE' };
    }
    const document = structuredClone(current.candidate.document);
    const invalid = validateDocument(document);
    if (invalid !== null) return invalid;
    document.metadata.updatedAt = this.#now();
    const nextEntry: DrawingEntry = {
      ...entry,
      document,
      revision: entry.revision + 1,
    };
    this.#storage?.save(sessionId, structuredClone(nextEntry));
    this.#drawings.set(sessionId, nextEntry);
    this.#previews.delete(sessionId);
    return { status: 'committed', snapshot: snapshotOf(nextEntry) };
  }

  discardPreview(
    sessionId: string,
    request: DrawingWorkspacePreviewControlRequest,
  ): DrawingWorkspacePreviewDiscardResult {
    const current = this.#previews.get(sessionId);
    if (current === undefined) {
      return { status: 'rejected', message: 'No current Preview exists', code: 'PREVIEW_NOT_FOUND' };
    }
    if (current.handle !== request.handle) {
      return {
        status: 'rejected',
        message: `Preview ${request.handle} is not current`,
        code: 'PREVIEW_NOT_CURRENT',
      };
    }
    this.#previews.delete(sessionId);
    return { status: 'discarded', ref: structuredClone(current.baseRef) };
  }

  disposeSession(sessionId: string): void {
    this.#pending.delete(sessionId);
    this.#drawings.delete(sessionId);
    this.#previews.delete(sessionId);
  }

  #getDrawing(sessionId: string): DrawingEntry | null {
    const current = this.#drawings.get(sessionId);
    if (current !== undefined) return current;
    const restored = this.#storage?.load(sessionId) ?? null;
    if (restored !== null) this.#drawings.set(sessionId, structuredClone(restored));
    return restored;
  }
}

function spatialQueryOf(request: DrawingQueryRequest): DrawingSpatialQuery {
  if (request.kind === 'node') return { kind: 'node', id: request.id };
  if (request.kind === 'neighbors') {
    return {
      kind: 'neighbors',
      nodeId: request.nodeId,
      ...(request.limit === undefined ? {} : { limit: request.limit }),
    };
  }
  return {
    kind: 'world-slice',
    bounds: structuredClone(request.bounds),
    ...(request.planes === undefined ? {} : { planes: [...request.planes] }),
    ...(request.limit === undefined ? {} : { limit: request.limit }),
  };
}

function snapshotOf(entry: DrawingEntry): DrawingWorkspaceSnapshot {
  return structuredClone({
    version: 1,
    ref: { drawingId: entry.drawingId, revision: entry.revision },
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
  if (command.type === 'node.create') return createNode(document, command);
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

function createNode(
  document: DrawingDocument,
  command: Extract<DrawingWorkspaceCommand, { type: 'node.create' }>,
): Extract<DrawingWorkspaceCommitResult, { status: 'rejected' }> | null {
  if (findNode(document, command.node.id) !== undefined) {
    return {
      status: 'rejected',
      message: `Node ${command.node.id} already exists`,
      code: 'NODE_ALREADY_EXISTS',
    };
  }
  if (command.plane === 'geometry') document.geometry.push(structuredClone(command.node));
  else if (command.plane === 'annotation') document.annotations.push(structuredClone(command.node));
  else if (command.plane === 'relation') document.relations.push(structuredClone(command.node));
  else document.features.push(structuredClone(command.node));
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

function diffDocuments(
  before: DrawingDocument,
  after: DrawingDocument,
): DrawingWorkspacePreview['diff'] {
  const beforeNodes = new Map(allNodes(before).map((node) => [node.id, node]));
  const afterNodes = new Map(allNodes(after).map((node) => [node.id, node]));
  return {
    createdNodeIds: [...afterNodes.keys()].filter((id) => !beforeNodes.has(id)),
    updatedNodeIds: [...afterNodes.keys()].filter((id) => (
      beforeNodes.has(id) && !isDeepStrictEqual(beforeNodes.get(id), afterNodes.get(id))
    )),
    deletedNodeIds: [...beforeNodes.keys()].filter((id) => !afterNodes.has(id)),
  };
}

function allNodes(document: DrawingDocument) {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ];
}

function validateDocument(
  document: DrawingDocument,
): Extract<DrawingWorkspaceCommitResult, { status: 'rejected' }> | null {
  if (!drawingDocumentSchema.safeParse(document).success) {
    return { status: 'rejected', message: 'Candidate Drawing is invalid', code: 'INVALID_DOCUMENT' };
  }
  const ids = allNodes(document).map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    return { status: 'rejected', message: 'Drawing node ids must be unique', code: 'NODE_ALREADY_EXISTS' };
  }
  const geometryIds = new Set(document.geometry.map(({ id }) => id));
  const annotationIds = new Set(document.annotations.map(({ id }) => id));
  const relationIds = new Set(document.relations.map(({ id }) => id));
  const featureIds = new Set(document.features.map(({ id }) => id));
  const nodeIds = new Set<string>(ids);
  const missing = (id: string, expected: Set<string>) => !expected.has(id);

  for (const annotation of document.annotations) {
    const targets = annotation.type === 'dimension'
      ? annotation.targets.map(({ geometryId }) => geometryId)
      : annotation.type === 'leader'
        ? [annotation.target.geometryId]
        : annotation.type === 'centerline'
          ? annotation.targets
          : [];
    if (targets.some((id) => missing(id, geometryIds))) return danglingReference(annotation.id);
  }
  for (const relation of document.relations) {
    const valid = relation.type === 'topology'
      ? relation.nodeIds.every((id) => nodeIds.has(id))
      : relation.type === 'constraint'
        ? relation.geometryIds.every((id) => geometryIds.has(id))
        : relation.type === 'association'
          ? annotationIds.has(relation.annotationId)
            && relation.geometryIds.every((id) => geometryIds.has(id))
          : featureIds.has(relation.featureId) && relation.nodeIds.every((id) => nodeIds.has(id));
    if (!valid) return danglingReference(relation.id);
  }
  for (const feature of document.features) {
    if (
      feature.geometryIds.some((id) => missing(id, geometryIds))
      || feature.annotationIds.some((id) => missing(id, annotationIds))
      || feature.relationIds.some((id) => missing(id, relationIds))
    ) return danglingReference(feature.id);
  }
  return null;
}

function danglingReference(
  id: string,
): Extract<DrawingWorkspaceCommitResult, { status: 'rejected' }> {
  return {
    status: 'rejected',
    message: `Node ${id} contains a dangling reference`,
    code: 'DANGLING_REFERENCE',
  };
}
