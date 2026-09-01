// SPDX-License-Identifier: Apache-2.0

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in';

const MILLIMETRES_PER_UNIT: Readonly<Record<LengthUnit, number>> = {
  mm: 1,
  cm: 10,
  m: 1_000,
  in: 25.4,
};

export function convertLength(value: number, sourceUnit: LengthUnit, targetUnit: LengthUnit): number {
  if (!Number.isFinite(value)) throw new TypeError('LENGTH_VALUE_INVALID');
  const sourceFactor = MILLIMETRES_PER_UNIT[sourceUnit];
  const targetFactor = MILLIMETRES_PER_UNIT[targetUnit];
  if (sourceFactor === undefined || targetFactor === undefined) throw new TypeError('LENGTH_UNIT_INVALID');
  return value * sourceFactor / targetFactor;
}

/** Stable authority-boundary representation used by millimetre standard providers. */
export function canonicalMillimetres(value: number, sourceUnit: LengthUnit): number {
  return Number(convertLength(value, sourceUnit, 'mm').toPrecision(15));
}
