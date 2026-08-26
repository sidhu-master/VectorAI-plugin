// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { PartitionSessionStore } from './partition-store';

function draft(): PartitionDraft {
  return {
    version: 1, drawingRef: { drawingId: 'd', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 2, orientation: 'forward' },
    segments: [0, 1].map((z) => ({ id: `s${z}`, zStart: z, zEnd: z + 1, profile: { minRadius: 1, maxRadius: 1, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] })),
    semanticGroups: [], stepCandidates: [{ id: 'step:1', z: 1, score: 1, evidenceIds: [], accepted: true }], evidence: [], diagnostics: [],
  };
}

describe('PartitionSessionStore', () => {
  it('edits, confirms, undoes back to editing, and redoes confirmation', () => {
    const store = new PartitionSessionStore(undefined, { now: () => 7, id: () => 'partition-r1' });
    store.beginAnalysis('s', { drawingId: 'd', revision: 1 });
    store.setDraft('s', draft());
    const edited = store.edit('s', { type: 'boundary.move', expectedDrawingRef: { drawingId: 'd', revision: 1 }, boundaryIndex: 1, requestedZ: 1.1, snapTolerance: 0 });
    expect(edited.draft?.segments[0]?.zEnd).toBe(1.1);
    expect(store.confirm('s', { drawingId: 'd', revision: 1 }).phase).toBe('confirmed');
    expect(store.undo('s', { drawingId: 'd', revision: 1 }).phase).toBe('editing');
    expect(store.redo('s', { drawingId: 'd', revision: 1 }).phase).toBe('confirmed');
  });

  it('cancels a draft without releasing the annotation workspace claim', () => {
    const store = new PartitionSessionStore();
    store.beginAnalysis('s', { drawingId: 'd', revision: 1 });
    store.setDraft('s', draft());
    expect(store.cancel('s', { drawingId: 'd', revision: 1 })).toMatchObject({ phase: 'idle', drawingRef: { drawingId: 'd', revision: 1 } });
  });

  it('restores the latest confirmed revision after undo and cancel', () => {
    const store = new PartitionSessionStore(undefined, { now: () => 7, id: () => 'partition-r1' });
    store.beginAnalysis('s', { drawingId: 'd', revision: 1 });
    store.setDraft('s', draft());
    store.confirm('s', { drawingId: 'd', revision: 1 });
    store.undo('s', { drawingId: 'd', revision: 1 });
    store.edit('s', { type: 'segment.metadata', expectedDrawingRef: { drawingId: 'd', revision: 1 }, segmentId: 's0', name: 'changed' });
    expect(store.cancel('s', { drawingId: 'd', revision: 1 })).toMatchObject({ phase: 'confirmed', confirmed: { id: 'partition-r1' } });
    store.beginAnalysis('s', { drawingId: 'd', revision: 1 });
    store.setDraft('s', draft());
    expect(store.cancel('s', { drawingId: 'd', revision: 1 })).toMatchObject({ phase: 'confirmed', confirmed: { id: 'partition-r1' } });
    store.beginAnalysis('s', { drawingId: 'd', revision: 1 });
    store.setDraft('s', draft());
    expect(store.confirm('s', { drawingId: 'd', revision: 1 }).confirmed).toMatchObject({ parentRevisionId: 'partition-r1' });
  });

  it('does not publish memory state when durable storage fails', () => {
    let fail = false;
    const storage = { load: () => null, save: () => { if (fail) throw new Error('disk-full'); } };
    const store = new PartitionSessionStore(storage);
    store.beginAnalysis('s', { drawingId: 'd', revision: 1 });
    const before = store.get('s');
    fail = true;
    expect(() => store.setDraft('s', draft())).toThrow('disk-full');
    expect(store.get('s')).toEqual(before);
  });

  it('reopens the exact confirmed draft and cancel restores the confirmed revision', () => {
    const store = new PartitionSessionStore(undefined, { now: () => 7, id: () => 'partition-r1' });
    const ref = { drawingId: 'd', revision: 1 };
    store.beginAnalysis('s', ref);
    store.setDraft('s', draft());
    const confirmed = store.confirm('s', ref);

    const reopened = store.reopen('s', ref);
    expect(reopened).toMatchObject({
      phase: 'editing',
      confirmed: { id: 'partition-r1' },
      draft: { basePartitionRevisionId: 'partition-r1', stepCandidates: [{ id: 'step:1' }] },
    });
    store.edit('s', { type: 'segment.metadata', expectedDrawingRef: ref, segmentId: 's0', name: 'changed' });
    expect(store.cancel('s', ref)).toMatchObject({ phase: 'confirmed', confirmed: { id: confirmed.confirmed?.id } });
  });

  it('persists enough confirmed draft state to reopen after process reload', () => {
    let saved: unknown = null;
    const storage = { load: () => saved, save: (_sessionId: string, value: unknown) => { saved = structuredClone(value); } };
    const ref = { drawingId: 'd', revision: 1 };
    const first = new PartitionSessionStore(storage, { now: () => 7, id: () => 'partition-r1' });
    first.beginAnalysis('s', ref);
    first.setDraft('s', draft());
    first.confirm('s', ref);

    const reloaded = new PartitionSessionStore(storage, { now: () => 8, id: () => 'partition-r2' });
    expect(reloaded.reopen('s', ref)).toMatchObject({
      phase: 'editing', draft: { basePartitionRevisionId: 'partition-r1', stepCandidates: [{ z: 1 }] },
    });
    expect(reloaded.confirm('s', ref)).toMatchObject({ confirmed: { id: 'partition-r2', parentRevisionId: 'partition-r1' } });
  });
});
