// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  drawingRefSchema,
  drawingQueryRequestSchema,
  drawingQueryResultSchema,
  finalizePreviewRequestSchema,
  drawingPreviewCreateRequestSchema,
  drawingPreviewSchema,
  drawingSelectionProjectionRequestSchema,
  drawingSelectionProjectionResultSchema,
  drawingWorkspaceCommitRequestSchema,
  drawingWorkspaceCommitResultSchema,
  drawingWorkspaceSnapshotSchema,
} from './index';

function snapshot() {
  return {
    version: 1 as const,
    ref: { drawingId: 'drawing-1', revision: 1 },
    document: createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 }),
    source: {
      id: 'attachment-1',
      mediaType: 'image/png',
      bytes: 4,
      width: 120,
      height: 80,
      name: 'drawing.png',
    },
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    provisional: true,
  };
}

describe('DSH drawing workspace wire schemas', () => {
  it('re-exports strict provider-neutral semantic edit contracts', () => {
    const ref = { drawingId: 'drawing-1', revision: 3 };
    const request = {
      previewHandle: 'preview-1',
      previewDigest: 'sha256:candidate',
      finalizeOperationId: 'operation-1',
      finalizeOperationBindingDigest: 'sha256:binding',
      evaluationId: 'evaluation-1',
    };

    expect(drawingRefSchema.parse(ref)).toEqual(ref);
    expect(finalizePreviewRequestSchema.parse(request)).toEqual(request);
    expect(() => finalizePreviewRequestSchema.parse({ ...request, approved: true })).toThrow();
  });

  it('accepts a complete Drawing snapshot without embedding raster bytes', () => {
    const parsed = drawingWorkspaceSnapshotSchema.parse(snapshot());

    expect(parsed?.document.protocol).toBe('VectorAI-Drawing');
    expect(parsed?.source).toMatchObject({ id: 'attachment-1', bytes: 4 });
    expect(parsed?.source).not.toHaveProperty('dataUrl');
  });

  it('strictly projects a bounded client selection without granting write authority', () => {
    const request = {
      expectedRef: { drawingId: 'drawing-1', revision: 1 },
      nodeIds: ['right-hand'],
    };
    const result = {
      status: 'projected' as const,
      projection: {
        selectionProjectionId: 'selection-1',
        drawingRef: request.expectedRef,
        nodeIds: request.nodeIds,
        projectionDigest: 'sha256:selection',
        expiresAt: 1234,
      },
    };

    expect(drawingSelectionProjectionRequestSchema.parse(request)).toEqual(request);
    expect(drawingSelectionProjectionResultSchema.parse(result)).toEqual(result);
    expect(drawingSelectionProjectionRequestSchema.parse({ ...request, nodeIds: [] }).nodeIds).toEqual([]);
    expect(drawingSelectionProjectionResultSchema.parse({ status: 'cleared' })).toEqual({ status: 'cleared' });
    expect(() => drawingSelectionProjectionRequestSchema.parse({ ...request, writable: true })).toThrow();
  });

  it('rejects unknown snapshot and nested document fields', () => {
    expect(() => drawingWorkspaceSnapshotSchema.parse({ ...snapshot(), extra: true })).toThrow();
    expect(() => drawingWorkspaceSnapshotSchema.parse({
      ...snapshot(),
      document: { ...snapshot().document, extra: true },
    })).toThrow();
  });

  it('accepts only strict revision-aware workspace commands', () => {
    const request = {
      expectedRevision: 3,
      commands: [{
        type: 'node.update', id: 'line-1',
        changes: { visible: false }, expected: { visible: true },
      }],
    };

    expect(drawingWorkspaceCommitRequestSchema.parse(request)).toEqual(request);
    expect(() => drawingWorkspaceCommitRequestSchema.parse({
      ...request,
      commands: [{ ...request.commands[0], unknown: true }],
    })).toThrow();
  });

  it('validates committed, conflict, and rejected results', () => {
    expect(drawingWorkspaceCommitResultSchema.parse({
      status: 'committed', snapshot: snapshot(),
    }).status).toBe('committed');
    expect(drawingWorkspaceCommitResultSchema.parse({
      status: 'conflict', message: 'stale', snapshot: snapshot(),
    }).status).toBe('conflict');
    expect(drawingWorkspaceCommitResultSchema.parse({
      status: 'rejected', message: 'invalid', code: 'INVALID_COMMAND',
    }).status).toBe('rejected');
  });

  it('accepts strict revision-bound world-slice queries', () => {
    const request = {
      kind: 'world-slice' as const,
      ref: { drawingId: 'drawing-1', revision: 3 },
      bounds: { minX: 0, minY: 1, maxX: 10, maxY: 11 },
      planes: ['geometry', 'annotation'] as const,
      limit: 20,
    };

    expect(drawingQueryRequestSchema.parse(request)).toEqual(request);
    expect(() => drawingQueryRequestSchema.parse({ ...request, unknown: true })).toThrow();
    expect(() => drawingQueryRequestSchema.parse({
      ...request,
      bounds: { ...request.bounds, unknown: true },
    })).toThrow();
  });

  it('validates strict query results containing Drawing nodes', () => {
    const line = {
      id: 'line-1',
      type: 'line' as const,
      start: [0, 0] as const,
      end: [10, 10] as const,
      visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    };
    const result = {
      kind: 'world-slice' as const,
      ref: { drawingId: 'drawing-1', revision: 3 },
      bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      nodes: [{ plane: 'geometry' as const, node: line }],
      totalByPlane: { geometry: 1, annotation: 0, relation: 0, feature: 0 },
      truncated: false,
    };

    expect(drawingQueryResultSchema.parse(result)).toEqual(result);
    expect(() => drawingQueryResultSchema.parse({
      ...result,
      nodes: [{ plane: 'geometry', node: { ...line, unknown: true } }],
    })).toThrow();
  });

  it('accepts node.create only with a matching strict plane node', () => {
    const text = {
      id: 'text-new',
      type: 'text' as const,
      content: '10',
      position: [5, 6] as const,
      height: 2,
      rotation: 0,
      alignment: 'center' as const,
      verticalAlignment: 'middle' as const,
      visible: true,
      quality: { status: 'candidate' as const, evidenceRefs: [] },
    };
    const request = {
      expectedRevision: 1,
      commands: [{ type: 'node.create' as const, plane: 'annotation' as const, node: text }],
    };

    expect(drawingWorkspaceCommitRequestSchema.parse(request)).toEqual(request);
    expect(() => drawingWorkspaceCommitRequestSchema.parse({
      ...request,
      commands: [{ ...request.commands[0], plane: 'geometry' }],
    })).toThrow();
    expect(() => drawingWorkspaceCommitRequestSchema.parse({
      ...request,
      commands: [{ ...request.commands[0], node: { ...text, unknown: true } }],
    })).toThrow();
  });

  it('validates strict Preview creation and candidate projection', () => {
    const request = {
      ref: { drawingId: 'drawing-1', revision: 1 },
      summary: 'hide one line',
      commands: [{
        type: 'node.update' as const,
        id: 'line-1',
        changes: { visible: false },
        expected: { visible: true },
      }],
    };
    const preview = {
      version: 1 as const,
      handle: 'preview-1',
      baseRef: request.ref,
      commands: request.commands,
      candidate: snapshot(),
      diff: {
        createdNodeIds: [],
        updatedNodeIds: ['line-1'],
        deletedNodeIds: [],
      },
      createdAt: 42,
      summary: request.summary,
    };

    expect(drawingPreviewCreateRequestSchema.parse(request)).toEqual(request);
    expect(drawingPreviewSchema.parse(preview)).toEqual(preview);
    expect(() => drawingPreviewCreateRequestSchema.parse({ ...request, unknown: true })).toThrow();
    expect(() => drawingPreviewSchema.parse({
      ...preview,
      diff: { ...preview.diff, unknown: true },
    })).toThrow();
  });
});
