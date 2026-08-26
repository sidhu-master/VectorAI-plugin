// SPDX-License-Identifier: Apache-2.0

import type { HatchPatternLine, ParametricHatch, Vec2 } from '@vectorai/drawing-core';

import { normalizeHatchRegion, type NormalizedHatchRegion } from './topology';

export const MAX_HATCH_RENDER_LINES = 20_000;

export interface HatchRenderLine {
  start: Vec2;
  end: Vec2;
  dashArray: number[];
  dashOffset: number;
}
export interface HatchRenderPlan { region: NormalizedHatchRegion; lines: HatchRenderLine[] }
export type HatchRenderPlanResult =
  | { status: 'ok'; plan: HatchRenderPlan }
  | { status: 'invalid'; code: 'HATCH_BOUNDARY_OPEN' | 'HATCH_BOUNDARY_EMPTY' | 'HATCH_COORDINATE_OVERFLOW' | 'HATCH_PATTERN_DENSITY_LIMIT' };

export function createHatchRenderPlan(hatch: ParametricHatch, tolerance: number): HatchRenderPlanResult {
  const normalized = normalizeHatchRegion(hatch, tolerance);
  if (normalized.status !== 'ok') return normalized;
  const lines: HatchRenderLine[] = [];
  for (const family of hatch.patternLines) {
    const generated = generateFamily(transformPatternFamily(family, hatch.patternAngle, hatch.patternScale), normalized.region);
    if (lines.length + generated.length > MAX_HATCH_RENDER_LINES) {
      return { status: 'invalid', code: 'HATCH_PATTERN_DENSITY_LIMIT' };
    }
    lines.push(...generated);
  }
  return { status: 'ok', plan: { region: normalized.region, lines } };
}

function transformPatternFamily(family: HatchPatternLine, angleDegrees: number, scale: number): HatchPatternLine {
  const angle = angleDegrees * Math.PI / 180;
  const rotateScale = ([x, y]: Vec2): Vec2 => [
    scale * (x * Math.cos(angle) - y * Math.sin(angle)),
    scale * (x * Math.sin(angle) + y * Math.cos(angle)),
  ];
  return {
    angle: family.angle + angleDegrees,
    base: rotateScale(family.base),
    offset: rotateScale(family.offset),
    dashLengths: family.dashLengths.map((value) => value * scale),
  };
}

function generateFamily(family: HatchPatternLine, region: NormalizedHatchRegion): HatchRenderLine[] {
  const angle = family.angle * Math.PI / 180;
  const direction: Vec2 = [Math.cos(angle), Math.sin(angle)];
  const normal: Vec2 = [-direction[1], direction[0]];
  const spacing = dot(family.offset, normal);
  if (Math.abs(spacing) <= 1e-12) return [];
  const corners: Vec2[] = [
    [region.bounds.minX, region.bounds.minY], [region.bounds.maxX, region.bounds.minY],
    [region.bounds.maxX, region.bounds.maxY], [region.bounds.minX, region.bounds.maxY],
  ];
  const cornerProjections = corners.map((point) => dot(point, normal));
  const baseProjection = dot(family.base, normal);
  const minIndex = Math.floor((Math.min(...cornerProjections) - baseProjection) / spacing) - 1;
  const maxIndex = Math.ceil((Math.max(...cornerProjections) - baseProjection) / spacing) + 1;
  const first = Math.min(minIndex, maxIndex);
  const last = Math.max(minIndex, maxIndex);
  const diagonal = Math.hypot(region.bounds.maxX - region.bounds.minX, region.bounds.maxY - region.bounds.minY);
  const alongProjections = corners.map((point) => dot(point, direction));
  const minimumAlong = Math.min(...alongProjections) - Math.max(1, diagonal * 0.01);
  const maximumAlong = Math.max(...alongProjections) + Math.max(1, diagonal * 0.01);
  const result: HatchRenderLine[] = [];
  for (let index = first; index <= last; index += 1) {
    const origin: Vec2 = [family.base[0] + family.offset[0] * index, family.base[1] + family.offset[1] * index];
    const originAlong = dot(origin, direction);
    const startDistance = minimumAlong - originAlong;
    const endDistance = maximumAlong - originAlong;
    result.push({
      start: [origin[0] + direction[0] * startDistance, origin[1] + direction[1] * startDistance],
      end: [origin[0] + direction[0] * endDistance, origin[1] + direction[1] * endDistance],
      dashArray: family.dashLengths.map(Math.abs),
      dashOffset: startDistance,
    });
  }
  return result;
}

function dot(a: Vec2, b: Vec2): number { return a[0] * b[0] + a[1] * b[1]; }
