// SPDX-License-Identifier: Apache-2.0

import type { ParametricHatch } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { createHatchRenderPlan } from './index';

const hatch: ParametricHatch = {
  version: 1,
  style: 'normal',
  elevation: 0,
  extrusion: [0, 0, 1],
  boundaryPaths: [{ flags: 3, closed: true, edges: [
    { type: 'line', start: [0, 0], end: [20, 0] },
    { type: 'line', start: [20, 0], end: [20, 10] },
    { type: 'line', start: [20, 10], end: [0, 10] },
    { type: 'line', start: [0, 10], end: [0, 0] },
  ] }],
  patternLines: [{ angle: 45, base: [0, 0], offset: [-2.2450640303, 2.2450640303], dashLengths: [] }],
  patternAngle: 0,
  patternScale: 1,
  double: false,
};

describe('createHatchRenderPlan', () => {
  it('generates a regular ANSI31 family spanning the clip bounds', () => {
    const result = createHatchRenderPlan(hatch, 1e-6);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const normal = [-Math.SQRT1_2, Math.SQRT1_2] as const;
    const projections = result.plan.lines
      .map((item) => item.start[0] * normal[0] + item.start[1] * normal[1])
      .sort((a, b) => a - b);
    for (let index = 1; index < projections.length; index += 1) {
      expect(projections[index]! - projections[index - 1]!).toBeCloseTo(3.175, 6);
    }
    for (const item of result.plan.lines) {
      expect(Math.atan2(item.end[1] - item.start[1], item.end[0] - item.start[0])).toBeCloseTo(Math.PI / 4, 8);
      expect(Math.hypot(item.end[0] - item.start[0], item.end[1] - item.start[1])).toBeGreaterThan(Math.hypot(20, 10));
    }
  });

  it('applies the DXF global pattern angle and scale at render time', () => {
    const result = createHatchRenderPlan({ ...hatch, patternAngle: 15, patternScale: 2 }, 1e-6);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const first = result.plan.lines[0]!;
    expect(Math.atan2(first.end[1] - first.start[1], first.end[0] - first.start[0]) * 180 / Math.PI).toBeCloseTo(60, 8);
    const normal = [-Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)] as const;
    const projections = result.plan.lines
      .map((item) => item.start[0] * normal[0] + item.start[1] * normal[1])
      .sort((a, b) => a - b);
    expect(projections[1]! - projections[0]!).toBeCloseTo(6.35, 6);
  });

  it('spans translated world-space bounds instead of centering finite lines around the pattern origin', () => {
    const translated: ParametricHatch = {
      ...hatch,
      boundaryPaths: [{ flags: 3, closed: true, edges: [
        { type: 'line', start: [500, 600], end: [700, 600] },
        { type: 'line', start: [700, 600], end: [700, 680] },
        { type: 'line', start: [700, 680], end: [500, 680] },
        { type: 'line', start: [500, 680], end: [500, 600] },
      ] }],
    };

    const result = createHatchRenderPlan(translated, 1e-6);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const direction = [Math.SQRT1_2, Math.SQRT1_2] as const;
    const minAlongLine = (500 + 600) * Math.SQRT1_2;
    const maxAlongLine = (700 + 680) * Math.SQRT1_2;
    for (const line of result.plan.lines) {
      const start = line.start[0] * direction[0] + line.start[1] * direction[1];
      const end = line.end[0] * direction[0] + line.end[1] * direction[1];
      expect(Math.min(start, end)).toBeLessThanOrEqual(minAlongLine);
      expect(Math.max(start, end)).toBeGreaterThanOrEqual(maxAlongLine);
    }
  });
});
