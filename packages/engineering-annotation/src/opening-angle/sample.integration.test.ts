// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DimensionAnnotation } from '@vectorai/drawing-core';
import { importDxf } from '@vectorai/dxf-import';
import { describe, expect, it } from 'vitest';

import { resolveShaftAxis } from '../shaft/axis';
import { planEngineeringAnnotations } from '../plan';
import { CAD_DIMENSION_TEXT_GAP, diameterLabelWidth } from '../diameter/layout';

describe('approved shaft DXF opening-angle annotation', () => {
  it('imports and deterministically plans only real axial-end openings', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft.dxf'));
    const imported = importDxf({
      bytes,
      source: { name: 'initial-shaft.dxf', digest: 'sha256:57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2' },
      drawingId: 'drawing:initial-shaft',
      now: () => 1,
    });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;

    const input = {
      document: imported.document,
      ref: { drawingId: 'drawing:initial-shaft', revision: 1 },
      objective: '自动标注轴端开角',
    };
    const first = planEngineeringAnnotations(input);
    const second = planEngineeringAnnotations(input);
    const angular = first.annotations.filter((item): item is DimensionAnnotation => (
      item.type === 'dimension' && item.dimensionKind === 'angular'
    ));

    expect(second).toEqual(first);
    expect(angular.map(({ computedValue }) => computedValue).sort((a, b) => (a ?? 0) - (b ?? 0)))
      .toEqual([60, 60, 120, 120]);
    expect(angular.every(({ definitionPoints }) => definitionPoints.length === 5)).toBe(true);
    expect(angular.every(({ targets }) => targets.length === 2)).toBe(true);
    expect(angular.every(({ computedValue }) => computedValue !== undefined && Math.abs(computedValue - 90) > 0.5)).toBe(true);
  });

  it('keeps feature-local diameters inside and moves only opening-zone conflicts outside', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../../../dxf-import/test/fixtures/initial-shaft.dxf'));
    const imported = importDxf({
      bytes,
      source: { name: 'initial-shaft.dxf', digest: 'sha256:diameter-layout' },
      drawingId: 'drawing:diameter-layout',
      now: () => 1,
    });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    const axis = resolveShaftAxis(imported.document, { regions: [] });
    expect(axis).not.toBeNull();
    if (!axis) return;
    const plan = planEngineeringAnnotations({
      document: imported.document,
      ref: { drawingId: 'drawing:diameter-layout', revision: 1 },
      objective: '自动标注',
      annotationKinds: ['opening-angle', 'diameter'],
    });
    const diameters = plan.annotations.filter((item): item is DimensionAnnotation => (
      item.type === 'dimension' && item.dimensionKind === 'diameter'
    ));
    const inside = diameters.filter((item) => {
      const coordinate = axialCoordinate(item.textPosition, axis.origin, axis.direction);
      return coordinate >= axis.zMin && coordinate <= axis.zMax;
    });
    const left = diameters.filter((item) => (
      axialCoordinate(item.textPosition, axis.origin, axis.direction) < axis.zMin
    )).sort((left, right) => (left.computedValue ?? 0) - (right.computedValue ?? 0));
    const right = diameters.filter((item) => (
      axialCoordinate(item.textPosition, axis.origin, axis.direction) > axis.zMax
    )).sort((left, right) => (left.computedValue ?? 0) - (right.computedValue ?? 0));
    const inwardLeftCoordinates = left.map(({ textPosition }) => axialCoordinate(textPosition, axis.origin, axis.direction));
    const outwardCoordinates = right.map(({ textPosition }) => axialCoordinate(textPosition, axis.origin, axis.direction));
    expect(diameters.map(({ computedValue }) => computedValue).sort((a, b) => (a ?? 0) - (b ?? 0)))
      .toEqual([20, 35, 35, 38, 40, 42.21, 44.59, 48, 51, 57.03]);
    expect(inside.length).toBeGreaterThan(left.length + right.length);
    expect(left.length + right.length).toBeGreaterThan(0);
    const insideIntervals = inside.map((item) => {
      const center = axialCoordinate(item.textPosition, axis.origin, axis.direction);
      const width = diameterLabelWidth(item.computedValue ?? 0);
      return { min: center - width / 2, max: center + width / 2 };
    }).sort((first, second) => first.min - second.min);
    expect(insideIntervals.every((interval, index) => (
      index === 0 || interval.min - insideIntervals[index - 1]!.max >= CAD_DIMENSION_TEXT_GAP - 1e-6
    ))).toBe(true);
    expect(left.every((item) => (
      axialCoordinate(item.textPosition, axis.origin, axis.direction)
        + diameterLabelWidth(item.computedValue ?? 0) / 2 < axis.zMin
    ))).toBe(true);
    expect(right.every((item) => (
      axialCoordinate(item.textPosition, axis.origin, axis.direction)
        - diameterLabelWidth(item.computedValue ?? 0) / 2 > axis.zMax
    ))).toBe(true);
    expect(inwardLeftCoordinates.every((coordinate, index) => index === 0 || coordinate < inwardLeftCoordinates[index - 1]!)).toBe(true);
    expect(outwardCoordinates.every((coordinate, index) => index === 0 || coordinate > outwardCoordinates[index - 1]!)).toBe(true);
  });
});

function axialCoordinate(point: readonly [number, number], origin: readonly [number, number], direction: readonly [number, number]): number {
  return (point[0] - origin[0]) * direction[0] + (point[1] - origin[1]) * direction[1];
}
