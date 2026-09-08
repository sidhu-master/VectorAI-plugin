// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { leaderArrowTriangles, leaderGeometryPoints, leaderPaths } from './leader';
import type { LeaderAnnotation } from './types';

const base: LeaderAnnotation = {
  id: 'leader-1' as never, type: 'leader', visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
  target: { geometryId: 'edge-1' as never, anchor: { kind: 'start' } },
  points: [[0, 0], [10, 0], [12, 2]], content: 'I', textHeight: 3.5,
};

describe('portable leader geometry', () => {
  it('preserves old single leaders and constructs branches with independent arrow tips', () => {
    expect(leaderPaths(base)).toEqual([base.points]);
    expect(leaderArrowTriangles(base)).toEqual([]);
    expect(leaderArrowTriangles({ ...base, arrowhead: 'closed-filled' }).map(([tip]) => tip)).toEqual([[0, 0]]);
    const leader = { ...base, branches: [{ target: { geometryId: 'edge-2' as never, anchor: { kind: 'end' as const } }, points: [[2, -20], [10, 0]] as LeaderAnnotation['points'] }] };
    expect(leaderPaths(leader)).toEqual([base.points, [[2, -20], [10, 0]]]);
    expect(leaderArrowTriangles(leader).map(([tip]) => tip)).toEqual([[0, 0], [2, -20]]);
    expect(leaderArrowTriangles({ ...leader, arrowhead: 'none' })).toEqual([]);
    expect(leaderGeometryPoints(leader)).toContainEqual([2, -20]);
  });

  it('uses the persisted center for a detail circle and starts the path at its circumference', () => {
    const leader: LeaderAnnotation = { ...base, callout: { type: 'detail', radius: 4 } };
    expect(leaderPaths(leader)).toEqual([[[4, 0], [10, 0], [12, 2]]]);
    expect(leaderGeometryPoints(leader)).toEqual(expect.arrayContaining([[-4, 0], [4, 0], [0, -4], [0, 4]]));
    expect(leader.points).toEqual(base.points);
  });
});
