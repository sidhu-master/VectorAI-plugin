// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import { describe, expect, it, vi } from 'vitest';

import { apply } from './client';

describe('annotation client contribution', () => {
  it('registers independently without claiming or registering the DSH workspace slot', async () => {
    const disposeContribution = vi.fn();
    const disposeLayer = vi.fn();
    const disposeRemote = vi.fn();
    let disposeInjected: (() => void | Promise<void>) | undefined;
    const disposeFiber = vi.fn(async () => { await disposeInjected?.(); });
    let registered: { id: string; claimSource: { observe(sessionId: string): { getSnapshot(): unknown } } } | undefined;
    const registeredLayers: unknown[] = [];
    const registry = {
      registerLayer: vi.fn((definition) => {
        registeredLayers.push(definition);
        return { dispose: disposeLayer };
      }),
      registerWorkspace: vi.fn((contribution) => {
        registered = contribution;
        return { dispose: disposeContribution };
      }),
    };
    let dropEntry: {
      options: { name: string; id: string; inject(sessionId: string): unknown };
      component: unknown;
    } | undefined;
    const disposeDropEntry = vi.fn();
    const disposeDropFiber = vi.fn(async () => disposeDropEntry());
    const slots = {
      register: vi.fn((options, component) => {
        dropEntry = { options, component };
        return disposeDropEntry;
      }),
      inject: vi.fn((name: string, callback: () => unknown) => {
        expect(name).toBe('conversation.input.dock');
        callback();
        return { dispose: disposeDropFiber };
      }),
    };
    const remote = {
      $mount: vi.fn(async () => disposeRemote),
      drawingAnnotation: {
        getSessionState: vi.fn(async () => ({
          ok: true as const,
          value: {
            version: 1 as const, workspaceClaimed: false, activationEpoch: 0,
            workflow: { status: 'idle' as const },
          },
        })),
      },
    };
    const ctx = {
      get(name: string) {
        if (name === 'remote') return remote;
        if (name === 'drawingSurfaceRegistry') return registry;
        if (name === 'slots') return slots;
        throw new Error(`unexpected service ${name}`);
      },
      inject(deps: string[], callback: (scope: Context) => unknown) {
        expect(deps).toEqual(['remote.drawingAnnotation', 'drawingSurfaceRegistry', 'slots']);
        disposeInjected = callback(ctx as unknown as Context) as (() => void) | undefined;
        return { dispose: disposeFiber };
      },
    } as unknown as Context;

    const dispose = await apply(ctx);
    expect(registered?.id).toBe('engineering-annotation');
    expect(registeredLayers).toEqual([
      {
        id: 'vectorai.annotation.partition',
        label: '智能分区',
        category: 'engineering',
        icon: 'partition',
        order: 100,
        defaultVisible: true,
      },
      {
        id: 'vectorai.annotation.opening-angle',
        label: '开角标注',
        category: 'engineering',
        icon: 'angle',
        order: 110,
        defaultVisible: true,
      },
      {
        id: 'vectorai.annotation.diameter',
        label: '直径标注',
        category: 'engineering',
        icon: 'dimension',
        order: 115,
        defaultVisible: true,
      },
      {
        id: 'vectorai.annotation.dimension-chain',
        label: '尺寸链',
        category: 'engineering',
        icon: 'dimension',
        order: 120,
        defaultVisible: true,
      },
      {
        id: 'vectorai.annotation.datum',
        label: '基准',
        category: 'engineering',
        icon: 'dimension',
        order: 125,
        defaultVisible: true,
      },
      {
        id: 'vectorai.annotation.gdt',
        label: '形位公差',
        category: 'engineering',
        icon: 'dimension',
        order: 130,
        defaultVisible: true,
      },
    ]);
    expect(registered?.claimSource.observe('session-1').getSnapshot())
      .toEqual({ active: false, activationEpoch: 0 });
    expect(dropEntry?.options).toMatchObject({
      name: 'conversation.input.dock',
      id: 'vectorai-engineering-import-drop',
    });
    expect(dropEntry?.component).toEqual(expect.any(Function));
    expect(dropEntry?.options.inject('session-1')).toMatchObject({
      partition: expect.any(Object),
      refreshClaim: expect.any(Function),
    });

    await dispose();
    expect(disposeFiber).toHaveBeenCalledOnce();
    expect(disposeDropFiber).toHaveBeenCalledOnce();
    expect(disposeContribution).toHaveBeenCalledOnce();
    expect(disposeLayer).toHaveBeenCalledTimes(6);
    expect(disposeRemote).toHaveBeenCalledOnce();
  });
});
