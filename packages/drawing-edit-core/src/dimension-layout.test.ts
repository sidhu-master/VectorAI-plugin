// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation } from '@vectorai/drawing-core';
import { drawingTransactionSchema, type DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';
import { describe, expect, it } from 'vitest';

import { applyDrawingTransaction, compileSpatialEditProgram, invertDrawingTransaction } from './index';

const ownerships = [undefined, { mode: 'automatic' as const, generatedText: '⌀20' }, { mode: 'manual' as const, generatedText: '⌀20' }];

function fixture(layout: DimensionAnnotation['layout']) {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
  document.annotations = [{
    id: 'dimension-1' as never, type: 'dimension', visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    dimensionKind: 'diameter', associationStatus: 'resolved', targets: [],
    computedValue: 20, displayText: '⌀20', textPosition: [5, 12], definitionPoints: [[5, -10], [5, 10]],
    ...(layout === undefined ? {} : { layout }),
  }];
  return document;
}

describe('dimension placement ownership', () => {
  for (const layout of ownerships) {
    for (const move of ['text', 'dimension'] as const) {
      it(`restores ${layout?.mode ?? 'legacy'} ownership through serialized ${move} move, undo and redo`, () => {
        const before = fixture(layout);
        const forward: DrawingTransactionCommand[] = [move === 'text' ? {
          type: 'annotation.move-text', id: 'dimension-1',
          position: [15, 12], expectedPosition: [5, 12],
        } : {
          type: 'node.update', id: 'dimension-1',
          changes: { textPosition: [15, 12], definitionPoints: [[15, -10], [15, 10]] },
          expected: { textPosition: [5, 12], definitionPoints: [[5, -10], [5, 10]] },
        }];
        const inverse = invertDrawingTransaction(before, forward);
        const transaction = drawingTransactionSchema.parse(JSON.parse(JSON.stringify({ forward, inverse })));
        const after = applyDrawingTransaction(before, transaction.forward, 2);
        expect(after.annotations[0]).toMatchObject({ layout: { mode: 'manual' }, textPosition: [15, 12] });
        expect((after.annotations[0] as DimensionAnnotation).layout?.generatedText).toBe(layout?.generatedText);
        const restored = applyDrawingTransaction(after, transaction.inverse, 3);
        expect(restored.annotations).toEqual(before.annotations);
        if (layout === undefined) expect(restored.annotations[0]).not.toHaveProperty('layout');
        expect(applyDrawingTransaction(restored, transaction.forward, 4).annotations).toEqual(after.annotations);
        // Durable redo is itself the inverse of the undo transaction.
        const redo = drawingTransactionSchema.parse(JSON.parse(JSON.stringify({
          forward: transaction.inverse, inverse: invertDrawingTransaction(after, transaction.inverse),
        })));
        expect(applyDrawingTransaction(restored, redo.inverse, 4).annotations).toEqual(after.annotations);
      });
    }
  }

  it('retains automatic ownership for tolerance edits and zero-distance moves', () => {
    const before = fixture({ mode: 'automatic', generatedText: '⌀20' });
    const after = applyDrawingTransaction(before, [{
      type: 'node.update', id: 'dimension-1', changes: { displayText: '⌀20 H7' }, expected: {},
    }, {
      type: 'annotation.move-text', id: 'dimension-1', position: [5, 12], expectedPosition: [5, 12],
    }, {
      type: 'node.update', id: 'dimension-1', changes: { definitionPoints: [[5, -10], [5, 10]] }, expected: {},
    }], 2);
    expect(after.annotations[0]).toMatchObject({ displayText: '⌀20 H7', layout: { mode: 'automatic', generatedText: '⌀20' } });
  });

  it('compiles an explicit dimension transform with reversible ownership and unchanged measurement', () => {
    const before = fixture({ mode: 'automatic', generatedText: '⌀20' });
    const compiled = compileSpatialEditProgram({
      document: before,
      program: {
        baseRef: { drawingId: 'drawing-1', revision: 1 }, targetHandle: 'target:dimension',
        summary: 'Move the dimension', objective: 'Move the dimension',
        operations: [{ kind: 'rigid_transform', translation: [10, 0], rotationRadians: 0, pivot: [0, 0] }],
        preserveScopes: [{ kind: 'node-field', nodeId: 'dimension-1', fields: ['computedValue', 'targets'] }],
        postconditions: [], evidenceRefs: [],
      },
      grounding: { targetHandle: 'target:dimension', targetNodeIds: ['dimension-1'], interfaces: [], sourceStatus: 'confirmed' },
      ports: { now: () => 2, id: (kind) => kind, digest: (value) => value },
    });
    expect(compiled.candidate.annotations[0]).toMatchObject({
      computedValue: 20, textPosition: [15, 12], layout: { mode: 'manual', generatedText: '⌀20' },
    });
    expect(compiled.actualEffect.changedFields['dimension-1']).toContain('layout');
    expect(applyDrawingTransaction(compiled.candidate, compiled.inverse, 3).annotations).toEqual(before.annotations);
  });
});
