// SPDX-License-Identifier: Apache-2.0

import type { AnnotationId, AnnotationNode, GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import {
  applySingleTolerance,
  axialDimensionIntentId,
  clearToleranceOverride,
  projectEngineeringAnnotations,
  projectAxialDimensionScheme,
  setToleranceOverride,
  type AxialDimensionScheme,
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
  it.each([undefined, 'automatic', 'manual'] as const)('retains explicit text under %s layout when applying a tolerance or repeating projection', (mode) => {
    const node = existing();
    if (node.type !== 'dimension') throw new Error('fixture');
    node.displayText = 'CUSTOM 20';
    if (mode !== undefined) node.layout = { mode, generatedText: '20' };
    const result = projectEngineeringAnnotations({ draft: draft(), orderedIntentIds: ['intent-a'], existingAnnotations: [node] });
    expect(result.annotations[0].displayText).toBe('CUSTOM 20');
    expect(result.annotations[0].toleranceProjection).toMatchObject({ upperDeviation: .02, lowerDeviation: -.01 });
  });

  it('marks freshly generated placements and their label baseline as automatic', () => {
    const result = projectEngineeringAnnotations({ draft: draft(), orderedIntentIds: ['intent-a'], existingAnnotations: [] });
    expect(result.annotations[0]).toMatchObject({ layout: { mode: 'automatic', generatedText: '20' } });
  });

  it.each([undefined, 'automatic', 'manual'] as const)('preserves %s placement ownership when projecting a tolerance', (mode) => {
    const placed = existing();
    if (placed.type !== 'dimension') throw new Error('fixture');
    if (mode !== undefined) placed.layout = { mode, generatedText: '20' };
    const result = projectEngineeringAnnotations({ draft: draft(), orderedIntentIds: ['intent-a'], existingAnnotations: [placed] });
    expect(result.annotations[0]?.textPosition).toEqual(placed.textPosition);
    expect(result.annotations[0]?.definitionPoints).toEqual(placed.definitionPoints);
    expect(result.annotations[0]?.layout).toEqual(placed.layout);
    if (mode === undefined) expect(result.annotations[0]).not.toHaveProperty('layout');
  });

  it('projects a resolved axial intent with a persisted standard tolerance', () => {
    const scheme: AxialDimensionScheme = {
      version: 1,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      policy: { id: 'shaft-hierarchical-dimensioning-v1', version: '1' },
      inputDigest: 'sha256:resolved-axial',
      topology: {
        drawingRef: { drawingId: 'drawing-1', revision: 1 },
        axis: {
          origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20,
          orientation: 'forward', geometryNodeIds: ['line-a'],
        },
        unit: 'mm',
        stations: [
          { id: 'station-0', coordinate: 0, sourceCoordinate: 0, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['line-a'], evidenceIds: [] },
          { id: 'station-20', coordinate: 20, sourceCoordinate: 20, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['line-a'], evidenceIds: [] },
        ],
        elementarySpans: [],
      },
      evidence: [],
      candidates: [{
        id: 'candidate:resolved', startStationId: 'station-0', endStationId: 'station-20', nominalValue: 20,
        roles: ['overall'], evidenceIds: [], required: true,
      }],
      displayedCandidateIds: ['candidate:resolved'], closureCandidateIds: [], chains: [],
      decisions: [{
        candidateId: 'candidate:resolved', decision: 'displayed', score: 1,
        features: [], reasonCodes: ['required'],
      }],
      diagnostics: [], status: 'resolved',
    };
    const intentId = axialDimensionIntentId('candidate:resolved');
    const axial = projectAxialDimensionScheme({ scheme });
    expect(axial.intents[0]?.status).toBe('resolved');
    const persisted = applySingleTolerance(axial, {
      designation: 'u6', featureClass: 'external', basicSize: 20, unit: 'mm',
      upperDeviation: .044, lowerDeviation: .033, upperLimitSize: 20.044, lowerLimitSize: 20.033,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:u6' },
    }, {
      dimensionIntentId: intentId, selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [],
    });
    const placed = existing();
    if (placed.type !== 'dimension') throw new Error('fixture');
    placed.engineeringIntentId = intentId;

    const result = projectEngineeringAnnotations({
      draft: persisted, orderedIntentIds: [intentId], existingAnnotations: [placed],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.annotations).toEqual([
      expect.objectContaining({
        id: 'annotation-existing', engineeringIntentId: intentId,
        textPosition: [10, 5], definitionPoints: [[0, 0], [20, 0]],
        toleranceProjection: expect.objectContaining({
          source: 'standard', status: 'resolved', featureClass: 'external', fitDesignation: 'u6',
          upperDeviation: .044, lowerDeviation: .033,
        }),
      }),
    ]);
  });

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

  it('keeps standard-provider deviations in millimetres when projecting an inch intent', () => {
    const input = draft();
    input.intents[0]!.nominalValue = .5;
    input.intents[0]!.unit = 'in';
    input.tolerances[0] = {
      ...input.tolerances[0]!, source: 'standard', featureClass: 'internal',
      selection: { designation: 'H7', source: 'manual', evidenceRefs: ['manual:H7'] },
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      inputs: { basicSize: 12.7, featureClass: 'internal', designation: 'H7' },
      resolved: {
        upperDeviation: .018, lowerDeviation: 0, upperLimit: 12.718, lowerLimit: 12.7,
        inputDigest: 'sha256:inch-H7', evaluatedAt: 1,
      },
    };

    const result = projectEngineeringAnnotations({
      draft: input, orderedIntentIds: ['intent-a'], existingAnnotations: [],
    });

    expect(result.annotations[0]).toMatchObject({
      computedValue: .5, unit: 'in',
      toleranceProjection: { upperDeviation: .018, lowerDeviation: 0, unit: 'mm', source: 'standard' },
    });
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

  it.each(['candidate', 'conflict', 'stale'] as const)('does not project a %s intent', (status) => {
    const invalid = draft();
    invalid.intents[0]!.status = status;
    const result = projectEngineeringAnnotations({
      draft: invalid, orderedIntentIds: ['intent-a'], existingAnnotations: [existing()],
    });
    expect(result.annotations).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toContain('ANNOTATION_INTENT_NOT_CONFIRMED');
  });

  it('preserves placement but replaces stale semantic and display payload during reprojection', () => {
    const changed = draft();
    changed.intents[0]!.nominalValue = 21;
    changed.tolerances = [];
    const stale = existing();
    if (stale.type !== 'dimension') throw new Error('fixture');
    stale.displayText = '19';
    stale.layout = { mode: 'automatic', generatedText: '19' };
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
