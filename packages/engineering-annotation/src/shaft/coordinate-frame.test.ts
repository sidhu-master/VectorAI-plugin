// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createShaftCoordinateFrame } from './coordinate-frame';

describe('shaft coordinate frame', () => {
  it('round-trips points for an arbitrarily rotated axis', () => {
    const angle = Math.PI * 0.37;
    const direction: [number, number] = [Math.cos(angle), Math.sin(angle)];
    const frame = createShaftCoordinateFrame({
      origin: [12, -7], direction, normal: [-direction[1], direction[0]],
      zMin: 0, zMax: 80, orientation: 'forward',
    });

    expect(frame.toLocal(frame.toWorld(31.25, -8.5))).toEqual([
      expect.closeTo(31.25, 10), expect.closeTo(-8.5, 10),
    ]);
  });
});
