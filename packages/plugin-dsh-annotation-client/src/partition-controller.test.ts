// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { createPartitionController } from './partition-controller';

const partition = { version: 1 as const, phase: 'editing' as const, drawingRef: { drawingId: 'd', revision: 1 }, canUndo: false, canRedo: false, updatedAt: 1 };

describe('partition controller', () => {
  it('reopens a confirmed partition through its explicit remote use case', async () => {
    const confirmed = { ...partition, phase: 'confirmed' as const };
    const reopenPartition = vi.fn(async () => ({ ok: true as const, value: partition }));
    const controller = createPartitionController('s', {
      getPartitionState: vi.fn(async () => ({ ok: true as const, value: confirmed })),
      reopenPartition,
      importAndAnalyze: vi.fn(), editPartition: vi.fn(), confirmPartition: vi.fn(),
      cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);
    await controller.actions.refresh();
    await controller.actions.reopen();
    expect(reopenPartition).toHaveBeenCalledWith('s', partition.drawingRef);
    expect(controller.state.getSnapshot().partition.phase).toBe('editing');
  });

  it('publishes an analyzing phase before the remote import finishes', async () => {
    let finish!: (value: { ok: true; value: typeof partition }) => void;
    const pending = new Promise<{ ok: true; value: typeof partition }>((resolve) => { finish = resolve; });
    const controller = createPartitionController('s', {
      importAndAnalyze: vi.fn(() => pending),
      getPartitionState: vi.fn(), editPartition: vi.fn(), confirmPartition: vi.fn(),
      cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);

    const importing = controller.actions.importFiles(new File(['DXF'], 'shaft.dxf'));
    await vi.waitFor(() => expect(controller.state.getSnapshot()).toMatchObject({
      busy: true,
      partition: { phase: 'analyzing' },
    }));
    finish({ ok: true, value: partition });
    await importing;
  });

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
    await controller.actions.moveSemanticRange('group:G01', 'start', 63.5, 0.5);
    await controller.actions.renameSemanticGroup('group:G01', '精加工齿轮段');
    expect(importAndAnalyze).toHaveBeenCalledOnce();
    expect(editPartition).toHaveBeenCalledWith('s', expect.objectContaining({ type: 'boundary.move', expectedDrawingRef: partition.drawingRef }));
    expect(editPartition).toHaveBeenCalledWith('s', expect.objectContaining({ type: 'semantic-range.move', groupId: 'group:G01', edge: 'start' }));
    expect(editPartition).toHaveBeenCalledWith('s', expect.objectContaining({
      type: 'semantic-group.rename', groupId: 'group:G01', name: '精加工齿轮段',
    }));
    expect(controller.state.getSnapshot()).toMatchObject({ partition: { updatedAt: 2 }, busy: false });
  });

  it('serializes multiple engineering documents as ordered immutable binaries', async () => {
    const importAndAnalyze = vi.fn(async () => ({ ok: true as const, value: partition }));
    const controller = createPartitionController('s', {
      importAndAnalyze,
      getPartitionState: async () => ({ ok: true, value: partition }),
      editPartition: vi.fn(), confirmPartition: vi.fn(), cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);
    const dxf = new File(['DXF'], 'shaft.dxf', { type: 'application/dxf' });
    const documents = [
      new File(['diameter,20'], 'limits.csv', { type: 'text/csv' }),
      new File(['轴段'], 'notes.txt', { type: 'text/plain' }),
    ];

    await controller.actions.importFiles(dxf, documents);

    expect(importAndAnalyze).toHaveBeenCalledWith('s', expect.objectContaining({
      engineeringDocuments: [
        expect.objectContaining({ name: 'limits.csv', mediaType: 'text/csv', base64: 'ZGlhbWV0ZXIsMjA=' }),
        expect.objectContaining({ name: 'notes.txt', mediaType: 'text/plain', base64: '6L205q61' }),
      ],
    }));
  });

  it('supplements the current drawing with documents without requiring the DXF again', async () => {
    const supplementDocuments = vi.fn(async () => ({ ok: true as const, value: partition }));
    const controller = createPartitionController('s', {
      supplementDocuments,
      getPartitionState: async () => ({ ok: true, value: partition }),
      importAndAnalyze: vi.fn(), editPartition: vi.fn(), confirmPartition: vi.fn(),
      cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);
    await controller.actions.refresh();
    const document = new File(['diameter,20'], 'limits.csv', { type: 'text/csv' });

    await controller.actions.supplementDocuments([document]);

    expect(supplementDocuments).toHaveBeenCalledWith('s', {
      expectedDrawingRef: partition.drawingRef,
      engineeringDocuments: [expect.objectContaining({
        name: 'limits.csv', mediaType: 'text/csv', base64: 'ZGlhbWV0ZXIsMjA=',
      })],
    });
  });

  it('rejects aggregate engineering document bytes before reading or calling the Host', async () => {
    const importAndAnalyze = vi.fn();
    const controller = createPartitionController('s', {
      importAndAnalyze,
      getPartitionState: vi.fn(), editPartition: vi.fn(), confirmPartition: vi.fn(), cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);
    const read = vi.fn();
    const oversized = Array.from({ length: 3 }, (_, index) => ({
      name: `part-${index}.pdf`, type: 'application/pdf', size: 18 * 1024 * 1024, arrayBuffer: read,
    })) as unknown as File[];

    await expect(controller.actions.importFiles(new File(['DXF'], 'shaft.dxf'), oversized))
      .rejects.toThrow('ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT');
    expect(read).not.toHaveBeenCalled();
    expect(importAndAnalyze).not.toHaveBeenCalled();
  });

  it('preserves the remote failure message so live import failures are diagnosable', async () => {
    const controller = createPartitionController('s', {
      importAndAnalyze: vi.fn(async () => ({
        ok: false as const,
        error: { code: 'INTERNAL', message: 'DXF_IMPORT_FAILED:invalid section', details: {} },
      })),
      getPartitionState: vi.fn(), editPartition: vi.fn(), confirmPartition: vi.fn(), cancelPartition: vi.fn(), undoPartition: vi.fn(), redoPartition: vi.fn(),
    } as never);

    await expect(controller.actions.importFiles(new File(['DXF'], 'shaft.dxf')))
      .rejects.toThrow('DXF_IMPORT_FAILED:invalid section');
  });
});
