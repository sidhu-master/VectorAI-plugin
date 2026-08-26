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
});
