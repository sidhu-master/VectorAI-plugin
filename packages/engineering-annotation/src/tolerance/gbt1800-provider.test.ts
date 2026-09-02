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
import { createGbt1800Provider, findGbt1800Interval } from './gbt1800-provider';

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

  it('resolves the golden-sample 35 mm n6 value from the standard table', () => {
    expect(provider.resolveBand({ basicSize: 35, featureClass: 'external', designation: 'n6' }))
      .toMatchObject({
        upperDeviation: 0.033,
        lowerDeviation: 0.017,
        upperLimitSize: 35.033,
        lowerLimitSize: 35.017,
      });
  });

  it('provides verified numeric cells throughout the supported 0–500 mm range', () => {
    const vectors = [
      { basicSize: 2, featureClass: 'internal' as const, designation: 'H7', lower: 0, upper: 0.01 },
      { basicSize: 25, featureClass: 'external' as const, designation: 'g6', lower: -0.02, upper: -0.007 },
      { basicSize: 125, featureClass: 'internal' as const, designation: 'F7', lower: 0.043, upper: 0.083 },
      { basicSize: 499, featureClass: 'external' as const, designation: 'h6', lower: -0.04, upper: 0 },
    ];
    for (const vector of vectors) {
      expect(provider.resolveBand(vector)).toMatchObject({
        lowerDeviation: vector.lower,
        upperDeviation: vector.upper,
      });
    }
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

  it('separates designation syntax and case from numeric availability', () => {
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'a5' }))
      .toThrow('TOLERANCE_STANDARD_UNAVAILABLE');
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'internal', designation: 'A5' }))
      .toThrow('TOLERANCE_STANDARD_UNAVAILABLE');
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'F7' }))
      .toThrow('TOLERANCE_DESIGNATION_INVALID');
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'shaft6' }))
      .toThrow('TOLERANCE_DESIGNATION_INVALID');
    expect(() => provider.resolveBand({ basicSize: 13, featureClass: 'external', designation: 'h99' }))
      .toThrow('TOLERANCE_DESIGNATION_INVALID');
  });

  it('lists only the selected feature class and orders recommended available bands first', () => {
    const bands = provider.listBands({ basicSize: 35, featureClass: 'external' });
    expect(bands.every(({ featureClass }) => featureClass === 'external')).toBe(true);
    expect(bands.filter(({ available }) => available).slice(0, 4).map(({ designation }) => designation))
      .toEqual(['g6', 'h6', 'js6', 'k6']);
    expect(bands).toContainEqual(expect.objectContaining({ designation: 'n6', available: true }));
  });

  it('exposes complete authorized-standard provenance to consumers', () => {
    expect(provider.datasetMetadata).toEqual({
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
  });

  it('defines all nominal intervals contiguously with ordered, case-correct cells', () => {
    expect(GBT_1800_2020_INTERVALS.length).toBeGreaterThanOrEqual(13);
    expect(GBT_1800_2020_INTERVALS[0]).toMatchObject({ over: 0, through: 3 });
    expect(GBT_1800_2020_INTERVALS.at(-1)).toMatchObject({ over: 450, through: 500 });

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

  it('keeps every imported cell equal to the IT width encoded by H/h for that interval', () => {
    for (const interval of GBT_1800_2020_INTERVALS) {
      for (const featureClass of ['internal', 'external'] as const) {
        for (const [designation, [lower, upper]] of Object.entries(interval[featureClass])) {
          const grade = Number(/\d+$/.exec(designation)?.[0]);
          const reference = interval[featureClass][`${featureClass === 'internal' ? 'H' : 'h'}${grade}`];
          expect(reference, `${designation} in (${interval.over}, ${interval.through}]`).toBeDefined();
          expect(upper - lower, `${designation} in (${interval.over}, ${interval.through}]`)
            .toBeCloseTo(reference![1] - reference![0], 8);
        }
      }
    }
  });

  it('uses an honest deterministic manifest checksum for the canonical dataset', () => {
    expect(GBT_1800_2020_MANIFEST).toMatchObject({
      standardId: 'GB/T 1800',
      edition: '2020',
      minimumExclusive: 0,
      maximumInclusive: 500,
      datasetVersion: '2',
      sourceParts: ['GB/T 1800.1-2020', 'GB/T 1800.2-2020'],
      availability: 'complete-0-through-500-mm',
      completeness: 'complete',
      catalogClassification: 'verified',
    });
    expect(GBT_1800_2020_MANIFEST.checksum).toBe(canonicalRuleInputDigest({
      nominalValue: 500,
      unit: 'mm',
      inputs: { dataset: JSON.stringify(GBT_1800_2020_INTERVALS) },
    }));
  });

  it('runtime-freezes interval records, deviation tuples, metadata, and the manifest', () => {
    const referenceInterval = GBT_1800_2020_INTERVALS[3]!;
    expect(Object.isFrozen(GBT_1800_2020_INTERVALS)).toBe(true);
    expect(Object.isFrozen(referenceInterval)).toBe(true);
    expect(Object.isFrozen(referenceInterval.internal)).toBe(true);
    expect(Object.isFrozen(referenceInterval.internal.H7)).toBe(true);
    expect(Object.isFrozen(GBT_1800_2020_MANIFEST)).toBe(true);
    expect(Object.isFrozen(GBT_1800_2020_MANIFEST.numericProvenance)).toBe(true);
    expect(() => {
      (referenceInterval.internal.H7 as unknown as number[])[0] = referenceInterval.internal.H7![0];
    }).toThrow(TypeError);
  });

  it('selects each concrete (over, through] interval at both boundaries', () => {
    expect(() => findGbt1800Interval(0))
      .toThrow('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
    for (const interval of GBT_1800_2020_INTERVALS) {
      expect(findGbt1800Interval(interval.through)).toBe(interval);
      const justInsideLowerBoundary = interval.over === 0
        ? Number.MIN_VALUE
        : interval.over + Number.EPSILON * interval.over;
      expect(findGbt1800Interval(justInsideLowerBoundary)).toBe(interval);
      if (interval.over > 0) {
        expect(findGbt1800Interval(interval.over)).toBe(GBT_1800_2020_INTERVALS[GBT_1800_2020_INTERVALS.indexOf(interval) - 1]);
      }
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
