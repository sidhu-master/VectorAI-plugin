// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import { describe, expect, it, vi } from 'vitest';
import { apply } from './client';

describe('client apply', () => {
  it('captures injected services before callbacks run outside the plugin fiber', async () => {
    const getProjection = vi.fn(async () => ({ ok: true as const, value: null }));
    const disposeRemote = vi.fn();
    const disposeSlot = vi.fn();
    const disposeViewFiber = vi.fn(async () => disposeSlot());
    let registration: { inject(sessionId: string): { loadDrawing(): Promise<unknown> } } | undefined;

    let pluginActive = true;
    const drawingSpace = { getProjection };
    const remote = {
      $mount: vi.fn(async () => disposeRemote),
      get drawingSpace() {
        if (!pluginActive) {
          throw new Error('remote namespace accessed outside inject');
        }
        return drawingSpace;
      },
    };
    const slots = {
      inject: vi.fn((_name: string, callback: () => unknown) => callback()),
      register: vi.fn((descriptor: typeof registration) => {
        registration = descriptor;
        return disposeSlot;
      }),
    };
    const ctx = {
      get(name: string) {
        if (name === 'remote') return remote;
        if (name === 'slots') return slots;
        throw new Error(`unexpected service ${name}`);
      },
      inject(deps: string[], callback: (scope: Context) => unknown) {
        expect(deps).toEqual(['remote.drawingSpace']);
        callback(ctx);
        return { dispose: disposeViewFiber };
      },
      get remote(): never {
        throw new Error('remote property accessed outside inject');
      },
      get slots(): never {
        throw new Error('slots property accessed outside inject');
      },
    } as unknown as Context;

    const dispose = await apply(ctx);
    pluginActive = false;
    const loadDrawing = registration?.inject('session-1').loadDrawing;
    expect(loadDrawing).toBeTypeOf('function');
    await expect(loadDrawing?.()).resolves.toEqual({ ok: true, value: null });
    expect(getProjection).toHaveBeenCalledWith('session-1');

    await dispose();
    expect(disposeViewFiber).toHaveBeenCalledOnce();
    expect(disposeSlot).toHaveBeenCalledOnce();
    expect(disposeRemote).toHaveBeenCalledOnce();
  });
});
