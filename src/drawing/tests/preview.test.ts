import { describe, expect, it } from 'vitest';

import type {
  GeometryId,
  GeometryNode,
  PerceptionPreviewDelta,
  SpatialRegionPreviewOverlay,
} from '@/drawing';
import {
  applyPerceptionPreviewDelta,
  emptyPerceptionPreview,
  reconcilePerceptionPreview,
  retainUncommittedPromotions,
} from '@/drawing/preview/reducer';

describe('perception preview reducer', () => {
  it('adopts an ordered run and replaces a stable slot without mutating prior state', () => {
    const initial = emptyPerceptionPreview(null);
    const observed = applyPerceptionPreviewDelta(initial, delta(1, 'observe', [circle(4)]));
    const refined = applyPerceptionPreviewDelta(observed, delta(2, 'refine', [circle(5)]));

    expect(initial).toEqual({
      runId: null, lastSequence: 0, nodes: {}, labelsByNodeId: {},
      activeOverlay: null, previewVersionId: null,
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

  it('tracks the perception stage of each preview node for layered rendering', () => {
    const observed = applyPerceptionPreviewDelta(
      emptyPerceptionPreview(null),
      {
        ...delta(1, 'observe', [circle(4)]),
        source: { page: 1, viewId: 'view_1', regionId: 'region_1', stage: 'outline' },
      },
    );
    expect(observed.stageByNodeId).toEqual({ node_obs_1: 'outline' });

    const refined = applyPerceptionPreviewDelta(observed, {
      ...delta(2, 'observe', [circle(6)]),
      source: { page: 1, viewId: 'view_1', regionId: 'region_1', stage: 'detail' },
    });
    expect(refined.stageByNodeId).toEqual({ node_obs_1: 'detail' });

    const removed = applyPerceptionPreviewDelta(refined, {
      ...delta(3, 'reject', []),
      removeIds: ['node_obs_1'],
      source: { page: 1, viewId: 'view_1', stage: 'reconciliation' },
    });
    expect(removed.stageByNodeId).toEqual({});
  });

  it('keeps promoted previews until the authoritative document contains the same id', () => {
    const observed = applyPerceptionPreviewDelta(
      emptyPerceptionPreview(null),
      delta(1, 'observe', [circle(4)]),
    );
    const promote = {
      ...delta(2, 'promote', []),
      removeIds: ['node_obs_1'],
      source: { page: 1, viewId: 'view_1', stage: 'reconciliation' as const },
    };

    const retained = applyPerceptionPreviewDelta(
      observed,
      retainUncommittedPromotions(promote, { geometry: [], annotations: [] }),
    );
    expect(retained.nodes).toHaveProperty('node_obs_1');

    const reconciled = reconcilePerceptionPreview(retained, {
      geometry: [circle(4)], annotations: [],
    });
    expect(reconciled.nodes).toEqual({});
    expect(reconciled.labelsByNodeId).toEqual({});
  });

  it('hides replaced canonical nodes during preview and restores them on revision', () => {
    const initial = emptyPerceptionPreview('run_1');
    const previewed = applyPerceptionPreviewDelta(initial, {
      ...delta(1, 'preview', [line()]),
      hideCommittedIds: ['old_hand'],
    });

    expect(previewed.hiddenCommittedIds).toEqual(['old_hand']);
    const revised = applyPerceptionPreviewDelta(previewed, {
      ...delta(2, 'revise', []),
      removeIds: ['node_obs_2'],
      showCommittedIds: ['old_hand'],
    });
    expect(revised.hiddenCommittedIds).toEqual([]);
  });

  it('atomically replaces the active region and superseded edit-preview nodes', () => {
    const previewed = applyPerceptionPreviewDelta(emptyPerceptionPreview('run_1'), {
      ...delta(1, 'preview', [line()]),
      source: { page: 1, viewId: 'view_1', regionId: 'region_1', stage: 'edit-preview' },
      hideCommittedIds: ['old_hand'],
      regionOverlay: regionOverlay('preview_1', 0),
    });
    const replaced = applyPerceptionPreviewDelta(previewed, {
      ...delta(2, 'preview', []),
      regionOverlay: regionOverlay('preview_2', 20),
      source: { page: 1, viewId: 'view_1', regionId: 'region_2', stage: 'edit-preview' },
    });

    expect(replaced.previewVersionId).toBe('preview_2');
    expect(replaced.activeOverlay?.contours[0][0]).toEqual([20, 0]);
    expect(replaced.nodes).toEqual({});
    expect(replaced.hiddenCommittedIds).toEqual([]);
    const cleared = applyPerceptionPreviewDelta(replaced, {
      ...delta(3, 'promote', []), regionOverlay: null,
    });
    expect(cleared.activeOverlay).toBeNull();
  });
});

function regionOverlay(previewVersionId: string, x: number): SpatialRegionPreviewOverlay {
  return {
    id: `region_${previewVersionId}`,
    revision: 'revision_1' as import('@/drawing').RevisionId,
    previewVersionId,
    attempt: 1,
    status: 'proposed',
    label: '右臂', contours: [[[x, 0], [x + 10, 0], [x + 10, 10]]], holes: [],
    anchors: [{
      id: 'anchor', role: 'boundary', point: [x, 0] as const, confidence: 1,
      snapStatus: 'pending',
    }],
    paths: [],
    issues: [],
    confidence: 0.9,
  };
}

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
