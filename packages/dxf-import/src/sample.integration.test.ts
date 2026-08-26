// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeHatchRegion } from '@vectorai/drawing-hatch';

import { importDxf } from './import';

describe('approved shaft DXF fixture', () => {
  it('preserves every supported entity and all source layers', async () => {
    const bytes = await readFile(resolve(import.meta.dirname, '../test/fixtures/initial-shaft.dxf'));
    const result = importDxf({
      bytes,
      source: {
        name: 'initial-shaft.dxf',
        digest: 'sha256:57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2',
      },
      drawingId: 'drawing:initial-shaft',
      now: () => 1,
    });

    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.counts).toEqual({ LINE: 89, SPLINE: 33, ARC: 12, HATCH: 2, VIEWPORT: 1 });
    expect(result.document.geometry.filter(({ type }) => type === 'line')).toHaveLength(89);
    expect(result.document.geometry.filter(({ type }) => type === 'spline')).toHaveLength(33);
    expect(result.document.geometry.filter(({ type }) => type === 'arc')).toHaveLength(12);
    const hatches = result.document.annotations.filter((annotation) => annotation.type === 'section-hatch');
    expect(hatches).toHaveLength(2);
    for (const annotation of hatches) {
      expect(annotation.pattern).toBe('ANSI31');
      expect(annotation.spacing).toBeCloseTo(3.175, 9);
      expect(annotation.hatch).toBeDefined();
      expect(annotation.segments).toBeUndefined();
      const normalized = normalizeHatchRegion(annotation.hatch!, 0.0001);
      expect(normalized.status).toBe('ok');
    }
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: 'DXF_HATCH_BOUNDARY_OPEN' }));
    expect(new Set([
      ...result.document.geometry,
      ...result.document.annotations,
    ].map((node) => node.sourceRef?.layer))).toEqual(new Set(['0', '1轮廓实线层', '5剖面线层']));
    expect(result.document.unitSystem.length).toBe('mm');
    expect(result.bounds.maxX - result.bounds.minX).toBeCloseTo(173, 6);
  });
});
