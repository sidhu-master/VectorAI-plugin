// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { normalizeToleranceProjection, validateToleranceProjection } from './tolerance';

describe('portable tolerance projection', () => {
  it('normalizes legacy deviations without inventing rule provenance', () => {
    expect(normalizeToleranceProjection({
      legacy: { upper: 0.02, lower: -0.01 },
      unit: 'mm',
    })).toEqual({
      mode: 'bilateral',
      upperDeviation: 0.02,
      lowerDeviation: -0.01,
      unit: 'mm',
      status: 'confirmed',
      source: 'manual',
      evidenceRefs: ['evidence:tolerance:legacy'],
    });
  });

  it('preserves a valid structured fit projection', () => {
    const projection = {
      mode: 'fit' as const,
      fitDesignation: 'H7',
      unit: 'mm' as const,
      status: 'confirmed' as const,
      source: 'standard' as const,
      ruleRef: { id: 'iso-fit', version: '1', inputDigest: 'sha256:abc' },
      evidenceRefs: ['evidence:fit'],
    };
    expect(normalizeToleranceProjection({ projection, unit: 'mm' })).toEqual(projection);
  });

  it('preserves standard provenance and display preferences without retaining nested references', () => {
    const projection = {
      mode: 'fit' as const,
      fitDesignation: 'H7/g6',
      unit: 'mm' as const,
      status: 'confirmed' as const,
      source: 'standard' as const,
      featureClass: 'external' as const,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      displayPreference: 'both' as const,
      evidenceRefs: ['evidence:fit'],
    };

    const normalized = normalizeToleranceProjection({ projection, unit: 'mm' });

    expect(normalized).toEqual(projection);
    expect(normalized?.standardRef).not.toBe(projection.standardRef);
  });

  it('rejects inverted limits, non-finite deviations, and confirmed data without evidence', () => {
    expect(() => validateToleranceProjection({
      mode: 'limits', lowerLimit: 12, upperLimit: 11, unit: 'mm',
      source: 'document', status: 'resolved', evidenceRefs: [],
    })).toThrow('TOLERANCE_LIMIT_ORDER');
    expect(() => validateToleranceProjection({
      mode: 'bilateral', upperDeviation: Number.NaN, lowerDeviation: -0.01, unit: 'mm',
      source: 'manual', status: 'resolved', evidenceRefs: [],
    })).toThrow('TOLERANCE_NUMBER_INVALID');
    expect(() => validateToleranceProjection({
      mode: 'unilateral', upperDeviation: 0.02, unit: 'mm',
      source: 'manual', status: 'confirmed', evidenceRefs: [],
    })).toThrow('TOLERANCE_EVIDENCE_REQUIRED');
  });

  it('rejects incomplete standard provenance and feature classes on angular units', () => {
    expect(() => validateToleranceProjection({
      mode: 'fit', fitDesignation: 'H7', unit: 'mm', source: 'standard', status: 'resolved',
      standardRef: { id: '', edition: '2020' }, evidenceRefs: [],
    })).toThrow('TOLERANCE_STANDARD_REF_INVALID');
    expect(() => validateToleranceProjection({
      mode: 'none', unit: 'deg', source: 'manual', status: 'resolved',
      featureClass: 'internal', evidenceRefs: [],
    })).toThrow('TOLERANCE_FEATURE_CLASS_UNIT_INVALID');
  });
});
