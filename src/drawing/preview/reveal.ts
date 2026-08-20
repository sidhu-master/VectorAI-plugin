export const VECTOR_REVEAL_DURATION_MS = 300;
export const VECTOR_REVEAL_STAGGER_MS = 220;
export const VECTOR_REVEAL_TOTAL_MS = VECTOR_REVEAL_DURATION_MS + VECTOR_REVEAL_STAGGER_MS;

export interface VectorRevealTiming {
  delayMs: number;
  durationMs: number;
}

export function vectorRevealTiming(index: number, total: number): VectorRevealTiming {
  const safeTotal = Math.max(1, finiteInteger(total, 1));
  const safeIndex = Math.min(safeTotal - 1, Math.max(0, finiteInteger(index, 0)));
  const delayMs = safeTotal === 1
    ? 0
    : Math.round((safeIndex / (safeTotal - 1)) * VECTOR_REVEAL_STAGGER_MS);
  return { delayMs, durationMs: VECTOR_REVEAL_DURATION_MS };
}

function finiteInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}
