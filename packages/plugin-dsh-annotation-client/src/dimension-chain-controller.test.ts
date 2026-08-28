// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { createDimensionChainController } from './dimension-chain-controller';

const ref = { drawingId: 'drawing:1', revision: 1 };
const plan = { version: 1 as const, phase: 'editing' as const, drawingRef: ref, canUndo: false, canRedo: false, updatedAt: 1 };

describe('dimension chain controller', () => {
  it('serializes candidate display and closure choice edits', async () => {
    const editDimensionScheme = vi.fn(async () => ({ ok: true as const, value: { ...plan, updatedAt: 2 } }));
    const controller = createDimensionChainController('session:1', {
      getDimensionPlan: vi.fn(async () => ({ ok: true as const, value: plan })), editDimensionScheme,
      confirmDimensionPlan: vi.fn(), cancelDimensionPlan: vi.fn(), undoDimensionPlan: vi.fn(), redoDimensionPlan: vi.fn(),
    });
    await controller.actions.refresh();
    await Promise.all([
      controller.actions.setDisplayed('candidate:1', false),
      controller.actions.chooseClosure('chain:1', 'candidate:2'),
    ]);

    expect(editDimensionScheme).toHaveBeenNthCalledWith(1, 'session:1', {
      type: 'candidate.display', candidateId: 'candidate:1', displayed: false, expectedDrawingRef: ref,
    });
    expect(editDimensionScheme).toHaveBeenNthCalledWith(2, 'session:1', {
      type: 'closure.choose', chainId: 'chain:1', candidateId: 'candidate:2', expectedDrawingRef: ref,
    });
  });
});
