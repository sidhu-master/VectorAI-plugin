// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DrawingWorkspace } from './DrawingWorkspace';
import { DrawingWorkspaceProvider } from './provider';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

class ActivityBarPort implements DrawingWorkspacePort {
  readonly value: DrawingWorkspaceSnapshot;

  constructor() {
    const document = createEmptyDrawing({ idFactory: { next: () => 'activity-bar' }, now: () => 1 });
    document.geometry = [{
      id: 'circle-1' as GeometryId,
      type: 'circle', center: [10, 20], radius: 8, visible: true, quality,
    }];
    this.value = {
      version: 1,
      ref: { drawingId: 'activity-bar', revision: 1 },
      document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
  }

  async load(): Promise<DrawingWorkspaceSnapshot> {
    return this.value;
  }

  async commit(): Promise<DrawingWorkspaceCommitResult> {
    return { status: 'committed', snapshot: this.value };
  }
}

async function renderWorkspace() {
  const store = createDrawingWorkspaceStore({ port: new ActivityBarPort() });
  await store.getState().load();
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <DrawingWorkspace />
      </DrawingWorkspaceProvider>,
    );
  });
  return renderer;
}

describe('DrawingWorkspace activity bar', () => {
  it('opens, switches, toggles, and closes one information panel at a time', async () => {
    const renderer = await renderWorkspace();

    expect(renderer.root.findAllByProps({ 'data-panel': 'objects' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-panel': 'properties' })).toHaveLength(0);

    act(() => renderer.root.findByProps({ 'aria-label': '对象面板' }).props.onClick());
    expect(renderer.root.findAllByProps({ 'data-panel': 'objects' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-panel': 'properties' })).toHaveLength(0);
    expect(renderer.root.findByProps({ 'aria-label': '对象面板' }).props['aria-pressed']).toBe(true);

    act(() => renderer.root.findByProps({ 'aria-label': '属性面板' }).props.onClick());
    expect(renderer.root.findAllByProps({ 'data-panel': 'objects' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-panel': 'properties' })).toHaveLength(1);

    act(() => renderer.root.findByProps({ 'aria-label': '属性面板' }).props.onClick());
    expect(renderer.root.findAllByProps({ 'data-panel': 'properties' })).toHaveLength(0);

    act(() => renderer.root.findByProps({ 'aria-label': '对象面板' }).props.onClick());
    act(() => renderer.root.findByProps({ 'aria-label': '关闭信息面板' }).props.onClick());
    expect(renderer.root.findAllByProps({ 'data-panel': 'objects' })).toHaveLength(0);
    act(() => renderer.unmount());
  });

  it('resizes the active panel with pointer and keyboard input within its bounds', async () => {
    const renderer = await renderWorkspace();
    act(() => renderer.root.findByProps({ 'aria-label': '对象面板' }).props.onClick());
    const resize = renderer.root.findByProps({ 'aria-label': '调整信息面板宽度' });
    const setPointerCapture = vi.fn();

    act(() => resize.props.onPointerDown({
      button: 0,
      clientX: 100,
      pointerId: 4,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture },
    }));
    act(() => resize.props.onPointerMove({ pointerId: 4, clientX: 180 }));
    expect(renderer.root.findByProps({ 'data-panel': 'objects' }).props.style.width).toBe(340);
    act(() => resize.props.onPointerMove({ pointerId: 4, clientX: 1000 }));
    expect(renderer.root.findByProps({ 'data-panel': 'objects' }).props.style.width).toBe(420);
    act(() => resize.props.onPointerUp({ pointerId: 4 }));
    act(() => resize.props.onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() }));
    expect(renderer.root.findByProps({ 'data-panel': 'objects' }).props.style.width).toBe(404);

    expect(setPointerCapture).toHaveBeenCalledWith(4);
    act(() => renderer.unmount());
  });
});
