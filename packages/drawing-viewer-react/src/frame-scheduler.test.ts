// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cancelFrame, scheduleFrame } from './frame-scheduler';

describe('frame scheduler', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('applies a preview synchronously when the host has no animation-frame API', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const apply = vi.fn();

    expect(scheduleFrame(apply)).toBeNull();
    expect(apply).toHaveBeenCalledOnce();
  });

  it('uses and cancels the host animation frame when available', () => {
    let queued: FrameRequestCallback | undefined;
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      queued = callback;
      return 17;
    }));
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const apply = vi.fn();

    expect(scheduleFrame(apply)).toBe(17);
    expect(apply).not.toHaveBeenCalled();
    queued?.(4);
    expect(apply).toHaveBeenCalledWith(4);

    cancelFrame(17);
    expect(cancel).toHaveBeenCalledWith(17);
  });
});
