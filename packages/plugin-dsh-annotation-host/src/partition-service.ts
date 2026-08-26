// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import { analyzeShaftPartition, type PartitionDraft } from '@vectorai/engineering-annotation';
import {
  type DrawingRef,
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
  constructor(
    private readonly space: SpacePort,
    private readonly partitions: PartitionSessionStore,
    private readonly annotations: AnnotationSessionStateStore,
    private readonly reviewer?: PartitionSemanticReviewer,
    private readonly extractDocuments: typeof extractEngineeringDocuments = extractEngineeringDocuments,
  ) {}

  async importAndAnalyze(agent: Agent, request: PartitionImportRequest, signal?: AbortSignal): Promise<PartitionSessionSnapshot> {
    if (request.dxf.base64.length > 27_962_028) throw new Error('DXF_SIZE_LIMIT');
    const bytes = decodeBase64(request.dxf.base64);
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('DXF_SIZE_LIMIT');
    if (Buffer.byteLength(request.engineeringDocument?.text ?? '', 'utf8') > 8 * 1024 * 1024) throw new Error('DOCUMENT_TOTAL_TEXT_SIZE_LIMIT');
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (digest !== request.dxf.digest) throw new Error('DXF_DIGEST_MISMATCH');
    signal?.throwIfAborted();
    const extracted = request.engineeringDocuments === undefined
      ? undefined
      : await this.extractDocuments(request.engineeringDocuments, { signal });
    const engineeringText = extracted?.combinedText ?? request.engineeringDocument?.text;
    signal?.throwIfAborted();
    await this.space.importDxf(agent, { bytes, digest, name: request.dxf.name }, signal);
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
    if (analyzed.unclassifiedSegmentIds.length > 0 && this.reviewer) {
      try {
        draft = (await this.reviewer({ agent, draft, segmentIds: analyzed.unclassifiedSegmentIds, signal })).draft;
      } catch (error) {
        draft = structuredClone(draft);
        draft.diagnostics.push({
          id: 'diagnostic:ai-semantic-unavailable', severity: 'warning', code: 'AI_SEMANTIC_REVIEW_UNAVAILABLE',
          message: error instanceof Error ? error.message : String(error),
          segmentIds: analyzed.unclassifiedSegmentIds,
        });
      }
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
