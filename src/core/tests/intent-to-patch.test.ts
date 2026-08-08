import { beforeEach, describe, expect, it } from 'vitest';
import { resetIdCounter } from '../compiler';
import { createEmptyModel } from '../model';
import { compileIntentToPatch } from '../patch/intent-to-patch';
import type { SpatialModel } from '../types';

function currentModel(): SpatialModel {
  const model = createEmptyModel();
  model.entities.push({
    id: 'c1',
    type: 'circle',
    visible: true,
    center: [0, 0],
    radius: 5,
  });
  return model;
}

describe('compileIntentToPatch', () => {
  beforeEach(() => resetIdCounter());

  it('compiles create intent to entity.add operations', () => {
    const result = compileIntentToPatch({
      operation: 'create',
      objects: [{ type: 'point', params: { x: 1, y: 2 } }],
    }, createEmptyModel());

    expect(result.errors).toEqual([]);
    expect(result.patch.operations).toEqual([
      {
        type: 'entity.add',
        entity: { id: 'ent_1', type: 'point', visible: true, x: 1, y: 2 },
      },
    ]);
  });

  it('compiles modify intent to an update containing only supplied fields', () => {
    const result = compileIntentToPatch({
      operation: 'modify',
      objects: [{ type: 'circle', id: 'c1', params: { radius: 8 } }],
    }, currentModel());

    expect(result.errors).toEqual([]);
    expect(result.patch.operations).toEqual([
      { type: 'entity.update', entityId: 'c1', changes: { radius: 8 } },
    ]);
  });

  it('compiles replace intent to relation deletes, entity deletes, then adds', () => {
    const model = currentModel();
    model.relations.push({
      id: 'r1', kind: 'radius', entities: ['c1'], status: 'unsolved', value: 5,
    });

    const result = compileIntentToPatch({
      operation: 'replace',
      objects: [{ type: 'line', params: { start: [0, 0], end: [10, 0] } }],
    }, model);

    expect(result.errors).toEqual([]);
    expect(result.patch.operations.map((operation) => operation.type)).toEqual([
      'relation.delete', 'entity.delete', 'entity.add',
    ]);
  });

  it('allows a verification-only intent to compile to an empty patch', () => {
    const result = compileIntentToPatch({ objects: [] }, currentModel());

    expect(result).toEqual({ patch: { operations: [] }, errors: [] });
  });

  it('preserves generated relations as relation.add operations', () => {
    const result = compileIntentToPatch({
      objects: [
        {
          type: 'circle',
          params: { center: [0, 0], radius: 5 },
          reference: 'hole',
        },
      ],
      relations: [{ kind: 'radius', entities: ['hole'], value: 5 }],
    }, createEmptyModel());

    expect(result.errors).toEqual([]);
    expect(result.patch.operations.map((operation) => operation.type)).toEqual([
      'entity.add', 'relation.add',
    ]);
  });
});
