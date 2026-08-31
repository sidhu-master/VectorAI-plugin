// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalRuleInputDigest } from './digest';
import {
  GBT_1800_2020_INTERVALS,
  GBT_1800_2020_MANIFEST,
} from './gbt1800-2020-data';
import { createGbt1800Provider } from './gbt1800-provider';

describe('GB/T 1800.1/2-2020 provider', () => {
  const provider = createGbt1800Provider();

  it('resolves the 13 mm u6 reference value', () => {
    expect(provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'u6' }))
      .toMatchObject({
        upperDeviation: 0.044,
        lowerDeviation: 0.033,
        upperLimitSize: 13.044,
        lowerLimitSize: 13.033,
      });
  });

  it('resolves H7/g6 and classifies its clearance fit', () => {
    expect(provider.resolveFit({ basicSize: 13, basis: 'hole', designation: 'H7/g6' }))
      .toMatchObject({ fitType: 'clearance', minimumClearance: 0.006, maximumClearance: 0.035 });
  });

  it('uses the external table for opposed parallel surfaces', () => {
    expect(provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'h6' }))
      .toMatchObject({ upperDeviation: 0, lowerDeviation: -0.011 });
  });

  it('classifies the independently specified H7/u6 reference as interference', () => {
    expect(provider.resolveFit({ basicSize: 13, basis: 'hole', designation: 'H7/u6' }))
      .toMatchObject({ fitType: 'interference', minimumClearance: -0.044, maximumClearance: -0.015 });
  });

  it('rejects out-of-range and wrong-case designations', () => {
    expect(() => provider.resolveBand({ basicSize: 501, featureClass: 'external', designation: 'h6' }))
      .toThrow('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'H7' }))
      .toThrow('TOLERANCE_DESIGNATION_INVALID');
  });

  it('reports unverified cells as unavailable instead of inferring values', () => {
    expect(() => provider.resolveBand({ basicSize: 19, featureClass: 'external', designation: 'h6' }))
      .toThrow('TOLERANCE_STANDARD_UNAVAILABLE');
    expect(provider.listBands({ basicSize: 19, featureClass: 'external' }))
      .toEqual([
        { designation: 'g6', featureClass: 'external', category: 'other', available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' },
        { designation: 'h6', featureClass: 'external', category: 'other', available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' },
        { designation: 'u6', featureClass: 'external', category: 'other', available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' },
      ]);
  });

  it('defines all nominal intervals contiguously with ordered, case-correct cells', () => {
    expect(GBT_1800_2020_INTERVALS).toHaveLength(13);
    expect(GBT_1800_2020_INTERVALS[0]).toMatchObject({ over: 0, through: 3 });
    expect(GBT_1800_2020_INTERVALS.at(-1)).toMatchObject({ over: 400, through: 500 });

    for (const [index, interval] of GBT_1800_2020_INTERVALS.entries()) {
      if (index > 0) expect(interval.over).toBe(GBT_1800_2020_INTERVALS[index - 1]!.through);
      for (const [designation, [lower, upper]] of Object.entries(interval.internal)) {
        expect(designation).toMatch(/^[A-Z]+\d+$/);
        expect(lower).toBeLessThanOrEqual(upper);
      }
      for (const [designation, [lower, upper]] of Object.entries(interval.external)) {
        expect(designation).toMatch(/^[a-z]+\d+$/);
        expect(lower).toBeLessThanOrEqual(upper);
      }
    }
  });

  it('uses an honest deterministic manifest checksum for the canonical dataset', () => {
    expect(GBT_1800_2020_MANIFEST).toMatchObject({
      standardId: 'GB/T 1800',
      edition: '2020',
      minimumExclusive: 0,
      maximumInclusive: 500,
      datasetVersion: '1',
      sourceParts: ['GB/T 1800.1-2020', 'GB/T 1800.2-2020'],
      availability: 'partial-reference-cases-only',
    });
    expect(GBT_1800_2020_MANIFEST.checksum).toBe(canonicalRuleInputDigest({
      nominalValue: 500,
      unit: 'mm',
      inputs: { dataset: JSON.stringify(GBT_1800_2020_INTERVALS) },
    }));
  });

  it('accepts every interval edge in range and rejects the exclusive lower edge', () => {
    expect(() => provider.listBands({ basicSize: 0, featureClass: 'external' }))
      .toThrow('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
    for (const interval of GBT_1800_2020_INTERVALS) {
      if (interval.over > 0) expect(() => provider.listBands({ basicSize: interval.over, featureClass: 'external' })).not.toThrow();
      expect(() => provider.listBands({ basicSize: interval.through, featureClass: 'external' })).not.toThrow();
    }
  });

  it('creates providers with identical catalog ordering, identity, values, and digests', () => {
    const first = createGbt1800Provider();
    const second = createGbt1800Provider();
    expect(first.standardRef).toEqual({ id: 'GB/T 1800', edition: '2020' });
    expect(second.standardRef).toEqual(first.standardRef);
    expect(second.listBands({ basicSize: 13, featureClass: 'external' }))
      .toEqual(first.listBands({ basicSize: 13, featureClass: 'external' }));
    expect(second.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'u6' }))
      .toEqual(first.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'u6' }));
  });

  it('does not import network, DSH, model, host, or UI modules', () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const source = ['gbt1800-2020-data.ts', 'gbt1800-provider.ts']
      .map((name) => readFileSync(join(directory, name), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|@vectorai\/plugin-|@deepseek-ai|react|\/dsh\b|\/host\b|\/ui\b/);
  });
});
