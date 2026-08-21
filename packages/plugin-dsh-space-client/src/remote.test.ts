// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { drawingWorkspaceSnapshotSchema } from '@vectorai/plugin-space-contracts';
import {
  DRAWING_SPACE_REMOTE,
} from './remote';

describe('DRAWING_SPACE_REMOTE', () => {
  it('uses strict codecs for every JSON field exposed to the DSH client gateway', () => {
    const [snapshot, query, projectSelection, getPreview, stageInteractive, stageUndo, getOperation] = DRAWING_SPACE_REMOTE.descriptors;

    expect(snapshot?.parameters[0]?.codec.mode).toBe('strict');
    expect(snapshot?.result.mode).toBe('strict');
    expect(snapshot?.invocation).toEqual({ kind: 'direct' });
    expect(snapshot?.scope).toEqual({ context: 'agent', wire: 'agentId' });
    expect(query?.method).toBe('query');
    expect(query?.parameters[1]?.codec.mode).toBe('strict');
    expect(query?.result.mode).toBe('strict');
    expect(projectSelection?.method).toBe('projectSelection');
    expect(projectSelection?.parameters[1]?.codec.mode).toBe('strict');
    expect(projectSelection?.result.mode).toBe('strict');
    expect(getPreview?.method).toBe('getPreview');
    expect(getPreview?.result.mode).toBe('strict');
    expect(stageInteractive?.method).toBe('stageInteractiveEdit');
    expect(stageInteractive?.parameters[1]?.codec.mode).toBe('strict');
    expect(stageInteractive?.result.mode).toBe('strict');
    expect(stageUndo?.method).toBe('stageUndo');
    expect(stageUndo?.parameters[1]?.codec.mode).toBe('strict');
    expect(stageUndo?.result.mode).toBe('strict');
    expect(getOperation?.method).toBe('getOperation');
    expect(getOperation?.parameters[1]?.codec.mode).toBe('strict');
    expect(DRAWING_SPACE_REMOTE.descriptors.map(({ method }) => method)).not.toEqual(
      expect.arrayContaining(['commit', 'createPreview', 'commitPreview', 'discardPreview']),
    );
  });

  it('accepts a complete workspace snapshot or null and rejects malformed snapshots', () => {
    expect(drawingWorkspaceSnapshotSchema.parse(null)).toBeNull();
    expect(() => drawingWorkspaceSnapshotSchema.parse({ version: 1 })).toThrow();
    expect(drawingWorkspaceSnapshotSchema.parse({
      version: 1,
      ref: { drawingId: 'drawing-1', revision: 1 },
      document: createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 }),
      source: {
        id: 'attachment-1',
        mediaType: 'image/png',
        bytes: 4,
        width: 800,
        height: 600,
      },
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      provisional: true,
    }).ref.drawingId).toBe('drawing-1');
  });
});
