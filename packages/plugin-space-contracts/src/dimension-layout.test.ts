// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { drawingDocumentSchema } from './index';

describe('dimension placement ownership persistence', () => {
  it.each([undefined, 'automatic', 'manual'] as const)('round-trips %s ownership without migrating old records', (mode) => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const dimension: DimensionAnnotation = {
      id: 'dimension-1' as never, type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'diameter', associationStatus: 'resolved', targets: [],
      textPosition: [5, 12], definitionPoints: [[5, -10], [5, 10]],
      ...(mode === undefined ? {} : { layout: { mode, generatedText: '⌀20' } }),
    };
    document.annotations = [dimension];
    const restored = drawingDocumentSchema.parse(JSON.parse(JSON.stringify(document)));
    expect(restored.annotations).toEqual(document.annotations);
    if (mode === undefined) expect(restored.annotations[0]).not.toHaveProperty('layout');
  });

  it('rejects unknown ownership modes and null document metadata', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const dimension = {
      id: 'dimension-1', type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'radius', associationStatus: 'resolved', targets: [],
      textPosition: [5, 12], definitionPoints: [[0, 0], [5, 0]],
    };
    for (const layout of [null, { mode: 'inferred' }, { mode: 'automatic', unknown: true }, { mode: 'automatic', generatedText: 20 }]) {
      expect(drawingDocumentSchema.safeParse({ ...document, annotations: [{ ...dimension, layout }] }).success).toBe(false);
    }
  });
});
