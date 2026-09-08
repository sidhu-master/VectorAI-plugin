// SPDX-License-Identifier: Apache-2.0

import type { LeaderAnnotation, Vec2 } from './types';

/** Render paths without changing the persisted detail center or branch anchors. */
export function leaderPaths(node: LeaderAnnotation): Vec2[][] {
  const main = node.points.map((point): Vec2 => [...point]);
  if (node.callout?.type === 'detail' && main.length >= 2) {
    const [center, next] = main;
    const distance = Math.hypot(next[0] - center[0], next[1] - center[1]);
    if (distance > 1e-10) main[0] = [center[0] + (next[0] - center[0]) * node.callout.radius / distance, center[1] + (next[1] - center[1]) * node.callout.radius / distance];
  }
  return [main, ...(node.branches ?? []).map(({ points }) => points.map((point): Vec2 => [...point]))];
}

/** Extended leaders have explicit tips; legacy single paths retain their existing rendering. */
export function leaderArrowTriangles(node: LeaderAnnotation, arrowSize = node.textHeight): Vec2[][] {
  if ((node.arrowhead ?? (node.branches?.length ? 'closed-filled' : 'none')) === 'none') return [];
  const paths = [...(node.callout ? [] : [node.points]), ...(node.branches ?? []).map(({ points }) => points)];
  return paths.flatMap((points): Vec2[][] => {
    if (points.length < 2) return [];
    const [tip, next] = points;
    const distance = Math.hypot(next[0] - tip[0], next[1] - tip[1]);
    if (distance <= 1e-10) return [];
    const size = Math.min(arrowSize, distance * 0.8);
    const dx = (next[0] - tip[0]) * size / distance;
    const dy = (next[1] - tip[1]) * size / distance;
    return [[tip, [tip[0] + dx - dy / 6, tip[1] + dy + dx / 6], [tip[0] + dx + dy / 6, tip[1] + dy - dx / 6]]];
  });
}

export function leaderGeometryPoints(node: LeaderAnnotation): Vec2[] {
  const points = [...node.points, ...(node.branches ?? []).flatMap(({ points }) => points), ...leaderArrowTriangles(node).flat()];
  if (node.callout?.type === 'detail' && node.points[0]) {
    const [x, y] = node.points[0];
    const { radius } = node.callout;
    points.push([x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius]);
  }
  return points;
}
