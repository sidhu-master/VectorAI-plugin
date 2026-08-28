// SPDX-License-Identifier: Apache-2.0

import { DRAWING_SURFACE_API_VERSION, type DrawingWorkspaceContribution } from '@vectorai/drawing-surface-api';
import type { DrawingSurfaceRuntime } from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { DrawingSurfaceHost } from './DrawingSurfaceHost';
import { createDrawingSurfaceRegistry } from './surface-registry';

function observable<T>(value: T) {
  return { getSnapshot: () => value, subscribe: () => () => undefined };
}

function runtime(hasDrawing: boolean): DrawingSurfaceRuntime {
  return {
    snapshot: observable(hasDrawing ? { ref: { drawingId: 'drawing-1', revision: 1 } } : null),
    viewport: observable({ x: 0, y: 0, scale: 1, width: 100, height: 100 }),
    selection: observable([]),
    presentation: observable({}),
    actions: {},
  } as unknown as DrawingSurfaceRuntime;
}

function specialized(Component: DrawingWorkspaceContribution['Component']): DrawingWorkspaceContribution {
  return {
    id: 'annotation',
    apiVersion: DRAWING_SURFACE_API_VERSION,
    priority: 10,
    claimSource: {
      observe: (sessionId) => observable({ active: sessionId === 'session-a', activationEpoch: 1 }),
    },
    Component,
  };
}

describe('DrawingSurfaceHost', () => {
  it('renders nothing without a drawing or a specialized claim', () => {
    const renderer = TestRenderer.create(<DrawingSurfaceHost
      sessionId="session-b"
      registry={createDrawingSurfaceRegistry()}
      runtime={runtime(false)}
      fallback={<span data-fallback="" />}
    />);
    expect(renderer.toJSON()).toBeNull();
  });

  it('uses the permanent fallback for a drawing with no active contribution', () => {
    const renderer = TestRenderer.create(<DrawingSurfaceHost
      sessionId="session-b"
      registry={createDrawingSurfaceRegistry()}
      runtime={runtime(true)}
      fallback={<span data-fallback="" />}
    />);
    expect(renderer.root.findByProps({ 'data-fallback': '' })).toBeDefined();
  });

  it('renders the elected contribution with a restricted runtime', () => {
    const registry = createDrawingSurfaceRegistry();
    registry.registerWorkspace(specialized(({ sessionId, namespace, runtime: received, layerRegistry }) => (
      <span
        data-specialized={sessionId}
        data-namespace={namespace}
        data-restricted={String(received === runtimeValue)}
        data-layer-registry={String(layerRegistry === registry)}
      />
    )));
    const runtimeValue = runtime(false);
    const renderer = TestRenderer.create(<DrawingSurfaceHost
      sessionId="session-a"
      registry={registry}
      runtime={runtimeValue}
      fallback={<span data-fallback="" />}
    />);

    expect(renderer.root.findByProps({
      'data-specialized': 'session-a',
      'data-namespace': 'annotation',
      'data-restricted': 'true',
      'data-layer-registry': 'true',
    })).toBeDefined();
    expect(renderer.root.findByProps({
      'data-drawing-surface-contribution': 'annotation',
      'data-conversation-workspace-active': '',
    }).props.style).toEqual({
      display: 'flex',
      flex: '1 1 auto',
      minWidth: 0,
      minHeight: 0,
    });
  });

  it('contains contribution render failures without yielding ownership to the fallback', () => {
    const registry = createDrawingSurfaceRegistry();
    registry.registerWorkspace(specialized(() => { throw new Error('render exploded'); }));
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<DrawingSurfaceHost
        sessionId="session-a"
        registry={registry}
        runtime={runtime(true)}
        fallback={<span data-fallback="" />}
      />);
    });

    expect(renderer!.root.findByProps({ 'data-drawing-contribution-error': 'annotation' })).toBeDefined();
    expect(renderer!.root.findAllByProps({ 'data-fallback': '' })).toHaveLength(0);
  });
});
