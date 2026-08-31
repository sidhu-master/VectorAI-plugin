// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { cadAxialDimensionOffset } from './cad-paper-layout';

describe('cadAxialDimensionOffset', () => {
  it('uses compact fixed paper-space lanes instead of viewport-scaled gaps', () => {
    expect(cadAxialDimensionOffset({ radialDistance: 24, lane: 0, textHeight: 3.5 })).toBe(34.5);
    expect(cadAxialDimensionOffset({ radialDistance: 24, lane: 1, textHeight: 3.5 })).toBe(41.5);
    expect(cadAxialDimensionOffset({ radialDistance: 24, lane: 2, textHeight: 3.5 })).toBe(48.5);
  });

  it('preserves explicit user offsets without changing the lane system', () => {
    expect(cadAxialDimensionOffset({ radialDistance: 24, lane: 1, textHeight: 3.5, chainOffset: 2, candidateOffset: -1 })).toBe(42.5);
  });
});
