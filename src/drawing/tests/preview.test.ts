import { describe, expect, it } from 'vitest';

import type { GeometryId, GeometryNode, PerceptionPreviewDelta } from '@/drawing';
import {
  applyPerceptionPreviewDelta,
  emptyPerceptionPreview,
} from '@/drawing/preview/reducer';

describe('perception preview reducer', () => {
  it('adopts an ordered run and replaces a stable slot without mutating prior state', () => {
    const initial = emptyPerceptionPreview(null);
    const observed = applyPerceptionPreviewDelta(initial, delta(1, 'observe', [circle(4)]));
    const refined = applyPerceptionPreviewDelta(observed, delta(2, 'refine', [circle(5)]));

    expect(initial).toEqual({
      runId: null, lastSequence: 0, nodes: {}, labelsByNodeId: {},
    });
    expect(observed.nodes.node_obs_1).toMatchObject({ type: 'circle', radius: 4 });
    expect(refined).toMatchObject({ runId: 'run_1', lastSequence: 2 });
    expect(refined.nodes.node_obs_1).toMatchObject({ type: 'circle', radius: 5 });
    expect(refined.nodes.node_obs_1).not.toBe(observed.nodes.node_obs_1);
  });

  it('ignores duplicate, out-of-order, and mismatched-run deltas', () => {
    const observed = applyPerceptionPreviewDelta(
      emptyPerceptionPreview('run_1'),
      delta(2, 'observe', [circle(4)]),
    );

    expect(applyPerceptionPreviewDelta(observed, delta(2, 'refine', [circle(9)])))
      .toBe(observed);
    expect(applyPerceptionPreviewDelta(observed, delta(1, 'refine', [circle(9)])))
      .toBe(observed);
    expect(applyPerceptionPreviewDelta(observed, {
      ...delta(3, 'refine', [circle(9)]), runId: 'run_2',
    })).toBe(observed);
  });

  it('removes rejected slots before applying new projections', () => {
    const observed = applyPerceptionPreviewDelta(
      emptyPerceptionPreview(null),
      delta(1, 'observe', [circle(4), line()]),
    );
    const reconciled = applyPerceptionPreviewDelta(observed, {
      ...delta(2, 'merge', [circle(6)]),
      slotIds: ['node_obs_1', 'node_obs_2'],
      removeIds: ['node_obs_1', 'node_obs_2'],
    });

    expect(Object.keys(reconciled.nodes)).toEqual(['node_obs_1']);
    expect(reconciled.nodes.node_obs_1).toMatchObject({ type: 'circle', radius: 6 });
    expect(observed.nodes).toHaveProperty('node_obs_2');
  });

  it('keeps system labels aligned with node replacement and removal', () => {
    const observed = applyPerceptionPreviewDelta(
      emptyPerceptionPreview(null),
      { ...delta(1, 'observe', [circle(4)]), labelsByNodeId: { node_obs_1: 'GEO-0001' } },
    );
    const removed = applyPerceptionPreviewDelta(observed, {
      ...delta(2, 'reject', []), removeIds: ['node_obs_1'], labelsByNodeId: {},
    });

    expect(observed.labelsByNodeId).toEqual({ node_obs_1: 'GEO-0001' });
    expect(removed.labelsByNodeId).toEqual({});
  });
});

function delta(
  sequence: number,
  action: PerceptionPreviewDelta['action'],
  upserts: GeometryNode[],
): PerceptionPreviewDelta {
  return {
    runId: 'run_1', sequence, action,
    slotIds: upserts.map((item) => item.id),
    upserts,
    removeIds: [],
    source: { page: 1, viewId: 'view_1', regionId: 'region_1', stage: 'detail' },
  };
}

function circle(radius: number): GeometryNode {
  return {
    id: 'node_obs_1' as GeometryId, type: 'circle', center: [10, 10], radius, visible: true,
    quality: { status: 'candidate', confidence: 0.7, evidenceRefs: [] },
  };
}

function line(): GeometryNode {
  return {
    id: 'node_obs_2' as GeometryId, type: 'line', start: [0, 0], end: [20, 0], visible: true,
    quality: { status: 'candidate', confidence: 0.7, evidenceRefs: [] },
  };
}
