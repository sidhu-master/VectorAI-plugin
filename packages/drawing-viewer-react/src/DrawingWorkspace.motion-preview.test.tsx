// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { DrawingWorkspace } from './DrawingWorkspace';
import { DrawingWorkspaceProvider } from './provider';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

class MotionPreviewPort implements DrawingWorkspacePort {
  readonly value: DrawingWorkspaceSnapshot;

  constructor() {
    const document = createEmptyDrawing({ idFactory: { next: () => 'motion-preview' }, now: () => 1 });
    document.geometry = [{
      id: 'arm' as GeometryId,
      type: 'line', start: [0, 0], end: [10, 0], visible: true, quality,
    }];
    this.value = {
      version: 1,
      ref: { drawingId: 'motion-preview', revision: 3 },
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

describe('DrawingWorkspace motion preview', () => {
  it('wires the held preview action to the canvas presentation state', async () => {
    const port = new MotionPreviewPort();
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    const candidate = structuredClone(port.value);
    const movedArm = candidate.document.geometry[0];
    if (movedArm?.type !== 'line') throw new Error('expected line');
    movedArm.start = [5, 5];
    movedArm.end = [15, 5];
    store.setState({
      displaySnapshot: candidate,
      motionRig: {
        phase: 'preview',
        projection: {
          version: 1,
          drawingRef: structuredClone(port.value.ref),
          state: 'ready',
          controlBodyNodeIds: ['arm'],
          connectors: [],
          anchor: [0, 0],
          handle: [5, 5],
          keepAnchorFixed: true,
          keepControlBodyRigid: true,
          preserveConnectivity: true,
          allowControlRotation: false,
        },
      },
    });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DrawingWorkspaceProvider store={store} autoLoad={false}>
          <DrawingWorkspace />
        </DrawingWorkspaceProvider>,
      );
    });

    const preview = renderer.root.findByProps({ 'aria-label': '按住预览修改效果' });
    expect(renderer.root.findByProps({ 'data-canvas-root': 'true' }).props['data-motion-preview-held'])
      .toBeUndefined();
    act(() => preview.props.onPointerDown({
      button: 0,
      pointerId: 9,
      preventDefault() {},
      currentTarget: { setPointerCapture() {} },
    }));
    expect(renderer.root.findByProps({ 'data-canvas-root': 'true' }).props['data-motion-preview-held'])
      .toBe(true);
    act(() => renderer.root.findByProps({ 'aria-label': '按住预览修改效果' }).props.onPointerUp());
    expect(renderer.root.findByProps({ 'data-canvas-root': 'true' }).props['data-motion-preview-held'])
      .toBeUndefined();
    act(() => renderer.unmount());
  });
});
