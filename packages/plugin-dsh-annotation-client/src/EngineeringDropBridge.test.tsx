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

  it('does not claim document-only drops or silently bind them to a later DXF', async () => {
    const importFiles = vi.fn(async () => undefined);
    const refreshClaim = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({ importFiles, refreshClaim });
    const documents = drop([file('notes.txt'), file('limits.pdf')]);

    await bridge.actions.handleDrop(documents);

    expect(documents.preventDefault).not.toHaveBeenCalled();
    expect(documents.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'idle', pendingDocuments: [] });

    const drawing = file('shaft.dxf');
    const dxfDrop = drop([drawing]);
    await bridge.actions.handleDrop(dxfDrop);

    expect(importFiles).toHaveBeenCalledWith(drawing, []);
    expect(refreshClaim).toHaveBeenCalledOnce();
    expect(bridge.state.getSnapshot()).toMatchObject({
      phase: 'success',
      pendingDocuments: [],
      filenames: ['shaft.dxf'],
    });
  });

  it('never accumulates unrelated document batches before the DXF', async () => {
    const importFiles = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({ importFiles, refreshClaim: vi.fn(async () => undefined) });

    await bridge.actions.handleDrop(drop([file('dimensions.pdf')]));
    await bridge.actions.handleDrop(drop([file('materials.xlsx')]));
    const drawing = file('shaft.dxf');
    await bridge.actions.handleDrop(drop([drawing]));

    expect(importFiles).toHaveBeenCalledWith(drawing, []);
  });

  it('does not supplement the current DXF merely because a document was dropped', async () => {
    let drawingReady = false;
    const supplementDocuments = vi.fn(async () => undefined);
    const bridge = createEngineeringDropBridgeController({
      importFiles: vi.fn(async () => { drawingReady = true; }),
      supplementDocuments,
      hasDrawing: () => drawingReady,
      refreshClaim: vi.fn(async () => undefined),
    });

    await bridge.actions.handleDrop(drop([file('shaft.dxf')]));
    const document = file('notes.txt', 'text/plain');
    await bridge.actions.handleDrop(drop([document]));

    expect(supplementDocuments).not.toHaveBeenCalled();
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'success', filenames: ['shaft.dxf'], pendingDocuments: [] });
  });

  it('surfaces rejection and import errors without leaving hidden pending files', async () => {
    const importFiles = vi.fn(async () => { throw new Error('DOCUMENT_PARSE_FAILED:broken.pdf'); });
    const bridge = createEngineeringDropBridgeController({ importFiles, refreshClaim: vi.fn() });

    await bridge.actions.handleDrop(drop([file('a.dxf'), file('b.dxf')]));
    expect(bridge.state.getSnapshot()).toMatchObject({ phase: 'error', code: 'ENGINEERING_DROP_MULTIPLE_DXF' });

    await bridge.actions.handleDrop(drop([file('drawing.dxf'), file('broken.pdf')]));
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
