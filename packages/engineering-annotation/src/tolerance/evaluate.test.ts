// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import {
  canonicalRuleInputDigest,
  resolveToleranceSpec,
  type DimensionIntent,
  type ToleranceRuleProvider,
  type ToleranceSpec,
} from '../index';

const intent: DimensionIntent = {
  id: 'intent-1', drawingRef: { drawingId: 'drawing-1', revision: 1 },
  kind: 'linear', targets: [{ geometryId: 'line-1' as GeometryId, anchor: { kind: 'end' } }],
  datumIds: [], nominalValue: 20, unit: 'mm', functionalRole: 'process',
  source: 'geometry', status: 'confirmed', evidenceIds: ['geometry:line-1'],
};

function spec(changes: Partial<ToleranceSpec> = {}): ToleranceSpec {
  return {
    id: 'tolerance-1', dimensionIntentId: 'intent-1', mode: 'formula',
    source: 'enterprise-rule', ruleRef: { id: 'fixture-rule', version: '1' },
    inputs: { grade: 'A', process: 2 }, status: 'candidate',
    evidenceIds: ['manual:rule'], diagnostics: [], ...changes,
  };
}

const provider: ToleranceRuleProvider = {
  listRules: () => [{
    id: 'fixture-rule', version: '1',
    inputSchema: { grade: 'string', process: 'number' },
    outputModes: ['bilateral'],
  }],
  evaluate: () => ({ mode: 'bilateral', upperDeviation: 0.02, lowerDeviation: -0.02 }),
};

describe('deterministic tolerance rule resolution', () => {
  it('canonicalizes input keys into a stable SHA-256 digest', () => {
    const first = canonicalRuleInputDigest({ nominalValue: 20, unit: 'mm', inputs: { grade: 'A', process: 2 } });
    const second = canonicalRuleInputDigest({ nominalValue: 20, unit: 'mm', inputs: { process: 2, grade: 'A' } });
    expect(first).toBe(second);
    expect(first).toBe('sha256:7b371431133009774bb1feb09758d26ee207094066f37460011a253a08d92c9e');
    expect(canonicalRuleInputDigest({ nominalValue: 20, unit: 'mm', inputs: { grade: '轴类' } }))
      .toBe('sha256:0e3c6b7849aaaae8271da4e1f2f84fee081857eec1665c5d44a22c2de311b9b3');
    expect(canonicalRuleInputDigest({ nominalValue: 21, unit: 'mm', inputs: { grade: 'A', process: 2 } })).not.toBe(first);
  });

  it('resolves a declared deterministic rule with versioned provenance', () => {
    const result = resolveToleranceSpec({ intent, spec: spec(), provider, now: () => 7 });
    expect(result.diagnostics).toEqual([]);
    expect(result.spec).toMatchObject({
      mode: 'bilateral', status: 'resolved',
      resolved: {
        upperDeviation: 0.02, lowerDeviation: -0.02,
        evaluatedAt: 7, inputDigest: expect.stringMatching(/^sha256:/),
      },
    });
  });

  it('preserves a standard-backed display preference through resolution', () => {
    const result = resolveToleranceSpec({
      intent,
      spec: spec({
        source: 'standard',
        featureClass: 'external',
        selection: { designation: 'u6', source: 'manual', evidenceRefs: ['manual:u6'] },
        standardRef: { id: 'GB/T 1800', edition: '2020' },
        displayPreference: 'both',
      }),
      provider,
      now: () => 7,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.spec).toMatchObject({
      source: 'standard',
      selection: { designation: 'u6' },
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      displayPreference: 'both',
    });
  });

  it('rejects unknown versions, invalid results, and AI numeric authority', () => {
    expect(resolveToleranceSpec({
      intent, spec: spec({ ruleRef: { id: 'fixture-rule', version: '2' } }), provider, now: () => 1,
    }).diagnostics[0]?.code).toBe('TOLERANCE_RULE_VERSION_MISMATCH');
    expect(resolveToleranceSpec({
      intent, spec: spec(), provider: { ...provider, evaluate: () => ({ mode: 'limits', upperLimit: 1, lowerLimit: 2 }) }, now: () => 1,
    }).diagnostics[0]?.code).toBe('TOLERANCE_RESULT_INVALID');
    expect(resolveToleranceSpec({
      intent, spec: spec(), provider: { ...provider, evaluate: () => ({ mode: 'bilateral', upperDeviation: -0.02, lowerDeviation: 0.02 }) }, now: () => 1,
    }).diagnostics[0]?.code).toBe('TOLERANCE_RESULT_INVALID');
    expect(resolveToleranceSpec({
      intent, spec: spec({ source: 'ai-candidate' }), provider, now: () => 1,
    }).diagnostics[0]?.code).toBe('TOLERANCE_AI_AUTHORITY_FORBIDDEN');
  });
});
