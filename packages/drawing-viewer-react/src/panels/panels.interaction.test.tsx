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
import { describe, expect, it } from 'vitest';

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

  it('toggles local display state and fits without committing', async () => {
    const { port, store, renderer } = await renderPanel(<WorkspaceToolbar />);
    const button = (label: string) => renderer.root.findAllByType('button')
      .find((candidate) => candidate.children.includes(label));

    act(() => button('网格')?.props.onClick());
    act(() => button('适配图纸')?.props.onClick());

    expect(store.getState().display.grid).toBe(false);
    expect(store.getState().viewport.scale).toBeGreaterThan(1);
    expect(port.commits).toEqual([]);
    act(() => renderer.unmount());
  });
});
