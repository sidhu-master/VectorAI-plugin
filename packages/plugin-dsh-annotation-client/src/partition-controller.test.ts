// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { createPartitionController } from './partition-controller';

const partition = { version: 1 as const, phase: 'editing' as const, drawingRef: { drawingId: 'd', revision: 1 }, canUndo: false, canRedo: false, updatedAt: 1 };

describe('partition controller', () => {
  it('imports explicitly and serializes revision-bound edits', async () => {
    const importAndAnalyze = vi.fn(async () => ({ ok: true as const, value: partition }));
    const editPartition = vi.fn(async () => ({ ok: true as const, value: { ...partition, updatedAt: 2 } }));
    const controller = createPartitionController('s', {
      importAndAnalyze, editPartition,
      getPartitionState: async () => ({ ok: true, value: partition }),
      confirmPartition: vi.fn(), cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);
    const file = new File([new TextEncoder().encode('DXF')], 'shaft.dxf');
    await controller.actions.importFiles(file);
    await controller.actions.moveBoundary(1, 12, 0.5);
    expect(importAndAnalyze).toHaveBeenCalledOnce();
    expect(editPartition).toHaveBeenCalledWith('s', expect.objectContaining({ type: 'boundary.move', expectedDrawingRef: partition.drawingRef }));
    expect(controller.state.getSnapshot()).toMatchObject({ partition: { updatedAt: 2 }, busy: false });
  });
});
