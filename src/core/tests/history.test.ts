import { describe, expect, it } from 'vitest';
import { createHistory, commitPatch, redo, undo } from '../history/history';
import { createEmptyModel } from '../model';
import type { SpatialPatch } from '../patch/types';

const addCircle: SpatialPatch = {
  operations: [{
    type: 'entity.add',
    entity: { id: 'c1', type: 'circle', visible: true, center: [0, 0], radius: 5 },
  }],
};

const commitInput = {
  id: 'commit_1',
  runId: 'run_1',
  stepId: 'step_1',
  source: 'AI' as const,
  timestamp: 100,
};

describe('SpatialHistory', () => {
  it('creates a commit and advances the cursor', () => {
    const result = commitPatch(createHistory(createEmptyModel()), {
      ...commitInput,
      patch: addCircle,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.history.cursor).toBe(0);
    expect(result.history.commits).toHaveLength(1);
    expect(result.history.commits[0]).toMatchObject({
      id: 'commit_1', runId: 'run_1', parentCommitId: undefined,
    });
    expect(result.history.model.entities).toHaveLength(1);
  });

  it('undo and redo move the cursor while applying inverse and forward patches', () => {
    const committed = commitPatch(createHistory(createEmptyModel()), {
      ...commitInput,
      patch: addCircle,
    });
    if (!committed.success) throw new Error('fixture commit failed');

    const undone = undo(committed.history);
    expect(undone.cursor).toBe(-1);
    expect(undone.model.entities).toEqual([]);

    const redone = redo(undone);
    expect(redone.cursor).toBe(0);
    expect(redone.model.entities).toHaveLength(1);
  });

  it('truncates the redo branch when committing after undo', () => {
    const first = commitPatch(createHistory(createEmptyModel()), {
      ...commitInput,
      patch: addCircle,
    });
    if (!first.success) throw new Error('fixture commit failed');
    const second = commitPatch(first.history, {
      ...commitInput,
      id: 'commit_2',
      stepId: 'step_2',
      patch: { operations: [{ type: 'entity.update', entityId: 'c1', changes: { radius: 8 } }] },
    });
    if (!second.success) throw new Error('fixture commit failed');

    const branched = commitPatch(undo(second.history), {
      ...commitInput,
      id: 'commit_3',
      stepId: 'step_3',
      patch: { operations: [{ type: 'entity.update', entityId: 'c1', changes: { radius: 12 } }] },
    });

    expect(branched.success).toBe(true);
    if (!branched.success) return;
    expect(branched.history.commits.map((commit) => commit.id)).toEqual(['commit_1', 'commit_3']);
    expect(branched.history.commits[1].parentCommitId).toBe('commit_1');
  });

  it('does not create a commit for an invalid patch', () => {
    const history = createHistory(createEmptyModel());
    const result = commitPatch(history, {
      ...commitInput,
      patch: { operations: [{ type: 'entity.delete', entityId: 'missing' }] },
    });

    expect(result.success).toBe(false);
    expect(result.history).toBe(history);
  });
});
