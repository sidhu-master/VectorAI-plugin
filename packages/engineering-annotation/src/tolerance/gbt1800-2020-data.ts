// SPDX-License-Identifier: Apache-2.0

import { canonicalRuleInputDigest } from './digest';
import type { ToleranceDatasetMetadata } from './standard-types';

export interface Gbt1800IntervalRecord {
  over: number;
  through: number;
  internal: Readonly<Record<string, readonly [lowerMicrometres: number, upperMicrometres: number]>>;
  external: Readonly<Record<string, readonly [lowerMicrometres: number, upperMicrometres: number]>>;
}

/**
 * Only the reference cells specified for this implementation are populated.
 * Empty maps are intentional: no value may be inferred for an unverified cell.
 */
export const GBT_1800_2020_INTERVALS: readonly Gbt1800IntervalRecord[] = deepFreeze([
  { over: 0, through: 3, internal: {}, external: {} },
  { over: 3, through: 6, internal: {}, external: {} },
  { over: 6, through: 10, internal: {}, external: {} },
  {
    over: 10,
    through: 18,
    internal: { H7: [0, 18] },
    external: { g6: [-17, -6], h6: [-11, 0], u6: [33, 44] },
  },
  { over: 18, through: 30, internal: {}, external: {} },
  { over: 30, through: 50, internal: {}, external: {} },
  { over: 50, through: 80, internal: {}, external: {} },
  { over: 80, through: 120, internal: {}, external: {} },
  { over: 120, through: 180, internal: {}, external: {} },
  { over: 180, through: 250, internal: {}, external: {} },
  { over: 250, through: 315, internal: {}, external: {} },
  { over: 315, through: 400, internal: {}, external: {} },
  { over: 400, through: 500, internal: {}, external: {} },
] as const);

// Selection-chart category metadata remains empty until its source is authorized.
export const GBT_1800_2020_PREFERRED_DESIGNATIONS: Readonly<{
  internal: readonly string[];
  external: readonly string[];
}> = deepFreeze({ internal: [], external: [] });

export const GBT_1800_2020_COMMON_DESIGNATIONS: Readonly<{
  internal: readonly string[];
  external: readonly string[];
}> = deepFreeze({ internal: [], external: [] });

/** Numeric authority is limited to the plan-mandated 13 mm reference vectors. */
export const GBT_1800_2020_DATASET_METADATA: ToleranceDatasetMetadata = deepFreeze({
  completeness: 'partial',
  catalogClassification: 'unverified',
  numericProvenance: [
    {
      kind: 'plan-reference-vector',
      referenceId: 'task-2-13mm-H7-g6',
      description: '13 mm components: H7 [0, 18] µm; g6 [-17, -6] µm',
    },
    {
      kind: 'plan-reference-vector',
      referenceId: 'task-2-13mm-h6-u6',
      description: '13 mm components: h6 [-11, 0] µm; u6 [33, 44] µm',
    },
  ],
});

export const GBT_1800_2020_MANIFEST = deepFreeze({
  standardId: 'GB/T 1800',
  edition: '2020',
  minimumExclusive: 0,
  maximumInclusive: 500,
  datasetVersion: '1',
  sourceParts: ['GB/T 1800.1-2020', 'GB/T 1800.2-2020'],
  availability: 'partial-reference-cases-only',
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
