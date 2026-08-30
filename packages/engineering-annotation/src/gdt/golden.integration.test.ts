// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { effectiveGeometricToleranceValue } from './value';
import type { GeometricToleranceIntent } from './types';

const golden = resolve(import.meta.dirname, '../../test/fixtures/golden-shaft-001/target.dxf');

describe('golden shaft GD&T semantic oracle', () => {
  it('round-trips the supplied golden tolerance magnitudes without using them as production rules', () => {
    const source = readFileSync(golden, 'utf8');
    const suppliedValues = [0.003, 0.005, 0.01, 0.015];
    for (const value of suppliedValues) expect(source).toContain(String(value));

    const records: GeometricToleranceIntent[] = suppliedValues.map((value, index) => ({
      id: `golden:gdt:${index}`, drawingRef: { drawingId: 'golden-oracle', revision: 1 },
      characteristic: index === 0 ? 'circularity' : index === 1 ? 'cylindricity' : index === 2 ? 'parallelism' : 'perpendicularity',
      controlledTargets: [], toleranceZone: { shape: 'linear' },
      datumReferenceFrame: index < 2 ? [] : [{ datumId: 'golden:datum:A' }],
      computed: { status: 'resolved', value, unit: 'mm', diagnostics: [] },
      source: 'document', status: 'resolved', evidenceIds: [`target.dxf:${value}`],
    }));
    expect(structuredClone(records).map(effectiveGeometricToleranceValue)).toEqual(suppliedValues);
  });

  it('keeps golden identities and numeric answers out of production GD&T sources', () => {
    const sourceDirectory = resolve(import.meta.dirname);
    const production = ['types.ts', 'value.ts', 'edit.ts', 'validate.ts']
      .map((name) => readFileSync(resolve(sourceDirectory, name), 'utf8')).join('\n');
    expect(production).not.toMatch(/样本图001|golden-shaft-001|0\.003|0\.005|0\.015/);
  });
});
