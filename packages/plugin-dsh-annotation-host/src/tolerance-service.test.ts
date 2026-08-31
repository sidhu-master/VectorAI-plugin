// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import {
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

  it('previews without mutating the plan and applies through shared undo history', () => {
    const { plans, service } = setup();
    const before = plans.get('session');
    expect(service.preview('session', {
      type: 'single', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6',
    })).toMatchObject({
      type: 'single', status: 'resolved', result: { upperDeviation: .044, lowerDeviation: .033 },
    });
    expect(plans.get('session')).toEqual(before);

    service.edit('session', {
      type: 'standard.single.apply', expectedDrawingRef: drawingRef, dimensionIntentId: 'intent-shaft',
      featureClass: 'external', designation: 'u6', selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    });
    expect(plans.undo('session', drawingRef).draft).toEqual(before.draft);
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
      type: 'fit', expectedDrawingRef: drawingRef, holeDimensionIntentId: 'intent-hole',
      shaftDimensionIntentId: 'intent-shaft', basis: 'hole', designation: 'H7/g6',
    })).toThrow('FIT_PAIR_BASIC_SIZE_MISMATCH');
  });

  it('applies a fit as one undo/redo step while preserving every unrelated annotation family', () => {
    const { plans, service } = setup();
    const before = plans.get('session').draft!;
    const applied = service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
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

  it('opens a confirmed fit as a complete editable draft and restores the confirmation in one undo', () => {
    const { plans, service } = setup();
    service.edit('session', {
      type: 'standard.fit.apply', expectedDrawingRef: drawingRef,
      holeDimensionIntentId: 'intent-hole', shaftDimensionIntentId: 'intent-shaft', basis: 'hole',
      designation: 'H7/g6', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:fit'],
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
      featureClass: 'external', designation: 'u6', selectionSource: 'ai-recommended', displayPreference: 'both',
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
      featureClass: 'external', designation: 'u6', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: ['manual:u6'],
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
