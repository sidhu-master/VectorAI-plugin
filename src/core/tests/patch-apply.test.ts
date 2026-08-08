import { describe, expect, it } from 'vitest';
import { applyPatch } from '../patch/apply';
import type { SpatialModel } from '../types';
import type { SpatialPatch } from '../patch/types';

function modelWithCircleAndRelation(): SpatialModel {
  return {
    protocol: 'VectorAI-Spatial',
    version: '0.1',
    metadata: { unit: 'mm', createdBy: 'system', timestamp: 1 },
    entities: [
      { id: 'c1', type: 'circle', visible: true, center: [0, 0], radius: 5 },
    ],
    relations: [
      { id: 'r1', kind: 'radius', entities: ['c1'], status: 'unsolved', value: 5 },
    ],
  };
}

describe('applyPatch', () => {
  it('applies ordered operations without mutating the source model', () => {
    const source: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'system', timestamp: 1 },
      entities: [],
      relations: [],
    };
    const patch: SpatialPatch = {
      operations: [
        {
          type: 'entity.add',
          entity: { id: 'c1', type: 'circle', visible: true, center: [10, 20], radius: 5 },
        },
        { type: 'entity.update', entityId: 'c1', changes: { radius: 8 } },
      ],
    };

    const result = applyPatch(source, patch);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(source.entities).toEqual([]);
    expect(result.model.entities).toEqual([
      { id: 'c1', type: 'circle', visible: true, center: [10, 20], radius: 8 },
    ]);
  });

  it('restores a deleted entity and its attached relation through the inverse patch', () => {
    const source = modelWithCircleAndRelation();
    const result = applyPatch(source, {
      operations: [{ type: 'entity.delete', entityId: 'c1' }],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.model.entities).toEqual([]);
    expect(result.model.relations).toEqual([]);

    const restored = applyPatch(result.model, result.inversePatch);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.model).toEqual(source);
  });

  it('returns the unchanged source model when any operation is invalid', () => {
    const source = modelWithCircleAndRelation();
    const patch: SpatialPatch = {
      operations: [
        { type: 'entity.update', entityId: 'c1', changes: { radius: 8 } },
        { type: 'entity.delete', entityId: 'missing' },
      ],
    };

    const result = applyPatch(source, patch);

    expect(result.success).toBe(false);
    expect(result.model).toBe(source);
    expect(source.entities[0]).toMatchObject({ radius: 5 });
  });

  it('rejects a patch whose resulting geometry is invalid', () => {
    const source = modelWithCircleAndRelation();
    const result = applyPatch(source, {
      operations: [{ type: 'entity.update', entityId: 'c1', changes: { radius: 0 } }],
    });

    expect(result.success).toBe(false);
    expect(result.model).toBe(source);
    expect('errors' in result && result.errors[0].code).toBe('MODEL_INVALID');
  });
});
