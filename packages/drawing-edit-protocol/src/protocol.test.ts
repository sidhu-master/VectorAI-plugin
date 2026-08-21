// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  drawingRefSchema,
  finalizePreviewRequestSchema,
  finalizePreviewResultSchema,
  observationArtifactRefSchema,
  spatialEditProgramSchema,
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
});
