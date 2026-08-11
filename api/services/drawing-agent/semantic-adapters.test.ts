import { describe, expect, it, vi } from 'vitest';

import type { RevisionId } from '../../../src/drawing/index.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  DrawingSemanticRegionAdapter,
  DrawingSpatialDesignAdapter,
  type DrawingSpatialCompletion,
} from './semantic-adapters.js';

describe('drawing region-first model adapters', () => {
  it('proposes a continuous semantic region without primitive ids', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        label: 'right arm', sourceViewId: 'view_overview',
        contours: [[[0.6, 0.3], [0.9, 0.4], [0.9, 0.7], [0.6, 0.6]]],
        holes: [],
        anchors: [{ id: 'shoulder', role: 'body-connection', point: [0.61, 0.58], confidence: 0.9 }],
        confidence: 0.92, evidenceRefs: ['view_overview'],
      });
    });
    const proposal = await new DrawingSemanticRegionAdapter(complete).propose({
      goal: '把右手抬起来打招呼', observation: observation(),
      readImage: () => 'data:image/png;base64,AAAA', modelName: 'semantic-model',
      signal: new AbortController().signal, deadlineAt: Date.now() + 1_000,
    });

    expect(proposal.sourceViewId).toBe('view_overview');
    expect(received?.systemPrompt).toContain('不考虑现有图元边界');
    expect(received?.userPrompt).not.toContain('hand_line');
    expect(received?.responseSchema).toMatchObject({ name: 'drawing_semantic_region' });
  });

  it('designs only the targets already resolved from the semantic region', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        kind: 'transform',
        transform: { kind: 'rotate', center: [30, 20], angleDegrees: 45 },
        confidence: 0.94, evidenceRefs: ['view_detail'],
      });
    });
    const current = observation();
    const design = await new DrawingSpatialDesignAdapter(complete).design({
      goal: '把右手抬起来打招呼', observation: current,
      region: {
        id: 'region_right_arm', drawingId: current.drawingId, revision: current.revision,
        label: '右臂', sourceViewIds: ['view_detail'], maskHandle: 'region_mask_1',
        worldContours: [[[20, 10], [40, 10], [40, 30], [20, 30]]],
        worldHoles: [], anchors: [], confidence: 0.93, evidenceRefs: ['view_detail'],
      },
      selection: {
        regionId: 'region_right_arm', revision: current.revision,
        wholeNodes: ['hand_line' as import('../../../src/drawing').GeometryId],
        partialSegments: [], crossingNodes: [], protectedNodes: ['body'],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      strategy: {
        mode: 'geometric-edit', regionId: 'region_right_arm', preserveRegionIds: [],
        boundaryAnchorIds: [], requiredGuarantees: ['outside-region-unchanged'],
        primaryReason: '确定性几何变换',
      },
      targetGeometry: [{
        id: 'hand_line' as import('../../../src/drawing').GeometryId,
        type: 'line', start: [20, 10], end: [40, 30], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
      }],
      readImage: () => 'data:image/png;base64,AAAA', modelName: 'semantic-model',
      signal: new AbortController().signal, deadlineAt: Date.now() + 1_000,
    });

    expect(design).toMatchObject({
      kind: 'transform', transform: { kind: 'rotate', angleDegrees: 45 },
    });
    expect(received?.userPrompt).toContain('region_right_arm');
    expect(received?.systemPrompt).toContain('不能重新选择 nodeId');
    expect(received?.responseSchema).toMatchObject({ name: 'drawing_spatial_edit_design' });
  });

  it('accepts additive replacement geometry when a creative region has no existing target nodes', async () => {
    const complete: DrawingSpatialCompletion = vi.fn(async () => JSON.stringify({
      kind: 'replacement',
      geometry: [{
        id: 'generated_hair', type: 'polyline', closed: false,
        vertices: [
          { point: [25, 78] }, { point: [50, 96] }, { point: [75, 78] },
        ],
        visible: true,
        quality: { status: 'confirmed', confidence: 0.92, evidenceRefs: ['view_detail'] },
      }],
      confidence: 0.92,
      evidenceRefs: ['view_detail'],
    }));
    const current = observation();

    const design = await new DrawingSpatialDesignAdapter(complete).design({
      goal: '给角色增加卷发', observation: current,
      region: {
        id: 'region_hair', drawingId: current.drawingId, revision: current.revision,
        label: '头发新增区域', sourceViewIds: ['view_detail'], maskHandle: 'region_mask_hair',
        worldContours: [[[20, 70], [80, 70], [80, 100], [20, 100]]],
        worldHoles: [], anchors: [], confidence: 0.95, evidenceRefs: ['view_detail'],
      },
      selection: {
        regionId: 'region_hair', revision: current.revision,
        wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      strategy: {
        mode: 'generative-redraw', regionId: 'region_hair', preserveRegionIds: [],
        boundaryAnchorIds: [], requiredGuarantees: ['outside-region-unchanged'],
        primaryReason: '新增外观需要局部生成',
      },
      targetGeometry: [],
      readImage: () => 'data:image/png;base64,AAAA', modelName: 'semantic-model',
      signal: new AbortController().signal, deadlineAt: Date.now() + 1_000,
    });

    expect(design).toMatchObject({
      kind: 'replacement',
      geometry: [expect.objectContaining({ id: 'generated_hair', type: 'polyline' })],
    });
  });
});

function observation(): VisualObservation {
  const view = (id: string, purpose: 'overview' | 'target-detail') => ({
    id, purpose, cacheKey: `key_${id}`,
    image: { handle: `observation_${id}`, mimeType: 'image/png' as const },
    width: 100, height: 100,
    worldBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    worldToImage: [1, 0, 0, -1, 0, 100] as const,
    grounding: [],
  });
  return {
    drawingId: 'drawing_semantic' as VisualObservation['drawingId'],
    revision: 'revision_semantic' as RevisionId,
    rendererVersion: 'scene-1.0', selectedIds: [],
    vectorDigest: {
      unit: 'mm', counts: { geometry: 3, annotation: 0, relation: 0, feature: 0 },
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, nodes: [],
    },
    views: [view('view_overview', 'overview'), view('view_detail', 'target-detail')],
  };
}
