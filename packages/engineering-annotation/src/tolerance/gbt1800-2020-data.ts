// SPDX-License-Identifier: Apache-2.0

import { canonicalRuleInputDigest } from './digest';
import { GBT_1800_2020_GENERATED_INTERVALS } from './gbt1800-2020-generated';
import type { ToleranceDatasetMetadata } from './standard-types';

export interface Gbt1800IntervalRecord {
  over: number;
  through: number;
  internal: Readonly<Record<string, readonly [lowerMicrometres: number, upperMicrometres: number]>>;
  external: Readonly<Record<string, readonly [lowerMicrometres: number, upperMicrometres: number]>>;
}

export const GBT_1800_2020_INTERVALS: readonly Gbt1800IntervalRecord[] = deepFreeze(
  GBT_1800_2020_GENERATED_INTERVALS as readonly Gbt1800IntervalRecord[],
);

export const GBT_1800_2020_PREFERRED_DESIGNATIONS: Readonly<{
  internal: readonly string[];
  external: readonly string[];
}> = deepFreeze({
  internal: ['H7', 'H8', 'H9', 'H11', 'JS7', 'K7', 'N7', 'P7'],
  external: ['g6', 'h6', 'js6', 'k6', 'n6', 'p6', 'r6', 's6'],
});

export const GBT_1800_2020_COMMON_DESIGNATIONS: Readonly<{
  internal: readonly string[];
  external: readonly string[];
}> = deepFreeze({
  internal: ['F6', 'G6', 'H6', 'JS6', 'K6', 'M6', 'N6', 'P6', 'F7', 'G7', 'M7', 'R7', 'S7', 'T7', 'U7', 'D8', 'E8', 'F8'],
  external: ['f5', 'g5', 'h5', 'js5', 'k5', 'm5', 'n5', 'p5', 'f6', 'm6', 't6', 'u6', 'f7', 'h7', 'e8', 'h8', 'd9', 'e9', 'h9'],
});

export const GBT_1800_2020_DATASET_METADATA: ToleranceDatasetMetadata = deepFreeze({
  completeness: 'complete',
  catalogClassification: 'verified',
  numericProvenance: [
    {
      kind: 'authorized-standard-tabulation',
      referenceId: 'GBT-1800.2-2020-tables-2-32',
      description: 'GB/T 1800.2-2020 tables 2–32, nominal sizes greater than 0 mm through 500 mm',
    },
  ],
});

export const GBT_1800_2020_MANIFEST = deepFreeze({
  standardId: 'GB/T 1800',
  edition: '2020',
  minimumExclusive: 0,
  maximumInclusive: 500,
  datasetVersion: '2',
  sourceParts: ['GB/T 1800.1-2020', 'GB/T 1800.2-2020'],
  availability: 'complete-0-through-500-mm',
  completeness: GBT_1800_2020_DATASET_METADATA.completeness,
  catalogClassification: GBT_1800_2020_DATASET_METADATA.catalogClassification,
  numericProvenance: GBT_1800_2020_DATASET_METADATA.numericProvenance,
  checksum: canonicalRuleInputDigest({
    nominalValue: 500,
    unit: 'mm',
    inputs: { dataset: JSON.stringify(GBT_1800_2020_INTERVALS) },
  }),
} as const);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
