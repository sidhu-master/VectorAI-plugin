import { describe, expect, it, vi } from 'vitest';

import { createEmptyDrawing, type IdFactory } from '../document/create';
import type { CommitId, DrawingId, GeometryId, RevisionId } from '../document/types';
import {
  commitRepositoryState,
  createRepositoryState,
  revertRepositoryState,
} from '../repository/state';
import type { DrawingTransaction } from '../transaction/types';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function ids(): IdFactory {
  const counts = new Map<string, number>([['revision', 1]]);
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

function fixture() {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_state' },
    now: () => 1,
  });
  const state = createRepositoryState(document, 'revision_1' as RevisionId);
  const transaction: DrawingTransaction = {
    id: 'tx_create_circle',
    baseRevision: 'revision_1' as RevisionId,
    actor: { type: 'AI', id: 'agent' },
    commands: [{
      type: 'geometry.create',
      value: {
        id: 'circle_1' as GeometryId,
        type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: 10,
      },
    }],
    preconditions: [{ type: 'node.absent', nodeId: 'circle_1' }],
    postconditions: [{ type: 'node.exists', nodeId: 'circle_1' }],
    evidenceRefs: [],
  };
  return { document, state, transaction };
}

describe('repository state transitions', () => {
  it('creates an isolated initial state and commits without mutating its input', () => {
    const { document, state, transaction } = fixture();
    const dependencies = { idFactory: ids(), now: () => 100 };
    document.metadata.updatedAt = 999;

    const transitioned = commitRepositoryState(state, transaction, dependencies);

    expect(transitioned.result).toMatchObject({
      status: 'committed',
      commit: { parentRevision: 'revision_1', resultingRevision: 'revision_2' },
      document: { geometry: [expect.objectContaining({ id: 'circle_1' })] },
    });
    expect(state.document.geometry).toEqual([]);
    expect(state.commits).toEqual([]);
    expect(transitioned.state.initialDocument.metadata.updatedAt).toBe(1);
    expect(transitioned.state.document.geometry).toHaveLength(1);
  });

  it('rejects a stale transition without changing state or allocating IDs', () => {
    const { state, transaction } = fixture();
    const next = vi.fn(() => {
      throw new Error('must not allocate');
    });
    const staleState = { ...state, revision: 'revision_2' as RevisionId };

    const transitioned = commitRepositoryState(staleState, transaction, {
      idFactory: { next }, now: () => 100,
    });

    expect(transitioned.result).toMatchObject({
      status: 'rejected', errors: [{ code: 'STALE_REVISION' }],
    });
    expect(transitioned.state).toEqual(staleState);
    expect(next).not.toHaveBeenCalled();
  });

  it('appends a revert commit and preserves the target commit', () => {
    const { state, transaction } = fixture();
    const dependencies = { idFactory: ids(), now: () => 100 };
    const committed = commitRepositoryState(state, transaction, dependencies);
    if (committed.result.status !== 'committed') throw new Error('expected commit');

    const reverted = revertRepositoryState(committed.state, {
      drawingId: 'drawing_state' as DrawingId,
      commitId: committed.result.commit.id,
      actor: { type: 'user', id: 'reviewer' },
    }, dependencies);

    expect(reverted.result).toMatchObject({
      status: 'committed',
      document: { geometry: [] },
      commit: {
        commands: [{
          type: 'history.revert', commitId: committed.result.commit.id as CommitId,
        }],
      },
    });
    expect(reverted.state.commits).toHaveLength(2);
    expect(reverted.state.commits[0]).toEqual(committed.state.commits[0]);
    expect(committed.state.document.geometry).toHaveLength(1);
  });

  it('returns isolated state and result objects', () => {
    const { state, transaction } = fixture();
    const transitioned = commitRepositoryState(state, transaction, {
      idFactory: ids(), now: () => 100,
    });
    if (transitioned.result.status !== 'committed') throw new Error('expected commit');

    transitioned.result.document.geometry[0].visible = false;
    transitioned.result.commit.commands.length = 0;

    expect(transitioned.state.document.geometry[0].visible).toBe(true);
    expect(transitioned.state.commits[0].commands).toHaveLength(1);
  });
});
