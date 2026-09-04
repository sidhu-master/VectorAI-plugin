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
 * long-outside ordering. Any non-overlapping dimensions may share a lane;
 * a new lane is introduced only when the occupied intervals collide.
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
  const laneIntervals: Array<Array<{ start: number; end: number }>> = [];
  for (const item of ordered) {
    let lane = laneIntervals.findIndex((intervals) => intervals.every((interval) => (
      item.occupiedEnd + safeGap <= interval.start
      || item.occupiedStart >= interval.end + safeGap
    )));
    if (lane < 0) {
      lane = laneIntervals.length;
      laneIntervals.push([]);
    }
    laneIntervals[lane]!.push({ start: item.occupiedStart, end: item.occupiedEnd });
    result.set(item.id, lane);
  }
  return result;
}
