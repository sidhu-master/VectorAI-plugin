// SPDX-License-Identifier: Apache-2.0

import type { GeometryId, GeometryNode } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { layoutOpeningAngles, measureOpeningAngles, selectAxialEndOpeningAngles } from './index';

const quality = { status: 'confirmed' as const, confidence: 1, evidenceRefs: [] };
const gid = (id: string) => id as GeometryId;
const line = (id: string, start: readonly [number, number], end: readonly [number, number]): GeometryNode => ({
  id: gid(id), type: 'line', visible: true, quality, start, end,
});

function axialOpeningFixture(): GeometryNode[] {
  const rise = 4 * Math.sqrt(3);
  const journal = 12.9 - rise;
  return [
    line('profile-top', [14, journal], [86, journal]),
    line('profile-bottom', [14, -journal], [86, -journal]),
    line('left-upper', [10, 12.9], [14, journal]),
    line('left-lower', [10, -12.9], [14, -journal]),
    line('right-upper', [86, journal], [90, 12.9]),
    line('right-lower', [86, -journal], [90, -12.9]),
    line('orthogonal-upper', [10, 10.9], [11, 11.9]),
    line('orthogonal-lower', [10, -10.9], [11, -11.9]),
    line('middle-upper', [40, 11], [42, 7.535898]),
    line('middle-lower', [40, -11], [42, -7.535898]),
  ];
}

describe('axial-end opening angle migration', () => {
  it('measures mirrored line pairs locally and selects only non-orthogonal axial-end openings', () => {
    const geometry = axialOpeningFixture();
    const measured = measureOpeningAngles(geometry);
    const selection = selectAxialEndOpeningAngles({ geometry, facts: measured.facts, axis: measured.axis });

    expect(selection.selected.map(({ value }) => Math.round(value)).sort()).toEqual([120, 120]);
    expect(selection.selected.flatMap(({ sourceIds }) => sourceIds).sort()).toEqual([
      'left-lower', 'left-upper', 'right-lower', 'right-upper',
    ]);
    expect(Object.values(selection.suppressionReasons)).toEqual(expect.arrayContaining([
      expect.stringContaining('90°'),
      expect.stringContaining('轴端'),
    ]));
  });

  it('extracts straight polyline edges without treating bulged edges as opening rays', () => {
    const geometry = axialOpeningFixture().filter(({ id }) => !String(id).startsWith('left-'));
    geometry.push({
      id: gid('left-profile'), type: 'polyline', visible: true, quality, closed: false,
      vertices: [
        { point: [10, 12.9] }, { point: [14, 12.9 - 4 * Math.sqrt(3)] },
        { point: [14, -12.9 + 4 * Math.sqrt(3)], bulge: 0.5 }, { point: [10, -12.9] },
      ],
    });

    const measured = measureOpeningAngles(geometry);
    expect(measured.facts.some(({ sourceIds }) => sourceIds.includes(gid('left-profile')))).toBe(false);
  });

  it('lays out nested openings in deterministic separated circular lanes', () => {
    const facts = [{
      key: 'opening:left:60', value: 60, vertex: [30, 0] as const,
      rays: [[20, 5], [20, -5]] as const, sourceIds: [gid('a'), gid('b')] as const,
      evidenceRefs: [], method: 'mirrored-line-pair-opening' as const, error: 0,
    }, {
      key: 'opening:left:120', value: 120, vertex: [17, 0] as const,
      rays: [[12, 8.660254], [12, -8.660254]] as const, sourceIds: [gid('c'), gid('d')] as const,
      evidenceRefs: [], method: 'mirrored-line-pair-opening' as const, error: 0,
    }];
    const geometry = [line('bounds-top', [0, 10], [100, 10]), line('bounds-bottom', [0, -10], [100, -10])];

    const first = layoutOpeningAngles({ geometry, facts });
    const second = layoutOpeningAngles({ geometry, facts });
    expect(second).toEqual(first);
    expect(first['opening:left:60']?.definitionPoints).toHaveLength(5);
    const innerRadius = distance([30, 0], first['opening:left:60']!.definitionPoints[3]!);
    const outerRadius = distance([17, 0], first['opening:left:120']!.definitionPoints[3]!);
    expect(outerRadius).toBeGreaterThan(innerRadius);
    expect(first['opening:left:120']!.textPosition[0]).toBeLessThan(first['opening:left:60']!.textPosition[0]);
  });
});

function distance(first: readonly [number, number], second: readonly [number, number]): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

