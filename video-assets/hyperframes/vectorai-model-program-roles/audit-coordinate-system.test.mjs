import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  applyCadViewport,
  createCadViewport,
  translateWorldPoint,
} from './audit-coordinate-system.js';

const closePoint = (actual, expected, label) => {
  assert.ok(Math.abs(actual[0] - expected[0]) < 1e-9, `${label}.x`);
  assert.ok(Math.abs(actual[1] - expected[1]) < 1e-9, `${label}.y`);
};

describe('CAD coordinate-system audit', () => {
  it('keeps world Y-up while projecting it upward on screen', () => {
    const full = createCadViewport(675);
    assert.equal(full.svgTransform, 'translate(0 675) scale(1 -1)');
    const attributes = new Map();
    applyCadViewport({ setAttribute: (name, value) => attributes.set(name, value) }, full);
    assert.equal(attributes.get('transform'), 'translate(0 675) scale(1 -1)');

    const before = [61.710477, 204.929327];
    const after = translateWorldPoint(before, [30, 150]);
    closePoint(after, [91.710477, 354.929327], 'translated point');
    closePoint(full.worldToScreen(before), [61.710477, 470.070673], 'before screen point');
    closePoint(full.worldToScreen(after), [91.710477, 320.070673], 'after screen point');

    const beforeScreen = full.worldToScreen(before);
    const afterScreen = full.worldToScreen(after);
    closePoint(
      [afterScreen[0] - beforeScreen[0], afterScreen[1] - beforeScreen[1]],
      [30, -150],
      'Y-up translation must move visually upward',
    );
  });
});
