// SPDX-License-Identifier: Apache-2.0

import type { AxialDimensionCandidate } from './types';

/**
 * Transition-detail candidates remain available to dimension-chain arithmetic,
 * but the automatic drafting policy must not place them on the drawing.
 * An explicit required interval always wins over geometry-only suppression.
 */
export function isAxialDimensionCandidateSuppressed(candidate: AxialDimensionCandidate): boolean {
  return candidate.constraint === 'prohibited' && !candidate.required;
}
