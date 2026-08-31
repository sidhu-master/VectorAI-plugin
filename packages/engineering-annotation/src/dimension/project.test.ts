// SPDX-License-Identifier: Apache-2.0

import type { AnnotationId, AnnotationNode, GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import {
  clearToleranceOverride,
  projectEngineeringAnnotations,
  setToleranceOverride,
  type EngineeringAnnotationDraft,
} from '../index';

function draft(): EngineeringAnnotationDraft {
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing-1', revision: 1 },
    datums: [{
      id: 'datum-a', drawingRef: { drawingId: 'drawing-1', revision: 1 }, name: 'A',
      geometryId: 'line-datum' as GeometryId, anchor: { kind: 'start' }, role: 'primary',
      source: 'manual', status: 'confirmed', evidenceIds: ['manual:datum-a'],
    }],
    intents: [{
      id: 'intent-a', drawingRef: { drawingId: 'drawing-1', revision: 1 }, kind: 'linear',
      targets: [{ geometryId: 'line-a' as GeometryId, anchor: { kind: 'end' } }],
      datumIds: ['datum-a'], nominalValue: 20, unit: 'mm', functionalRole: 'functional',
      source: 'document', status: 'confirmed', evidenceIds: ['document:intent-a'],
    }],
    tolerances: [{
      id: 'tolerance-a', dimensionIntentId: 'intent-a', mode: 'bilateral',
      source: 'enterprise-rule', ruleRef: { id: 'rule-a', version: '1' }, inputs: { grade: 'A' },
      resolved: {
        upperDeviation: 0.02, lowerDeviation: -0.01,
        inputDigest: 'sha256:fixture', evaluatedAt: 1,
      },
      status: 'resolved', evidenceIds: ['rule:rule-a@1'], diagnostics: [],
    }],
    fitAssignments: [],
    geometricTolerances: [],
    chains: [{
      id: 'chain-a', drawingRef: { drawingId: 'drawing-1', revision: 1 }, datumIds: ['datum-a'],
      members: [{ dimensionIntentId: 'intent-a', coefficient: 1, role: 'functional' }],
      equation: { closureIntentId: 'intent-a' }, analysisMode: 'reference-only', status: 'resolved',
      evidenceIds: ['manual:chain-a'], diagnostics: [],
    }],
    dependencies: [], diagnostics: [],
  };
}

function existing(): AnnotationNode {
  return {
    id: 'annotation-existing' as AnnotationId, type: 'dimension', visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] }, associationStatus: 'resolved',
    dimensionKind: 'linear', targets: [{ geometryId: 'line-a' as GeometryId, anchor: { kind: 'end' } }],
    computedValue: 20, displayText: '20', unit: 'mm', textPosition: [10, 5],
    definitionPoints: [[0, 0], [20, 0]], engineeringIntentId: 'intent-a',
  };
}

describe('portable engineering annotation projection', () => {
  it('projects confirmed intent, datum, chain, order, and resolved tolerance provenance', () => {
    const input = draft();
    const before = structuredClone(input);
    const result = projectEngineeringAnnotations({
      draft: input, orderedIntentIds: ['intent-a'], existingAnnotations: [existing()],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.annotations).toEqual([
      expect.objectContaining({
        id: 'annotation-existing', engineeringIntentId: 'intent-a', engineeringChainIds: ['chain-a'],
        generationOrder: 0, computedValue: 20, textPosition: [10, 5],
        datumReferences: [{
          datumId: 'datum-a', role: 'primary', geometryId: 'line-datum', anchor: { kind: 'start' },
        }],
        toleranceProjection: {
          mode: 'bilateral', upperDeviation: 0.02, lowerDeviation: -0.01, unit: 'mm',
          status: 'resolved', source: 'enterprise-rule',
          ruleRef: { id: 'rule-a', version: '1', inputDigest: 'sha256:fixture' },
          evidenceRefs: ['rule:rule-a@1'],
        },
        quality: expect.objectContaining({
          status: 'confirmed',
          evidenceRefs: expect.arrayContaining(['document:intent-a', 'manual:datum-a', 'rule:rule-a@1']),
        }),
      }),
    ]);
    expect(input).toEqual(before);
  });

  it('allows a confirmed untoleranced dimension but rejects candidate or unresolved tolerance data', () => {
    const untoleranced = draft();
    untoleranced.tolerances = [];
    expect(projectEngineeringAnnotations({
      draft: untoleranced, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    }).annotations).toHaveLength(1);

    const invalid = draft();
    invalid.intents[0]!.status = 'candidate';
    invalid.tolerances[0]!.resolved = undefined;
    const result = projectEngineeringAnnotations({
      draft: invalid, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    });
    expect(result.annotations).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'ANNOTATION_INTENT_NOT_CONFIRMED',
      'TOLERANCE_RESULT_REQUIRED',
    ]);
  });

  it('preserves placement but replaces stale semantic and display payload during reprojection', () => {
    const changed = draft();
    changed.intents[0]!.nominalValue = 21;
    changed.tolerances = [];
    const stale = existing();
    if (stale.type !== 'dimension') throw new Error('fixture');
    stale.displayText = '19';
    stale.observedValue = 19;
    stale.tolerance = { upper: 0.5, lower: -0.5 };
    stale.toleranceProjection = {
      mode: 'fit', fitDesignation: 'OLD', unit: 'mm', source: 'manual', status: 'confirmed',
      evidenceRefs: ['manual:old'],
    };
    stale.prefix = 'OLD';
    stale.suffix = 'OLD';

    const result = projectEngineeringAnnotations({
      draft: changed, orderedIntentIds: ['intent-a'], existingAnnotations: [stale],
    });
    expect(result.annotations[0]).toMatchObject({
      id: 'annotation-existing', computedValue: 21, displayText: '21',
      textPosition: [10, 5], definitionPoints: [[0, 0], [20, 0]],
    });
    expect(result.annotations[0]).not.toHaveProperty('observedValue');
    expect(result.annotations[0]).not.toHaveProperty('tolerance');
    expect(result.annotations[0]).not.toHaveProperty('toleranceProjection');
    expect(result.annotations[0]).not.toHaveProperty('prefix');
    expect(result.annotations[0]).not.toHaveProperty('suffix');
  });

  it('does not project a structurally invalid resolved tolerance', () => {
    const invalid = draft();
    invalid.tolerances[0]!.resolved = {
      upperDeviation: 0.02, inputDigest: 'sha256:invalid', evaluatedAt: 1,
    };
    const result = projectEngineeringAnnotations({
      draft: invalid, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    });
    expect(result.annotations).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe('TOLERANCE_RESULT_INVALID');
  });

  it('projects an effective override together with standard selection provenance', () => {
    const input = draft();
    input.tolerances[0] = {
      ...input.tolerances[0]!, source: 'standard',
      featureClass: 'external',
      selection: { designation: 'H7/g6', source: 'ai-recommended', evidenceRefs: ['ai:fit-1'] },
      standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both',
      override: { upperDeviation: .05, lowerDeviation: .04 },
    };

    const result = projectEngineeringAnnotations({
      draft: input, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.annotations[0]?.toleranceProjection).toMatchObject({
      mode: 'bilateral', upperDeviation: .05, lowerDeviation: .04, fitDesignation: 'H7/g6',
      featureClass: 'external', standardRef: { id: 'GB/T 1800', edition: '2020' }, displayPreference: 'both',
      source: 'standard', ruleRef: { id: 'rule-a', version: '1', inputDigest: 'sha256:fixture' },
    });
  });

  it('uses the last duplicate tolerance for override and clear, matching projection', () => {
    const input = draft();
    input.tolerances = [{
      ...input.tolerances[0]!, id: 'tolerance-first',
      resolved: { upperDeviation: .1, lowerDeviation: .09, inputDigest: 'sha256:first', evaluatedAt: 1 },
      override: { upperDeviation: .12, lowerDeviation: .11 },
    }, {
      ...input.tolerances[0]!, id: 'tolerance-last',
      resolved: { upperDeviation: .02, lowerDeviation: -.01, inputDigest: 'sha256:last', evaluatedAt: 1 },
    }];

    const overridden = setToleranceOverride(input, 'intent-a', { upperDeviation: .05, lowerDeviation: .04 });
    expect(projectEngineeringAnnotations({
      draft: overridden, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    }).annotations[0]?.toleranceProjection).toMatchObject({ upperDeviation: .05, lowerDeviation: .04 });
    expect(overridden.tolerances[0]?.override).toEqual({ upperDeviation: .12, lowerDeviation: .11 });

    const cleared = clearToleranceOverride(overridden, 'intent-a');
    expect(projectEngineeringAnnotations({
      draft: cleared, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    }).annotations[0]?.toleranceProjection).toMatchObject({ upperDeviation: .02, lowerDeviation: -.01 });
    expect(cleared.tolerances[0]?.override).toEqual({ upperDeviation: .12, lowerDeviation: .11 });
    expect(cleared.tolerances[1]).not.toHaveProperty('override');
  });
});
