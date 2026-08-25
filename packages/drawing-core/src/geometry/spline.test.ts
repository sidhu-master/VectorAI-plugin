// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import type { GeometryId, SplineGeometry } from '../document';
import { evaluateSpline, sampleSpline, splineBounds } from './spline';

function quarterCircle(): SplineGeometry {
  return {
    id: 'spline-quarter' as GeometryId,
    type: 'spline',
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    degree: 2,
    controlPoints: [[1, 0], [1, 1], [0, 1]],
    knots: [0, 0, 0, 1, 1, 1],
    weights: [1, Math.SQRT1_2, 1],
    closed: false,
    periodic: false,
  };
}

describe('canonical spline evaluation', () => {
  it('evaluates a rational quadratic arc instead of its control polygon', () => {
    const spline = quarterCircle();

    expect(evaluateSpline(spline, 0)).toEqual([1, 0]);
    expect(evaluateSpline(spline, 1)).toEqual([0, 1]);
    expect(evaluateSpline(spline, 0.5)[0]).toBeCloseTo(Math.SQRT1_2, 8);
    expect(evaluateSpline(spline, 0.5)[1]).toBeCloseTo(Math.SQRT1_2, 8);
  });

  it('samples the evaluated curve within a requested chord error', () => {
    const points = sampleSpline(quarterCircle(), { maxError: 0.001 });

    expect(points.length).toBeGreaterThan(8);
    expect(points[0]).toEqual([1, 0]);
    expect(points.at(-1)).toEqual([0, 1]);
    expect(points.every(([x, y]) => Math.abs(Math.hypot(x, y) - 1) < 1e-8)).toBe(true);
  });

  it('derives bounds from the evaluated curve and rejects inconsistent knot data', () => {
    expect(splineBounds(quarterCircle())).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });

    expect(() => evaluateSpline({ ...quarterCircle(), knots: [0, 0, 1, 1] }, 0.5))
      .toThrow('SPLINE_KNOT_COUNT_INVALID');
  });

  it('retains an inflection whose midpoint lies on its endpoint chord', () => {
    const curve: SplineGeometry = {
      id: 'spline-inflection' as GeometryId,
      type: 'spline',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      degree: 3,
      controlPoints: [[0, 0], [0, 10], [10, -10], [10, 0]],
      knots: [0, 0, 0, 0, 1, 1, 1, 1],
      closed: false,
      periodic: false,
    };
    const points = sampleSpline(curve, { maxError: 0.05 });
    expect(points.length).toBeGreaterThan(2);
    expect(Math.max(...points.map(([, y]) => y))).toBeGreaterThan(2.7);
    expect(Math.min(...points.map(([, y]) => y))).toBeLessThan(-2.7);
  });

  it('uses the Bezier control hull for high-order curves that cross every fixed probe', () => {
    const curve: SplineGeometry = {
      id: 'spline-high-order' as GeometryId, type: 'spline', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, degree: 5,
      controlPoints: [[0, 0], [2, 187.5], [4, -406.25], [6, 406.25], [8, -187.5], [10, 0]],
      knots: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], closed: false, periodic: false,
    };
    const points = sampleSpline(curve, { maxError: 0.01 });
    expect(points.length).toBeGreaterThan(2);
    expect(Math.max(...points.map(([, y]) => y))).toBeGreaterThan(30);
    expect(Math.min(...points.map(([, y]) => y))).toBeLessThan(-30);
  });
});
