// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingMotionRigProjection,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DrawingWorkspaceProvider } from '../provider';
import { Canvas } from './Canvas';

function fixture(): { snapshot: DrawingWorkspaceSnapshot; rig: DrawingMotionRigProjection } {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
  document.geometry = [
    {
      id: 'hand' as GeometryId, type: 'circle', center: [20, 20], radius: 3,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    },
    {
      id: 'arm' as GeometryId, type: 'line', start: [0, 20], end: [17, 20],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    },
  ];
  return {
    snapshot: {
      version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    },
    rig: {
      version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 }, state: 'ready',
      controlBodyNodeIds: ['hand'],
      connectors: [{ nodeId: 'arm', movingEndpoint: 'end', fixedPoint: [0, 20] }],
      anchor: [0, 20], handle: [20, 20], keepAnchorFixed: true,
      keepControlBodyRigid: true, preserveConnectivity: true, allowControlRotation: false,
    },
  };
}

describe('Canvas temporary motion rig', () => {
  it('routes handle movement through local solve and enters Preview on pointer-up', async () => {
    const value = fixture();
    const port: DrawingWorkspacePort = {
      load: async () => value.snapshot,
      loadMotionRig: async () => value.rig,
      commit: async (_request: DrawingWorkspaceCommitRequest) => ({
        status: 'rejected', code: 'not-used', message: 'not used',
      }),
    };
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    store.getState().setViewport({ x: 0, y: 0, scale: 1, width: 100, height: 100 });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DrawingWorkspaceProvider store={store} autoLoad={false}><Canvas /></DrawingWorkspaceProvider>,
      );
    });
    const svgElement = { tagName: 'svg', getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    const handleElement = { tagName: 'circle', ownerSVGElement: svgElement };
    const handle = renderer.root.findByProps({ 'aria-label': '拖动可动部件' });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    act(() => handle.props.onMouseDown({
      button: 0, clientX: 20, clientY: -20, currentTarget: handleElement,
      preventDefault, stopPropagation,
    }));
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    act(() => svg.props.onMouseMove({
      clientX: 30, clientY: -25, currentTarget: svgElement,
    }));
    act(() => svg.props.onMouseUp({
      clientX: 30, clientY: -25, currentTarget: svgElement,
    }));

    expect(store.getState().motionRig?.phase).toBe('preview');
    expect(store.getState().motionRig?.projection.handle).toEqual([30, 25]);
    expect(store.getState().displaySnapshot?.document.geometry).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'hand', center: [30, 25] }),
      expect.objectContaining({ id: 'arm', start: [0, 20], end: [27, 25] }),
    ]));
    act(() => renderer.unmount());
  });
});
