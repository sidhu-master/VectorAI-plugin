import { beforeEach, describe, expect, it } from 'vitest';

import { compileIntent, resetIdCounter } from '../compiler';
import { validateIntent } from '../intent-validator';
import { validateModel } from '../validator';

describe('polyline and spline entities', () => {
  beforeEach(() => resetIdCounter());

  it('normalizes open and closed polyline vertices while preserving bulge', () => {
    const { model, errors } = compileIntent({
      objects: [
        {
          type: 'polyline',
          params: { vertices: [[0, 0], { point: [10, 0], bulge: 0.5 }], closed: false },
        },
        {
          type: 'polyline',
          params: { vertices: [[0, 0], [10, 0], [10, 10]], closed: true },
        },
      ],
    });

    expect(errors).toEqual([]);
    expect(model.entities).toEqual([
      {
        id: 'ent_1', type: 'polyline', visible: true, closed: false,
        vertices: [{ point: [0, 0] }, { point: [10, 0], bulge: 0.5 }],
      },
      {
        id: 'ent_2', type: 'polyline', visible: true, closed: true,
        vertices: [{ point: [0, 0] }, { point: [10, 0] }, { point: [10, 10] }],
      },
    ]);
    expect(validateModel(model).valid).toBe(true);
  });

  it.each([
    [{ vertices: [[0, 0]], closed: false }, '至少'],
    [{ vertices: [[0, 0], [1, 0]], closed: true }, '至少'],
    [{ vertices: [[0, 0], { point: [1, 0], bulge: Number.POSITIVE_INFINITY }] }, 'bulge'],
  ])('rejects malformed polyline params %#', (params, message) => {
    const intent = { objects: [{ type: 'polyline' as const, params }] };

    expect(validateIntent(intent).errors.join(' ')).toContain(message);
    expect(compileIntent(intent).errors).not.toEqual([]);
  });

  it('compiles a rational spline with explicit topology flags', () => {
    const { model, errors } = compileIntent({
      objects: [{
        type: 'spline',
        params: {
          degree: 2,
          controlPoints: [[0, 0], [5, 10], [10, 0]],
          knots: [0, 0, 0, 1, 1, 1],
          weights: [1, 0.75, 1],
          closed: false,
          periodic: false,
        },
      }],
    });

    expect(errors).toEqual([]);
    expect(model.entities[0]).toEqual({
      id: 'ent_1', type: 'spline', visible: true,
      degree: 2,
      controlPoints: [[0, 0], [5, 10], [10, 0]],
      knots: [0, 0, 0, 1, 1, 1],
      weights: [1, 0.75, 1],
      closed: false,
      periodic: false,
    });
    expect(validateModel(model).valid).toBe(true);
  });

  it.each([
    [{ degree: 3, controlPoints: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 0, 1, 1, 1] }, 'degree'],
    [{ degree: 2, controlPoints: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 1, 0, 1, 1] }, 'knots'],
    [{ degree: 2, controlPoints: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 1, 1] }, 'knots'],
    [{ degree: 2, controlPoints: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 0, 1, 1, 1], weights: [1, 1] }, 'weights'],
    [{ degree: 2, controlPoints: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 0, 1, 1, 1], weights: [1, 0, 1] }, 'weights'],
    [{ degree: 2, controlPoints: [[0, 0], [1, 1], [2, 0]], knots: [0, 0, 0, 1, 1, 1], closed: false, periodic: true }, 'periodic'],
  ])('rejects malformed spline params %#', (params, message) => {
    const intent = { objects: [{ type: 'spline' as const, params }] };

    expect(validateIntent(intent).errors.join(' ')).toContain(message);
    expect(compileIntent(intent).errors).not.toEqual([]);
  });

  it('rejects malformed complex curves in canonical models', () => {
    const { model } = compileIntent({
      objects: [{
        type: 'spline',
        params: {
          degree: 2,
          controlPoints: [[0, 0], [5, 10], [10, 0]],
          knots: [0, 0, 0, 1, 1, 1],
        },
      }],
    });
    const spline = model.entities[0];
    if (spline.type !== 'spline') throw new Error('expected spline');
    spline.knots = [0, 1, 0, 1, 1, 1];

    const validation = validateModel(model);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('knots');
  });
});
