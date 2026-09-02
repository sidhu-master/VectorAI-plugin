// SPDX-License-Identifier: Apache-2.0

import type { GeometricCharacteristic } from './types';

export type Gbt1184ToleranceClass = 'H' | 'K' | 'L';

export interface Gbt1184CatalogEntry {
  characteristic: GeometricCharacteristic;
  toleranceClass: Gbt1184ToleranceClass;
  value: number;
  unit: 'mm';
  nominalLength?: number;
  standardRef: { id: 'GB/T 1184'; edition: '1996' };
}

export interface Gbt1184SpecifiedToleranceEntry {
  grade: number;
  value: number;
}

const POSITION_PREFERRED_NUMBERS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8] as const;

export function listGbt1184PositionToleranceSeries({
  min = 0.001,
  max = 10,
}: { min?: number; max?: number } = {}): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return [];
  const firstExponent = Math.floor(Math.log10(min)) - 1;
  const lastExponent = Math.ceil(Math.log10(max));
  const values: number[] = [];
  for (let exponent = firstExponent; exponent <= lastExponent; exponent += 1) {
    const factor = 10 ** exponent;
    for (const preferredNumber of POSITION_PREFERRED_NUMBERS) {
      const value = Number((preferredNumber * factor).toPrecision(12));
      if (value >= min && value <= max) values.push(value);
    }
  }
  return [...new Set(values)].sort((left, right) => left - right);
}

export function lookupGbt1184SpecifiedTolerance(
  characteristic: GeometricCharacteristic,
  nominalLength?: number,
): Gbt1184SpecifiedToleranceEntry[] {
  const table = SPECIFIED_TABLES[characteristic];
  if (table === undefined || nominalLength === undefined || !Number.isFinite(nominalLength) || nominalLength <= 0) return [];
  const rangeIndex = table.maxima.findIndex((maximum) => nominalLength <= maximum);
  if (rangeIndex < 0) return [];
  return table.rows.map(({ grade, values }) => ({ grade, value: micrometresToMillimetres(values[rangeIndex]!) }));
}

interface SpecifiedTable {
  maxima: readonly number[];
  rows: ReadonlyArray<{ grade: number; values: readonly number[] }>;
}

const B1: SpecifiedTable = {
  maxima: [10, 16, 25, 40, 63, 100, 160, 250, 400, 630, 1_000, 1_600, 2_500, 4_000, 6_300, 10_000],
  rows: [
    { grade: 1, values: [.2, .25, .3, .4, .5, .6, .8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6] },
    { grade: 2, values: [.4, .5, .6, .8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12] },
    { grade: 3, values: [.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25] },
    { grade: 4, values: [1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40] },
    { grade: 5, values: [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60] },
    { grade: 6, values: [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100] },
    { grade: 7, values: [5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150] },
    { grade: 8, values: [8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250] },
    { grade: 9, values: [12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400] },
    { grade: 10, values: [20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600] },
    { grade: 11, values: [30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000] },
    { grade: 12, values: [60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500, 2_000] },
  ],
};

const B2: SpecifiedTable = {
  maxima: [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500],
  rows: [
    { grade: 0, values: [.1, .1, .12, .15, .2, .25, .3, .4, .6, .8, 1, 1.2, 1.5] },
    { grade: 1, values: [.2, .2, .25, .25, .3, .4, .5, .6, 1, 1.2, 1.6, 2, 2.5] },
    { grade: 2, values: [.3, .4, .4, .5, .6, .6, .8, 1, 1.2, 2, 2.5, 3, 4] },
    { grade: 3, values: [.5, .6, .6, .8, 1, 1, 1.2, 1.5, 2, 3, 4, 5, 6] },
    { grade: 4, values: [.8, 1, 1, 1.2, 1.5, 1.5, 2, 2.5, 3.5, 4.5, 6, 7, 8] },
    { grade: 5, values: [1.2, 1.5, 1.5, 2, 2.5, 2.5, 3, 4, 5, 7, 8, 9, 10] },
    { grade: 6, values: [2, 2.5, 2.5, 3, 4, 4, 5, 6, 8, 10, 12, 13, 15] },
    { grade: 7, values: [3, 4, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20] },
    { grade: 8, values: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27] },
    { grade: 9, values: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40] },
    { grade: 10, values: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63] },
    { grade: 11, values: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97] },
    { grade: 12, values: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155] },
  ],
};

const B3: SpecifiedTable = {
  maxima: [10, 16, 25, 40, 63, 100, 160, 250, 400, 630, 1_000, 1_600, 2_500, 4_000, 6_300, 10_000],
  rows: [
    { grade: 1, values: [.4, .5, .6, .8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12] },
    { grade: 2, values: [.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25] },
    { grade: 3, values: [1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50] },
    { grade: 4, values: [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100] },
    { grade: 5, values: [5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150] },
    { grade: 6, values: [8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250] },
    { grade: 7, values: [12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400] },
    { grade: 8, values: [20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600] },
    { grade: 9, values: [30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000] },
    { grade: 10, values: [50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500] },
    { grade: 11, values: [80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500, 2_000, 2_500] },
    { grade: 12, values: [120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500, 2_000, 2_500, 3_000, 4_000] },
  ],
};

const B4: SpecifiedTable = {
  maxima: [1, 3, 6, 10, 18, 30, 50, 120, 250, 500, 800, 1_250, 2_000, 3_150, 5_000, 8_000, 10_000],
  rows: [
    { grade: 1, values: [.4, .4, .5, .6, .8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12] },
    { grade: 2, values: [.6, .6, .8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20] },
    { grade: 3, values: [1, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30] },
    { grade: 4, values: [1.5, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50] },
    { grade: 5, values: [2.5, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80] },
    { grade: 6, values: [4, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120] },
    { grade: 7, values: [6, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200] },
    { grade: 8, values: [10, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300] },
    { grade: 9, values: [15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600] },
    { grade: 10, values: [25, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200] },
    { grade: 11, values: [40, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500, 2_000] },
    { grade: 12, values: [60, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500, 2_000, 2_500, 3_000, 4_000] },
  ],
};

const SPECIFIED_TABLES: Partial<Record<GeometricCharacteristic, SpecifiedTable>> = {
  straightness: B1, flatness: B1,
  circularity: B2, cylindricity: B2,
  parallelism: B3, perpendicularity: B3, angularity: B3,
  coaxiality: B4, symmetry: B4, 'circular-runout': B4, 'total-runout': B4,
};

function micrometresToMillimetres(value: number): number {
  return Number((value / 1_000).toPrecision(12));
}

interface LengthRow {
  maxInclusive: number;
  H: number;
  K: number;
  L: number;
}

const CLASSES: readonly Gbt1184ToleranceClass[] = ['H', 'K', 'L'];
const STANDARD_REF = { id: 'GB/T 1184', edition: '1996' } as const;
const STRAIGHTNESS_FLATNESS_ROWS: readonly LengthRow[] = [
  { maxInclusive: 10, H: 0.02, K: 0.05, L: 0.1 },
  { maxInclusive: 30, H: 0.05, K: 0.1, L: 0.2 },
  { maxInclusive: 100, H: 0.1, K: 0.2, L: 0.4 },
  { maxInclusive: 300, H: 0.2, K: 0.4, L: 0.8 },
  { maxInclusive: 1_000, H: 0.3, K: 0.6, L: 1.2 },
  { maxInclusive: 3_000, H: 0.4, K: 0.8, L: 1.6 },
];
const PERPENDICULARITY_ROWS: readonly LengthRow[] = [
  { maxInclusive: 100, H: 0.2, K: 0.4, L: 0.6 },
  { maxInclusive: 300, H: 0.3, K: 0.6, L: 1 },
  { maxInclusive: 1_000, H: 0.4, K: 0.8, L: 1.5 },
  { maxInclusive: 3_000, H: 0.5, K: 1, L: 2 },
];
const SYMMETRY_ROWS: readonly LengthRow[] = [
  { maxInclusive: 100, H: 0.5, K: 0.6, L: 0.6 },
  { maxInclusive: 300, H: 0.5, K: 0.6, L: 1 },
  { maxInclusive: 1_000, H: 0.5, K: 0.8, L: 1.5 },
  { maxInclusive: 3_000, H: 0.5, K: 1, L: 2 },
];
const LENGTH_TABLES: Partial<Record<GeometricCharacteristic, readonly LengthRow[]>> = {
  straightness: STRAIGHTNESS_FLATNESS_ROWS,
  flatness: STRAIGHTNESS_FLATNESS_ROWS,
  perpendicularity: PERPENDICULARITY_ROWS,
  symmetry: SYMMETRY_ROWS,
};

export function lookupGbt1184GeneralTolerance(
  characteristic: GeometricCharacteristic,
  nominalLength?: number,
): Gbt1184CatalogEntry[] {
  if (characteristic === 'circular-runout') {
    const values = { H: 0.1, K: 0.2, L: 0.5 } as const;
    return CLASSES.map((toleranceClass) => ({
      characteristic, toleranceClass, value: values[toleranceClass], unit: 'mm', standardRef: STANDARD_REF,
    }));
  }
  const table = LENGTH_TABLES[characteristic];
  if (table === undefined || nominalLength === undefined || !Number.isFinite(nominalLength) || nominalLength <= 0) return [];
  const row = table.find(({ maxInclusive }) => nominalLength <= maxInclusive);
  if (row === undefined) return [];
  return CLASSES.map((toleranceClass) => ({
    characteristic, toleranceClass, value: row[toleranceClass], unit: 'mm', nominalLength, standardRef: STANDARD_REF,
  }));
}
