// SPDX-License-Identifier: Apache-2.0

import { canonicalRuleInputDigest } from './digest';

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
export const GBT_1800_2020_INTERVALS: readonly Gbt1800IntervalRecord[] = [
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
] as const;

// Selection-chart category metadata remains empty until its source is authorized.
export const GBT_1800_2020_PREFERRED_DESIGNATIONS: Readonly<{
  internal: readonly string[];
  external: readonly string[];
}> = { internal: [], external: [] };

export const GBT_1800_2020_COMMON_DESIGNATIONS: Readonly<{
  internal: readonly string[];
  external: readonly string[];
}> = { internal: [], external: [] };

export const GBT_1800_2020_MANIFEST = {
  standardId: 'GB/T 1800',
  edition: '2020',
  minimumExclusive: 0,
  maximumInclusive: 500,
  datasetVersion: '1',
  sourceParts: ['GB/T 1800.1-2020', 'GB/T 1800.2-2020'],
  availability: 'partial-reference-cases-only',
  checksum: canonicalRuleInputDigest({
    nominalValue: 500,
    unit: 'mm',
    inputs: { dataset: JSON.stringify(GBT_1800_2020_INTERVALS) },
  }),
} as const;
