// SPDX-License-Identifier: Apache-2.0

export function scheduleFrame(callback: FrameRequestCallback): number | null {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    callback(0);
    return null;
  }
  return globalThis.requestAnimationFrame(callback);
}

export function cancelFrame(frame: number | null): void {
  if (frame === null || typeof globalThis.cancelAnimationFrame !== 'function') return;
  globalThis.cancelAnimationFrame(frame);
}
