import { describe, expect, it } from 'vitest';
import { createEmptyModel } from '../model';
import { validatePatch } from '../patch/validate';
import type { SpatialPatch } from '../patch/types';

describe('validatePatch', () => {
  it('accepts an empty patch for a verification-only step', () => {
    expect(validatePatch({ operations: [] }, createEmptyModel())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects an update to a missing entity', () => {
    const patch: SpatialPatch = {
      operations: [
        {
          type: 'entity.update',
          entityId: 'missing',
          changes: { visible: false },
        },
      ],
    };

    expect(validatePatch(patch, createEmptyModel()).errors).toEqual([
      {
        operationIndex: 0,
        code: 'ENTITY_NOT_FOUND',
        message: 'entity.update 引用了不存在的实体 "missing"',
      },
    ]);
  });

  it('rejects changing an entity type through a partial update', () => {
    const model = createEmptyModel();
    model.entities.push({
      id: 'c1',
      type: 'circle',
      visible: true,
      center: [0, 0],
      radius: 5,
    });
    const patch = {
      operations: [
        {
          type: 'entity.update',
          entityId: 'c1',
          changes: { type: 'line' },
        },
      ],
    } as unknown as SpatialPatch;

    expect(validatePatch(patch, model).errors[0]).toMatchObject({
      operationIndex: 0,
      code: 'IMMUTABLE_ENTITY_FIELD',
    });
  });

  it('allows a relation to reference an entity added earlier in the patch', () => {
    const patch: SpatialPatch = {
      operations: [
        {
          type: 'entity.add',
          entity: {
            id: 'c1',
            type: 'circle',
            visible: true,
            center: [0, 0],
            radius: 5,
          },
        },
        {
          type: 'relation.add',
          relation: {
            id: 'r1',
            kind: 'radius',
            entities: ['c1'],
            status: 'unsolved',
            value: 5,
          },
        },
      ],
    };

    expect(validatePatch(patch, createEmptyModel()).valid).toBe(true);
  });
});
