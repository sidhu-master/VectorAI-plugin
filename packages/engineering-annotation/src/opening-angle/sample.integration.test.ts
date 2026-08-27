// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DimensionAnnotation } from '@vectorai/drawing-core';
import { importDxf } from '@vectorai/dxf-import';
import { describe, expect, it } from 'vitest';

import { planEngineeringAnnotations } from '../plan';

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
});
