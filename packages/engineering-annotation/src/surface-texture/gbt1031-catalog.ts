// SPDX-License-Identifier: Apache-2.0

import type { SurfaceTextureIntent } from '../dimension/types';

export interface Gbt1031SurfaceTextureValue {
  parameter: SurfaceTextureIntent['parameter'];
  value: number;
  unit: 'um';
  series: 'preferred';
}

const RA_PREFERRED_VALUES = [
  0.006, 0.012, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8,
  1.6, 3.2, 6.3, 12.5, 25, 50, 100,
] as const;

/**
 * Preferred Ra values used for surface-texture callouts under GB/T 1031.
 *
 * Other profile parameters remain editable but intentionally do not borrow
 * this Ra series: their standard values must be added from their own table.
 */
export function listGbt1031SurfaceTextureValues(
  parameter: SurfaceTextureIntent['parameter'],
): Gbt1031SurfaceTextureValue[] {
  if (parameter !== 'Ra') return [];
  return RA_PREFERRED_VALUES.map((value) => ({
    parameter,
    value,
    unit: 'um',
    series: 'preferred',
  }));
}
