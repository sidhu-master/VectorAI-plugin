import { describe, expect, it } from 'vitest';

import type { SpatialSelection } from '../../../src/contracts/drawing-spatial-region.js';
import type { GeometryId, RevisionId } from '../../../src/drawing/index.js';
import { routeSpatialEditStrategy } from './strategy-router.js';
import {
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

describe('routeSpatialEditStrategy', () => {
  it('ignores auto dimensions that do not reference the local target', () => {
    const document = test2SharedPolylineDocument();
    document.annotations.push({
      id: 'dimension_unrelated_face' as never,
      type: 'dimension',
      dimensionKind: 'diameter',
      associationStatus: 'resolved',
      targets: [{ geometryId: 'node_test2_face' as GeometryId, anchor: { kind: 'center' } }],
      textPosition: [80, 245],
      definitionPoints: [[60, 220], [100, 220]],
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    });

    const strategy = routeSpatialEditStrategy({
      goal: '把右手抬起来打招呼',
      document,
      region: test2RightArmRegion(),
      selection: selection(),
    });

    expect(strategy.primaryReason).not.toContain('工程几何');
  });

  it('forces engineering geometry with constraints onto the geometric path', () => {
    const document = test2SharedPolylineDocument();
    document.relations.push({
      id: 'constraint_test' as never, type: 'constraint', plane: 'constraint',
      kind: 'horizontal', geometryIds: ['node_test2_hand_outline' as GeometryId],
      status: 'satisfied', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    });

    expect(routeSpatialEditStrategy({
      goal: '把工程图中的右臂旋转 30 度并保持连接',
      document,
      region: test2RightArmRegion(),
      selection: selection(),
      proposedMode: 'generative-redraw',
    }).mode).toBe('geometric-edit');
  });

  it('uses generative redraw for a free-form appearance addition', () => {
    expect(routeSpatialEditStrategy({
      goal: '给角色增加卷发',
      document: test2SharedPolylineDocument(),
      region: test2RightArmRegion(),
      selection: selection(),
    }).mode).toBe('generative-redraw');
  });

  it('uses hybrid edit when free-form generation must protect named regions', () => {
    const strategy = routeSpatialEditStrategy({
      goal: '给角色增加卷发，但不遮挡眼睛和脸部轮廓',
      document: test2SharedPolylineDocument(),
      region: test2RightArmRegion(),
      selection: selection(),
      protectedRegionIds: ['region_eyes', 'region_face'],
    });

    expect(strategy).toMatchObject({
      mode: 'hybrid-edit',
      preserveRegionIds: ['region_eyes', 'region_face'],
      fallbackMode: 'geometric-edit',
    });
  });
});

function selection(): SpatialSelection {
  return {
    regionId: 'region_test2_right_arm', revision: 'revision_test2_region' as RevisionId,
    wholeNodes: ['node_test2_hand_outline' as GeometryId], partialSegments: [],
    crossingNodes: [], protectedNodes: [], boundaryAnchors: [], classifications: [],
    uncertainParts: [], splitPlan: [],
  };
}
