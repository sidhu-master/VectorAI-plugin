// SPDX-License-Identifier: Apache-2.0

import type { DrawingMotionRigWorkspaceState } from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { MotionRigOverlay } from './MotionRigOverlay';

const rig: DrawingMotionRigWorkspaceState = {
  phase: 'ready',
  projection: {
    version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 }, state: 'ready',
    controlBodyNodeIds: ['hand'],
    connectors: [{ nodeId: 'arm', movingEndpoint: 'end', fixedPoint: [0, 20] }],
    anchor: [0, 20], handle: [20, 20],
    keepAnchorFixed: true, keepControlBodyRigid: true,
    preserveConnectivity: true, allowControlRotation: false,
  },
};

describe('MotionRigOverlay', () => {
  it('renders one fixed anchor and one accessible draggable control handle', () => {
    const onHandleMouseDown = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <svg><MotionRigOverlay rig={rig} viewportScale={2} onHandleMouseDown={onHandleMouseDown} /></svg>,
      );
    });

    expect(renderer.root.findByProps({ 'data-motion-rig-anchor': true }).props).toMatchObject({
      cx: 0, cy: 20,
    });
    const handle = renderer.root.findByProps({ 'aria-label': '拖动可动部件' });
    expect(handle.props).toMatchObject({ cx: 20, cy: 20, role: 'button' });
    const event = { button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => handle.props.onMouseDown(event));
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onHandleMouseDown).toHaveBeenCalledWith(event);
    act(() => renderer.unmount());
  });

  it('reports Preview status without relying on marker color', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <svg><MotionRigOverlay rig={{ ...rig, phase: 'preview' }} viewportScale={1} onHandleMouseDown={() => {}} /></svg>,
      );
    });

    expect(renderer.root.findByProps({ 'data-motion-rig-status': 'preview' }).children).toEqual(['等待确认']);
    const label = renderer.root.findByProps({ 'data-screen-space-label': true });
    expect(label.props.transform).toContain('scale(1 -1)');
    expect(label.findByType('text').props.fontSize).toBe(11);
    act(() => renderer.unmount());
  });

  it('renders directly draggable connector contacts while Preview remains active', () => {
    const onConnectorMouseDown = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <svg>
          <MotionRigOverlay
            rig={{ ...rig, phase: 'preview' }}
            viewportScale={2}
            connectorHandles={[{ nodeId: 'arm', point: [17, 20] }]}
            onHandleMouseDown={() => {}}
            onConnectorMouseDown={onConnectorMouseDown}
          />
        </svg>,
      );
    });

    const handle = renderer.root.findByProps({ 'aria-label': '调整 arm 与可动部件的接点' });
    expect(handle.props).toMatchObject({ cx: 17, cy: 20, role: 'button' });
    const event = { button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    act(() => handle.props.onMouseDown(event));
    expect(onConnectorMouseDown).toHaveBeenCalledWith('arm', event);
    act(() => renderer.unmount());
  });
});
