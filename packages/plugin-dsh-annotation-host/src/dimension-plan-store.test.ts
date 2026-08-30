// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import {
  projectAxialDimensionScheme,
  type AxialDimensionScheme,
  type EngineeringAnnotationDraft,
} from '@vectorai/engineering-annotation';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DimensionPlanStore, FileDimensionPlanStorage } from './dimension-plan-store';

function draft(nominalValue = 20): EngineeringAnnotationDraft {
  return {
    version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 }, datums: [],
    intents: [{
      id: 'component', drawingRef: { drawingId: 'drawing-1', revision: 1 }, kind: 'linear',
      targets: [{ geometryId: 'line-1' as GeometryId, anchor: { kind: 'end' } }], datumIds: [],
      nominalValue, unit: 'mm', functionalRole: 'process', source: 'manual', status: 'confirmed',
      evidenceIds: ['manual:component'],
    }, {
      id: 'closure', drawingRef: { drawingId: 'drawing-1', revision: 1 }, kind: 'linear',
      targets: [{ geometryId: 'line-2' as GeometryId, anchor: { kind: 'end' } }], datumIds: [],
      nominalValue, unit: 'mm', functionalRole: 'closure', source: 'manual', status: 'confirmed',
      evidenceIds: ['manual:closure'],
    }],
    tolerances: [], geometricTolerances: [],
    chains: [{
      id: 'chain-1', drawingRef: { drawingId: 'drawing-1', revision: 1 }, datumIds: [],
      members: [
        { dimensionIntentId: 'component', coefficient: 1, role: 'component' },
        { dimensionIntentId: 'closure', coefficient: -1, role: 'closure' },
      ],
      equation: { closureIntentId: 'closure' }, analysisMode: 'reference-only', status: 'confirmed',
      evidenceIds: ['manual:chain'], diagnostics: [],
    }],
    dependencies: [{
      beforeIntentId: 'component', afterIntentId: 'closure', reason: 'component-before-closure',
      evidenceIds: ['manual:order'],
    }],
    diagnostics: [],
  };
}

const drawingRef = { drawingId: 'drawing-1', revision: 1 };

function inferredDraft(status: AxialDimensionScheme['status'] = 'resolved'): EngineeringAnnotationDraft {
  const station = (id: string, coordinate: number) => ({
    id, coordinate, sourceCoordinate: coordinate, unit: 'mm' as const,
    kinds: ['shoulder' as const], geometryNodeIds: [`geometry:${id}`], evidenceIds: [],
  });
  const scheme: AxialDimensionScheme = {
    version: 1, drawingRef,
    policy: { id: 'shaft-reference-terminal-closure-v1', version: '1' },
    inputDigest: 'sha256:test-scheme',
    topology: {
      drawingRef,
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' },
      unit: 'mm',
      stations: [station('station:0', 0), station('station:10', 10), station('station:20', 20)],
      elementarySpans: [
        { id: 'span:a', startStationId: 'station:0', endStationId: 'station:10', nominalValue: 10, segmentIds: [], evidenceIds: [] },
        { id: 'span:b', startStationId: 'station:10', endStationId: 'station:20', nominalValue: 10, segmentIds: [], evidenceIds: [] },
      ],
    },
    evidence: [],
    candidates: [
      { id: 'candidate:overall', startStationId: 'station:0', endStationId: 'station:20', nominalValue: 20, roles: ['overall'], evidenceIds: [], required: true },
      { id: 'candidate:local', startStationId: 'station:0', endStationId: 'station:10', nominalValue: 10, roles: ['local'], evidenceIds: [], required: false },
      { id: 'candidate:closure', startStationId: 'station:10', endStationId: 'station:20', nominalValue: 10, roles: ['closure'], evidenceIds: [], required: false },
    ],
    displayedCandidateIds: ['candidate:overall', 'candidate:local'],
    closureCandidateIds: ['candidate:closure'],
    chains: [{
      id: 'chain:overall', parentCandidateId: 'candidate:overall', childCandidateIds: ['candidate:local'],
      closureCandidateId: 'candidate:closure', alternativeClosureCandidateIds: [], status: status === 'resolved' ? 'resolved' : 'needs-review',
    }],
    decisions: [], diagnostics: [], status,
  };
  return projectAxialDimensionScheme({ scheme });
}

describe('DimensionPlanStore', () => {
  it('persists datum label movement directly on a confirmed annotation plan', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    const value = draft();
    value.datums = [{
      id: 'datum:A', drawingRef, name: 'A', geometryId: 'line-1' as GeometryId, anchor: { kind: 'start' },
      role: 'primary', source: 'ai-candidate', status: 'candidate', evidenceIds: [],
    }];
    store.begin('session', drawingRef);
    store.setDraft('session', value);
    store.confirm('session', drawingRef);

    const moved = store.editGeometricTolerance('session', {
      type: 'datum.layout', datumId: 'datum:A', position: [42, -18], expectedDrawingRef: drawingRef,
    });

    expect(moved.phase).toBe('confirmed');
    expect(moved.confirmed?.datums[0]?.labelPosition).toEqual([42, -18]);
  });

  it('persists one dragged geometric-tolerance frame position for every row in its visual group', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    const value = draft();
    value.geometricTolerances = ['gdt:1', 'gdt:2', 'gdt:3'].map((id, index) => ({
      id, drawingRef, characteristic: ['straightness', 'circularity', 'cylindricity'][index] as 'straightness',
      controlledTargets: [{ geometryId: 'line-1' as GeometryId, anchor: { kind: 'end' } }],
      toleranceZone: { shape: 'linear' }, datumReferenceFrame: [],
      computed: { status: 'resolved', value: 0.01, unit: 'mm', diagnostics: [] },
      source: 'ai-candidate', status: 'confirmed', evidenceIds: [],
    }));
    store.begin('session', drawingRef);
    store.setDraft('session', value);
    store.confirm('session', drawingRef);

    const moved = store.editGeometricTolerance('session', {
      type: 'frame.layout', intentIds: ['gdt:1', 'gdt:2', 'gdt:3'], position: [120, 80], expectedDrawingRef: drawingRef,
    } as never);

    expect(moved.phase).toBe('confirmed');
    expect(moved.confirmed?.geometricTolerances.map(({ framePosition, status }) => ({ framePosition, status }))).toEqual([
      { framePosition: [120, 80], status: 'confirmed' },
      { framePosition: [120, 80], status: 'confirmed' },
      { framePosition: [120, 80], status: 'confirmed' },
    ]);
  });

  it('tracks draft edits, confirms atomically, then undoes and redoes confirmation', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    store.begin('session', drawingRef);
    store.setDraft('session', draft());
    store.setDraft('session', draft(21));
    expect(store.undo('session', drawingRef).draft?.intents[0]?.nominalValue).toBe(20);
    store.redo('session', drawingRef);
    const confirmed = store.confirm('session', drawingRef);
    expect(confirmed).toMatchObject({
      phase: 'confirmed', confirmed: {
        id: 'revision-1', generationOrder: ['component', 'closure'], confirmedAt: 7,
      },
    });
    expect(store.undo('session', drawingRef)).toMatchObject({ phase: 'editing', draft: { intents: expect.any(Array) } });
    expect(store.redo('session', drawingRef)).toMatchObject({ phase: 'confirmed', confirmed: { id: 'revision-1' } });
  });

  it('keeps the latest confirmed baseline across undo, edits, cancel, and a new parent revision', () => {
    let nextId = 0;
    const store = new DimensionPlanStore(undefined, { now: () => 7 + nextId, id: () => `revision-${++nextId}` });
    store.begin('session', drawingRef);
    store.setDraft('session', draft());
    store.confirm('session', drawingRef);
    store.undo('session', drawingRef);
    store.setDraft('session', draft(22));
    expect(store.cancel('session', drawingRef)).toMatchObject({ phase: 'confirmed', confirmed: { id: 'revision-1' } });
    store.begin('session', drawingRef);
    store.setDraft('session', draft(23));
    expect(store.confirm('session', drawingRef)).toMatchObject({
      confirmed: { id: 'revision-2', parentRevisionId: 'revision-1' },
    });
  });

  it('rejects stale DrawingRefs, cyclic order, and conflicting plans', () => {
    const store = new DimensionPlanStore();
    store.begin('session', drawingRef);
    expect(() => store.setDraft('session', { ...draft(), drawingRef: { drawingId: 'drawing-1', revision: 2 } })).toThrow('ANNOTATION_PLAN_DRAWING_STALE');
    const invalid = draft();
    invalid.dependencies.push({
      beforeIntentId: 'closure', afterIntentId: 'component', reason: 'explicit-document-order', evidenceIds: ['manual:cycle'],
    });
    invalid.intents[0]!.status = 'conflict';
    store.setDraft('session', invalid);
    expect(() => store.confirm('session', drawingRef)).toThrow('ANNOTATION_PLAN_INVALID');
    expect(() => store.confirm('session', { drawingId: 'drawing-1', revision: 2 })).toThrow('ANNOTATION_PLAN_DRAWING_STALE');
    expect(store.markNeedsRebase('session', { drawingId: 'drawing-1', revision: 2 })).toMatchObject({ phase: 'needs-rebase' });
    expect(() => store.confirm('session', { drawingId: 'drawing-1', revision: 2 })).toThrow('ANNOTATION_PLAN_DRAWING_STALE');
    expect(store.get('session')).toMatchObject({ phase: 'needs-rebase', draft: { drawingRef } });
  });

  it('rejects a draft bound to a superseded second-layer base revision', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    store.begin('session', drawingRef);
    store.setDraft('session', draft());
    store.confirm('session', drawingRef);
    store.begin('session', drawingRef);
    store.setDraft('session', { ...draft(), baseRevisionId: 'older-revision' });
    expect(() => store.confirm('session', drawingRef)).toThrow('ANNOTATION_PLAN_BASE_STALE');
  });

  it('round-trips a strict durable envelope and falls back safely from corrupt data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vectorai-dimension-plan-'));
    const storage = new FileDimensionPlanStorage(directory);
    const first = new DimensionPlanStore(storage, { now: () => 7, id: () => 'revision-1' });
    first.begin('session', drawingRef);
    first.setDraft('session', draft());
    first.confirm('session', drawingRef);
    expect(new DimensionPlanStore(storage).get('session')).toMatchObject({
      phase: 'confirmed', confirmed: { id: 'revision-1' },
    });
    storage.save('corrupt', { snapshot: { version: 99 }, undo: 'bad', redo: [] });
    expect(new DimensionPlanStore(storage).get('corrupt')).toMatchObject({ phase: 'idle', canUndo: false, canRedo: false });
  });

  it('does not publish memory state when durable storage fails', () => {
    let fail = false;
    const storage = { load: () => null, save: () => { if (fail) throw new Error('disk-full'); } };
    const store = new DimensionPlanStore(storage);
    store.begin('session', drawingRef);
    const before = store.get('session');
    fail = true;
    expect(() => store.setDraft('session', draft())).toThrow('disk-full');
    expect(store.get('session')).toEqual(before);
  });

  it('edits an inferred candidate and restores it through undo and redo', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    store.begin('session', drawingRef);
    store.setDraft('session', inferredDraft());
    store.editScheme('session', {
      type: 'candidate.display', candidateId: 'candidate:local', displayed: false, expectedDrawingRef: drawingRef,
    });
    expect(store.get('session').draft?.axialScheme?.displayedCandidateIds).not.toContain('candidate:local');
    expect(store.undo('session', drawingRef).draft?.axialScheme?.displayedCandidateIds).toContain('candidate:local');
    expect(store.redo('session', drawingRef).draft?.axialScheme?.displayedCandidateIds).not.toContain('candidate:local');
  });

  it('persists a candidate layout offset and restores it through undo and redo', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    store.begin('session', drawingRef);
    store.setDraft('session', inferredDraft());
    store.editScheme('session', {
      type: 'candidate.layout', candidateId: 'candidate:local', normalOffset: 12,
      expectedDrawingRef: drawingRef,
    });
    expect(store.get('session').draft?.axialScheme?.layout?.candidateNormalOffsets).toEqual([
      { candidateId: 'candidate:local', normalOffset: 12 },
    ]);
    expect(store.undo('session', drawingRef).draft?.axialScheme?.layout).toBeUndefined();
    expect(store.redo('session', drawingRef).draft?.axialScheme?.layout?.candidateNormalOffsets).toEqual([
      { candidateId: 'candidate:local', normalOffset: 12 },
    ]);
  });

  it('persists one chain-specific group offset and restores it through undo and redo', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    store.begin('session', drawingRef);
    store.setDraft('session', inferredDraft());
    store.editScheme('session', {
      type: 'chain.layout', chainId: 'chain:overall', normalOffset: 18, expectedDrawingRef: drawingRef,
    });
    expect(store.get('session').draft?.axialScheme?.layout).toEqual({
      chainNormalOffsets: [{ chainId: 'chain:overall', normalOffset: 18 }], candidateNormalOffsets: [],
    });
    expect(store.undo('session', drawingRef).draft?.axialScheme?.layout).toBeUndefined();
    expect(store.redo('session', drawingRef).draft?.axialScheme?.layout?.chainNormalOffsets).toEqual([
      { chainId: 'chain:overall', normalOffset: 18 },
    ]);
  });

  it('switches a confirmed chain closure immediately without reopening the save toolbar', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    const value = inferredDraft();
    value.axialScheme!.chains[0]!.alternativeClosureCandidateIds = ['candidate:local'];
    store.begin('session', drawingRef);
    store.setDraft('session', value);
    store.confirm('session', drawingRef);

    const switched = store.editScheme('session', {
      type: 'closure.choose', chainId: 'chain:overall', candidateId: 'candidate:local', expectedDrawingRef: drawingRef,
    });

    expect(switched.phase).toBe('confirmed');
    expect(switched.confirmed?.axialScheme?.chains[0]).toMatchObject({
      closureCandidateId: 'candidate:local',
      childCandidateIds: ['candidate:closure'],
    });
  });

  it('hydrates switchable closure candidates for legacy confirmed schemes', () => {
    const store = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-1' });
    store.begin('session', drawingRef);
    store.setDraft('session', inferredDraft());
    store.confirm('session', drawingRef);

    expect(store.get('session').confirmed?.axialScheme?.chains[0]?.alternativeClosureCandidateIds)
      .toContain('candidate:local');
  });

  it.each(['needs-review', 'conflict', 'stale'] as const)('blocks confirmation for a %s inferred scheme', (status) => {
    const store = new DimensionPlanStore();
    store.begin('session', drawingRef);
    store.setDraft('session', inferredDraft(status));
    expect(() => store.confirm('session', drawingRef)).toThrow('ANNOTATION_PLAN_INVALID');
  });
});
