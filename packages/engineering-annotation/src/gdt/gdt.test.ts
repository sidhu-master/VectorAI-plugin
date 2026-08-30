// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { applyGeometricToleranceEdit } from './edit';
import type { GeometricToleranceIntent } from './types';
import { validateGeometricTolerances } from './validate';
import { effectiveGeometricToleranceValue } from './value';

const ref = { drawingId: 'drawing-test', revision: 1 };

function intent(overrides: Partial<GeometricToleranceIntent> = {}): GeometricToleranceIntent {
  return {
    id: 'gdt:1', drawingRef: ref, characteristic: 'perpendicularity',
    controlledTargets: [{ geometryId: 'edge:controlled' as GeometryId, anchor: { kind: 'nearest', point: [3, 4] } }],
    toleranceZone: { shape: 'linear' }, datumReferenceFrame: [{ datumId: 'datum:A' }],
    computed: { status: 'resolved', value: 0.015, unit: 'mm', diagnostics: [] },
    source: 'geometry', status: 'resolved', evidenceIds: ['golden:frame:1'],
    ...overrides,
  };
}

const datum = {
  id: 'datum:A', drawingRef: ref, name: 'A', geometryId: 'edge:datum' as GeometryId,
  anchor: { kind: 'nearest' as const, point: [0, 0] as const }, role: 'primary' as const,
  source: 'geometry' as const, status: 'candidate' as const, evidenceIds: ['golden:datum:A'],
};

describe('GD&T domain foundation', () => {
  it('keeps calculated and manually overridden values separate', () => {
    const edited = applyGeometricToleranceEdit(intent(), { type: 'override.set', value: 0.01 });
    expect(edited.computed.value).toBe(0.015);
    expect(effectiveGeometricToleranceValue(edited)).toBe(0.01);
    expect(effectiveGeometricToleranceValue(applyGeometricToleranceEdit(edited, { type: 'override.clear' }))).toBe(0.015);
    expect(() => applyGeometricToleranceEdit(intent(), { type: 'override.set', value: 0 })).toThrow('GDT_VALUE_INVALID');
  });

  it('validates datum requirements, identities, targets, and positive values', () => {
    const diagnostics = validateGeometricTolerances({
      datums: [datum, { ...datum, id: 'datum:A2' }],
      intents: [intent({ datumReferenceFrame: [], override: { value: -1 } })],
      geometryIds: new Set(['edge:datum']),
    });
    expect(diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'GDT_DATUM_NAME_DUPLICATE', 'GDT_DATUM_REQUIRED', 'GDT_TARGET_UNKNOWN', 'GDT_VALUE_INVALID',
    ]));
  });

  it('does not require a datum for form controls', () => {
    expect(validateGeometricTolerances({ datums: [], intents: [intent({ characteristic: 'flatness', datumReferenceFrame: [] })] })
      .map(({ code }) => code)).not.toContain('GDT_DATUM_REQUIRED');
  });
});
