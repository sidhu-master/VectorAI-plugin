// SPDX-License-Identifier: Apache-2.0

import {
  DRAWING_SURFACE_API_VERSION,
  type DrawingLayerDefinition,
  type DrawingSurfaceObservable,
  type DrawingWorkspaceClaim,
  type DrawingWorkspaceContribution,
} from '@vectorai/drawing-surface-api';
import { describe, expect, it, vi } from 'vitest';

import { createDrawingSurfaceRegistry } from './surface-registry';

function claims(initial: Record<string, DrawingWorkspaceClaim>) {
  const values = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();
  return {
    source: {
      observe(sessionId: string): DrawingSurfaceObservable<DrawingWorkspaceClaim> {
        return {
          getSnapshot: () => values.get(sessionId) ?? { active: false, activationEpoch: 0 },
          subscribe(listener) {
            const group = listeners.get(sessionId) ?? new Set();
            group.add(listener);
            listeners.set(sessionId, group);
            return () => group.delete(listener);
          },
        };
      },
    },
    set(sessionId: string, value: DrawingWorkspaceClaim) {
      values.set(sessionId, value);
      for (const listener of listeners.get(sessionId) ?? []) listener();
    },
  };
}

const Component = () => null;

function contribution(
  id: string,
  claimSource: ReturnType<typeof claims>['source'],
  priority = 0,
): DrawingWorkspaceContribution {
  return { id, apiVersion: DRAWING_SURFACE_API_VERSION, priority, claimSource, Component };
}

describe('drawing surface registry', () => {
  it('registers drawing layers in stable order and releases them idempotently', () => {
    const registry = createDrawingSurfaceRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribeLayers(listener);
    const partition: DrawingLayerDefinition = {
      id: 'vectorai.annotation.partition',
      label: '智能分区',
      category: 'engineering',
      icon: 'partition',
      order: 100,
      defaultVisible: true,
    };
    const angle: DrawingLayerDefinition = {
      id: 'vectorai.annotation.angle',
      label: '开角标注',
      category: 'engineering',
      icon: 'angle',
      order: 50,
      defaultVisible: true,
    };
    const angleRegistration = registry.registerLayer(angle);
    const partitionRegistration = registry.registerLayer(partition);

    expect(registry.getLayers()).toEqual([angle, partition]);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(() => registry.registerLayer(partition))
      .toThrow('DUPLICATE_DRAWING_LAYER:vectorai.annotation.partition');

    angleRegistration.dispose();
    angleRegistration.dispose();
    expect(registry.getLayers()).toEqual([partition]);
    expect(listener).toHaveBeenCalledTimes(3);
    partitionRegistration.dispose();
    unsubscribe();
  });

  it('rejects duplicate IDs and removes a registration idempotently', () => {
    const registry = createDrawingSurfaceRegistry();
    const claim = claims({});
    const disposable = registry.registerWorkspace(contribution('annotation', claim.source));

    expect(() => registry.registerWorkspace(contribution('annotation', claim.source)))
      .toThrow('DUPLICATE_DRAWING_WORKSPACE_CONTRIBUTION:annotation');
    expect(registry.getWorkspaceSnapshot('session-a').contributionIds).toEqual(['annotation']);

    disposable.dispose();
    disposable.dispose();
    expect(registry.getWorkspaceSnapshot('session-a').contributionIds).toEqual([]);
  });

  it('elects independently per session and reacts to claim changes', () => {
    const registry = createDrawingSurfaceRegistry();
    const annotation = claims({
      'session-a': { active: true, activationEpoch: 4 },
      'session-b': { active: false, activationEpoch: 4 },
    });
    const inspection = claims({
      'session-a': { active: true, activationEpoch: 3 },
    });
    registry.registerWorkspace(contribution('annotation', annotation.source, 1));
    registry.registerWorkspace(contribution('inspection', inspection.source, 100));

    expect(registry.getWorkspaceSnapshot('session-a').electedId).toBe('annotation');
    expect(registry.getWorkspaceSnapshot('session-b').electedId).toBeNull();

    const listener = vi.fn();
    const unsubscribe = registry.subscribe('session-a', listener);
    inspection.set('session-a', { active: true, activationEpoch: 5 });
    expect(listener).toHaveBeenCalledOnce();
    expect(registry.getWorkspaceSnapshot('session-a').electedId).toBe('inspection');
    unsubscribe();
  });

  it('falls back while a claimed contribution is missing and restores it after re-registration', () => {
    const registry = createDrawingSurfaceRegistry();
    const sticky = claims({ 'session-a': { active: true, activationEpoch: 7 } });
    const first = registry.registerWorkspace(contribution('annotation', sticky.source));
    expect(registry.getWorkspaceSnapshot('session-a').electedId).toBe('annotation');

    first.dispose();
    expect(registry.getWorkspaceSnapshot('session-a').electedId).toBeNull();
    registry.registerWorkspace(contribution('annotation', sticky.source));
    expect(registry.getWorkspaceSnapshot('session-a').electedId).toBe('annotation');
  });

  it('keeps incompatible registered contributions unavailable for election', () => {
    const registry = createDrawingSurfaceRegistry();
    const active = claims({ 'session-a': { active: true, activationEpoch: 9 } });
    registry.registerWorkspace({
      ...contribution('future', active.source),
      apiVersion: 2,
    } as unknown as DrawingWorkspaceContribution);

    expect(registry.getWorkspaceSnapshot('session-a')).toEqual({
      electedId: null,
      contributionIds: ['future'],
    });
  });
});
