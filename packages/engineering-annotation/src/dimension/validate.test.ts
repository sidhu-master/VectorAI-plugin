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
    fitAssignments: [],
    geometricTolerances: [],
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

  it('rejects resolved tolerance payloads that do not match their declared mode', () => {
    const draft = validDraft();
    draft.tolerances[0]!.mode = 'limits';
    draft.tolerances[0]!.resolved = {
      upperLimit: 19.9, lowerLimit: 20.1, inputDigest: 'sha256:invalid', evaluatedAt: 1,
    };
    expect(validateEngineeringDraft(draft)).toEqual([
      expect.objectContaining({ code: 'TOLERANCE_RESULT_INVALID' }),
    ]);
  });

  it('validates active fit assignments while allowing intentional stale orphan members', () => {
    const active = validDraft();
    active.intents[0]!.id = 'hole';
    active.intents[1]!.id = 'shaft';
    active.tolerances = [
      {
        id: 'fit:pair:hole', dimensionIntentId: 'hole', mode: 'bilateral', source: 'standard',
        featureClass: 'internal', fitGroupId: 'fit:pair',
        selection: { designation: 'H7/g6', source: 'manual', evidenceRefs: [] },
        standardRef: { id: 'GB/T 1800', edition: '2020' }, inputs: {},
        resolved: { upperDeviation: .018, lowerDeviation: 0, fitDesignation: 'H7/g6', inputDigest: 'sha256:hole', evaluatedAt: 1 },
        status: 'resolved', evidenceIds: [], diagnostics: [],
      },
      {
        id: 'fit:pair:shaft', dimensionIntentId: 'shaft', mode: 'bilateral', source: 'standard',
        featureClass: 'external', fitGroupId: 'fit:pair',
        selection: { designation: 'H7/g6', source: 'manual', evidenceRefs: [] },
        standardRef: { id: 'GB/T 1800', edition: '2020' }, inputs: {},
        resolved: { upperDeviation: -.006, lowerDeviation: -.017, fitDesignation: 'H7/g6', inputDigest: 'sha256:shaft', evaluatedAt: 1 },
        status: 'resolved', evidenceIds: [], diagnostics: [],
      },
    ];
    active.fitAssignments = [{
      fitGroupId: 'fit:pair', holeDimensionId: 'hole', shaftDimensionId: 'shaft', basis: 'hole',
      designation: 'H7/g6', fitType: 'clearance', minimumClearance: .006, maximumClearance: .035,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
    }];
    active.chains = [];
    active.dependencies = [];
    expect(validateEngineeringDraft(active)).toEqual([]);

    const inconsistent = structuredClone(active);
    inconsistent.tolerances[1]!.selection!.designation = 'H7/h6';
    expect(validateEngineeringDraft(inconsistent)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FIT_ASSIGNMENT_TOLERANCE_INVALID' }),
    ]));

    const candidateMember = structuredClone(active);
    candidateMember.tolerances[1]!.status = 'candidate';
    expect(validateEngineeringDraft(candidateMember)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FIT_ASSIGNMENT_TOLERANCE_INVALID' }),
    ]));

    const staleArithmetic = structuredClone(active);
    staleArithmetic.tolerances[0]!.override = { upperDeviation: .02, lowerDeviation: .01 };
    expect(validateEngineeringDraft(staleArithmetic)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FIT_ASSIGNMENT_ARITHMETIC_INVALID' }),
    ]));
    staleArithmetic.fitAssignments[0]!.minimumClearance = .016;
    staleArithmetic.fitAssignments[0]!.maximumClearance = .037;
    expect(validateEngineeringDraft(staleArithmetic)).toEqual([]);

    const invertedOverride = structuredClone(active);
    invertedOverride.tolerances[0]!.override = { upperDeviation: -.01, lowerDeviation: .01 };
    invertedOverride.fitAssignments[0]!.minimumClearance = .016;
    invertedOverride.fitAssignments[0]!.maximumClearance = .007;
    invertedOverride.fitAssignments[0]!.fitType = 'clearance';
    expect(validateEngineeringDraft(invertedOverride)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TOLERANCE_DEVIATION_ORDER' }),
    ]));

    const wrongType = structuredClone(active);
    wrongType.fitAssignments[0]!.fitType = 'transition';
    expect(validateEngineeringDraft(wrongType)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FIT_ASSIGNMENT_ARITHMETIC_INVALID' }),
    ]));

    const stale = structuredClone(active);
    stale.fitAssignments = [];
    stale.tolerances = stale.tolerances.map((member) => {
      const next = { ...member, status: 'stale' as const };
      delete next.resolved;
      return next;
    });
    expect(validateEngineeringDraft(stale)).toEqual([]);
  });
});
