import { describe, expect, it } from 'vitest';

import { vectorRevealTiming } from './reveal';

describe('vectorRevealTiming', () => {
  it('starts a single outline immediately and stays inside the preview window', () => {
    expect(vectorRevealTiming(0, 1)).toEqual({ delayMs: 0, durationMs: 300 });
  });

  it('stagger-reveals a full 48-node vectorization batch within 520ms', () => {
    const timings = Array.from({ length: 48 }, (_, index) => vectorRevealTiming(index, 48));

    expect(timings.map((timing) => timing.delayMs)).toEqual(
      [...timings].map((timing) => timing.delayMs).sort((left, right) => left - right),
    );
    expect(timings.at(-1)!.delayMs + timings.at(-1)!.durationMs).toBeLessThanOrEqual(520);
  });

  it('clamps invalid indexes and totals to bounded CSS-safe timing', () => {
    expect(vectorRevealTiming(-20, 0)).toEqual({ delayMs: 0, durationMs: 300 });
    expect(vectorRevealTiming(999, 2)).toEqual({ delayMs: 220, durationMs: 300 });
  });
});
