// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import {
  canonicalRuleInputDigest,
  createGbt1800Provider,
  type EngineeringAnnotationDraft,
  type ToleranceStandardProvider,
} from '@vectorai/engineering-annotation';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DimensionPlanStore, FileDimensionPlanStorage } from './dimension-plan-store';
import { createToleranceReconciler, ToleranceService } from './tolerance-service';

const drawingRef = { drawingId: 'drawing-1', revision: 1 } as const;

function inputDigest(featureClass: 'internal' | 'external', designation: string, basicSize = 13): string {
  return canonicalRuleInputDigest({
    nominalValue: basicSize, unit: 'mm',
    inputs: { standardId: 'GB/T 1800', edition: '2020', featureClass, designation },
  });
}

function fitInputDigests(basicSize = 13) {
  return {
    expectedHoleInputDigest: inputDigest('internal', 'H7', basicSize),
    expectedShaftInputDigest: inputDigest('external', 'g6', basicSize),
  };
}

function draft(holeSize = 13, shaftSize = 13): EngineeringAnnotationDraft {
  return {
    version: 1,
    drawingRef,
    datums: [{
      id: 'datum:A', drawingRef, name: 'A', geometryId: 'line-datum' as GeometryId,
      anchor: { kind: 'start' }, role: 'primary', source: 'manual', status: 'confirmed', evidenceIds: ['manual:datum'],
    }],
    intents: [{
      id: 'intent-hole', drawingRef, kind: 'diameter',
      targets: [{ geometryId: 'circle-hole' as GeometryId, anchor: { kind: 'center' } }], datumIds: [],
      nominalValue: holeSize, unit: 'mm', functionalRole: 'assembly', source: 'manual', status: 'confirmed', evidenceIds: [],
    }, {
      id: 'intent-shaft', drawingRef, kind: 'diameter',
      targets: [{ geometryId: 'circle-shaft' as GeometryId, anchor: { kind: 'center' } }], datumIds: [],
      nominalValue: shaftSize, unit: 'mm', functionalRole: 'assembly', source: 'manual', status: 'confirmed', evidenceIds: [],
    }, {
      id: 'intent-opening-angle', drawingRef, kind: 'angular',
      targets: [{ geometryId: 'line-angle' as GeometryId, anchor: { kind: 'end' } }], datumIds: [],
      nominalValue: 45, unit: 'deg', functionalRole: 'inspection', source: 'geometry', status: 'resolved', evidenceIds: [],
    }],
    tolerances: [], fitAssignments: [],
    geometricTolerances: [{
      id: 'gdt:runout', drawingRef, characteristic: 'circular-runout',
      controlledTargets: [{ geometryId: 'circle-shaft' as GeometryId, anchor: { kind: 'center' } }],
      toleranceZone: { shape: 'linear' }, datumReferenceFrame: [{ datumId: 'datum:A' }],
      computed: { status: 'resolved', value: .01, unit: 'mm', diagnostics: [] },
      source: 'manual', status: 'confirmed', evidenceIds: [],
    }],
    chains: [], dependencies: [], diagnostics: [],
  };
}

function setup(provider: ToleranceStandardProvider = createGbt1800Provider()) {
  const plans = new DimensionPlanStore(
    undefined,
    { now: () => 7, id: () => 'revision-1' },
    createToleranceReconciler(provider),
  );
  plans.begin('session', drawingRef);
  plans.setDraft('session', draft());
  return { plans, service: new ToleranceService(plans, provider) };
}

function setupStaleFit() {
  const state = setup();
  state.service.edit('session', {
    type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
    holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
    designation: 'H7/g6', ...fitInputDigests(), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
  });
  const changed = state.plans.get('session').draft as unknown as EngineeringAnnotationDraft;
  changed.intents.find(({ id }) => id === 'intent-shaft')!.nominalValue = 14;
  state.plans.setDraft('session', changed);
  return state;
}

describe('ToleranceService', () => {
  it('queries partial catalog metadata and validates the active drawing and intent', () => {
    const { service } = setup();
    expect(service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    })).toMatchObject({
      drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      datasetMetadata: { completeness: 'partial', catalogClassification: 'unverified' },
      bands: expect.arrayContaining([{ designation: 'u6', featureClass: 'external', category: 'unknown', available: true }]),
    });
    expect(() => service.query('session', {
      expectedDrawingRef: { ...drawingRef, revision: 2 }, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    })).toThrow('ANNOTATION_PLAN_DRAWING_STALE');
    expect(() => service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'missing', featureClass: 'external',
    })).toThrow('TOLERANCE_INTENT_UNKNOWN');
  });

  it('rejects querying a stored standard target under another feature class', () => {
    const { service } = setup();
    service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    });

    expect(() => service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'internal',
    })).toThrow('TOLERANCE_FEATURE_CLASS_MISMATCH');
  });

  it('hydrates the stored display preference and override in the matching catalog', () => {
    const { service } = setup();
    service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    });
    service.edit('session', {
      type: 'standard.override.set', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      upperDeviation: .05, lowerDeviation: .04,
    });

    expect(service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    }).selection).toEqual({
      designation: 'u6', source: 'manual', evidenceRefs: ['manual:u6'], displayPreference: 'both',
      override: { upperDeviation: .05, lowerDeviation: .04 },
    });
  });

  it('exposes complete fit hydration metadata from either saved member', () => {
    const { plans, service } = setup();
    const mixed = draft(.5, 12.7);
    mixed.intents[0]!.unit = 'in';
    plans.setDraft('session', mixed);
    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(12.7), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:fit'],
    });
    service.edit('session', {
      type: 'standard.override.set', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      upperDeviation: -.002, lowerDeviation: -.01,
    });

    const expectedFit = {
      fitGroupId: 'fit:intent-hole:intent-shaft', basis: 'hole', designation: 'H7/g6',
      holeDimensionIntentId: 'intent-hole', holeFeatureClass: 'internal', holeDesignation: 'H7',
      shaftDimensionIntentId: 'intent-shaft', shaftFeatureClass: 'external', shaftDesignation: 'g6',
      holeTarget: {
        dimensionIntentId: 'intent-hole', label: '⌀0.5 in', basicSize: 12.7, unit: 'mm', featureClass: 'internal',
      },
      shaftTarget: {
        dimensionIntentId: 'intent-shaft', label: '⌀12.7 mm', basicSize: 12.7, unit: 'mm', featureClass: 'external',
      },
      shaftOverride: { upperDeviation: -.002, lowerDeviation: -.01 },
      result: {
        designation: 'H7/g6', basis: 'hole', fitType: 'clearance',
        minimumClearance: .002, maximumClearance: .028,
        hole: { designation: 'H7', basicSize: 12.7, upperDeviation: .018, lowerDeviation: 0 },
        shaft: { designation: 'g6', basicSize: 12.7, upperDeviation: -.002, lowerDeviation: -.01 },
      },
    } as const;
    const fromHole = service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole', featureClass: 'internal',
    });
    const fromShaft = service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    });
    expect(fromHole.selection).toMatchObject({ designation: 'H7/g6', fit: expectedFit });
    expect(fromShaft.selection).toMatchObject({ designation: 'H7/g6', fit: expectedFit });
    expect(fromHole.fitBands).toMatchObject({
      internal: expect.arrayContaining([expect.objectContaining({ designation: 'H7', featureClass: 'internal', available: true })]),
      external: expect.arrayContaining([expect.objectContaining({ designation: 'g6', featureClass: 'external', available: true })]),
    });
    expect(fromShaft.selection?.fit).toEqual(fromHole.selection?.fit);

    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(12.7), selectionSource: 'manual', displayPreference: 'designation',
      evidenceRefs: ['manual:fit'],
    });
    expect(service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    }).selection).toMatchObject({
      displayPreference: 'designation',
      override: { upperDeviation: -.002, lowerDeviation: -.01 },
      fit: {
        shaftOverride: { upperDeviation: -.002, lowerDeviation: -.01 },
        result: { minimumClearance: .002, maximumClearance: .028 },
      },
    });
  });

  it('previews without mutating the plan and applies through shared undo history', () => {
    const { plans, service } = setup();
    const before = plans.get('session');
    const preview = service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6',
    });
    expect(preview).toMatchObject({
      type: 'single', status: 'resolved', result: { basicSize: 13, upperDeviation: .044, lowerDeviation: .033 },
    });
    if (preview.type !== 'single') throw new Error('expected single preview');
    expect(preview.result.toleranceMagnitude).toBeCloseTo(.011);
    expect(plans.get('session')).toEqual(before);

    service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: preview.result.ruleRef.inputDigest, selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    });
    expect(plans.undo('session', drawingRef).draft).toEqual(before.draft);
  });

  it('queries, previews, and applies H7, g6, and u6 for a 0.5 inch intent through the millimetre provider boundary', () => {
    const { plans, service } = setup();
    const imperial = draft(.5, .5);
    imperial.intents[0]!.unit = 'in';
    imperial.intents[1]!.unit = 'in';
    plans.setDraft('session', imperial);

    expect(service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole', featureClass: 'internal',
    }).bands).toContainEqual(expect.objectContaining({ designation: 'H7', available: true }));
    expect(service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    }).bands).toEqual(expect.arrayContaining([
      expect.objectContaining({ designation: 'g6', available: true }),
      expect.objectContaining({ designation: 'u6', available: true }),
    ]));

    const h7 = service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole',
      featureClass: 'internal', designation: 'H7',
    });
    const g6 = service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'g6',
    });
    expect(h7).toMatchObject({ result: { basicSize: 12.7, unit: 'mm', upperDeviation: .018, lowerDeviation: 0 } });
    expect(g6).toMatchObject({ result: { basicSize: 12.7, unit: 'mm', upperDeviation: -.006, lowerDeviation: -.017 } });

    const applied = service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6', 12.7), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    });
    expect(applied.draft?.tolerances[0]).toMatchObject({
      inputs: { basicSize: 12.7 }, resolved: { upperDeviation: .044, lowerDeviation: .033 },
    });
    const stored = structuredClone(applied.draft!.tolerances[0]!);
    expect(stored.resolved?.inputDigest).toBe(canonicalRuleInputDigest({
      nominalValue: 12.7, unit: 'mm',
      inputs: {
        standardId: 'GB/T 1800', edition: '2020', featureClass: 'external', designation: 'u6',
      },
    }));
    const equivalent = applied.draft as unknown as EngineeringAnnotationDraft;
    equivalent.intents[1]!.nominalValue = 12.7;
    equivalent.intents[1]!.unit = 'mm';
    plans.setDraft('session', equivalent);
    expect(plans.get('session').draft?.tolerances[0]).toEqual(stored);
  });

  it('previews and applies a fit to equal physical sizes expressed as inches and millimetres', () => {
    const { plans, service } = setup();
    const mixed = draft(.5, 12.7);
    mixed.intents[0]!.unit = 'in';
    plans.setDraft('session', mixed);

    expect(service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    })).toMatchObject({ result: { hole: { basicSize: 12.7 }, shaft: { basicSize: 12.7 } } });

    const applied = service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(12.7), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
    });
    expect(applied.draft?.tolerances).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimensionIntentId: 'intent-hole', inputs: expect.objectContaining({ basicSize: 12.7 }) }),
      expect.objectContaining({ dimensionIntentId: 'intent-shaft', inputs: expect.objectContaining({ basicSize: 12.7 }) }),
    ]));
  });

  it('recovers an inch standard tolerance after nominal changes', () => {
    const { plans, service } = setup();
    const imperial = draft(.5, 12.7);
    imperial.intents[0]!.unit = 'in';
    plans.setDraft('session', imperial);

    service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole',
      featureClass: 'internal', designation: 'H7', expectedInputDigest: inputDigest('internal', 'H7', 12.7), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:H7'],
    });
    const unsupported = plans.get('session').draft as unknown as EngineeringAnnotationDraft;
    unsupported.intents[0]!.nominalValue = 20;
    plans.setDraft('session', unsupported);
    expect(plans.get('session').draft?.tolerances[0]).toMatchObject({
      status: 'stale', inputs: { basicSize: 508 },
    });

    const restored = plans.get('session').draft as unknown as EngineeringAnnotationDraft;
    restored.intents[0]!.nominalValue = .5;
    plans.setDraft('session', restored);
    expect(plans.get('session').draft?.tolerances[0]).toMatchObject({
      status: 'resolved', inputs: { basicSize: 12.7 }, resolved: { upperDeviation: .018, lowerDeviation: 0 },
    });
  });

  it('stores canonical provider sizes when an inch fit becomes stale', () => {
    const { plans, service } = setup();
    const imperial = draft(.5, .5);
    imperial.intents[0]!.unit = 'in';
    imperial.intents[1]!.unit = 'in';
    plans.setDraft('session', imperial);
    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(12.7), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
    });

    const changed = plans.get('session').draft as unknown as EngineeringAnnotationDraft;
    changed.intents[1]!.nominalValue = .6;
    plans.setDraft('session', changed);

    expect(plans.get('session').draft?.tolerances).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimensionIntentId: 'intent-hole', status: 'stale', inputs: expect.objectContaining({ basicSize: 12.7 }) }),
      expect.objectContaining({ dimensionIntentId: 'intent-shaft', status: 'stale', inputs: expect.objectContaining({ basicSize: 15.24 }) }),
    ]));
  });

  it('returns Host-derived tolerance magnitudes for both fit members', () => {
    const { service } = setup();
    const preview = service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    });
    if (preview.type !== 'fit') throw new Error('expected fit preview');
    expect(preview.result.hole.toleranceMagnitude).toBeCloseTo(
      preview.result.hole.upperDeviation - preview.result.hole.lowerDeviation,
    );
    expect(preview.result.shaft.toleranceMagnitude).toBeCloseTo(
      preview.result.shaft.upperDeviation - preview.result.shaft.lowerDeviation,
    );
  });

  it('rejects a self-consistent provider result that does not match the apply request', () => {
    const delegate = createGbt1800Provider();
    const provider: ToleranceStandardProvider = {
      ...delegate,
      resolveBand({ basicSize }) {
        return {
          ...delegate.resolveBand({ basicSize, featureClass: 'external', designation: 'h6' }),
          ruleRef: {
            id: 'GB/T 1800', version: '1',
            inputDigest: canonicalRuleInputDigest({
              nominalValue: basicSize, unit: 'mm',
              inputs: { standardId: 'GB/T 1800', edition: '2020', featureClass: 'external', designation: 'h6' },
            }),
          },
        };
      },
    };
    const { service } = setup(provider);

    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    })).toThrow('TOLERANCE_PROVIDER_RESULT_MISMATCH');
  });

  it('rejects unsupported ranges, stale refs, and unequal fit sizes', () => {
    const { plans, service } = setup();
    const oversized = draft(501, 501);
    plans.setDraft('session', oversized);
    expect(() => service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6',
    })).toThrow('TOLERANCE_SIZE_RANGE_UNSUPPORTED');
    expect(() => service.preview('session', {
      type: 'single', expectedDrawingRef: { ...drawingRef, revision: 2 }, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6',
    })).toThrow('ANNOTATION_PLAN_DRAWING_STALE');

    plans.setDraft('session', draft(13, 14));
    expect(() => service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    })).toThrow('FIT_PAIR_BASIC_SIZE_MISMATCH');
  });

  it('is the final authority for fit feature roles and preserves its diagnostic', () => {
    const { service } = setup();
    expect(() => service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'internal',
      basis: 'hole', designation: 'H7/g6',
    })).toThrow('FIT_PAIR_CLASS_INCOMPATIBLE');
  });

  it('rejects unsupported feature kinds before catalog, preview, or fit resolution', () => {
    const { plans, service } = setup();
    const unsupported = draft();
    unsupported.intents.push({
      ...structuredClone(unsupported.intents[1]!), id: 'intent-radius', kind: 'radius', nominalValue: 13,
    });
    plans.setDraft('session', unsupported);

    expect(() => service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-opening-angle', featureClass: 'external',
    })).toThrow('TOLERANCE_FEATURE_UNSUPPORTED');
    expect(() => service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-radius',
      featureClass: 'external', designation: 'u6',
    })).toThrow('TOLERANCE_FEATURE_UNSUPPORTED');
    expect(() => service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-radius', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    })).toThrow('TOLERANCE_FEATURE_UNSUPPORTED');
  });

  it('binds hostile direct-contract feature classes to existing domain evidence', () => {
    const { plans, service } = setup();
    service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'),
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:u6'],
    });

    expect(() => service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'internal',
    })).toThrow('TOLERANCE_FEATURE_CLASS_MISMATCH');
    expect(() => service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'internal', designation: 'H7',
    })).toThrow('TOLERANCE_FEATURE_CLASS_MISMATCH');
    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'internal', designation: 'H7', expectedInputDigest: inputDigest('internal', 'H7'),
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [],
    })).toThrow('TOLERANCE_FEATURE_CLASS_MISMATCH');

    const stale = plans.get('session').draft as unknown as EngineeringAnnotationDraft;
    stale.tolerances[0]!.status = 'stale';
    plans.setDraft('session', stale);
    expect(() => service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'internal',
    })).toThrow('TOLERANCE_FEATURE_CLASS_MISMATCH');
  });

  it('does not turn two evidenced external members into a fit through hostile caller labels', () => {
    const { service } = setup();
    for (const dimensionIntentId of ['intent-hole', 'intent-shaft']) {
      service.edit('session', {
        type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId,
        featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'),
        selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [],
      });
    }

    expect(() => service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    })).toThrow('TOLERANCE_FEATURE_CLASS_MISMATCH');
  });

  it('rejects apply when the nominal changed at the same drawing ref after preview', () => {
    const { plans, service } = setup();
    const preview = service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6',
    });
    if (preview.type !== 'single') throw new Error('expected single preview');
    const changed = plans.get('session').draft as unknown as EngineeringAnnotationDraft;
    changed.intents.find(({ id }) => id === 'intent-shaft')!.nominalValue = 14;
    plans.setDraft('session', changed);

    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: preview.result.ruleRef.inputDigest,
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [],
    } as never)).toThrow('TOLERANCE_TARGET_STALE');
    expect(plans.get('session').draft?.tolerances).toEqual([]);
  });

  it('rejects fit apply with the same stale diagnostic when either member changed after preview', () => {
    const { plans, service } = setup();
    const preview = service.preview('session', {
      type: 'fit', expectedDrawingRef: drawingRef,
      primaryDimensionIntentId: 'intent-hole', primaryFeatureClass: 'internal',
      secondaryDimensionIntentId: 'intent-shaft', secondaryFeatureClass: 'external',
      basis: 'hole', designation: 'H7/g6',
    });
    if (preview.type !== 'fit') throw new Error('expected fit preview');
    const changed = plans.get('session').draft as unknown as EngineeringAnnotationDraft;
    changed.intents.find(({ id }) => id === 'intent-shaft')!.nominalValue = 14;
    plans.setDraft('session', changed);

    expect(() => service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6',
      expectedHoleInputDigest: preview.result.hole.ruleRef.inputDigest,
      expectedShaftInputDigest: preview.result.shaft.ruleRef.inputDigest,
      selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [],
    })).toThrow('TOLERANCE_TARGET_STALE');
    expect(plans.get('session').draft?.tolerances).toEqual([]);
  });

  it('applies a fit as one undo/redo step while preserving every unrelated annotation family', () => {
    const { plans, service } = setup();
    const before = plans.get('session').draft!;
    const applied = service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
    });

    expect(applied.draft).toMatchObject({
      datums: before.datums, geometricTolerances: before.geometricTolerances,
      intents: expect.arrayContaining([
        expect.objectContaining({ id: 'intent-opening-angle', kind: 'angular' }),
        expect.objectContaining({ id: 'intent-hole', kind: 'diameter' }),
        expect.objectContaining({ id: 'intent-shaft', kind: 'diameter' }),
      ]),
      fitAssignments: [{ fitGroupId: 'fit:intent-hole:intent-shaft', designation: 'H7/g6' }],
    });
    expect(plans.undo('session', drawingRef).draft).toEqual(before);
    expect(plans.redo('session', drawingRef).draft?.fitAssignments).toHaveLength(1);
  });

  it('rejects single-sided standard or manual replacement of an active fit member', () => {
    const { plans, service } = setup();
    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
    });
    const before = plans.get('session');

    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    })).toThrow('FIT_PAIR_TARGET_CONFLICT');
    expect(plans.get('session')).toEqual(before);

    expect(() => service.edit('session', {
      type: 'manual.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole', mode: 'bilateral',
      upperDeviation: .02, lowerDeviation: 0, displayPreference: 'deviations', evidenceRefs: ['manual:deviation'],
    })).toThrow('FIT_PAIR_TARGET_CONFLICT');
    expect(plans.get('session')).toEqual(before);
  });

  it('rejects standard.single replacement of one stale fit member', () => {
    const { plans, service } = setupStaleFit();
    const before = plans.get('session');
    expect(before.draft?.fitAssignments).toEqual([]);
    expect(before.draft?.tolerances.every(({ fitGroupId, status }) => fitGroupId !== undefined && status === 'stale')).toBe(true);

    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6', 14), selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    })).toThrow('FIT_PAIR_TARGET_CONFLICT');
    expect(plans.get('session')).toEqual(before);
  });

  it('rejects manual replacement of one stale fit member', () => {
    const { plans, service } = setupStaleFit();
    const before = plans.get('session');
    expect(before.draft?.fitAssignments).toEqual([]);
    expect(before.draft?.tolerances.every(({ fitGroupId, status }) => fitGroupId !== undefined && status === 'stale')).toBe(true);

    expect(() => service.edit('session', {
      type: 'manual.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole', mode: 'bilateral',
      upperDeviation: .02, lowerDeviation: 0, displayPreference: 'deviations', evidenceRefs: ['manual:deviation'],
    })).toThrow('FIT_PAIR_TARGET_CONFLICT');
    expect(plans.get('session')).toEqual(before);
  });

  it('opens a confirmed fit as a complete editable draft and restores the confirmation in one undo', () => {
    const { plans, service } = setup();
    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
    });
    const confirmed = plans.confirm('session', drawingRef);

    const edited = service.edit('session', {
      type: 'standard.override.set', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-hole',
      upperDeviation: .02, lowerDeviation: .001,
    });
    expect(edited).toMatchObject({
      phase: 'editing',
      confirmed: { id: 'revision-1', fitAssignments: [{ designation: 'H7/g6' }] },
      draft: {
        baseRevisionId: 'revision-1', fitAssignments: [{ designation: 'H7/g6' }],
        datums: confirmed.confirmed?.datums, geometricTolerances: confirmed.confirmed?.geometricTolerances,
      },
    });
    expect(plans.undo('session', drawingRef)).toMatchObject({
      phase: 'confirmed', confirmed: { id: 'revision-1', fitAssignments: [{ designation: 'H7/g6' }] },
    });
  });

  it('updates fit arithmetic atomically for override set, clear, undo, redo, and confirmation', () => {
    const { plans, service } = setup();
    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', ...fitInputDigests(), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
    });
    const baseline = plans.get('session').draft!.fitAssignments[0]!;

    const overridden = service.edit('session', {
      type: 'standard.override.set', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      upperDeviation: .01, lowerDeviation: .005,
    });
    expect(overridden.draft?.fitAssignments[0]).toMatchObject({
      fitType: 'transition', minimumClearance: expect.closeTo(-.01, 12), maximumClearance: expect.closeTo(.013, 12),
    });
    expect(plans.undo('session', drawingRef).draft?.fitAssignments[0]).toEqual(baseline);
    expect(plans.redo('session', drawingRef).draft?.fitAssignments[0]).toEqual(overridden.draft?.fitAssignments[0]);

    const cleared = service.edit('session', {
      type: 'standard.override.clear', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
    });
    expect(cleared.draft?.fitAssignments[0]).toEqual(baseline);
    expect(plans.confirm('session', drawingRef)).toMatchObject({
      phase: 'confirmed', confirmed: { fitAssignments: [baseline] },
    });
  });

  it('does not elevate an unevidenced AI designation or accept AI numeric authority', () => {
    const { plans, service } = setup();
    const candidate = draft();
    candidate.tolerances = [{
      id: 'tolerance:ai:intent-shaft', dimensionIntentId: 'intent-shaft', mode: 'bilateral',
      source: 'ai-candidate', featureClass: 'external',
      selection: { designation: 'u6', source: 'ai-recommended', evidenceRefs: [] },
      inputs: { basicSize: 13, designation: 'u6', featureClass: 'external' },
      status: 'candidate', evidenceIds: [], diagnostics: [],
    }];
    plans.setDraft('session', candidate);

    const catalog = service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    });
    expect(catalog).not.toHaveProperty('recommendation');
    expect(plans.get('session').draft?.tolerances[0]).toMatchObject({ source: 'ai-candidate', status: 'candidate' });
    expect(plans.get('session').draft?.tolerances[0]).not.toHaveProperty('resolved');
  });

  it('rejects ai-recommended apply without a matching evidenced active candidate', () => {
    const { plans, service } = setup();
    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'ai-recommended', displayPreference: 'both',
      evidenceRefs: ['invented:evidence'],
    })).toThrow('TOLERANCE_AI_RECOMMENDATION_REQUIRED');

    const ungrounded = draft();
    ungrounded.tolerances = [{
      id: 'tolerance:ai:intent-shaft', dimensionIntentId: 'intent-shaft', mode: 'bilateral',
      source: 'ai-candidate', featureClass: 'external',
      selection: { designation: 'u6', source: 'ai-recommended', evidenceRefs: ['invented:evidence'] },
      inputs: { basicSize: 13, designation: 'u6', featureClass: 'external' },
      status: 'candidate', evidenceIds: [], diagnostics: [],
    }];
    plans.setDraft('session', ungrounded);
    expect(() => service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'ai-recommended', displayPreference: 'both',
      evidenceRefs: ['invented:evidence'],
    })).toThrow('TOLERANCE_AI_RECOMMENDATION_REQUIRED');
  });

  it('surfaces an evidenced AI candidate without numeric fields and resolves it again during Apply', () => {
    const delegate = createGbt1800Provider();
    let resolutionCount = 0;
    const provider: ToleranceStandardProvider = {
      ...delegate,
      resolveBand(request) { resolutionCount += 1; return delegate.resolveBand(request); },
      resolveFit(request) { resolutionCount += 1; return delegate.resolveFit(request); },
    };
    const { plans, service } = setup(provider);
    const candidate = draft();
    candidate.tolerances = [{
      id: 'tolerance:ai:intent-shaft', dimensionIntentId: 'intent-shaft', mode: 'bilateral',
      source: 'ai-candidate', featureClass: 'external',
      selection: { designation: 'u6', source: 'ai-recommended', evidenceRefs: ['document:bearing-seat'] },
      inputs: { basicSize: 13, designation: 'u6', featureClass: 'external' },
      status: 'candidate', evidenceIds: ['document:bearing-seat'], diagnostics: [],
    }];
    plans.setDraft('session', candidate);
    expect(service.query('session', {
      expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft', featureClass: 'external',
    }).recommendation).toEqual({
      designation: 'u6', source: 'ai-recommended', evidenceRefs: ['document:bearing-seat'],
    });
    expect(resolutionCount).toBe(0);

    const applied = service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'ai-recommended', displayPreference: 'both',
      evidenceRefs: ['document:bearing-seat'],
    });
    expect(resolutionCount).toBe(1);
    expect(applied.draft?.tolerances[0]).toMatchObject({
      source: 'standard', selection: { source: 'ai-recommended' },
      resolved: { upperDeviation: .044, lowerDeviation: .033 },
    });
  });

  it('retains recorded provider edition and values across reload until explicit reapply', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vectorai-tolerance-service-'));
    const storage = new FileDimensionPlanStorage(directory);
    const provider = createGbt1800Provider();
    const first = new DimensionPlanStore(storage, { now: () => 7, id: () => 'revision-1' }, createToleranceReconciler(provider));
    first.begin('session', drawingRef);
    first.setDraft('session', draft());
    new ToleranceService(first, provider).edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', expectedInputDigest: inputDigest('external', 'u6'), selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:u6'],
    });
    first.confirm('session', drawingRef);

    const replacement: ToleranceStandardProvider = {
      ...provider,
      standardRef: { id: 'GB/T 1800', edition: 'future' },
      resolveBand: () => { throw new Error('RELOAD_MUST_NOT_RESOLVE'); },
      resolveFit: () => { throw new Error('RELOAD_MUST_NOT_RESOLVE'); },
    };
    const loaded = new DimensionPlanStore(storage, undefined, createToleranceReconciler(replacement)).get('session');
    expect(loaded.confirmed?.tolerances[0]).toMatchObject({
      standardRef: { edition: '2020' }, resolved: { upperDeviation: .044, lowerDeviation: .033 },
    });
  });
});
