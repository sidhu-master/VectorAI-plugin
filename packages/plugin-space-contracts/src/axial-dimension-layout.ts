// SPDX-License-Identifier: Apache-2.0

export interface AxialDimensionLaneItem {
  id: string;
  /** Engineering span used to order dimensions from short/inner to long/outer. */
  span: number;
  /** Occupied interval used to prevent labels on the same length tier from colliding. */
  occupiedStart: number;
  occupiedEnd: number;
}

/**
 * Allocate stable axial-dimension lanes using the conventional short-inside,
 * long-outside ordering. Equal-length, non-overlapping dimensions share a lane.
 */
export function allocateAxialDimensionLanes(
  items: readonly AxialDimensionLaneItem[],
  gap = 0,
): ReadonlyMap<string, number> {
  const safeGap = Math.max(0, gap);
  const ordered = items.map((item) => ({
    ...item,
    span: Math.abs(item.span),
    occupiedStart: Math.min(item.occupiedStart, item.occupiedEnd),
    occupiedEnd: Math.max(item.occupiedStart, item.occupiedEnd),
  })).sort((a, b) => a.span - b.span
    || a.occupiedStart - b.occupiedStart
    || a.occupiedEnd - b.occupiedEnd
    || a.id.localeCompare(b.id));

  const result = new Map<string, number>();
  let groupStart = 0;
  let cursor = 0;
  while (cursor < ordered.length) {
    const groupSpan = ordered[cursor]!.span;
    const group: typeof ordered = [];
    while (cursor < ordered.length && sameSpan(ordered[cursor]!.span, groupSpan)) {
      group.push(ordered[cursor]!);
      cursor += 1;
    }

    const laneEnds: number[] = [];
    for (const item of group) {
      let localLane = laneEnds.findIndex((end) => item.occupiedStart >= end + safeGap);
      if (localLane < 0) localLane = laneEnds.length;
      laneEnds[localLane] = item.occupiedEnd;
      result.set(item.id, groupStart + localLane);
    }
    groupStart += Math.max(1, laneEnds.length);
  }
  return result;
}

function sameSpan(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;
}
