// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { validateEngineeringDraft, type EngineeringAnnotationDraft } from '../index';

function validDraft(): EngineeringAnnotationDraft {
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing-1', revision: 1 },
    datums: [{
      id: 'datum-a', drawingRef: { drawingId: 'drawing-1', revision: 1 },
      name: 'A', geometryId: 'line-1' as GeometryId, anchor: { kind: 'start' },
      role: 'primary', source: 'manual', status: 'confirmed', evidenceIds: ['manual:datum-a'],
    }],
    intents: [{
      id: 'intent-component', drawingRef: { drawingId: 'drawing-1', revision: 1 },
      kind: 'linear', targets: [{ geometryId: 'line-1' as GeometryId, anchor: { kind: 'end' } }],
      datumIds: ['datum-a'], nominalValue: 20, unit: 'mm', functionalRole: 'process',
      source: 'geometry', status: 'confirmed', evidenceIds: ['geometry:line-1'],
    }, {
      id: 'intent-closure', drawingRef: { drawingId: 'drawing-1', revision: 1 },
      kind: 'linear', targets: [{ geometryId: 'line-2' as GeometryId, anchor: { kind: 'end' } }],
      datumIds: ['datum-a'], nominalValue: 20, unit: 'mm', functionalRole: 'closure',
      source: 'document', status: 'confirmed', evidenceIds: ['document:closure'],
    }],
    tolerances: [{
      id: 'tolerance-component', dimensionIntentId: 'intent-component',
      mode: 'bilateral', source: 'manual', inputs: {},
      resolved: {
        upperDeviation: 0.02, lowerDeviation: -0.02,
        inputDigest: 'sha256:manual', evaluatedAt: 1,
      },
      status: 'confirmed', evidenceIds: ['manual:tolerance'], diagnostics: [],
    }],
    chains: [{
      id: 'chain-1', drawingRef: { drawingId: 'drawing-1', revision: 1 },
      datumIds: ['datum-a'],
      members: [
        { dimensionIntentId: 'intent-component', coefficient: 1, role: 'component' },
        { dimensionIntentId: 'intent-closure', coefficient: -1, role: 'closure' },
      ],
      equation: { closureIntentId: 'intent-closure' },
      analysisMode: 'worst-case', status: 'confirmed',
      evidenceIds: ['manual:chain'], diagnostics: [],
    }],
    dependencies: [{
      beforeIntentId: 'intent-component', afterIntentId: 'intent-closure',
      reason: 'component-before-closure', evidenceIds: ['manual:order'],
    }],
    diagnostics: [],
  };
}

describe('engineering dimension domain invariants', () => {
  it('accepts a complete revision-bound dimension chain', () => {
    expect(validateEngineeringDraft(validDraft())).toEqual([]);
  });

  it('reports every broken identity and chain invariant deterministically', () => {
    const draft = validDraft();
    draft.intents.push(structuredClone(draft.intents[0]!));
    draft.chains[0]!.members[0]!.coefficient = 0 as 1;
    draft.chains[0]!.equation.closureIntentId = 'missing-intent';
    draft.datums[0]!.status = 'stale';
    draft.tolerances[0]!.resolved = undefined;
    expect(validateEngineeringDraft(draft).map(({ code }) => code)).toEqual([
      'DIMENSION_ID_DUPLICATE',
      'DIMENSION_DATUM_STALE',
      'TOLERANCE_RESULT_REQUIRED',
      'DIMENSION_CHAIN_COEFFICIENT_INVALID',
      'DIMENSION_CHAIN_CLOSURE_UNKNOWN',
    ]);
  });

  it('rejects references to missing datums and dimensions', () => {
    const draft = validDraft();
    draft.intents[0]!.datumIds = ['missing-datum'];
    draft.dependencies[0]!.beforeIntentId = 'missing-intent';
    expect(validateEngineeringDraft(draft)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DIMENSION_DATUM_UNKNOWN' }),
      expect.objectContaining({ code: 'DIMENSION_DEPENDENCY_UNKNOWN' }),
    ]));
  });
});
