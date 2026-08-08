import { expect, it } from 'vitest';

import { createEmptyDrawing, type IdFactory } from '../document/create';
import type { GeometryId } from '../document/types';
import { MemoryDrawingRepository } from '../repository/memory';
import { replayDrawingCommits } from '../repository/replay';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function deterministicIds(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

it('runs create, modify, revert and deterministic audit replay end to end', async () => {
  const initial = createEmptyDrawing({ idFactory: { next: () => 'drawing_integration' }, now: () => 1 });
  const repository = new MemoryDrawingRepository({ idFactory: deterministicIds(), now: () => 100 });
  const opened = await repository.create(initial);
  const created = await repository.commit({
    id: 'tx_create_entities',
    baseRevision: opened.revision,
    actor: { type: 'AI', id: 'agent' },
    goalId: 'goal_draw_reference',
    commands: [
      {
        type: 'geometry.create',
        value: {
          id: 'circle_1' as GeometryId,
          type: 'circle', visible: true, quality: confirmed, center: [10, 10], radius: 5,
        },
      },
      {
        type: 'geometry.create',
        value: {
          id: 'xline_1' as GeometryId,
          type: 'xline', visible: true, quality: confirmed,
          origin: [0, 0], direction: [1, 0],
        },
      },
    ],
    preconditions: [
      { type: 'node.absent', nodeId: 'circle_1' },
      { type: 'node.absent', nodeId: 'xline_1' },
    ],
    postconditions: [
      { type: 'node.exists', nodeId: 'circle_1' },
      { type: 'node.exists', nodeId: 'xline_1' },
    ],
    evidenceRefs: [],
  });
  if (created.status !== 'committed') throw new Error('expected create commit');
  const updated = await repository.commit({
    id: 'tx_resize_circle',
    baseRevision: created.revision,
    actor: { type: 'AI', id: 'agent' },
    commands: [{
      type: 'geometry.update', id: 'circle_1' as GeometryId,
      expected: { radius: 5 }, changes: { radius: 8 },
    }],
    preconditions: [],
    postconditions: [{
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 8,
    }],
    evidenceRefs: [],
  });
  if (updated.status !== 'committed') throw new Error('expected update commit');
  const reverted = await repository.revert({
    drawingId: initial.id,
    commitId: updated.commit.id,
    actor: { type: 'user', id: 'reviewer' },
  });
  if (reverted.status !== 'committed') throw new Error('expected revert commit');

  const current = await repository.getCurrent(initial.id);
  const commits = await repository.listCommits(initial.id);
  const replayed = replayDrawingCommits(initial, commits);

  expect(current.document.geometry).toEqual([
    expect.objectContaining({ id: 'circle_1', type: 'circle', radius: 5 }),
    expect.objectContaining({ id: 'xline_1', type: 'xline', direction: [1, 0] }),
  ]);
  expect(commits.map((commit) => commit.commands[0].type)).toEqual([
    'geometry.create', 'geometry.update', 'history.revert',
  ]);
  expect(replayed).toEqual({
    success: true,
    document: current.document,
    revision: current.revision,
  });
});
