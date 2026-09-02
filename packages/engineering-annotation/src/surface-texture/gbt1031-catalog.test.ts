// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { listGbt1031SurfaceTextureValues } from './gbt1031-catalog';

describe('GB/T 1031 surface-texture catalog', () => {
  it('provides the preferred Ra series used by drawing annotations', () => {
    const entries = listGbt1031SurfaceTextureValues('Ra');

    expect(entries.find(({ value }) => value === 0.8)).toEqual({
      parameter: 'Ra', value: 0.8, unit: 'um', series: 'preferred',
    });
    expect(entries.map(({ value }) => value)).toEqual([
      0.006, 0.012, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8,
      1.6, 3.2, 6.3, 12.5, 25, 50, 100,
    ]);
  });

  it('returns new arrays so callers cannot mutate the shared standard catalog', () => {
    const first = listGbt1031SurfaceTextureValues('Ra');
    first.pop();

    expect(listGbt1031SurfaceTextureValues('Ra')).toHaveLength(15);
  });
});
