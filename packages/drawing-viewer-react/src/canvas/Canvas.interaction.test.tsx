// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationId,
  type GeometryId,
} from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DrawingWorkspaceProvider } from '../provider';
import { Canvas } from './Canvas';
import { screenToWorld } from './geometry';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

class InteractionPort implements DrawingWorkspacePort {
  readonly commits: DrawingWorkspaceCommitRequest[] = [];
  readonly value: DrawingWorkspaceSnapshot;

  constructor() {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    document.geometry = [{
      id: 'line-1' as GeometryId,
      type: 'line', start: [0, 0], end: [100, 0], visible: true, quality,
    }, {
      id: 'circle-1' as GeometryId,
      type: 'circle', center: [50, 40], radius: 12, visible: true, quality,
    }];
    document.annotations = [{
      id: 'text-1' as AnnotationId,
      type: 'text', content: 'A', position: [20, 20], height: 6, rotation: 0,
      alignment: 'left', verticalAlignment: 'baseline', visible: true, quality,
    }];
    this.value = {
      version: 1,
      ref: { drawingId: 'drawing', revision: 2 },
      document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
  }

  async load(): Promise<DrawingWorkspaceSnapshot> {
    return this.value;
  }

  async commit(request: DrawingWorkspaceCommitRequest): Promise<DrawingWorkspaceCommitResult> {
    this.commits.push(structuredClone(request));
    return { status: 'committed', snapshot: this.value };
  }
}

async function renderCanvas() {
  const port = new InteractionPort();
  const store = createDrawingWorkspaceStore({ port });
  await store.getState().load();
  store.getState().setViewport({ x: 400, y: 300, scale: 2, width: 800, height: 600 });
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );
  });
  return { port, store, renderer };
}

const svgTarget = {
  tagName: 'svg',
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
};
const groupTarget = { tagName: 'g', ownerSVGElement: svgTarget };
const stopPropagation = () => {};
const preventDefault = () => {};

describe('shared Canvas interaction', () => {
  it('zooms around the pointer without moving its world coordinate', async () => {
    const { store, renderer } = await renderCanvas();
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    const before = screenToWorld([500, 240], store.getState().viewport);

    act(() => svg.props.onWheel({
      currentTarget: svgTarget,
      clientX: 500,
      clientY: 240,
      deltaY: -800,
      preventDefault,
      stopPropagation,
    }));

    expect(store.getState().viewport.scale).toBeCloseTo(2.2);
    expect(screenToWorld([500, 240], store.getState().viewport)[0]).toBeCloseTo(before[0]);
    expect(screenToWorld([500, 240], store.getState().viewport)[1]).toBeCloseTo(before[1]);
    act(() => renderer.unmount());
  });

  it('consumes wheel input so the DSH conversation does not scroll', async () => {
    const { renderer } = await renderCanvas();
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    const wheelPreventDefault = vi.fn();
    const wheelStopPropagation = vi.fn();

    act(() => svg.props.onWheel({
      currentTarget: svgTarget,
      clientX: 500,
      clientY: 240,
      deltaY: 100,
      preventDefault: wheelPreventDefault,
      stopPropagation: wheelStopPropagation,
    }));

    expect(wheelPreventDefault).toHaveBeenCalledOnce();
    expect(wheelStopPropagation).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it('supports click selection and modifier multi-selection', async () => {
    const { store, renderer } = await renderCanvas();
    const line = renderer.root.findByProps({ 'data-entity-id': 'line-1' });
    const circle = renderer.root.findByProps({ 'data-entity-id': 'circle-1' });

    act(() => line.props.onClick({ stopPropagation, metaKey: false, ctrlKey: false }));
    act(() => circle.props.onClick({ stopPropagation, metaKey: true, ctrlKey: false }));

    expect(store.getState().selectedIds).toEqual(['line-1', 'circle-1']);
    act(() => renderer.unmount());
  });

  it('box-selects with Ctrl+left drag and clears selection with Escape', async () => {
    const { store, renderer } = await renderCanvas();
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    const canvas = renderer.root.findByProps({ 'data-canvas-root': 'true' });

    act(() => svg.props.onMouseDown?.({
      currentTarget: svgTarget,
      target: svgTarget,
      clientX: 470,
      clientY: 250,
      button: 0,
      metaKey: false,
      ctrlKey: true,
    }));
    act(() => svg.props.onMouseMove({ currentTarget: svgTarget, clientX: 530, clientY: 190 }));
    act(() => svg.props.onMouseUp({ currentTarget: svgTarget, clientX: 530, clientY: 190 }));

    expect(store.getState().selectedIds).toEqual(['circle-1']);

    act(() => canvas.props.onKeyDown({ code: 'Escape', key: 'Escape', preventDefault }));

    expect(store.getState().selectedIds).toEqual([]);
    act(() => renderer.unmount());
  });

  it('pans with plain left drag even when the drag starts on geometry', async () => {
    const { store, renderer } = await renderCanvas();
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });

    act(() => svg.props.onMouseDown?.({
      currentTarget: svgTarget,
      target: groupTarget,
      clientX: 100,
      clientY: 100,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      preventDefault,
    }));
    act(() => svg.props.onMouseMove({ currentTarget: svgTarget, clientX: 130, clientY: 140 }));
    act(() => svg.props.onMouseUp({ currentTarget: svgTarget, clientX: 130, clientY: 140 }));

    expect(store.getState().viewport.x).toBe(430);
    expect(store.getState().viewport.y).toBe(340);
    act(() => renderer.unmount());
  });

  it('pans with the middle mouse button', async () => {
    const { store, renderer } = await renderCanvas();
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });

    act(() => svg.props.onMouseDown?.({
      currentTarget: svgTarget,
      target: svgTarget,
      clientX: 100,
      clientY: 100,
      button: 1,
      preventDefault,
    }));
    act(() => svg.props.onMouseMove({ currentTarget: svgTarget, clientX: 130, clientY: 140 }));
    act(() => svg.props.onMouseUp({ currentTarget: svgTarget, clientX: 130, clientY: 140 }));

    expect(store.getState().viewport.x).toBe(430);
    expect(store.getState().viewport.y).toBe(340);
    act(() => renderer.unmount());
  });

  it('commits a dragged annotation text position', async () => {
    const { port, renderer } = await renderCanvas();
    const text = renderer.root.findByProps({ 'data-entity-id': 'text-1' });
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });

    act(() => text.props.onMouseDown({
      currentTarget: groupTarget,
      clientX: 440,
      clientY: 260,
      button: 0,
      stopPropagation,
    }));
    act(() => svg.props.onMouseMove({ currentTarget: svgTarget, clientX: 460, clientY: 240 }));
    await act(async () => {
      svg.props.onMouseUp({ currentTarget: svgTarget, clientX: 460, clientY: 240 });
      await Promise.resolve();
    });

    expect(port.commits[0]).toEqual({
      expectedRevision: 2,
      commands: [{
        type: 'annotation.move-text',
        id: 'text-1',
        position: [30, 30],
        expectedPosition: [20, 20],
      }],
    });
    act(() => renderer.unmount());
  });
});
