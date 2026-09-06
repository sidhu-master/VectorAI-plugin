// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { queryDrawing } from './query';

describe('leader spatial discovery', () => {
  it('finds a leader through its remote branch and its detail circle perimeter', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    document.annotations = [{ id: 'leader' as never, type: 'leader', visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
      target: { geometryId: 'a' as never, anchor: { kind: 'start' } }, points: [[0, 0], [10, 0]], content: 'I', textHeight: 3.5,
      branches: [{ target: { geometryId: 'b' as never, anchor: { kind: 'end' } }, points: [[30, -20], [10, 0]] }], callout: { type: 'detail', radius: 4 } }];
    for (const bounds of [{ minX: 29, maxX: 31, minY: -21, maxY: -19 }, { minX: -4.2, maxX: -3.8, minY: -0.2, maxY: 0.2 }]) {
      expect(queryDrawing(document, { kind: 'world-slice', bounds, planes: ['annotation'] }).nodes.map(({ node }) => node.id)).toEqual(['leader']);
    }
  });
});
