// SPDX-License-Identifier: Apache-2.0

export interface DiameterLayoutSpan {
  id: string;
  zStart: number;
  zEnd: number;
  radius: number;
}

export interface DiameterLayoutBounds {
  zMin: number;
  zMax: number;
  maximumRadius: number;
}

export type DiameterLayoutPlacement<T extends DiameterLayoutSpan> = T & {
  side: 'left' | 'right';
  placement: 'interior' | 'exterior';
  dimensionZ: number;
};

/**
 * Prefers the owning shaft span when it has enough room for a readable label.
 * Colliding or short-span dimensions fall back outside the nearest real shaft
 * end; only that exterior subset is ordered by diameter.
 */
export function layoutDiameterSpans<T extends DiameterLayoutSpan>(
  spans: readonly T[],
  bounds: DiameterLayoutBounds,
): Array<DiameterLayoutPlacement<T>> {
  const extent = Math.max(bounds.zMax - bounds.zMin, bounds.maximumRadius * 2, Number.EPSILON);
  const minimumInteriorWidth = Math.max(bounds.maximumRadius * 0.45, extent * 0.03);
  const minimumInteriorSpacing = Math.max(bounds.maximumRadius * 0.5, extent * 0.035);
  const interiorIds = selectInteriorSpans(spans, minimumInteriorWidth, minimumInteriorSpacing);
  const classified = spans.map((span) => ({
    span,
    side: nearestSide(span, bounds),
    placement: interiorIds.has(span.id) ? 'interior' as const : 'exterior' as const,
  } as const));
  const baseGap = Math.max(bounds.maximumRadius * 0.35, extent * 0.015);
  const lanePitch = Math.max(bounds.maximumRadius * 0.3, extent * 0.012);
  const dimensionById = new Map<string, number>();

  for (const { span, placement } of classified) {
    if (placement === 'interior') dimensionById.set(span.id, midpoint(span));
  }

  for (const side of ['left', 'right'] as const) {
    const group = classified
      .filter((item) => item.placement === 'exterior' && item.side === side)
      .sort((left, right) => (
        left.span.radius - right.span.radius
        || left.span.zStart - right.span.zStart
        || left.span.zEnd - right.span.zEnd
        || left.span.id.localeCompare(right.span.id)
      ));
    group.forEach(({ span }, lane) => {
      const distance = baseGap + lane * lanePitch;
      dimensionById.set(span.id, side === 'left' ? bounds.zMin - distance : bounds.zMax + distance);
    });
  }

  return classified.map(({ span, side, placement }) => ({
    ...span,
    side,
    placement,
    dimensionZ: dimensionById.get(span.id)!,
  }));
}

function selectInteriorSpans<T extends DiameterLayoutSpan>(
  spans: readonly T[],
  minimumWidth: number,
  minimumSpacing: number,
): Set<string> {
  const selected: T[] = [];
  for (const span of [...spans].sort((left, right) => (
    (right.zEnd - right.zStart) - (left.zEnd - left.zStart)
    || right.radius - left.radius
    || left.id.localeCompare(right.id)
  ))) {
    if (span.zEnd - span.zStart < minimumWidth) continue;
    const center = midpoint(span);
    if (selected.some((other) => Math.abs(center - midpoint(other)) < minimumSpacing)) continue;
    selected.push(span);
  }
  return new Set(selected.map(({ id }) => id));
}

function nearestSide(span: DiameterLayoutSpan, bounds: DiameterLayoutBounds): 'left' | 'right' {
  const leftGap = Math.max(0, span.zStart - bounds.zMin);
  const rightGap = Math.max(0, bounds.zMax - span.zEnd);
  return leftGap <= rightGap ? 'left' : 'right';
}

function midpoint(span: DiameterLayoutSpan): number { return (span.zStart + span.zEnd) / 2; }
