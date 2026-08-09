import { describe, expect, it, vi } from 'vitest';

import { createCanvasPanSession } from './pan-interaction';

describe('canvas pan interaction', () => {
  it('previews pointer movement without committing and commits the final transform once', () => {
    const commit = vi.fn();
    const session = createCanvasPanSession(
      { x: 10, y: 20 },
      { scale: 2, offsetX: 100, offsetY: 200 },
      commit,
    );

    expect(session.preview({ x: 15, y: 12 })).toEqual({
      transform: { scale: 2, offsetX: 105, offsetY: 192 },
      deltaX: 5,
      deltaY: -8,
    });
    expect(session.preview({ x: 30, y: 35 })).toEqual({
      transform: { scale: 2, offsetX: 120, offsetY: 215 },
      deltaX: 20,
      deltaY: 15,
    });
    expect(commit).not.toHaveBeenCalled();

    expect(session.finish()).toEqual({ scale: 2, offsetX: 120, offsetY: 215 });
    expect(session.finish()).toEqual({ scale: 2, offsetX: 120, offsetY: 215 });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({ scale: 2, offsetX: 120, offsetY: 215 });
  });
});
