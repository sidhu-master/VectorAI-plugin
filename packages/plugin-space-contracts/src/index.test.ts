// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
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
  it('accepts a complete Drawing snapshot without embedding raster bytes', () => {
    const parsed = drawingWorkspaceSnapshotSchema.parse(snapshot());

    expect(parsed?.document.protocol).toBe('VectorAI-Drawing');
    expect(parsed?.source).toMatchObject({ id: 'attachment-1', bytes: 4 });
    expect(parsed?.source).not.toHaveProperty('dataUrl');
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
});
