// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { groundGdtRecommendation } from './gdt-grounding';

describe('GD&T tolerance grounding', () => {
  it('keeps AI-recommended control semantics pending until a tolerance engine resolves the value', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'bearing-surface' as GeometryId, type: 'line', start: [0, 5], end: [20, 5], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const grounded = groundGdtRecommendation({
      version: 1, ref: { drawingId: document.id, revision: 1 }, document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    }, {
      datums: [],
      controls: [{
        id: 'gdt:bearing:circularity', characteristic: 'circularity', geometryIds: ['bearing-surface'],
        datumNames: [], toleranceZoneShape: 'linear',
      }],
    });
    expect(grounded.geometricTolerances[0]).toMatchObject({
      status: 'pending-calculation', source: 'ai-candidate',
      computed: { status: 'pending' },
    });
  });
});
