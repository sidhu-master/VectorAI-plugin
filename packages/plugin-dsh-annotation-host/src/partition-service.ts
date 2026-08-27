// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import { analyzeShaftPartition, inferRegularShaftRegions, type PartitionDraft } from '@vectorai/engineering-annotation';
import {
  type DrawingRef,
  type EngineeringDocumentInput,
  type DrawingSpaceExtensionHost,
  type PartitionDocumentSupplementRequest,
  type PartitionEditCommand,
  type PartitionImportRequest,
  type PartitionSessionSnapshot,
} from '@vectorai/plugin-space-contracts';
import { createHash, randomUUID } from 'node:crypto';
import type { AnnotationSessionStateStore } from './session-state';
import type { PartitionSessionStore } from './partition-store';
import { extractEngineeringDocuments } from './engineering-document-extractor';
import { ENGINEERING_DOCUMENT_LIMITS } from './engineering-document-extractor';

export interface PartitionSemanticReviewInput {
  agent: Agent;
  draft: PartitionDraft;
  segmentIds: string[];
  signal?: AbortSignal;
}
export type PartitionSemanticReviewer = (input: PartitionSemanticReviewInput) => Promise<{ draft: PartitionDraft }>;

type SpacePort = Pick<DrawingSpaceExtensionHost<Agent>, 'importDxf' | 'getSnapshot' | 'renderObservation'>;
type SpaceSnapshot = NonNullable<ReturnType<SpacePort['getSnapshot']>>;

export class PartitionWorkflowService {
  readonly #stagedDocuments = new Map<string, {
    drawingRef?: DrawingRef;
    entries: Array<{ name: string; digest: string; sourceBytes: number; text: string; textBytes: number }>;
  }>();
  constructor(
    private readonly space: SpacePort,
    private readonly partitions: PartitionSessionStore,
    private readonly annotations: AnnotationSessionStateStore,
    private readonly reviewer?: PartitionSemanticReviewer,
    private readonly extractDocuments: typeof extractEngineeringDocuments = extractEngineeringDocuments,
  ) {}

  async stageDocuments(agent: Agent, documents: readonly EngineeringDocumentInput[], signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    const sessionId = String(agent.id);
    const drawingRef = this.space.getSnapshot(agent)?.ref;
    const stored = this.#stagedDocuments.get(sessionId);
    const previous = stored?.drawingRef && drawingRef && !sameDrawing(stored.drawingRef, drawingRef) ? undefined : stored;
    const names = new Set<string>();
    const duplicate = [...(previous?.entries ?? []), ...documents].find(({ name }) => {
      const key = name.toLocaleLowerCase();
      if (names.has(key)) return true;
      names.add(key);
      return false;
    });
    if (duplicate) throw new Error(`ENGINEERING_DOCUMENT_DUPLICATE_NAME:${duplicate.name}`);
    const extracted = await this.extractDocuments(documents, { signal });
    signal?.throwIfAborted();
    if (!extracted.combinedText) throw new Error('ENGINEERING_DOCUMENT_REQUIRED');
    const additions = extracted.documents.map((document, index) => ({
      name: document.name,
      digest: documents[index]!.digest,
      sourceBytes: Buffer.from(documents[index]!.base64, 'base64').byteLength,
      text: document.text,
      textBytes: Buffer.byteLength(document.text, 'utf8'),
    }));
    const entries = [...(previous?.entries ?? []), ...additions];
    if (entries.length > ENGINEERING_DOCUMENT_LIMITS.maxDocuments) throw new Error('ENGINEERING_DOCUMENT_COUNT_LIMIT');
    if (entries.reduce((total, entry) => total + entry.sourceBytes, 0) > ENGINEERING_DOCUMENT_LIMITS.maxTotalDocumentBytes) throw new Error('ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT');
    if (entries.reduce((total, entry) => total + entry.textBytes, 0) > ENGINEERING_DOCUMENT_LIMITS.maxTotalTextBytes) throw new Error('DOCUMENT_TOTAL_TEXT_SIZE_LIMIT');
    this.#stagedDocuments.set(sessionId, {
      ...(drawingRef ?? previous?.drawingRef ? { drawingRef: drawingRef ?? previous!.drawingRef } : {}),
      entries,
    });
    return this.partitions.get(sessionId);
  }

  clearDocuments(agent: Agent): PartitionSessionSnapshot {
    const sessionId = String(agent.id);
    this.#stagedDocuments.delete(sessionId);
    return this.partitions.get(sessionId);
  }

  disposeSession(sessionId: string): void { this.#stagedDocuments.delete(sessionId); }

  async importDrawing(agent: Agent, dxf: PartitionImportRequest['dxf'], signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    const bytes = validateDxf(dxf);
    signal?.throwIfAborted();
    await this.space.importDxf(agent, { bytes, digest: dxf.digest, name: dxf.name }, signal);
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error('DRAWING_REQUIRED');
    const sessionId = String(agent.id);
    const staged = this.#stagedDocuments.get(sessionId);
    if (staged?.drawingRef && !sameDrawing(staged.drawingRef, snapshot.ref)) this.#stagedDocuments.delete(sessionId);
    else if (staged && !staged.drawingRef) this.#stagedDocuments.set(sessionId, { ...staged, drawingRef: snapshot.ref });
    this.annotations.release(sessionId);
    return this.partitions.bindDrawing(sessionId, snapshot.ref);
  }

  async importAndAnalyze(agent: Agent, request: PartitionImportRequest, signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    const bytes = validateDxf(request.dxf);
    if (Buffer.byteLength(request.engineeringDocument?.text ?? '', 'utf8') > 8 * 1024 * 1024) throw new Error('DOCUMENT_TOTAL_TEXT_SIZE_LIMIT');
    signal?.throwIfAborted();
    const extracted = request.engineeringDocuments === undefined
      ? undefined
      : await this.extractDocuments(request.engineeringDocuments, { signal });
    const engineeringText = extracted?.combinedText ?? request.engineeringDocument?.text;
    signal?.throwIfAborted();
    await this.space.importDxf(agent, { bytes, digest: request.dxf.digest, name: request.dxf.name }, signal);
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error('DRAWING_REQUIRED');
    return this.#analyze(agent, snapshot, engineeringText, request.dxf.name, signal);
  }

  async supplementDocuments(agent: Agent, request: PartitionDocumentSupplementRequest, signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error('DRAWING_REQUIRED');
    if (snapshot.ref.drawingId !== request.expectedDrawingRef.drawingId || snapshot.ref.revision !== request.expectedDrawingRef.revision) {
      this.partitions.markNeedsRebase(String(agent.id), snapshot.ref);
      throw new Error('PARTITION_DRAWING_STALE');
    }
    const extracted = await this.extractDocuments(request.engineeringDocuments, { signal });
    signal?.throwIfAborted();
    const drawingSourceName = snapshot.document.sources?.find(({ kind }) => kind === 'dxf')?.name ?? 'drawing.dxf';
    return this.#analyze(agent, snapshot, extracted.combinedText, drawingSourceName, signal);
  }

  async analyzeCurrent(agent: Agent, engineeringContext?: string, signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error('DRAWING_REQUIRED');
    if (Buffer.byteLength(engineeringContext ?? '', 'utf8') > 32 * 1024) throw new Error('PARTITION_CONTEXT_SIZE_LIMIT');
    signal?.throwIfAborted();
    const drawingSourceName = snapshot.document.sources?.find(({ kind }) => kind === 'dxf')?.name;
    if (drawingSourceName === undefined) throw new Error('DXF_DRAWING_REQUIRED');
    const staged = this.#stagedDocuments.get(String(agent.id));
    const stagedText = staged && (!staged.drawingRef || sameDrawing(staged.drawingRef, snapshot.ref))
      ? staged.entries.map(({ name, text }) => `===== ENGINEERING DOCUMENT: ${name} =====\n${text}\n===== END ENGINEERING DOCUMENT: ${name} =====`).join('\n')
      : undefined;
    const combinedContext = [stagedText, engineeringContext?.trim()].filter(Boolean).join('\n') || undefined;
    return this.#analyze(agent, snapshot, combinedContext, drawingSourceName, signal);
  }

  async #analyze(agent: Agent, snapshot: SpaceSnapshot, engineeringText: string | undefined, drawingSourceName: string, signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    const sessionId = String(agent.id);
    this.annotations.start(sessionId, `partition_${randomUUID()}`);
    this.partitions.beginAnalysis(sessionId, snapshot.ref);
    const analyzed = analyzeShaftPartition({
      document: snapshot.document,
      drawingRef: snapshot.ref,
      ...(engineeringText === undefined ? {} : { engineeringText }),
      drawingSourceName,
    });
    if (analyzed.status === 'rejected') {
      this.annotations.finish(sessionId, 'failed', analyzed.diagnostics.map(({ code }) => code).join(', '));
      throw new Error(`PARTITION_ANALYSIS_REJECTED:${analyzed.diagnostics.map(({ code }) => code).join(',')}`);
    }
    let draft = analyzed.draft;
    let semanticReviewCompleted = analyzed.semanticReviewSegmentIds.length === 0;
    if (analyzed.semanticReviewSegmentIds.length > 0 && this.reviewer) {
      try {
        draft = (await this.reviewer({ agent, draft, segmentIds: analyzed.semanticReviewSegmentIds, signal })).draft;
        semanticReviewCompleted = true;
      } catch (error) {
        if (signal?.aborted) {
          this.partitions.cancel(sessionId, snapshot.ref);
          this.annotations.release(sessionId);
          throw signal.reason ?? error;
        }
        draft = structuredClone(draft);
        draft.diagnostics.push({
          id: 'diagnostic:ai-semantic-unavailable', severity: 'warning', code: 'AI_SEMANTIC_REVIEW_UNAVAILABLE',
          message: error instanceof Error ? error.message : String(error),
          segmentIds: analyzed.semanticReviewSegmentIds,
        });
      }
    }
    if (semanticReviewCompleted) draft = inferRegularShaftRegions(draft);
    if (signal?.aborted) {
      this.partitions.cancel(sessionId, snapshot.ref);
      this.annotations.release(sessionId);
      throw signal.reason ?? new Error('PARTITION_ANALYSIS_CANCELED');
    }
    return this.partitions.setDraft(sessionId, draft);
  }

  getState(agent: Agent): PartitionSessionSnapshot { return this.partitions.get(String(agent.id)); }

  edit(agent: Agent, command: PartitionEditCommand): PartitionSessionSnapshot {
    if (!this.#current(agent, command.expectedDrawingRef)) return this.partitions.get(String(agent.id));
    return this.partitions.edit(String(agent.id), command);
  }
  confirm(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    if (!this.#current(agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.confirm(sessionId, expected);
    this.annotations.finish(sessionId, 'completed');
    return result;
  }
  cancel(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    if (!this.#current(agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.cancel(sessionId, expected);
    this.annotations.finish(sessionId, 'canceled');
    return result;
  }
  reopen(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    if (!this.#current(agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.reopen(sessionId, expected);
    this.annotations.start(sessionId, `partition_${randomUUID()}`);
    return result;
  }
  undo(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    if (!this.#current(agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.undo(sessionId, expected);
    if (result.phase === 'editing') this.annotations.start(sessionId, `partition_${randomUUID()}`);
    return result;
  }
  redo(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    if (!this.#current(agent, expected)) return this.partitions.get(String(agent.id));
    return this.partitions.redo(String(agent.id), expected);
  }

  #current(agent: Agent, expected: DrawingRef): boolean {
    const current = this.space.getSnapshot(agent)?.ref;
    if (current && current.drawingId === expected.drawingId && current.revision === expected.revision) return true;
    this.partitions.markNeedsRebase(String(agent.id), current ?? expected);
    return false;
  }
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('DXF_BASE64_INVALID');
  return new Uint8Array(Buffer.from(value, 'base64'));
}

function validateDxf(dxf: PartitionImportRequest['dxf']): Uint8Array {
  if (dxf.base64.length > 27_962_028) throw new Error('DXF_SIZE_LIMIT');
  const bytes = decodeBase64(dxf.base64);
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('DXF_SIZE_LIMIT');
  const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (digest !== dxf.digest) throw new Error('DXF_DIGEST_MISMATCH');
  return bytes;
}

function sameDrawing(left: DrawingRef, right: DrawingRef): boolean {
  return left.drawingId === right.drawingId;
}
