import { beforeEach, describe, expect, it } from 'vitest';
import { createHistory } from '@/core/history/history';
import { createEmptyModel } from '@/core/model';
import { useStore } from './useStore';

beforeEach(() => {
  const model = createEmptyModel();
  model.entities.push({
    id: 'c1', type: 'circle', visible: true, center: [0, 0], radius: 5,
  });
  model.relations.push({
    id: 'r1', kind: 'radius', entities: ['c1'], status: 'unsolved', value: 5,
  });
  useStore.setState({ model, history: createHistory(model), selectedIds: [] });
});

describe('useStore history integration', () => {
  it('records a parameter edit and can undo it', () => {
    useStore.getState().updateEntity('c1', { radius: 8 });

    expect(useStore.getState().model.entities[0]).toMatchObject({ radius: 8 });
    expect(useStore.getState().history.commits).toHaveLength(1);

    useStore.getState().undo();
    expect(useStore.getState().model.entities[0]).toMatchObject({ radius: 5 });
  });

  it('undo restores an entity and attached relations after deletion', () => {
    useStore.getState().deleteEntity('c1');
    expect(useStore.getState().model.entities).toEqual([]);
    expect(useStore.getState().model.relations).toEqual([]);

    useStore.getState().undo();
    expect(useStore.getState().model.entities).toHaveLength(1);
    expect(useStore.getState().model.relations).toHaveLength(1);
  });

  it('does not commit an invalid AI intent', () => {
    const errors = useStore.getState().applyIntent({
      objects: [{ type: 'circle', params: { center: [0, 0], radius: 0 } }],
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(useStore.getState().history.commits).toHaveLength(0);
    expect(useStore.getState().model.entities).toHaveLength(1);
  });
});
