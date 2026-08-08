import { describe, expect, it, vi } from 'vitest';

import type {
  CommitId,
  DrawingId,
  DrawingTransaction,
  RevisionId,
} from '@/drawing';
import { DrawingClient, DrawingClientError } from './drawing-client';

const workspace = {
  document: {
    protocol: 'VectorAI-Drawing' as const,
    schemaVersion: '1.0' as const,
    id: 'drawing / one' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm' as const, angle: 'deg' as const },
    coordinateFrames: [{
      id: 'frame_document', kind: 'document' as const,
      transform: [1, 0, 0, 1, 0, 0] as const,
    }],
    geometry: [], annotations: [], relations: [], features: [],
  },
  revision: 'revision_1' as RevisionId,
  commits: [],
};

const transaction: DrawingTransaction = {
  id: 'tx_1', baseRevision: 'revision_1' as RevisionId,
  actor: { type: 'user', id: 'user' },
  commands: [], preconditions: [], postconditions: [], evidenceRefs: [],
};

describe('DrawingClient', () => {
  it('creates and opens drawings through the shared workspace contract', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, workspace }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, workspace }, 200));
    const client = new DrawingClient({ fetcher });

    expect(await client.create('cm')).toEqual(workspace);
    expect(await client.open(workspace.document.id)).toEqual(workspace);

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/drawings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit: 'cm' }),
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/drawings/drawing%20%2F%20one',
      undefined,
    );
  });

  it('sends typed transaction and revert requests', async () => {
    const committed = {
      status: 'already_satisfied' as const,
      outcome: { satisfied: true, assertions: [] },
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, result: committed }, 200))
      .mockResolvedValueOnce(jsonResponse({ success: true, result: committed }, 200));
    const client = new DrawingClient({ fetcher });

    expect(await client.execute(workspace.document.id, transaction)).toEqual(committed);
    expect(await client.revert(
      workspace.document.id,
      'commit_1' as CommitId,
      { type: 'user', id: 'user' },
    )).toEqual(committed);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/drawings/drawing%20%2F%20one/transactions',
      expect.objectContaining({
        method: 'POST', body: JSON.stringify({ transaction }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/drawings/drawing%20%2F%20one/reverts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          commitId: 'commit_1', actor: { type: 'user', id: 'user' },
        }),
      }),
    );
  });

  it('surfaces the server safe error message for a failed response', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      success: false,
      error: { code: 'CORRUPT_SNAPSHOT', message: '本地图纸数据损坏' },
    }, 409));
    const client = new DrawingClient({ fetcher });

    const error = await client.open('drawing_bad' as DrawingId).catch((reason) => reason);

    expect(error).toBeInstanceOf(DrawingClientError);
    expect(error).toMatchObject({
      code: 'CORRUPT_SNAPSHOT',
      status: 409,
      message: '本地图纸数据损坏',
    });
  });
});

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
