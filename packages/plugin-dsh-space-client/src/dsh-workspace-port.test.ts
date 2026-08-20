// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import { createDshDrawingWorkspacePort } from './dsh-workspace-port';

function snapshot() {
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
      remote: { getSnapshot, commit: vi.fn() },
      resolveImage: vi.fn(),
    });

    await expect(port.load()).resolves.toMatchObject({ ref: { drawingId: 'drawing-1' } });
    expect(getSnapshot).toHaveBeenCalledWith('session-1');
  });

  it('commits using the current session and preserves protocol failures', async () => {
    const committed = { status: 'committed' as const, snapshot: snapshot() };
    const commit = vi.fn(async () => ({ ok: true as const, value: committed }));
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: { getSnapshot: vi.fn(), commit },
      resolveImage: vi.fn(),
    });
    const request = {
      expectedRevision: 1,
      commands: [{ type: 'node.delete' as const, id: 'line-1' }],
    };

    await expect(port.commit(request)).resolves.toEqual(committed);
    expect(commit).toHaveBeenCalledWith('session-1', request);
  });

  it('resolves the durable attachment through the DSH conversation service', async () => {
    const resolveImage = vi.fn(async () => 'blob:dsh-source');
    const port = createDshDrawingWorkspacePort({
      sessionId: 'session-1',
      remote: { getSnapshot: vi.fn(), commit: vi.fn() },
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
        commit: vi.fn(),
      },
      resolveImage: vi.fn(),
    });

    await expect(port.load()).rejects.toThrow('Host disconnected');
  });
});
