// SPDX-License-Identifier: Apache-2.0

import type { HatchBoundaryEdge, ParametricHatch, Vec2 } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { normalizeHatchRegion } from './index';

const line = (start: Vec2, end: Vec2): HatchBoundaryEdge => ({ type: 'line', start, end });

function hatch(paths: HatchBoundaryEdge[][]): ParametricHatch {
  return {
    version: 1,
    style: 'normal',
    elevation: 0,
    extrusion: [0, 0, 1],
    boundaryPaths: paths.map((edges) => ({ flags: 0, closed: true, edges })),
    patternLines: [{ angle: 45, base: [0, 0], offset: [-2.2450640303, 2.2450640303], dashLengths: [] }],
    patternAngle: 0,
    patternScale: 1,
    double: false,
  };
}

function signedArea(points: Vec2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

describe('normalizeHatchRegion', () => {
  it('assembles unordered and reversed edges into a closed contour', () => {
    const result = normalizeHatchRegion(hatch([[
      line([10, 10], [10, 0]),
      line([0, 0], [0, 10]),
      line([10, 0], [0, 0]),
      line([0, 10], [10, 10]),
    ]]), 1e-6);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.region.contours).toHaveLength(1);
    expect(Math.abs(signedArea(result.region.contours[0]!))).toBeCloseTo(100, 6);
  });

  it('preserves an outer loop, a hole, and an island under even-odd fill', () => {
    const square = (min: number, max: number) => [
      line([min, min], [max, min]), line([max, min], [max, max]),
      line([max, max], [min, max]), line([min, max], [min, min]),
    ];
    const result = normalizeHatchRegion(hatch([square(0, 30), square(5, 25), square(10, 20)]), 1e-6);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.region.fillRule).toBe('evenodd');
    expect(result.region.contours).toHaveLength(3);
    expect(result.region.bounds).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 30 });
  });

  it('rejects an open boundary instead of fabricating a 6.5-unit closing edge', () => {
    const result = normalizeHatchRegion(hatch([[
      line([0, 0], [10, 0]),
      line([10, 0], [10, 10]),
      line([10, 10], [0, 10]),
      line([0, 10], [0, 6.5]),
    ]]), 1e-6);

    expect(result).toEqual({ status: 'invalid', code: 'HATCH_BOUNDARY_OPEN' });
  });
});
