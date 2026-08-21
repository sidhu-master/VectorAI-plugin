// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  assessmentSchema,
  drawingTransactionCommandSchema,
  drawingRefSchema,
  durableOperationBindingSchema,
  durableOperationReceiptSchema,
  finalizePreviewRequestSchema,
  finalizePreviewResultSchema,
  observationArtifactRefSchema,
  operationLookupResultSchema,
  reviewEvidenceSchema,
  spatialEditProgramSchema,
  taskRefSchema,
} from './index';

function validProgram() {
  return {
    baseRef: { drawingId: 'drawing-1', revision: 2 },
    targetHandle: 'grounding-target-1',
    summary: 'Move the selected connected part',
    objective: 'Raise the selected arm into a waving pose',
    operations: [{
      kind: 'rigid_transform' as const,
      translation: [4, 8] as const,
      rotationRadians: -0.5,
      pivot: [20, 30] as const,
    }],
    preserveScopes: [{
      kind: 'node-field' as const,
      nodeId: 'body-outline',
      fields: ['start', 'end'],
    }],
    postconditions: [{
      kind: 'within_bounds' as const,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 120 },
    }],
    evidenceRefs: ['evidence:right-arm'],
  };
}

function validFinalizeRequest() {
  return {
    previewHandle: 'preview-1',
    previewDigest: 'sha256:candidate',
    finalizeOperationId: 'operation-1',
    finalizeOperationBindingDigest: 'sha256:binding',
    evaluationId: 'evaluation-1',
  };
}

describe('@vectorai/drawing-edit-protocol', () => {
  it('keeps DrawingRef revision-bound and rejects host identity fields', () => {
    const ref = { drawingId: 'drawing-1', revision: 2 };

    expect(drawingRefSchema.parse(ref)).toEqual(ref);
    expect(() => drawingRefSchema.parse({ ...ref, sessionId: 'forged-session' })).toThrow();
    expect(() => drawingRefSchema.parse({ drawingId: '', revision: 2 })).toThrow();
    expect(() => drawingRefSchema.parse({ drawingId: 'drawing-1', revision: -1 })).toThrow();
  });

  it('uses provider-neutral observation artifacts instead of DSH attachments', () => {
    const artifact = {
      id: 'artifact-1',
      contentDigest: 'sha256:artifact',
      mimeType: 'image/png' as const,
      basis: { kind: 'canonical' as const, ref: { drawingId: 'drawing-1', revision: 2 } },
    };

    expect(observationArtifactRefSchema.parse(artifact)).toEqual(artifact);
    expect(() => observationArtifactRefSchema.parse({
      ...artifact,
      attachmentId: 'dsh-attachment-1',
    })).toThrow();
  });

  it('parses a bounded high-level spatial edit program', () => {
    expect(spatialEditProgramSchema.parse(validProgram())).toEqual(validProgram());
  });

  it('rejects raw commands, empty evidence, invalid preserve scopes, and non-finite motion', () => {
    const program = validProgram();

    expect(() => spatialEditProgramSchema.parse({ ...program, commands: [] })).toThrow();
    expect(() => spatialEditProgramSchema.parse({ ...program, evidenceRefs: [] })).toThrow();
    expect(() => spatialEditProgramSchema.parse({
      ...program,
      preserveScopes: [{ kind: 'node-field', nodeId: 'body-outline', fields: [] }],
    })).toThrow();
    expect(() => spatialEditProgramSchema.parse({
      ...program,
      operations: [{ ...program.operations[0], translation: [Number.POSITIVE_INFINITY, 8] }],
    })).toThrow();
    expect(() => spatialEditProgramSchema.parse({
      ...program,
      operations: [{ ...program.operations[0], autoSafe: true }],
    })).toThrow();
  });

  it('accepts only authority-free finalize input', () => {
    const request = validFinalizeRequest();

    expect(finalizePreviewRequestSchema.parse(request)).toEqual(request);
    for (const forbidden of [
      { force: true },
      { approved: true },
      { humanDecision: 'apply' },
      { autoSafe: true },
      { commands: [] },
      { sessionId: 'forged-session' },
    ]) {
      expect(() => finalizePreviewRequestSchema.parse({ ...request, ...forbidden })).toThrow();
    }
  });

  it('freezes fail-closed and outcome-unknown finalize results', () => {
    const unavailable = {
      status: 'rejected' as const,
      disposition: 'blocked' as const,
      code: 'AUTO_SAFE_UNAVAILABLE' as const,
      message: 'Durable prerequisites are unavailable.',
    };
    const unknown = {
      status: 'outcome-unknown' as const,
      operationId: 'operation-1',
      operationBindingDigest: 'sha256:binding',
    };

    expect(finalizePreviewResultSchema.parse(unavailable)).toEqual(unavailable);
    expect(finalizePreviewResultSchema.parse(unknown)).toEqual(unknown);
    expect(() => finalizePreviewResultSchema.parse({ ...unavailable, approved: true })).toThrow();
  });

  it('freezes strict task lineage and rejects caller-authored actor fields', () => {
    const task = {
      taskId: 'task-1',
      rootUserMessageDigest: 'sha256:message',
      authoritativeObjectiveDigest: 'sha256:objective',
      baseRef: { drawingId: 'drawing-1', revision: 2 },
      policy: 'auto-safe' as const,
      stateEpoch: 3,
    };

    expect(taskRefSchema.parse(task)).toEqual(task);
    expect(() => taskRefSchema.parse({ ...task, actorId: 'model-forged' })).toThrow();
  });

  it('preserves transaction order while keeping command envelopes strict', () => {
    const first = {
      type: 'node.update' as const,
      id: 'line-1',
      changes: { start: [1, 2] },
      expected: { start: [0, 0] },
    };
    const second = { type: 'node.delete' as const, id: 'line-2' };

    expect(drawingTransactionCommandSchema.parse(first)).toEqual(first);
    expect(() => drawingTransactionCommandSchema.parse({ ...first, force: true })).toThrow();
    expect(JSON.stringify([first, second])).not.toBe(JSON.stringify([second, first]));
  });

  it('separates auto-safe qualification from confirmation authority', () => {
    const common = {
      assessmentId: 'assessment-1',
      taskId: 'task-1',
      drawingId: 'drawing-1',
      baseRef: { drawingId: 'drawing-1', revision: 2 },
      previewHandle: 'preview-1',
      candidateDigest: 'sha256:candidate',
      evaluationDigest: 'sha256:evaluation',
      policyVersion: 'policy-v1',
      evaluatorVersions: ['source-quality-v1', 'postconditions-v1'],
      effectDigest: 'sha256:effect',
      reasons: [],
    };
    const autoSafe = {
      ...common,
      disposition: 'auto_safe' as const,
      autoQualification: {
        exactScope: true,
        cleanDiagnostics: true,
        sourceConfirmed: true,
        reviewerSatisfied: true,
        inverseVerified: true,
      },
    };
    const confirmation = {
      ...common,
      disposition: 'confirmation_required' as const,
      reasons: ['SOURCE_CANDIDATE'],
      requiredEffectDigest: 'sha256:effect',
    };

    expect(assessmentSchema.parse(autoSafe)).toEqual(autoSafe);
    expect(assessmentSchema.parse(confirmation)).toEqual(confirmation);
    expect(() => assessmentSchema.parse({ ...confirmation, autoQualification: autoSafe.autoQualification })).toThrow();
  });

  it('freezes mode-discriminated operation bindings and terminal receipts', () => {
    const binding = {
      mode: 'semantic' as const,
      operationId: 'operation-1',
      sessionId: 'session-1',
      drawingId: 'drawing-1',
      candidateDigest: 'sha256:candidate',
      previewHandle: 'preview-1',
    };
    const receipt = {
      status: 'committed' as const,
      mode: 'semantic' as const,
      operationId: 'operation-1',
      operationBindingDigest: 'sha256:binding',
      sessionId: 'session-1',
      drawingId: 'drawing-1',
      parentRef: { drawingId: 'drawing-1', revision: 2 },
      resultingRef: { drawingId: 'drawing-1', revision: 3 },
      commitId: 'commit-1',
      semanticDigest: 'sha256:semantic',
      snapshotIntegrityDigest: 'sha256:snapshot',
    };

    expect(durableOperationBindingSchema.parse(binding)).toEqual(binding);
    expect(durableOperationReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(operationLookupResultSchema.parse({ status: 'committed', receipt })).toEqual({ status: 'committed', receipt });
    expect(operationLookupResultSchema.parse({
      status: 'outcome-unknown',
      operationId: 'operation-1',
      operationBindingDigest: 'sha256:binding',
    }).status).toBe('outcome-unknown');
  });

  it('stores bounded reviewer evidence instead of a digest-only audit stub', () => {
    const evidence = {
      kind: 'reviewer' as const,
      provider: 'in-process',
      providerVersion: 'rc.8',
      authoritativeObjective: {
        text: 'Raise the right hand',
        attachmentContentDigests: ['sha256:image'],
      },
      renderManifest: {
        rendererVersion: 'svg-v1',
        beforeContentDigest: 'sha256:before',
        afterContentDigest: 'sha256:after',
        viewport: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        width: 800,
        height: 600,
        overlays: ['selection', 'changed-nodes'],
      },
      outcome: 'satisfied' as const,
      defects: [],
      resolvedDefects: [{
        defectId: 'defect-previous',
        scopeDigest: 'sha256:scope',
        evidenceDigests: ['sha256:resolution'],
      }],
    };

    expect(reviewEvidenceSchema.parse(evidence)).toEqual(evidence);
    expect(() => reviewEvidenceSchema.parse({ ...evidence, rawPrompt: 'unbounded prompt' })).toThrow();
  });
});
