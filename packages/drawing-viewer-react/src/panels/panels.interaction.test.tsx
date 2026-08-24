// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
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
import { ObjectList } from './ObjectList';
import { PropertyInspector } from './PropertyInspector';
import { WorkspaceToolbar } from './WorkspaceToolbar';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

class ActionPort implements DrawingWorkspacePort {
  readonly commits: DrawingWorkspaceCommitRequest[] = [];
  readonly value: DrawingWorkspaceSnapshot;

  constructor() {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    document.geometry = [{
      id: 'circle-1' as GeometryId,
      type: 'circle', center: [10, 20], radius: 8, visible: true, quality,
    }];
    this.value = {
      version: 1,
      ref: { drawingId: 'drawing', revision: 5 },
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

async function renderPanel(children: React.ReactNode) {
  const port = new ActionPort();
  const store = createDrawingWorkspaceStore({ port });
  await store.getState().load();
  store.getState().setSelection(['circle-1']);
  store.getState().setViewport({ x: 0, y: 0, scale: 1, width: 800, height: 600 });
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>{children}</DrawingWorkspaceProvider>,
    );
  });
  return { port, store, renderer };
}

describe('shared workspace panel actions', () => {
  it('commits visibility and delete actions from the object list', async () => {
    const { port, renderer } = await renderPanel(<ObjectList />);

    await act(async () => {
      renderer.root.findByProps({ 'aria-label': '隐藏 circle-1' }).props.onClick();
      await Promise.resolve();
    });
    await act(async () => {
      renderer.root.findByProps({ 'aria-label': '删除 circle-1' }).props.onClick();
      await Promise.resolve();
    });

    expect(port.commits).toEqual([{
      expectedRevision: 5,
      commands: [{
        type: 'node.update', id: 'circle-1',
        changes: { visible: false }, expected: { visible: true },
      }],
    }, {
      expectedRevision: 5,
      commands: [{ type: 'node.delete', id: 'circle-1' }],
    }]);
    act(() => renderer.unmount());
  });

  it('commits a numeric property edited in the inspector', async () => {
    const { port, renderer } = await renderPanel(<PropertyInspector />);
    const radius = renderer.root.findAllByType('input').find((input) => input.props.defaultValue === '8');

    await act(async () => {
      radius?.props.onBlur({ currentTarget: { value: '12.5' } });
      await Promise.resolve();
    });

    expect(port.commits[0]).toEqual({
      expectedRevision: 5,
      commands: [{
        type: 'node.update', id: 'circle-1',
        changes: { radius: 12.5 }, expected: { radius: 8 },
      }],
    });
    act(() => renderer.unmount());
  });

  it('fits the viewport without committing', async () => {
    const { port, store, renderer } = await renderPanel(<WorkspaceToolbar />);

    act(() => renderer.root.findByProps({ 'aria-label': '适配图纸' }).props.onClick());

    expect(store.getState().viewport.scale).toBeGreaterThan(1);
    expect(port.commits).toEqual([]);
    act(() => renderer.unmount());
  });

  it('forwards explicit upload and export gestures from the floating toolbar', async () => {
    const onUploadFiles = vi.fn();
    const onExport = vi.fn();
    const { renderer } = await renderPanel(
      <WorkspaceToolbar onUploadFiles={onUploadFiles} onExport={onExport} />,
    );
    const file = { name: 'drawing.png', type: 'image/png' } as File;
    const input = renderer.root.findByType('input');
    const exportButton = renderer.root.findByProps({ 'aria-label': '导出 DXF' });

    act(() => input.props.onChange({ currentTarget: { files: [file], value: 'drawing.png' } }));
    act(() => exportButton?.props.onClick());

    expect(onUploadFiles).toHaveBeenCalledWith([file]);
    expect(onExport).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  it('shows icon-only confirm and cancel actions for a motion-rig Preview', async () => {
    const { store, renderer } = await renderPanel(<WorkspaceToolbar />);
    const confirmMotionRig = vi.fn(async () => true);
    const cancelMotionRig = vi.fn(async () => {});
    act(() => store.setState({
      motionRig: {
        phase: 'preview',
        projection: {
          version: 1, drawingRef: { drawingId: 'drawing', revision: 5 }, state: 'ready',
          controlBodyNodeIds: ['circle-1'],
          connectors: [{ nodeId: 'arm', movingEndpoint: 'end', fixedPoint: [0, 0] }],
          anchor: [0, 0], handle: [10, 20], keepAnchorFixed: true,
          keepControlBodyRigid: true, preserveConnectivity: true, allowControlRotation: false,
        },
      },
      confirmMotionRig,
      cancelMotionRig,
    }));

    const confirm = renderer.root.findByProps({ 'aria-label': '确认姿态' });
    const cancel = renderer.root.findByProps({ 'aria-label': '取消姿态' });
    await act(async () => { confirm.props.onClick(); await Promise.resolve(); });
    await act(async () => { cancel.props.onClick(); await Promise.resolve(); });

    expect(confirmMotionRig).toHaveBeenCalledOnce();
    expect(cancelMotionRig).toHaveBeenCalledOnce();
    expect(confirm.findAllByType('span')).toHaveLength(0);
    expect(cancel.findAllByType('span')).toHaveLength(0);
    act(() => renderer.unmount());
  });

  it('previews only while the motion-rig preview action is held', async () => {
    const onMotionPreviewHeldChange = vi.fn();
    const { store, renderer } = await renderPanel(
      <WorkspaceToolbar
        motionPreviewHeld={false}
        onMotionPreviewHeldChange={onMotionPreviewHeldChange}
      />,
    );
    act(() => store.setState({
      motionRig: {
        phase: 'preview',
        projection: {
          version: 1, drawingRef: { drawingId: 'drawing', revision: 5 }, state: 'ready',
          controlBodyNodeIds: ['circle-1'], connectors: [], anchor: [0, 0], handle: [10, 20],
          keepAnchorFixed: true, keepControlBodyRigid: true,
          preserveConnectivity: true, allowControlRotation: false,
        },
      },
    }));
    const preview = renderer.root.findByProps({ 'aria-label': '按住预览修改效果' });
    const setPointerCapture = vi.fn();

    act(() => preview.props.onPointerDown?.({
      button: 0,
      pointerId: 7,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture },
    }));
    act(() => preview.props.onPointerUp?.({ preventDefault: vi.fn() }));
    act(() => preview.props.onKeyDown?.({ key: ' ', repeat: false, preventDefault: vi.fn() }));
    act(() => preview.props.onKeyUp?.({ key: ' ', preventDefault: vi.fn() }));

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onMotionPreviewHeldChange.mock.calls).toEqual([[true], [false], [true], [false]]);
    act(() => renderer.unmount());
  });
});
