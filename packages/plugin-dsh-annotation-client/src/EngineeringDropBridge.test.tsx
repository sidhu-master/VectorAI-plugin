// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { createEngineeringDropBridgeController, type EngineeringDropEventTarget } from './EngineeringDropBridge';

function file(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

function drop(files: File[]) {
  return {
    dataTransfer: { files },
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
}

function engineeringDragPreview(files: File[]) {
  return {
    dataTransfer: {
      files: [],
      items: files.map((entry) => ({ kind: 'file', type: entry.type, getAsFile: () => entry })),
      types: ['Files'],
      dropEffect: 'none',
    },
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
}

describe('engineering drop bridge', () => {
  it('does not interfere with ordinary DSH image drops', async () => {
    const importFiles = vi.fn();
    const bridge = createEngineeringDropBridgeController({ importFiles, refreshClaim: vi.fn() });
    const event = drop([file('photo.png', 'image/png')]);

    await bridge.actions.handleDrop(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(importFiles).not.toHaveBeenCalled();
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'idle', pendingDocuments: [] });
  });

  it('stages document-only drops without importing, partitioning, or claiming the workspace', async () => {
    const importFiles = vi.fn(async () => undefined);
    const stageDocuments = vi.fn(async () => undefined);
    const refreshClaim = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({ importFiles, stageDocuments, refreshClaim });
    const documents = drop([file('notes.txt'), file('limits.pdf')]);

    await bridge.actions.handleDrop(documents);

    expect(documents.preventDefault).toHaveBeenCalledOnce();
    expect(documents.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(stageDocuments).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'notes.txt' }), expect.objectContaining({ name: 'limits.pdf' }),
    ]));
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'success', pendingDocuments: documents.dataTransfer.files });

    const drawing = file('shaft.dxf');
    const dxfDrop = drop([drawing]);
    await bridge.actions.handleDrop(dxfDrop);

    expect(importFiles).toHaveBeenCalledWith(drawing, []);
    expect(refreshClaim).toHaveBeenCalledOnce();
    expect(bridge.state.getSnapshot()).toMatchObject({
      phase: 'success',
      pendingDocuments: documents.dataTransfer.files,
      filenames: ['shaft.dxf', 'notes.txt', 'limits.pdf'],
    });
  });

  it('stages multiple document batches and does not implicitly feed them into DXF import', async () => {
    const importFiles = vi.fn(async () => undefined);
    const stageDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({ importFiles, stageDocuments, refreshClaim: vi.fn(async () => undefined) });

    await bridge.actions.handleDrop(drop([file('dimensions.pdf')]));
    await bridge.actions.handleDrop(drop([file('materials.xlsx')]));
    const drawing = file('shaft.dxf');
    await bridge.actions.handleDrop(drop([drawing]));

    expect(stageDocuments).toHaveBeenCalledTimes(2);
    expect(importFiles).toHaveBeenCalledWith(drawing, []);
  });

  it('preserves earlier staged files when a later stage fails and clears Host context on user clear', async () => {
    const stageDocuments = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DOCUMENT_PARSE_FAILED:broken.pdf'));
    const clearDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(), stageDocuments, clearDocuments, refreshClaim: vi.fn(),
    });
    const first = file('notes.txt');
    await bridge.actions.handleDrop(drop([first]));
    await bridge.actions.handleDrop(drop([file('broken.pdf')]));

    expect(bridge.state.getSnapshot().pendingDocuments).toEqual([first]);
    bridge.actions.clear();
    await vi.waitFor(() => expect(clearDocuments).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(bridge.state.getSnapshot().phase).toBe('idle'));
  });

  it('does not supplement the current DXF merely because a document was dropped', async () => {
    const supplementDocuments = vi.fn(async () => undefined);
    const stageDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(async () => undefined),
      stageDocuments,
      refreshClaim: vi.fn(async () => undefined),
    });

    await bridge.actions.handleDrop(drop([file('shaft.dxf')]));
    const document = file('notes.txt', 'text/plain');
    await bridge.actions.handleDrop(drop([document]));

    expect(supplementDocuments).not.toHaveBeenCalled();
    expect(stageDocuments).toHaveBeenCalledWith([document]);
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'success', filenames: ['notes.txt'], pendingDocuments: [document] });
  });

  it('stages documents from a mixed drop and opens the DXF without starting partitioning', async () => {
    const importFiles = vi.fn(async () => undefined);
    const stageDocuments = vi.fn(async () => undefined);
    const clearDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({ importFiles, stageDocuments, clearDocuments, refreshClaim: vi.fn(async () => undefined) });

    await bridge.actions.handleDrop(drop([file('shaft.dxf'), file('notes.txt', 'text/plain')]));

    expect(clearDocuments).not.toHaveBeenCalled();
    expect(stageDocuments).toHaveBeenCalledOnce();
    expect(importFiles).toHaveBeenCalledWith(expect.objectContaining({ name: 'shaft.dxf' }), []);
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'success', filenames: ['shaft.dxf', 'notes.txt'] });
  });

  it('does not restore documents from the replaced drawing when mixed staging fails', async () => {
    let drawingId = 'old-drawing';
    const stageDocuments = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DOCUMENT_PARSE_FAILED:broken.pdf'));
    const clearDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(async () => { drawingId = 'replacement-drawing'; }),
      stageDocuments,
      clearDocuments,
      getDrawingId: () => drawingId,
      refreshClaim: vi.fn(async () => undefined),
    });
    await bridge.actions.handleDrop(drop([file('old-notes.txt')]));

    await bridge.actions.handleDrop(drop([file('replacement.dxf'), file('broken.pdf')]));

    expect(clearDocuments).not.toHaveBeenCalled();
    expect(bridge.state.getSnapshot()).toMatchObject({
      phase: 'error',
      code: 'DOCUMENT_PARSE_FAILED:broken.pdf',
      pendingDocuments: [],
    });
  });

  it('keeps unbound documents when a later mixed drop opens a drawing and adds more documents', async () => {
    const stageDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(async () => undefined),
      stageDocuments,
      clearDocuments: vi.fn(async () => undefined),
      getDrawingId: () => undefined,
      refreshClaim: vi.fn(async () => undefined),
    });
    const first = file('dimensions.txt');
    const second = file('materials.pdf');
    await bridge.actions.handleDrop(drop([first]));

    await bridge.actions.handleDrop(drop([file('shaft.dxf'), second]));

    expect(stageDocuments).toHaveBeenNthCalledWith(1, [first]);
    expect(stageDocuments).toHaveBeenNthCalledWith(2, [second]);
    expect(bridge.state.getSnapshot()).toMatchObject({
      phase: 'success',
      pendingDocuments: [first, second],
      filenames: ['shaft.dxf', 'dimensions.txt', 'materials.pdf'],
    });
  });

  it('drops documents bound to the old drawing when a replacement DXF opens', async () => {
    let drawingId = 'old-drawing';
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(async () => { drawingId = 'replacement-drawing'; }),
      stageDocuments: vi.fn(async () => undefined),
      getDrawingId: () => drawingId,
      refreshClaim: vi.fn(async () => undefined),
    });
    await bridge.actions.handleDrop(drop([file('old-drawing-notes.txt')]));

    await bridge.actions.handleDrop(drop([file('replacement.dxf')]));

    expect(bridge.state.getSnapshot()).toMatchObject({
      phase: 'success', pendingDocuments: [], filenames: ['replacement.dxf'],
    });
  });

  it('opens a dropped DXF without starting or claiming the partition workflow', async () => {
    const importFiles = vi.fn(async () => undefined);
    const refreshClaim = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({ importFiles, refreshClaim });

    await bridge.actions.handleDrop(drop([file('shaft.dxf')]));

    expect(importFiles).toHaveBeenCalledWith(expect.objectContaining({ name: 'shaft.dxf' }), []);
    expect(refreshClaim).toHaveBeenCalledOnce();
  });

  it('surfaces rejection and import errors without leaving hidden pending files', async () => {
    const importFiles = vi.fn(async () => { throw new Error('DOCUMENT_PARSE_FAILED:broken.pdf'); });
    const bridge = createEngineeringDropBridgeController({ importFiles, refreshClaim: vi.fn() });

    await bridge.actions.handleDrop(drop([file('a.dxf'), file('b.dxf')]));
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'error', code: 'ENGINEERING_DROP_MULTIPLE_DXF' });

    await bridge.actions.handleDrop(drop([file('drawing.dxf')]));
    expect(bridge.state.getSnapshot()).toMatchObject({
      phase: 'error', code: 'DOCUMENT_PARSE_FAILED:broken.pdf', pendingDocuments: [],
    });
  });

  it('releases the DSH native drag lifecycle after owning an engineering drop', async () => {
    let nativeOverlayActive = true;
    const nativeWindow = new EventTarget();
    nativeWindow.addEventListener('dragend', () => { nativeOverlayActive = false; });
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(async () => undefined),
      refreshClaim: vi.fn(async () => undefined),
      releaseNativeDragState: () => { nativeWindow.dispatchEvent(new Event('dragend')); },
    });

    await bridge.actions.handleDrop(drop([file('shaft.dxf')]));

    expect(nativeOverlayActive).toBe(false);
  });

  it('installs capture-phase listeners and removes them on disposal', () => {
    const added: Array<[string, (event: never) => void, boolean?]> = [];
    const removed: Array<[string, (event: never) => void, boolean?]> = [];
    const target: EngineeringDropEventTarget = {
      addEventListener: vi.fn((type, listener, capture) => { added.push([type, listener as never, capture]); }),
      removeEventListener: vi.fn((type, listener, capture) => { removed.push([type, listener as never, capture]); }),
    };
    const bridge = createEngineeringDropBridgeController({ importFiles: vi.fn(), refreshClaim: vi.fn() });

    const detach = bridge.actions.attach(target);

    expect(added.map(([type, , options]) => [type, options])).toEqual([
      ['dragenter', true], ['dragover', true], ['drop', true],
    ]);
    detach();
    expect(removed).toEqual(added);
  });

  it('owns engineering dragenter before DSH can open its native image overlay', () => {
    const listeners = new Map<string, (event: never) => void>();
    const target: EngineeringDropEventTarget = {
      addEventListener: vi.fn((type, listener) => { listeners.set(type, listener as never); }),
      removeEventListener: vi.fn(),
    };
    const bridge = createEngineeringDropBridgeController({ importFiles: vi.fn(), refreshClaim: vi.fn() });
    bridge.actions.attach(target);
    const event = engineeringDragPreview([file('shaft.dxf', 'application/dxf')]);

    listeners.get('dragenter')?.(event as never);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('still lets DSH preview and receive ordinary image drags', () => {
    const listeners = new Map<string, (event: never) => void>();
    const target: EngineeringDropEventTarget = {
      addEventListener: vi.fn((type, listener) => { listeners.set(type, listener as never); }),
      removeEventListener: vi.fn(),
    };
    const bridge = createEngineeringDropBridgeController({ importFiles: vi.fn(), refreshClaim: vi.fn() });
    bridge.actions.attach(target);
    const event = engineeringDragPreview([file('photo.png', 'image/png')]);

    listeners.get('dragenter')?.(event as never);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('none');
  });
});
