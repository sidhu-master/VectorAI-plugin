// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import type { DrawingDocument } from '@vectorai/drawing-core';
import {
  applyDrawingTransaction,
  canonicalSemanticString,
  withDimensionLayoutOwnership,
} from '@vectorai/drawing-edit-core';
import type {
  Assessment,
  DrawingTransactionCommand,
  DurableOperationReceipt,
  OperationLookupResult,
  ReviewEvidence,
} from '@vectorai/drawing-edit-protocol';
import { queryDrawing, type DrawingSpatialQuery } from '@vectorai/drawing-spatial';
import { importDxf as parseDxf } from '@vectorai/dxf-import';
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
import { createHash } from 'node:crypto';

import type {
  DrawingCommitRecord,
  DrawingDurableState,
  DrawingSolverProvenance,
  DurableDrawingRepositoryStorage,
} from './durable-envelope';
import type { ImageVectorizer } from './vectorizer';

export type { ImageVectorizer } from './vectorizer';

const CURRENT_DXF_PROJECTION_VERSION = 2;

export interface DrawingEntry {
  attachmentId: string;
  dxfProjectionVersion?: number;
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
  loadDurable?(sessionId: string): DrawingDurableState | null;
  saveDurable?(sessionId: string, state: DrawingDurableState): void;
}

export interface SemanticCommitRequest {
  expectedRef: { drawingId: string; revision: number };
  operationId: string;
  operationBindingDigest: string;
  candidateDigest: string;
  forward: DrawingTransactionCommand[];
  inverse: DrawingTransactionCommand[];
  mode: 'auto-safe' | 'confirmed' | 'interactive';
  assessment?: Assessment;
  reviewEvidence?: ReviewEvidence;
  solverProvenance?: DrawingSolverProvenance;
}

export interface UndoCommitRequest {
  targetCommitId: string;
  expectedCurrentRef: { drawingId: string; revision: number };
  operationId: string;
  operationBindingDigest: string;
}

export type RedoCommitRequest = UndoCommitRequest;

export class InMemoryDrawingRepository {
  readonly #pending = new Map<string, ImageAttachmentRef>();
  readonly #drawings = new Map<string, DrawingEntry>();
  readonly #durable = new Map<string, DrawingDurableState>();
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
    if (this.#storage?.saveDurable) {
      const state: DrawingDurableState = {
        version: 2,
        entry: structuredClone(entry),
        commits: [],
        operations: [],
      };
      this.#storage.saveDurable(sessionId, structuredClone(state));
      this.#durable.set(sessionId, state);
    } else {
      this.#storage?.save(sessionId, structuredClone(entry));
    }
    this.#drawings.set(sessionId, entry);
    this.#previews.delete(sessionId);
    return {
      status: 'imported',
      ref: { drawingId, revision: 1 },
      provisional: vectorized.provisional,
    };
  }

  async importDxf(
    sessionId: string,
    input: { bytes: Uint8Array; name?: string; digest: string; signal?: AbortSignal },
  ): Promise<DrawingImportResult> {
    const current = this.#getDrawing(sessionId);
    if (
      current?.attachmentId === input.digest
      && current.dxfProjectionVersion === CURRENT_DXF_PROJECTION_VERSION
    ) {
      return {
        status: 'already-imported',
        ref: { drawingId: current.drawingId, revision: current.revision },
        provisional: current.provisional,
      };
    }

    input.signal?.throwIfAborted();
    const actualDigest = `sha256:${createHash('sha256').update(input.bytes).digest('hex')}`;
    if (actualDigest !== input.digest) {
      throw new Error('DXF_IMPORT_REJECTED:DXF_DIGEST_MISMATCH');
    }
    const drawingId = `drawing_dxf_${actualDigest.slice('sha256:'.length, 'sha256:'.length + 24)}`;
    const imported = parseDxf({
      bytes: input.bytes.slice(),
      source: {
        digest: actualDigest,
        ...(input.name === undefined ? {} : { name: input.name }),
      },
      drawingId,
      now: this.#now,
    });
    if (imported.status === 'rejected') {
      const codes = imported.diagnostics
        .filter(({ severity }) => severity === 'error')
        .map(({ code }) => code)
        .join(',');
      throw new Error(`DXF_IMPORT_REJECTED:${codes || 'UNKNOWN'}`);
    }
    input.signal?.throwIfAborted();
    const provisional = imported.diagnostics.some(({ severity }) => severity === 'warning');
    const entry: DrawingEntry = {
      attachmentId: actualDigest,
      dxfProjectionVersion: CURRENT_DXF_PROJECTION_VERSION,
      document: structuredClone(imported.document),
      drawingId,
      bounds: structuredClone(imported.bounds),
      revision: 1,
      source: {
        id: actualDigest,
        mediaType: 'application/dxf',
        bytes: input.bytes.byteLength,
        ...(input.name === undefined ? {} : { name: input.name }),
      },
      provisional,
    };
    if (this.#storage?.saveDurable) {
      const state: DrawingDurableState = {
        version: 2,
        entry: structuredClone(entry),
        commits: [],
        operations: [],
      };
      this.#storage.saveDurable(sessionId, structuredClone(state));
      this.#durable.set(sessionId, state);
    } else {
      this.#storage?.save(sessionId, structuredClone(entry));
    }
    this.#drawings.set(sessionId, entry);
    this.#previews.delete(sessionId);
    return {
      status: 'imported',
      ref: { drawingId, revision: 1 },
      provisional,
    };
  }

  getSnapshot(sessionId: string): DrawingWorkspaceSnapshot | null {
    const entry = this.#getDrawing(sessionId);
    if (entry === null) return null;
    const lastCommit = this.#durableState(sessionId)?.commits.at(-1);
    return snapshotOf(entry, lastCommit);
  }

  getBounds(sessionId: string): Bounds2D | null {
    const entry = this.#getDrawing(sessionId);
    return entry === null ? null : structuredClone(entry.bounds);
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

  commitSemantic(sessionId: string, request: SemanticCommitRequest): DurableOperationReceipt {
    const state = this.#requireDurable(sessionId);
    const replay = findOperation(state, request.operationId);
    if (replay) {
      if (replay.operationBindingDigest !== request.operationBindingDigest) {
        throw new Error('IDEMPOTENCY_KEY_REUSED');
      }
      return structuredClone(replay);
    }
    const entry = state.entry;
    if (
      request.expectedRef.drawingId !== entry.drawingId
      || request.expectedRef.revision !== entry.revision
    ) throw new Error('DRAWING_STALE');
    const operationMode = request.mode === 'interactive' ? 'interactive' : 'semantic';
    const beforeSemantic = canonicalSemanticString(entry.document);
    const candidate = applyDrawingTransaction(entry.document, request.forward, this.#now());
    const semanticDigest = digest(canonicalSemanticString(candidate));
    if (canonicalSemanticString(candidate) === beforeSemantic) {
      const receipt: DurableOperationReceipt = {
        status: 'no-effect',
        mode: operationMode,
        operationId: request.operationId,
        operationBindingDigest: request.operationBindingDigest,
        sessionId,
        drawingId: entry.drawingId,
        ref: { drawingId: entry.drawingId, revision: entry.revision },
        semanticDigest,
      };
      const next = { ...state, operations: [...state.operations, receipt] };
      this.#saveDurable(sessionId, next);
      return structuredClone(receipt);
    }
    const restored = applyDrawingTransaction(candidate, request.inverse, this.#now());
    if (canonicalSemanticString(restored) !== beforeSemantic) {
      throw new Error('INVERSE_VERIFICATION_FAILED');
    }
    const nextEntry: DrawingEntry = {
      ...entry,
      document: candidate,
      revision: entry.revision + 1,
    };
    const commitId = `commit_${request.operationId}`;
    const snapshotIntegrityDigest = digest(JSON.stringify(nextEntry));
    const receipt: DurableOperationReceipt = {
      status: 'committed',
      mode: operationMode,
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      sessionId,
      drawingId: entry.drawingId,
      parentRef: { drawingId: entry.drawingId, revision: entry.revision },
      resultingRef: { drawingId: entry.drawingId, revision: nextEntry.revision },
      commitId,
      semanticDigest,
      snapshotIntegrityDigest,
    };
    const record: DrawingCommitRecord = {
      commitId,
      mode: request.mode,
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      parentRevision: entry.revision,
      resultingRevision: nextEntry.revision,
      forward: structuredClone(request.forward),
      inverse: structuredClone(request.inverse),
      candidateDigest: request.candidateDigest,
      semanticDigest,
      snapshotIntegrityDigest,
      ...(request.assessment ? { assessment: structuredClone(request.assessment) } : {}),
      ...(request.reviewEvidence ? { reviewEvidence: structuredClone(request.reviewEvidence) } : {}),
      ...(request.solverProvenance ? { solverProvenance: structuredClone(request.solverProvenance) } : {}),
      committedAt: this.#now(),
    };
    this.#saveDurable(sessionId, {
      version: 2,
      entry: nextEntry,
      commits: [...state.commits, record],
      operations: [...state.operations, receipt],
    });
    this.#previews.delete(sessionId);
    return structuredClone(receipt);
  }

  getOperation(
    sessionId: string,
    operationId: string,
    operationBindingDigest: string,
  ): OperationLookupResult {
    const state = this.#durableState(sessionId);
    if (state === null) return { status: 'absent' };
    const receipt = findOperation(state, operationId);
    if (!receipt) return { status: 'absent' };
    if (receipt.operationBindingDigest !== operationBindingDigest) {
      return { status: 'digest-mismatch', operationId };
    }
    return receipt.status === 'no-effect'
      ? { status: 'no-effect', receipt: structuredClone(receipt) }
      : { status: 'committed', receipt: structuredClone(receipt) };
  }

  undoCommit(sessionId: string, request: UndoCommitRequest): DurableOperationReceipt {
    if (this.#previews.has(sessionId)) throw new Error('UNDO_PREVIEW_ACTIVE');
    const state = this.#requireDurable(sessionId);
    const replay = findOperation(state, request.operationId);
    if (replay) {
      if (replay.operationBindingDigest !== request.operationBindingDigest) {
        throw new Error('IDEMPOTENCY_KEY_REUSED');
      }
      return structuredClone(replay);
    }
    const currentRef = { drawingId: state.entry.drawingId, revision: state.entry.revision };
    if (!isDeepStrictEqual(currentRef, request.expectedCurrentRef)) throw new Error('UNDO_CONFLICT');
    const target = state.commits.find(({ commitId }) => commitId === request.targetCommitId);
    if (!target) throw new Error('UNDO_TARGET_NOT_FOUND');
    if (target.mode === 'undo') throw new Error('UNDO_TARGET_IS_REVERT');
    if (target.resultingRevision !== state.entry.revision) throw new Error('UNDO_CONFLICT');
    const document = applyDrawingTransaction(state.entry.document, target.inverse, this.#now());
    const nextEntry: DrawingEntry = { ...state.entry, document, revision: state.entry.revision + 1 };
    const semanticDigest = digest(canonicalSemanticString(document));
    const snapshotIntegrityDigest = digest(JSON.stringify(nextEntry));
    const commitId = `commit_${request.operationId}`;
    const receipt: DurableOperationReceipt = {
      status: 'committed', mode: 'undo',
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      sessionId, drawingId: state.entry.drawingId,
      parentRef: currentRef,
      resultingRef: { drawingId: state.entry.drawingId, revision: nextEntry.revision },
      commitId, targetCommitId: target.commitId,
      semanticDigest, snapshotIntegrityDigest,
    };
    const record: DrawingCommitRecord = {
      commitId, mode: 'undo',
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      parentRevision: state.entry.revision,
      resultingRevision: nextEntry.revision,
      forward: structuredClone(target.inverse),
      inverse: structuredClone(target.forward),
      targetCommitId: target.commitId,
      semanticDigest, snapshotIntegrityDigest,
      committedAt: this.#now(),
    };
    this.#saveDurable(sessionId, {
      version: 2,
      entry: nextEntry,
      commits: [...state.commits, record],
      operations: [...state.operations, receipt],
    });
    return structuredClone(receipt);
  }

  redoCommit(sessionId: string, request: RedoCommitRequest): DurableOperationReceipt {
    if (this.#previews.has(sessionId)) throw new Error('REDO_PREVIEW_ACTIVE');
    const state = this.#requireDurable(sessionId);
    const replay = findOperation(state, request.operationId);
    if (replay) {
      if (replay.operationBindingDigest !== request.operationBindingDigest) {
        throw new Error('IDEMPOTENCY_KEY_REUSED');
      }
      return structuredClone(replay);
    }
    const currentRef = { drawingId: state.entry.drawingId, revision: state.entry.revision };
    if (!isDeepStrictEqual(currentRef, request.expectedCurrentRef)) throw new Error('REDO_CONFLICT');
    const target = state.commits.find(({ commitId }) => commitId === request.targetCommitId);
    if (!target) throw new Error('REDO_TARGET_NOT_FOUND');
    if (target.mode !== 'undo') throw new Error('REDO_TARGET_NOT_UNDO');
    if (target.resultingRevision !== state.entry.revision) throw new Error('REDO_CONFLICT');
    const document = applyDrawingTransaction(state.entry.document, target.inverse, this.#now());
    const nextEntry: DrawingEntry = { ...state.entry, document, revision: state.entry.revision + 1 };
    const semanticDigest = digest(canonicalSemanticString(document));
    const snapshotIntegrityDigest = digest(JSON.stringify(nextEntry));
    const commitId = `commit_${request.operationId}`;
    const receipt: DurableOperationReceipt = {
      status: 'committed', mode: 'redo',
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      sessionId, drawingId: state.entry.drawingId,
      parentRef: currentRef,
      resultingRef: { drawingId: state.entry.drawingId, revision: nextEntry.revision },
      commitId, targetCommitId: target.commitId,
      semanticDigest, snapshotIntegrityDigest,
    };
    const record: DrawingCommitRecord = {
      commitId, mode: 'redo',
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      parentRevision: state.entry.revision,
      resultingRevision: nextEntry.revision,
      forward: structuredClone(target.inverse),
      inverse: structuredClone(target.forward),
      targetCommitId: target.commitId,
      semanticDigest, snapshotIntegrityDigest,
      committedAt: this.#now(),
    };
    this.#saveDurable(sessionId, {
      version: 2,
      entry: nextEntry,
      commits: [...state.commits, record],
      operations: [...state.operations, receipt],
    });
    return structuredClone(receipt);
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
    this.#durable.delete(sessionId);
    this.#previews.delete(sessionId);
  }

  #getDrawing(sessionId: string): DrawingEntry | null {
    const current = this.#drawings.get(sessionId);
    if (current !== undefined) return current;
    const durable = this.#durableState(sessionId);
    const restored = durable?.entry ?? this.#storage?.load(sessionId) ?? null;
    if (restored !== null) this.#drawings.set(sessionId, structuredClone(restored));
    return restored;
  }

  #durableState(sessionId: string): DrawingDurableState | null {
    const current = this.#durable.get(sessionId);
    if (current) return current;
    const restored = this.#storage?.loadDurable?.(sessionId) ?? null;
    if (restored) {
      const clone = structuredClone(restored);
      this.#durable.set(sessionId, clone);
      this.#drawings.set(sessionId, structuredClone(clone.entry));
      return clone;
    }
    return null;
  }

  #requireDurable(sessionId: string): DrawingDurableState {
    if (!this.#storage?.loadDurable || !this.#storage.saveDurable) {
      throw new Error('AUTO_SAFE_UNAVAILABLE');
    }
    const state = this.#durableState(sessionId);
    if (state) return state;
    const legacy = this.#getDrawing(sessionId);
    if (!legacy) throw new Error('DRAWING_REQUIRED');
    const promoted: DrawingDurableState = {
      version: 2,
      entry: structuredClone(legacy),
      commits: [],
      operations: [],
    };
    this.#saveDurable(sessionId, promoted);
    return promoted;
  }

  #saveDurable(sessionId: string, state: DrawingDurableState): void {
    const storage = this.#storage as DrawingRepositoryStorage & DurableDrawingRepositoryStorage;
    storage.saveDurable(sessionId, structuredClone(state));
    this.#durable.set(sessionId, structuredClone(state));
    this.#drawings.set(sessionId, structuredClone(state.entry));
  }
}

function findOperation(state: DrawingDurableState, operationId: string): DurableOperationReceipt | undefined {
  return state.operations.find((receipt) => receipt.operationId === operationId);
}

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
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

function snapshotOf(entry: DrawingEntry, lastCommit?: DrawingCommitRecord): DrawingWorkspaceSnapshot {
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
    ...(lastCommit ? { lastCommit: {
      commitId: lastCommit.commitId,
      mode: lastCommit.mode,
      undoable: lastCommit.mode !== 'undo',
      redoable: lastCommit.mode === 'undo',
    } } : {}),
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
    Object.assign(node, structuredClone(withDimensionLayoutOwnership(
      node as unknown as Record<string, unknown>, { [key]: command.position },
    )));
    return null;
  }

  const mutable = node as unknown as Record<string, unknown>;
  for (const [key, expected] of Object.entries(command.expected)) {
    if (!isDeepStrictEqual(mutable[key], node.type === 'dimension' && key === 'layout' && expected === null ? undefined : expected)) {
      return {
        status: 'rejected',
        message: `Precondition failed for node ${command.id} property ${key}`,
        code: 'PRECONDITION_FAILED',
      };
    }
  }
  for (const [key, value] of Object.entries(withDimensionLayoutOwnership(mutable, command.changes))) {
    const dimensionLayout = node.type === 'dimension' && key === 'layout';
    if (key === 'id' || key === 'type' || key === 'plane' || (!(key in mutable) && !dimensionLayout)) {
      return {
        status: 'rejected',
        message: `Property ${key} cannot be updated on node ${command.id}`,
        code: 'INVALID_COMMAND',
      };
    }
    if (dimensionLayout && value === null) delete mutable.layout;
    else mutable[key] = structuredClone(value);
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
        ? [annotation.target.geometryId, ...(annotation.branches ?? []).map(({ target }) => target.geometryId)]
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
