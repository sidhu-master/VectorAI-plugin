import { beforeEach, describe, expect, it } from 'vitest';

import { compileIntent, resetIdCounter } from '../compiler';
import { createEmptyModel } from '../model';
import { compileIntentToPatch } from '../patch/intent-to-patch';
import { validateIntent } from '../intent-validator';

describe('analytic CAD intent compilation', () => {
  beforeEach(() => resetIdCounter());

  it('compiles and normalizes ray and xline direction aliases', () => {
    const { model, errors } = compileIntent({
      objects: [
        { type: 'ray', params: { origin: [1, 2], direction: [3, 4] } },
        { type: 'xline', params: { point: [5, 6], dir: [0, -2] } },
      ],
    });

    expect(errors).toEqual([]);
    expect(model.entities).toEqual([
      {
        id: 'ent_1', type: 'ray', visible: true, origin: [1, 2], direction: [0.6, 0.8],
      },
      {
        id: 'ent_2', type: 'xline', visible: true, origin: [5, 6], direction: [0, -1],
      },
    ]);
  });

  it('converts arc diameter and normalizes degree angles', () => {
    const { model, errors } = compileIntent({
      objects: [{
        type: 'arc',
        confidence: 0.52,
        params: {
          position: [10, 20], diameter: 20, start: -90, end: 450, clockwise: true,
        },
      }],
    });

    expect(errors).toEqual([]);
    expect(model.entities[0]).toEqual({
      id: 'ent_1', type: 'arc', visible: true, confidence: 0.52,
      center: [10, 20], radius: 10, startAngle: 270, endAngle: 90,
      counterClockwise: false,
    });
  });

  it('preserves a native ellipse arc and normalizes its parameters', () => {
    const { model, errors } = compileIntent({
      objects: [{
        type: 'ellipse',
        params: {
          center: [0, 0], majorAxis: [20, 0], ratio: 0.5,
          startParam: -45, endParam: 405,
        },
      }],
    });

    expect(errors).toEqual([]);
    expect(model.entities[0]).toEqual({
      id: 'ent_1', type: 'ellipse', visible: true, center: [0, 0],
      majorAxis: [20, 0], ratio: 0.5, startParam: 315, endParam: 45,
    });
  });

  it('rejects zero directions, non-positive radii, and invalid ellipse axes', () => {
    const intent = {
      objects: [
        { type: 'ray' as const, params: { origin: [0, 0], direction: [0, 0] } },
        {
          type: 'arc' as const,
          params: { center: [0, 0], radius: 0, startAngle: 0, endAngle: 90 },
        },
        { type: 'ellipse' as const, params: { center: [0, 0], majorAxis: [0, 0], ratio: 2 } },
      ],
    };

    const validation = validateIntent(intent);
    const compiled = compileIntent(intent);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/direction|radius|majorAxis|ratio/);
    expect(compiled.model.entities).toEqual([]);
    expect(compiled.errors).toHaveLength(3);
  });

  it('compiles a partial analytic-entity modification to changed fields only', () => {
    const model = createEmptyModel();
    model.entities.push({
      id: 'arc_1', type: 'arc', visible: true, center: [0, 0], radius: 10,
      startAngle: 0, endAngle: 90, counterClockwise: true,
    });

    const result = compileIntentToPatch({
      operation: 'modify',
      objects: [{ type: 'arc', id: 'arc_1', params: { endAngle: 180 } }],
    }, model);

    expect(result.errors).toEqual([]);
    expect(result.patch.operations).toEqual([{
      type: 'entity.update', entityId: 'arc_1', changes: { endAngle: 180 },
    }]);
  });
});
