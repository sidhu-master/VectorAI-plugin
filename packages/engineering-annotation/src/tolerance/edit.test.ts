// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import {
  applyFitTolerance,
  applyManualTolerance,
  applySingleTolerance,
  clearToleranceOverride,
  setToleranceOverride,
  type EngineeringAnnotationDraft,
  type ResolvedFit,
  type ResolvedStandardTolerance,
} from '../index';

function standard(
  designation: string,
  featureClass: 'internal' | 'external',
  basicSize = 20,
  upperDeviation = 0.044,
  lowerDeviation = 0.033,
): ResolvedStandardTolerance {
  return {
    designation, featureClass, basicSize, unit: 'mm', upperDeviation, lowerDeviation,
    upperLimitSize: basicSize + upperDeviation, lowerLimitSize: basicSize + lowerDeviation,
    standardRef: { id: 'GB/T 1800', edition: '2020' },
    ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: `sha256:${designation}` },
  };
}

function fit(): ResolvedFit {
  return {
    designation: 'H7/g6', basis: 'hole',
    hole: standard('H7', 'internal', 20, 0.021, 0),
    shaft: standard('g6', 'external', 20, -0.007, -0.02),
    fitType: 'clearance', minimumClearance: 0.007, maximumClearance: 0.041,
  };
}

function draft(): EngineeringAnnotationDraft {
  return {
    version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 },
    datums: [{
      id: 'datum-a', drawingRef: { drawingId: 'drawing-1', revision: 1 }, name: 'A',
      geometryId: 'line-a' as GeometryId, anchor: { kind: 'start' }, role: 'primary',
      source: 'manual', status: 'confirmed', evidenceIds: ['manual:datum-a'],
    }],
    intents: ['intent-hole', 'intent-shaft', 'intent-other'].map((id) => ({
      id, drawingRef: { drawingId: 'drawing-1', revision: 1 }, kind: 'linear' as const,
      targets: [{ geometryId: `${id}-line` as GeometryId, anchor: { kind: 'end' as const } }],
      datumIds: ['datum-a'], nominalValue: id === 'intent-other' ? 12 : 20, unit: 'mm' as const,
      functionalRole: 'functional' as const, source: 'manual' as const, status: 'confirmed' as const,
      evidenceIds: [`manual:${id}`],
    })),
    tolerances: [{
      id: 'tolerance-other', dimensionIntentId: 'intent-other', mode: 'bilateral', source: 'manual', inputs: {},
      resolved: { upperDeviation: 0.1, lowerDeviation: -0.1, inputDigest: 'manual:other', evaluatedAt: 0 },
      status: 'resolved', evidenceIds: ['manual:other'], diagnostics: [],
    }],
    fitAssignments: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
  };
}

describe('immutable tolerance edits', () => {
  it('replaces only the target intent while preserving unrelated annotation families', () => {
    const before = draft();
    const original = structuredClone(before);
    const first = applySingleTolerance(before, standard('u6', 'external'), {
      dimensionIntentId: 'intent-shaft', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:u6'],
    });
    const after = applySingleTolerance(first, standard('h6', 'external', 20, 0, -0.013), {
      dimensionIntentId: 'intent-shaft', selectionSource: 'manual', displayPreference: 'designation', evidenceRefs: ['manual:h6'],
    });

    expect(before).toEqual(original);
    expect(after.tolerances.filter(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft')).toEqual([
      expect.objectContaining({ selection: expect.objectContaining({ designation: 'h6' }) }),
    ]);
    expect(after.tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-other')).toEqual(original.tolerances[0]);
    expect(after.datums).toEqual(original.datums);
    expect(after.geometricTolerances).toEqual(original.geometricTolerances);
    expect(after.chains).toEqual(original.chains);
  });

  it.each([
    ['mm', 12.7], ['cm', 1.27], ['m', .0127], ['in', .5],
  ] as const)('applies millimetre provider output to an equivalent %s intent', (unit, nominalValue) => {
    const input = draft();
    const intent = input.intents.find(({ id }) => id === 'intent-shaft')!;
    intent.nominalValue = nominalValue;
    intent.unit = unit;

    const after = applySingleTolerance(input, standard('u6', 'external', 12.7, .044, .033), {
      dimensionIntentId: 'intent-shaft', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:u6'],
    });

    expect(after.tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft')).toMatchObject({
      inputs: { basicSize: 12.7, featureClass: 'external', designation: 'u6' },
      resolved: {
        upperDeviation: .044, lowerDeviation: .033,
        upperLimit: expect.closeTo(12.744, 12), lowerLimit: expect.closeTo(12.733, 12),
      },
    });
  });

  it('replaces one fit group atomically', () => {
    const before = draft();
    before.tolerances.push({
      id: 'old-hole', dimensionIntentId: 'intent-hole', mode: 'bilateral', source: 'standard', inputs: {},
      resolved: { upperDeviation: .02, lowerDeviation: 0, inputDigest: 'sha256:old-hole', evaluatedAt: 0 },
      status: 'resolved', evidenceIds: [], diagnostics: [], fitGroupId: 'fit-1',
    }, {
      id: 'old-shaft', dimensionIntentId: 'intent-shaft', mode: 'bilateral', source: 'standard', inputs: {},
      resolved: { upperDeviation: 0, lowerDeviation: -.01, inputDigest: 'sha256:old-shaft', evaluatedAt: 0 },
      status: 'resolved', evidenceIds: [], diagnostics: [], fitGroupId: 'fit-1',
    });
    const original = structuredClone(before);

    const after = applyFitTolerance(before, fit(), {
      fitGroupId: 'fit-1', holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft',
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit-1'],
    });

    expect(before).toEqual(original);
    expect(after.fitAssignments).toEqual([
      expect.objectContaining({ fitGroupId: 'fit-1', designation: 'H7/g6' }),
    ]);
    expect(after.tolerances.filter(({ fitGroupId }) => fitGroupId === 'fit-1')).toEqual([
      expect.objectContaining({ dimensionIntentId: 'intent-hole', selection: { designation: 'H7/g6', source: 'manual', evidenceRefs: ['manual:fit-1'] } }),
      expect.objectContaining({ dimensionIntentId: 'intent-shaft', selection: { designation: 'H7/g6', source: 'manual', evidenceRefs: ['manual:fit-1'] } }),
    ]);
    expect(after.tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-other')).toEqual(original.tolerances[0]);
  });

  it('retains calculated standard provenance while setting and clearing an override', () => {
    const resolved = applySingleTolerance(draft(), standard('u6', 'external'), {
      dimensionIntentId: 'intent-shaft', selectionSource: 'ai-recommended', displayPreference: 'both', evidenceRefs: ['ai:choice-1'],
    });
    const overridden = setToleranceOverride(resolved, 'intent-shaft', { upperDeviation: .05, lowerDeviation: .04 });
    const tolerance = overridden.tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft');

    expect(tolerance).toMatchObject({
      source: 'standard', selection: { designation: 'u6', source: 'ai-recommended', evidenceRefs: ['ai:choice-1'] },
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      resolved: { upperDeviation: .044, lowerDeviation: .033 }, override: { upperDeviation: .05, lowerDeviation: .04 },
    });
    expect(clearToleranceOverride(overridden, 'intent-shaft').tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft'))
      .toMatchObject({ resolved: { upperDeviation: .044, lowerDeviation: .033 } });
    expect(clearToleranceOverride(overridden, 'intent-shaft').tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft'))
      .not.toHaveProperty('override');
  });

  it('creates a manual result with no standard provenance or fit assignment', () => {
    const after = applyManualTolerance(draft(), {
      dimensionIntentId: 'intent-shaft', mode: 'unilateral', upperDeviation: .02,
      displayPreference: 'deviations', evidenceRefs: ['manual:shaft'],
    });

    expect(after.tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft')).toEqual(expect.objectContaining({
      source: 'manual', mode: 'unilateral', resolved: expect.objectContaining({ upperDeviation: .02 }),
    }));
    expect(after.tolerances.find(({ dimensionIntentId }) => dimensionIntentId === 'intent-shaft'))
      .not.toHaveProperty('standardRef');
    expect(after.fitAssignments).toEqual([]);
  });

  it('rejects a fit whose referenced intents do not share the provider basic size', () => {
    const mismatched = draft();
    mismatched.intents[1]!.nominalValue = 21;

    expect(() => applyFitTolerance(mismatched, fit(), {
      fitGroupId: 'fit-1', holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft',
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit-1'],
    })).toThrow('TOLERANCE_FIT_BASIC_SIZE_MISMATCH');
  });

  it('rejects a fit designation that does not describe its resolved members', () => {
    const invalid = { ...fit(), designation: 'H7/h6' };

    expect(() => applyFitTolerance(draft(), invalid, {
      fitGroupId: 'fit-1', holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft',
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit-1'],
    })).toThrow('TOLERANCE_FIT_DESIGNATION_MISMATCH');
  });

  it('rejects a fit target already owned by another complete fit group without changing it', () => {
    const before = draft();
    before.tolerances.push({
      id: 'other-fit-hole', dimensionIntentId: 'intent-other', mode: 'bilateral', source: 'standard', inputs: {},
      resolved: { upperDeviation: .021, lowerDeviation: 0, inputDigest: 'sha256:other-hole', evaluatedAt: 0 },
      status: 'resolved', evidenceIds: [], diagnostics: [], fitGroupId: 'fit-other',
    }, {
      id: 'other-fit-shaft', dimensionIntentId: 'intent-shaft', mode: 'bilateral', source: 'standard', inputs: {},
      resolved: { upperDeviation: 0, lowerDeviation: -.02, inputDigest: 'sha256:other-shaft', evaluatedAt: 0 },
      status: 'resolved', evidenceIds: [], diagnostics: [], fitGroupId: 'fit-other',
    });
    before.fitAssignments.push({
      fitGroupId: 'fit-other', holeDimensionId: 'intent-other', shaftDimensionId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', fitType: 'clearance', minimumClearance: .007, maximumClearance: .041,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
    });
    const original = structuredClone(before);

    expect(() => applyFitTolerance(before, fit(), {
      fitGroupId: 'fit-1', holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft',
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit-1'],
    })).toThrow('FIT_PAIR_TARGET_CONFLICT');
    expect(before).toEqual(original);
  });
});
