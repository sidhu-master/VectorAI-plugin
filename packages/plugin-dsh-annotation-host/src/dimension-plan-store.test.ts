// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import type { EngineeringAnnotationDraft } from '@vectorai/engineering-annotation';
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
    tolerances: [],
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

describe('DimensionPlanStore', () => {
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
});
