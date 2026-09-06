// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type LeaderAnnotation } from '@vectorai/drawing-core';
import { drawingTransactionSchema } from '@vectorai/drawing-edit-protocol';
import { describe, expect, it } from 'vitest';
import { applyDrawingTransaction, compileSpatialEditProgram } from './index';

describe('leader transforms and inverse transactions', () => {
  it('moves every tip and detail center, preserves target identities and radius, and restores all fields', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    document.geometry = [{ id: 'a' as never, type: 'line', start: [0, 0], end: [10, 0], visible: true, quality }, { id: 'b' as never, type: 'line', start: [0, 8], end: [10, 8], visible: true, quality }];
    const leader: LeaderAnnotation = { id: 'leader' as never, type: 'leader', visible: true, quality,
      target: { geometryId: 'a' as never, anchor: { kind: 'start' } }, points: [[0, 0], [10, 0]], content: 'I', textHeight: 3.5,
      branches: [{ target: { geometryId: 'b' as never, anchor: { kind: 'start' } }, points: [[0, 8], [10, 0]] }], callout: { type: 'detail', radius: 4 } };
    document.annotations = [leader];
    const compiled = compileSpatialEditProgram({ document,
      program: { baseRef: { drawingId: 'drawing', revision: 1 }, targetHandle: 'leader-target', summary: 'Move reference', objective: 'Move reference',
        operations: [{ kind: 'rigid_transform', translation: [5, 6], rotationRadians: Math.PI / 2, pivot: [0, 0] }], preserveScopes: [], postconditions: [], evidenceRefs: [] },
      grounding: { targetHandle: 'leader-target', targetNodeIds: ['leader'], interfaces: [], sourceStatus: 'confirmed' },
      ports: { id: (kind) => kind, digest: (value) => value, now: () => 2 },
    });
    const moved = compiled.candidate.annotations[0] as LeaderAnnotation;
    expect(moved.points[0]).toEqual([5, 6]);
    expect(moved.branches![0].points[0][0]).toBeCloseTo(-3);
    expect(moved.branches![0].points[0][1]).toBeCloseTo(6);
    expect(moved.branches![0].target).toEqual(leader.branches![0].target);
    expect(moved.callout).toEqual({ type: 'detail', radius: 4 });
    expect(compiled.candidate.geometry).toEqual(document.geometry);
    const transaction = drawingTransactionSchema.parse(JSON.parse(JSON.stringify({ forward: compiled.forward, inverse: compiled.inverse })));
    const restored = applyDrawingTransaction(compiled.candidate, transaction.inverse, 3);
    expect(restored.annotations).toEqual(document.annotations);
    expect(applyDrawingTransaction(restored, transaction.forward, 4).annotations).toEqual(compiled.candidate.annotations);
  });
});
