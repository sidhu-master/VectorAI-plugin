import { describe, expect, it } from 'vitest';

import { createEmptyDrawing, type IdFactory } from '../document/create';
import type { GeometryId, RevisionId } from '../document/types';
import { MemoryDrawingRepository } from '../repository/memory';
import { replayDrawingCommits } from '../repository/replay';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

describe('replayDrawingCommits', () => {
  it('replays immutable commit patches into the exact repository state', async () => {
    const initial = createEmptyDrawing({ idFactory: { next: () => 'drawing_replay' }, now: () => 1 });
    const repository = new MemoryDrawingRepository({ idFactory: ids(), now: () => 10 });
    const opened = await repository.create(initial);
    const created = await repository.commit({
      id: 'tx_create', baseRevision: opened.revision,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.create',
        value: {
          id: 'circle_1' as GeometryId,
          type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: 10,
        },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });
    if (created.status !== 'committed') throw new Error('expected commit');
    const updated = await repository.commit({
      id: 'tx_update', baseRevision: created.revision,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: 20 },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });
    if (updated.status !== 'committed') throw new Error('expected commit');
    const commits = await repository.listCommits(initial.id);
    const current = await repository.getCurrent(initial.id);
    const initialSnapshot = structuredClone(initial);

    const replayed = replayDrawingCommits(initial, commits);

    expect(replayed).toEqual({
      success: true,
      document: current.document,
      revision: current.revision,
    });
    expect(initial).toEqual(initialSnapshot);
  });

  it('rejects the first broken parent revision in chronological order', async () => {
    const initial = createEmptyDrawing({ idFactory: { next: () => 'drawing_chain' }, now: () => 1 });
    const repository = new MemoryDrawingRepository({ idFactory: ids(), now: () => 10 });
    const opened = await repository.create(initial);
    const first = await repository.commit({
      id: 'tx_1', baseRevision: opened.revision,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.create',
        value: {
          id: 'point_1' as GeometryId,
          type: 'point', visible: true, quality: confirmed, x: 0, y: 0,
        },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });
    if (first.status !== 'committed') throw new Error('expected commit');
    const second = await repository.commit({
      id: 'tx_2', baseRevision: first.revision,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.update', id: 'point_1' as GeometryId, changes: { x: 1 },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });
    if (second.status !== 'committed') throw new Error('expected commit');
    const commits = await repository.listCommits(initial.id);
    commits[1].parentRevision = 'revision_wrong' as RevisionId;

    const replayed = replayDrawingCommits(initial, commits);

    expect(replayed).toMatchObject({
      success: false,
      error: { code: 'REVISION_CHAIN_BROKEN', commitIndex: 1, commitId: commits[1].id },
    });
  });

  it('rejects a commit patch that produces an invalid drawing', async () => {
    const initial = createEmptyDrawing({ idFactory: { next: () => 'drawing_invalid_replay' }, now: () => 1 });
    const repository = new MemoryDrawingRepository({ idFactory: ids(), now: () => 10 });
    const opened = await repository.create(initial);
    const created = await repository.commit({
      id: 'tx_create', baseRevision: opened.revision,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.create',
        value: {
          id: 'circle_1' as GeometryId,
          type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: 10,
        },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });
    if (created.status !== 'committed') throw new Error('expected commit');
    const commits = await repository.listCommits(initial.id);
    commits[0].patch.operations = [{
      type: 'geometry.add',
      value: {
        id: 'circle_bad' as GeometryId,
        type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: -1,
      },
    }];

    const replayed = replayDrawingCommits(initial, commits);

    expect(replayed).toMatchObject({
      success: false,
      error: { code: 'INVALID_RADIUS', commitIndex: 0 },
    });
  });
});
