// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type { DrawingWorkspaceSnapshot } from '@vectorai/plugin-space-contracts';
import { describe, expect, it, vi } from 'vitest';

import { createDshDrawingWorkspacePort } from './dsh-workspace-port';

function snapshot(): DrawingWorkspaceSnapshot {
  return {
    version: 1 as const,
    ref: { drawingId: 'drawing-1', revision: 1 },
    document: createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 }),
    source: {
      id: 'attachment-1', mediaType: 'image/png', bytes: 4, width: 120, height: 80, name: 'drawing.png',
    },
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    provisional: true,
  };
}

describe('createDshDrawingWorkspacePort', () => {
  it('loads the authorized session snapshot and unwraps Remote results', async () => {
    const getSnapshot = vi.fn(async () => ({ ok: true as const, value: snapshot() }));
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: { getSnapshot, stageInteractiveEdit: vi.fn(), stageUndo: vi.fn(), getOperation: vi.fn() },
      commands: { execute: vi.fn() },
      resolveImage: vi.fn(),
    });

    await expect(port.load()).resolves.toMatchObject({ ref: { drawingId: 'drawing-1' } });
    expect(getSnapshot).toHaveBeenCalledWith('session-1');
  });

  it('commits using the current session and preserves protocol failures', async () => {
    const staged = {
      status: 'staged' as const,
      intentId: 'intent-1', intentDigest: 'sha256:intent',
      operationId: 'operation-1', operationBindingDigest: 'sha256:binding',
      commandLine: '/drawing-apply-intent intent-1 sha256:intent operation-1 sha256:binding',
    };
    const stageInteractiveEdit = vi.fn(async () => ({ ok: true as const, value: staged }));
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: { commandId: 'command-1' as never, result: { kind: 'success' as const } },
    }));
    const getSnapshot = vi.fn(async () => ({ ok: true as const, value: snapshot() }));
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: { getSnapshot, stageInteractiveEdit, stageUndo: vi.fn(), getOperation: vi.fn() },
      commands: { execute },
      resolveImage: vi.fn(),
    });
    const request = {
      expectedRevision: 1,
      commands: [{ type: 'node.delete' as const, id: 'line-1' }],
    };

    await expect(port.commit(request)).resolves.toEqual({ status: 'committed', snapshot: snapshot() });
    expect(stageInteractiveEdit).toHaveBeenCalledWith('session-1', request);
    expect(execute).toHaveBeenCalledWith('session-1', staged.commandLine, [], undefined);
  });

  it('loads the current session Preview separately from the formal snapshot', async () => {
    const preview = {
      version: 1 as const,
      handle: 'preview-1',
      baseRef: { drawingId: 'drawing-1', revision: 1 },
      commands: [{ type: 'node.delete' as const, id: 'line-1' }],
      candidate: snapshot(),
      diff: { createdNodeIds: [], updatedNodeIds: [], deletedNodeIds: ['line-1'] },
      createdAt: 42,
    };
    const getPreview = vi.fn(async () => ({ ok: true as const, value: preview }));
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: { getSnapshot: vi.fn(), stageInteractiveEdit: vi.fn(), stageUndo: vi.fn(), getOperation: vi.fn(), getPreview },
      commands: { execute: vi.fn() },
      resolveImage: vi.fn(),
    });

    await expect(port.loadPreview?.()).resolves.toEqual(preview);
    expect(getPreview).toHaveBeenCalledWith('session-1');
  });

  it('resolves the durable attachment through the DSH conversation service', async () => {
    const resolveImage = vi.fn(async () => 'blob:dsh-source');
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: { getSnapshot: vi.fn(), stageInteractiveEdit: vi.fn(), stageUndo: vi.fn(), getOperation: vi.fn() },
      commands: { execute: vi.fn() },
      resolveImage,
    });

    await expect(port.loadSource(snapshot().source)).resolves.toMatchObject({ url: 'blob:dsh-source' });
    expect(resolveImage).toHaveBeenCalledWith('session-1', {
      attachmentId: 'attachment-1',
      mediaType: 'image/png',
      bytes: 4,
      width: 120,
      height: 80,
      name: 'drawing.png',
    });
  });

  it('turns Remote transport failures into actionable errors', async () => {
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: {
        getSnapshot: vi.fn(async () => ({
          ok: false as const,
          error: { code: 'DISCONNECTED', message: 'Host disconnected', details: {} },
        })),
        stageInteractiveEdit: vi.fn(),
        stageUndo: vi.fn(),
        getOperation: vi.fn(),
      },
      commands: { execute: vi.fn() },
      resolveImage: vi.fn(),
    });

    await expect(port.load()).rejects.toThrow('Host disconnected');
  });

  it('routes Undo through the exact current commit command and reloads the new revision', async () => {
    const current = snapshot();
    current.lastCommit = { commitId: 'commit-1', mode: 'interactive', undoable: true };
    const undone = { ...snapshot(), ref: { drawingId: 'drawing-1', revision: 2 } };
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: { commandId: 'command-undo' as never, result: { kind: 'success' as const } },
    }));
    const staged = {
      status: 'staged' as const,
      targetCommitId: 'commit-1',
      expectedCurrentRef: { drawingId: 'drawing-1', revision: 1 },
      operationId: 'undo-operation-1',
      operationBindingDigest: 'sha256:undo-binding',
      commandLine: '/drawing-undo commit-1 drawing-1@1 undo-operation-1 sha256:undo-binding',
    };
    const stageUndo = vi.fn(async () => ({ ok: true as const, value: staged }));
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: {
        getSnapshot: vi.fn(async () => ({ ok: true as const, value: undone })),
        stageInteractiveEdit: vi.fn(),
        stageUndo,
        getOperation: vi.fn(),
      },
      commands: { execute },
      resolveImage: vi.fn(),
    });

    await expect(port.undoLast?.(current)).resolves.toEqual({ status: 'committed', snapshot: undone });
    expect(execute).toHaveBeenCalledWith(
      'session-1',
      staged.commandLine,
      [],
      undefined,
    );
    expect(stageUndo).toHaveBeenCalledWith('session-1', {
      targetCommitId: 'commit-1', expectedCurrentRef: current.ref,
    });
  });
});
