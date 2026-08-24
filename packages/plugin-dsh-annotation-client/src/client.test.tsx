// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import { describe, expect, it, vi } from 'vitest';

import { apply } from './client';

describe('annotation client contribution', () => {
  it('registers independently without claiming or registering the DSH workspace slot', async () => {
    const disposeContribution = vi.fn();
    const disposeRemote = vi.fn();
    let disposeInjected: (() => void) | undefined;
    const disposeFiber = vi.fn(async () => disposeInjected?.());
    let registered: { id: string; claimSource: { observe(sessionId: string): { getSnapshot(): unknown } } } | undefined;
    const registry = {
      registerWorkspace: vi.fn((contribution) => {
        registered = contribution;
        return { dispose: disposeContribution };
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
        throw new Error(`unexpected service ${name}`);
      },
      inject(deps: string[], callback: (scope: Context) => unknown) {
        expect(deps).toEqual(['remote.drawingAnnotation', 'drawingSurfaceRegistry']);
        disposeInjected = callback(ctx as unknown as Context) as (() => void) | undefined;
        return { dispose: disposeFiber };
      },
    } as unknown as Context;

    const dispose = await apply(ctx);
    expect(registered?.id).toBe('engineering-annotation');
    expect(registered?.claimSource.observe('session-1').getSnapshot())
      .toEqual({ active: false, activationEpoch: 0 });
    expect(ctx).not.toHaveProperty('slots');

    await dispose();
    expect(disposeFiber).toHaveBeenCalledOnce();
    expect(disposeContribution).toHaveBeenCalledOnce();
    expect(disposeRemote).toHaveBeenCalledOnce();
  });
});
