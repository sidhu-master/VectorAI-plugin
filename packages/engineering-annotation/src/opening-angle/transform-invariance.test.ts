// SPDX-License-Identifier: Apache-2.0

import type { GeometryId, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import { measureOpeningAngles, selectAxialEndOpeningAngles } from './index';

const quality = { status: 'confirmed' as const, confidence: 1, evidenceRefs: [] };
const source = [
  line('top', [10, 6], [90, 6]), line('bottom', [10, -6], [90, -6]),
  line('lu', [5, 10], [10, 6]), line('ll', [5, -10], [10, -6]),
  line('ru', [90, 6], [95, 10]), line('rl', [90, -6], [95, -10]),
];

describe('opening-angle local-coordinate invariance', () => {
  for (const degrees of [0, 90, 37]) {
    it(`preserves facts after ${degrees}° rotation`, () => {
      const geometry = source.map((node) => rotateNode(node, degrees));
      const measured = measureOpeningAngles(geometry);
      const selected = selectAxialEndOpeningAngles({ geometry, facts: measured.facts, axis: measured.axis }).selected;
      expect(selected).toHaveLength(2);
      expect(selected.map(({ value }) => value)).toEqual([expect.closeTo(77.32, 1), expect.closeTo(77.32, 1)]);
      expect(selected.map(({ axialSide }) => axialSide).sort()).toEqual(['end', 'start']);
    });
  }
});

function line(id: string, start: Vec2, end: Vec2): GeometryNode { return { id: id as GeometryId, type: 'line', visible: true, quality, start, end }; }
function rotateNode(node: GeometryNode, degrees: number): GeometryNode {
  if (node.type !== 'line') return node;
  const angle = degrees * Math.PI / 180;
  const rotate = ([x, y]: Vec2): Vec2 => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
  return { ...node, start: rotate(node.start), end: rotate(node.end) };
}
