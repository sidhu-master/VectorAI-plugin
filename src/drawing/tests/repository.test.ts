import { describe, expect, it } from 'vitest';

import type { DrawingAssertion } from '../command/types';
import { createEmptyDrawing, type IdFactory } from '../document/create';
import type { DrawingDocument, GeometryId, RevisionId } from '../document/types';
import { MemoryDrawingRepository } from '../repository/memory';
import type { Actor, DrawingTransaction } from '../transaction/types';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };
const actor: Actor = { type: 'AI', id: 'agent' };

function sequentialIds(): IdFactory {
  const sequences = new Map<string, number>();
  return {
    next: (kind) => {
      const sequence = (sequences.get(kind) ?? 0) + 1;
      sequences.set(kind, sequence);
      return `${kind}_${sequence}`;
    },
  };
}

function initialDocument(): DrawingDocument {
  return createEmptyDrawing({ idFactory: { next: () => 'drawing_repo' }, now: () => 1 });
}

function createCircleTransaction(baseRevision: RevisionId): DrawingTransaction {
  return {
    id: 'tx_create_circle',
    baseRevision,
    actor,
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
}

describe('MemoryDrawingRepository', () => {
  it('creates and opens isolated document snapshots', async () => {
    const repository = new MemoryDrawingRepository({ idFactory: sequentialIds(), now: () => 100 });
    const source = initialDocument();
    const opened = await repository.create(source);
    source.metadata.updatedAt = 999;
    opened.document.metadata.updatedAt = 888;

    const current = await repository.getCurrent(source.id);

    expect(current.revision).toBe('revision_1');
    expect(current.document.metadata.updatedAt).toBe(1);
  });

  it('atomically commits a ready transaction and advances a linear revision chain', async () => {
    const repository = new MemoryDrawingRepository({ idFactory: sequentialIds(), now: () => 100 });
    const opened = await repository.create(initialDocument());

    const result = await repository.commit(createCircleTransaction(opened.revision));

    expect(result).toMatchObject({
      status: 'committed',
      commit: {
        id: 'commit_1',
        parentRevision: 'revision_1',
        resultingRevision: 'revision_2',
        timestamp: 100,
      },
      revision: 'revision_2',
      document: { geometry: [expect.objectContaining({ id: 'circle_1' })] },
    });
    expect((await repository.listCommits(initialDocument().id)).map((item) => item.id)).toEqual([
      'commit_1',
    ]);
  });

  it('rejects stale transactions and does not append a commit', async () => {
    const repository = new MemoryDrawingRepository({ idFactory: sequentialIds(), now: () => 100 });
    const opened = await repository.create(initialDocument());
    const transaction = createCircleTransaction(opened.revision);
    await repository.commit(transaction);

    const stale = await repository.commit({
      ...transaction,
      id: 'tx_stale',
      commands: [],
      preconditions: [],
      postconditions: [],
    });

    expect(stale).toMatchObject({
      status: 'rejected', errors: [{ code: 'STALE_REVISION', stage: 'revision' }],
    });
    expect(await repository.listCommits(initialDocument().id)).toHaveLength(1);
  });

  it('returns already satisfied without allocating a commit or revision', async () => {
    const ids = sequentialIds();
    const repository = new MemoryDrawingRepository({ idFactory: ids, now: () => 100 });
    const opened = await repository.create(initialDocument());
    const assertion: DrawingAssertion = { type: 'document.valid' };

    const result = await repository.commit({
      id: 'tx_noop',
      baseRevision: opened.revision,
      actor,
      commands: [],
      preconditions: [],
      postconditions: [assertion],
      evidenceRefs: [],
    });
    const nextId = ids.next('revision');

    expect(result).toEqual({
      status: 'already_satisfied',
      outcome: { satisfied: true, assertions: [{ assertion, satisfied: true }] },
    });
    expect(nextId).toBe('revision_2');
    expect(await repository.listCommits(initialDocument().id)).toEqual([]);
  });

  it('returns immutable commit copies in chronological order', async () => {
    const repository = new MemoryDrawingRepository({ idFactory: sequentialIds(), now: () => 100 });
    const opened = await repository.create(initialDocument());
    const created = await repository.commit(createCircleTransaction(opened.revision));
    if (created.status !== 'committed') throw new Error('expected commit');
    const updated = await repository.commit({
      id: 'tx_update_circle',
      baseRevision: created.revision,
      actor,
      commands: [{
        type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: 20 },
      }],
      preconditions: [],
      postconditions: [{
        type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 20,
      }],
      evidenceRefs: [],
    });
    if (updated.status !== 'committed') throw new Error('expected commit');

    const firstRead = await repository.listCommits(initialDocument().id);
    firstRead[0].commands.length = 0;
    const secondRead = await repository.listCommits(initialDocument().id);

    expect(secondRead.map((commit) => commit.id)).toEqual(['commit_1', 'commit_2']);
    expect(secondRead[0].commands).toHaveLength(1);
    expect(secondRead[1].parentRevision).toBe(secondRead[0].resultingRevision);
  });

  it('appends a revert commit without deleting history', async () => {
    const repository = new MemoryDrawingRepository({ idFactory: sequentialIds(), now: () => 100 });
    const initial = initialDocument();
    const opened = await repository.create(initial);
    const created = await repository.commit(createCircleTransaction(opened.revision));
    if (created.status !== 'committed') throw new Error('expected commit');

    const reverted = await repository.revert({
      drawingId: initial.id,
      commitId: created.commit.id,
      actor: { type: 'user', id: 'user_1' },
    });

    expect(reverted).toMatchObject({
      status: 'committed',
      document: { geometry: [] },
      commit: {
        parentRevision: created.revision,
        commands: [{ type: 'history.revert', commitId: created.commit.id }],
      },
    });
    const history = await repository.listCommits(initial.id);
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe(created.commit.id);
  });
});
