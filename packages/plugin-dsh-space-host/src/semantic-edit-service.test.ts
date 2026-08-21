// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import type { DrawingDurableState } from './durable-envelope';
import { InMemoryDrawingRepository, type DrawingRepositoryStorage } from './repository';
import { SemanticEditService } from './semantic-edit-service';

class Storage implements DrawingRepositoryStorage {
  state: DrawingDurableState | null = null;
  load() { return this.state?.entry ?? null; }
  save(_sessionId: string, entry: DrawingDurableState['entry']) {
    this.state = { version: 2, entry: structuredClone(entry), commits: [], operations: [] };
  }
  loadDurable() { return this.state === null ? null : structuredClone(this.state); }
  saveDurable(_sessionId: string, state: DrawingDurableState) { this.state = structuredClone(state); }
}

async function setup(
  provisional = false,
  review?: ConstructorParameters<typeof SemanticEditService>[1]['review'],
) {
  const storage = new Storage();
  let sequence = 0;
  const drawings = new InMemoryDrawingRepository({
    storage,
    previewHandle: () => `workspace-preview-${++sequence}`,
    now: () => 100 + sequence,
    drawingId: () => 'drawing-wave',
    vectorizer: {
      async vectorize({ drawingId }) {
        const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
        const quality = { status: provisional ? 'candidate' as const : 'confirmed' as const, evidenceRefs: [] };
        document.geometry = [
          { id: 'body' as GeometryId, type: 'circle', center: [0, 0], radius: 10, visible: true, quality },
          { id: 'right-hand' as GeometryId, type: 'circle', center: [15, 0], radius: 3, visible: true, quality },
          { id: 'right-arm-top' as GeometryId, type: 'line', start: [9, 2], end: [12, 2], visible: true, quality },
          { id: 'right-arm-bottom' as GeometryId, type: 'line', start: [9, -2], end: [12, -2], visible: true, quality },
          { id: 'left-hand' as GeometryId, type: 'circle', center: [-15, 0], radius: 3, visible: true, quality },
        ];
        return { document, bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 }, provisional };
      },
    },
  });
  const attachment: ImageAttachmentRef = {
    attachmentId: 'source' as never, mediaType: 'image/png', bytes: 1, width: 60, height: 50,
  };
  drawings.bindPending('session-1', attachment);
  await drawings.importPending('session-1', { data: new Uint8Array([1]), signal: new AbortController().signal });
  const service = new SemanticEditService(drawings, {
    id: (kind) => `${kind}-${++sequence}`,
    now: () => 1_000 + sequence,
    digest: (value) => `sha256:test-${value.length}-${checksum(value)}`,
    ...(review ? { review } : {}),
  });
  return { drawings, service, storage };
}

async function previewRightHand(service: SemanticEditService) {
  const task = service.startTask('session-1', {
    objective: '把右手抬起来打招呼',
    rootUserMessageDigest: 'sha256:user-message',
    policy: 'auto-safe',
  });
  const observation = service.observe('session-1', { taskId: task.taskId });
  const context = service.buildContext('session-1', {
    taskId: task.taskId,
    observationId: observation.observationId,
  });
  const grounding = service.ground('session-1', {
    taskId: task.taskId,
    contextId: context.contextId,
    targetNodeIds: ['right-hand'],
    interfaces: [
      { interfaceId: 'right-arm-top:end', nodeId: 'right-arm-top', endpoint: 'end' },
      { interfaceId: 'right-arm-bottom:end', nodeId: 'right-arm-bottom', endpoint: 'end' },
    ],
  });
  const preview = service.previewProgram('session-1', {
    taskId: task.taskId,
    groundingId: grounding.groundingId,
    program: {
      baseRef: task.baseRef,
      targetHandle: grounding.targetHandle,
      summary: 'Raise right hand',
      objective: '把右手抬起来打招呼',
      operations: [{
        kind: 'connected_transform', translation: [-3, 11], rotationRadians: -Math.PI / 3,
        pivot: [15, 0], interfaceIds: ['right-arm-top:end', 'right-arm-bottom:end'],
      }],
      preserveScopes: [{ kind: 'node-field', nodeId: 'left-hand', fields: ['center'] }],
      postconditions: [{ kind: 'within_bounds', bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 } }],
      evidenceRefs: ['evidence:right-hand'],
    },
  });
  return { task, observation, context, grounding, preview };
}

describe('SemanticEditService', () => {
  it('runs the right-hand edit through Preview, evaluation, auto-safe commit, and Undo', async () => {
    const { service, drawings, storage } = await setup();
    const { preview } = await previewRightHand(service);

    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(1);
    expect(drawings.getPreview('session-1')?.candidate.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });

    const evaluation = await service.evaluatePreview('session-1', {
      taskId: preview.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    });
    expect(evaluation.assessment.disposition).toBe('auto_safe');

    const finalized = service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluation.evaluation.evaluationId,
    });

    expect(finalized).toMatchObject({ status: 'committed', mode: 'auto-safe', ref: { revision: 2 } });
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [12, 11] });
    expect(storage.state?.commits[0]).toMatchObject({ mode: 'auto-safe' });

    if (finalized.status !== 'committed') throw new Error('expected committed finalize');
    const undone = service.undo('session-1', {
      targetCommitId: finalized.commitId,
      expectedCurrentRef: finalized.ref,
      operationId: 'undo-1',
      operationBindingDigest: 'sha256:undo-binding',
    });
    expect(undone.status).toBe('committed');
    expect(drawings.getSnapshot('session-1')?.document.geometry
      .find(({ id }) => id === 'right-hand')).toMatchObject({ center: [15, 0] });
  });

  it('requires confirmation for provisional source and does not mutate formal state', async () => {
    const { service, drawings } = await setup(true);
    const { preview } = await previewRightHand(service);
    const evaluation = await service.evaluatePreview('session-1', {
      taskId: preview.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    });

    expect(evaluation.assessment).toMatchObject({
      disposition: 'confirmation_required',
      reasons: expect.arrayContaining(['SOURCE_NOT_CONFIRMED']),
    });
    expect(service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluation.evaluation.evaluationId,
    })).toMatchObject({ status: 'rejected', disposition: 'confirmation_required' });
    expect(drawings.getSnapshot('session-1')?.ref.revision).toBe(1);
  });

  it('invalidates the former task Preview when a new direct task starts', async () => {
    const { service, drawings } = await setup();
    const { preview } = await previewRightHand(service);

    service.startTask('session-1', {
      objective: 'Inspect the body', rootUserMessageDigest: 'sha256:new-message', policy: 'review',
    });

    expect(drawings.getPreview('session-1')).toBeNull();
    expect(() => service.finalizePreview('session-1', {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: 'evaluation-old',
    })).toThrow('EDIT_TASK_STALE');
  });

  it('revises the current candidate atomically and makes the former Preview unusable', async () => {
    const { service, drawings } = await setup();
    const { task, grounding, preview } = await previewRightHand(service);
    const revised = service.revisePreview('session-1', {
      taskId: task.taskId,
      currentPreviewHandle: preview.previewHandle,
      currentCandidateDigest: preview.candidateDigest,
      groundingId: grounding.groundingId,
      program: {
        baseRef: task.baseRef,
        targetHandle: grounding.targetHandle,
        summary: 'Raise right hand a little less',
        objective: '把右手抬起来打招呼',
        operations: [{
          kind: 'connected_transform', translation: [-2, 10], rotationRadians: 0,
          pivot: [15, 0], interfaceIds: ['right-arm-top:end', 'right-arm-bottom:end'],
        }],
        preserveScopes: [{ kind: 'node-field', nodeId: 'left-hand', fields: ['center'] }],
        postconditions: [{ kind: 'within_bounds', bounds: { minX: -30, minY: -20, maxX: 30, maxY: 30 } }],
        evidenceRefs: ['evidence:right-hand'],
      },
    });

    expect(revised.previewHandle).not.toBe(preview.previewHandle);
    expect(drawings.getPreview('session-1')?.handle).toBe(revised.previewHandle);
    expect(() => service.discardPreview('session-1', preview.previewHandle)).toThrow('EDIT_PREVIEW_STALE');
  });

  it('joins concurrent reviews and keeps a negative result sticky for the same semantic candidate', async () => {
    let reviewCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { service } = await setup(false, async () => {
      reviewCalls += 1;
      await gate;
      return {
        outcome: 'needs_revision',
        defects: [{ code: 'HAND_POSE', reason: 'The greeting pose is unclear.', scopeDigest: 'sha256:scope' }],
      };
    });
    const { preview } = await previewRightHand(service);
    const request = {
      taskId: preview.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
    };
    const first = service.evaluatePreview('session-1', request);
    const second = service.evaluatePreview('session-1', request);
    await Promise.resolve();
    expect(reviewCalls).toBe(1);
    release();

    const [a, b] = await Promise.all([first, second]);
    expect(a.assessment.disposition).toBe('confirmation_required');
    expect(b.assessment.disposition).toBe('confirmation_required');
    await service.evaluatePreview('session-1', request);
    expect(reviewCalls).toBe(1);
  });
});

function checksum(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 33 + character.charCodeAt(0)) >>> 0;
  return result;
}
