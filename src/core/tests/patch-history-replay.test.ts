import { expect, it } from 'vitest';
import {
  commitPatch,
  createEmptyModel,
  createHistory,
  redo,
  undo,
} from '../index';
import { replayCommits } from '../../../api/services/audit/replay';

it('replays committed entity and relation changes to the current history model', () => {
  const initial = createEmptyModel();
  initial.entities.push(
    { id: 'l1', type: 'line', visible: true, start: [0, 0], end: [10, 0] },
    { id: 'c1', type: 'circle', visible: true, center: [5, 5], radius: 2 },
  );
  const first = commitPatch(createHistory(initial), {
    id: 'cmt_1', runId: 'run_1', stepId: 'step_1', source: 'AI', timestamp: 1,
    patch: { operations: [
      { type: 'entity.update', entityId: 'c1', changes: { radius: 3 } },
      {
        type: 'relation.add',
        relation: { id: 'r1', kind: 'radius', entities: ['c1'], status: 'unsolved', value: 3 },
      },
    ] },
  });
  if (!first.success) throw new Error('fixture commit failed');

  const afterUndo = undo(first.history);
  expect(afterUndo.model.entities[1]).toMatchObject({ radius: 2 });
  expect(afterUndo.model.relations).toEqual([]);

  const afterRedo = redo(afterUndo);
  expect(replayCommits(initial, afterRedo.commits.slice(0, afterRedo.cursor + 1))).toEqual(afterRedo.model);
});
