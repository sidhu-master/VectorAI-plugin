// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceSnapshot } from '@vectorai/drawing-workspace';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import { ExtensionPreviewService } from './extension-preview-service';

function request() {
  return {
    extensionId: 'engineering-annotation',
    workflowId: 'workflow-1',
    ref: { drawingId: 'drawing-1', revision: 1 },
    targetNodeIds: ['circle-1'],
    interfaces: [],
    program: {
      baseRef: { drawingId: 'drawing-1', revision: 1 },
      targetHandle: 'extension-input',
      summary: 'create a dimension',
      objective: '工程图纸自动标注',
      operations: [{
        kind: 'create_annotation_batch' as const,
        annotations: [{ id: 'dimension-1', type: 'dimension' }],
        associations: [],
      }],
      preserveScopes: [],
      postconditions: [],
      evidenceRefs: ['planner-1'],
    },
  };
}

function snapshot(revision = 1): DrawingWorkspaceSnapshot {
  return {
    version: 1,
    ref: { drawingId: 'drawing-1', revision },
    document: createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 }),
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
  };
}

function setup() {
  let current = snapshot();
  let now = 100;
  let sequence = 0;
  const drawings = { getSnapshot: vi.fn(() => current) };
  const semantic = {
    startTask: vi.fn(() => ({ taskId: 'task-1', baseRef: current.ref })),
    observe: vi.fn(async () => ({ observationId: 'observation-1' })),
    buildContext: vi.fn(() => ({ contextId: 'context-1' })),
    ground: vi.fn(() => ({ groundingId: 'grounding-1', targetHandle: 'target-1' })),
    previewProgram: vi.fn(() => ({
      previewHandle: `internal-preview-${++sequence}`,
      candidateDigest: `sha256:candidate-${sequence}`,
      finalizeOperationId: `operation-${sequence}`,
      finalizeOperationBindingDigest: `sha256:binding-${sequence}`,
    })),
    evaluatePreview: vi.fn(async () => ({
      evaluation: { evaluationId: 'evaluation-1' },
      assessment: {
        disposition: 'auto_safe', assessmentId: 'assessment-1', taskId: 'task-1',
        drawingId: 'drawing-1', baseRef: current.ref, previewHandle: `internal-preview-${sequence}`,
        candidateDigest: `sha256:candidate-${sequence}`, evaluationDigest: 'sha256:evaluation',
        policyVersion: 'policy-1', evaluatorVersions: ['eval-1'], effectDigest: 'sha256:effect', reasons: [],
        autoQualification: {
          exactScope: true, cleanDiagnostics: true, sourceConfirmed: true,
          reviewerSatisfied: true, inverseVerified: true,
        },
      },
    })),
    finalizePreview: vi.fn(() => ({
      status: 'committed', mode: 'auto-safe', commitId: 'commit-1',
      ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'operation-1',
      operationBindingDigest: 'sha256:binding-1',
    })),
    discardPreview: vi.fn(() => ({ status: 'discarded', ref: current.ref })),
  };
  const service = new ExtensionPreviewService(drawings, semantic as never, {
    id: () => `opaque-${++sequence}`,
    digest: (value) => `sha256:${value.length}`,
    now: () => now,
    ttlMs: 50,
  });
  return {
    service, semantic, drawings,
    advance: (milliseconds: number) => { now += milliseconds; },
    reviseDrawing: (revision: number) => { current = snapshot(revision); },
  };
}

describe('ExtensionPreviewService', () => {
  it('creates an opaque Preview without leaking semantic handles', async () => {
    const { service, semantic } = setup();
    const result = await service.create('session-1', request());

    expect(result).toMatchObject({
      status: 'previewed', previewToken: expect.stringMatching(/^opaque-/),
      candidateDigest: expect.stringMatching(/^sha256:candidate-/), ref: request().ref,
    });
    expect(result).not.toHaveProperty('taskId');
    expect(result).not.toHaveProperty('previewHandle');
    expect(semantic.ground).toHaveBeenCalledWith('session-1', expect.objectContaining({
      targetNodeIds: ['circle-1'],
    }));
  });

  it('isolates extension/workflow ownership and keeps the prior candidate after a failed replacement', async () => {
    const { service, semantic } = setup();
    const created = await service.create('session-1', request());
    if (created.status !== 'previewed') throw new Error('expected preview');
    const control = {
      extensionId: request().extensionId, workflowId: request().workflowId,
      ref: request().ref, previewToken: created.previewToken, candidateDigest: created.candidateDigest,
    };

    expect(await service.assess('session-1', { ...control, extensionId: 'intruder' }))
      .toMatchObject({ status: 'rejected', code: 'EXTENSION_PREVIEW_NOT_FOUND' });

    semantic.previewProgram.mockImplementationOnce(() => { throw new Error('INVALID_PROGRAM'); });
    await expect(service.replace('session-1', { ...control, program: request().program }))
      .rejects.toThrow('INVALID_PROGRAM');
    expect((await service.assess('session-1', control)).status).toBe('assessed');
  });

  it('assesses and finalizes idempotently while committing only once', async () => {
    const { service, semantic } = setup();
    const created = await service.create('session-1', request());
    if (created.status !== 'previewed') throw new Error('expected preview');
    const control = {
      extensionId: request().extensionId, workflowId: request().workflowId,
      ref: request().ref, previewToken: created.previewToken, candidateDigest: created.candidateDigest,
    };
    expect(await service.assess('session-1', control)).toMatchObject({
      status: 'assessed', assessment: { disposition: 'auto_safe' },
    });
    const first = await service.finalize('session-1', control);
    const replay = await service.finalize('session-1', control);

    expect(first).toMatchObject({ status: 'finalized', result: { status: 'committed' } });
    expect(replay).toEqual(first);
    expect(semantic.finalizePreview).toHaveBeenCalledOnce();
  });

  it('reports stale revisions and expires tokens without silently committing', async () => {
    const { service, semantic, reviseDrawing, advance } = setup();
    const created = await service.create('session-1', request());
    if (created.status !== 'previewed') throw new Error('expected preview');
    const control = {
      extensionId: request().extensionId, workflowId: request().workflowId,
      ref: request().ref, previewToken: created.previewToken, candidateDigest: created.candidateDigest,
    };
    reviseDrawing(2);
    expect(await service.assess('session-1', control)).toEqual({
      status: 'needs-rebase', currentRef: { drawingId: 'drawing-1', revision: 2 },
    });
    reviseDrawing(1);
    advance(51);
    expect(await service.assess('session-1', control)).toMatchObject({
      status: 'rejected', code: 'EXTENSION_PREVIEW_EXPIRED',
    });
    expect(semantic.finalizePreview).not.toHaveBeenCalled();
    expect(semantic.discardPreview).toHaveBeenCalledOnce();
  });
});
