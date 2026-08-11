import { describe, expect, it, vi } from 'vitest';

import type { RevisionId } from '../../../src/drawing/index.js';
import type { VisualFeatureGraph } from '../../../src/contracts/drawing-spatial-agent.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  DrawingEditIntentAdapter,
  DrawingFeatureGraphAdapter,
  DrawingGeometryCandidateAdapter,
  DrawingSemanticRegionAdapter,
  DrawingSpatialDesignAdapter,
  type DrawingSpatialCompletion,
} from './semantic-adapters.js';

describe('drawing semantic model adapters', () => {
  it('proposes a continuous semantic region without exposing primitive ids', async () => {
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
    const adapter = new DrawingSemanticRegionAdapter(complete);

    const proposal = await adapter.propose({
      goal: '把右手抬起来打招呼',
      observation: observation(),
      readImage: () => 'data:image/png;base64,AAAA',
      modelName: 'semantic-model',
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
    });

    expect(proposal.sourceViewId).toBe('view_overview');
    expect(received?.systemPrompt).toContain('不考虑现有图元边界');
    expect(received?.userPrompt).not.toContain('hand_line');
    expect(received?.responseSchema).toMatchObject({ name: 'drawing_semantic_region' });
  });

  it('resolves visual features only against observed ids and cited views', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        features: [{
          id: 'right_hand', label: '右手', nodeIds: ['hand_line'],
          bounds: { minX: 20, minY: 10, maxX: 40, maxY: 30 },
          confidence: 0.9, evidenceRefs: ['view_detail'],
        }],
        anchors: [],
        relations: [],
      });
    });
    const adapter = new DrawingFeatureGraphAdapter(complete);

    const graph = await adapter.resolve({
      goal: '把右手抬起来打招呼',
      observation: observation(),
      readImage: () => 'data:image/png;base64,AAAA',
      modelName: 'semantic-model',
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
      protocolFeedback: 'featureGraph.anchors[0].point 必须使用 [x,y] 数组',
    });

    expect(graph.features[0].nodeIds).toEqual(['hand_line']);
    expect(received?.images).toEqual([
      expect.objectContaining({ id: 'view_overview', dataUrl: 'data:image/png;base64,AAAA' }),
      expect.objectContaining({ id: 'view_detail', dataUrl: 'data:image/png;base64,AAAA' }),
    ]);
    expect(received?.userPrompt).toContain('hand_line');
    expect(received?.systemPrompt).toContain('不得编造 nodeId');
    expect(received?.systemPrompt).toContain('point:[x,y]');
    expect(received?.userPrompt).toContain('必须使用 [x,y] 数组');
    expect(received?.responseSchema).toMatchObject({
      name: 'drawing_visual_feature_graph',
      schema: {
        properties: {
          anchors: { items: { properties: { point: { minItems: 2, maxItems: 2 } } } },
          relations: { items: { properties: { type: { enum: expect.arrayContaining(['connected']) } } } },
        },
      },
    });
  });

  it('designs an EditIntent and never accepts a low-level DrawingCommand', async () => {
    const complete: DrawingSpatialCompletion = vi.fn(async () => JSON.stringify({
      operation: 'local-redraw',
      targetFeatureIds: ['right_hand'],
      targetNodeIds: ['hand_line'],
      anchors: [{ nodeId: 'arm_line', role: 'wrist', point: [30, 20] }],
      preserveNodeIds: ['body'],
      preserveRules: [{ type: 'outside-target-unchanged' }],
      desiredRelations: [{ type: 'connected', from: 'arm_line', to: 'hand_line' }],
      confidence: 0.91,
      evidenceRefs: ['view_detail'],
    }));
    const graph: VisualFeatureGraph = {
      features: [{
        id: 'right_hand', label: '右手', nodeIds: ['hand_line'],
        bounds: { minX: 20, minY: 10, maxX: 40, maxY: 30 }, confidence: 0.9,
        evidenceRefs: ['view_detail'],
      }],
      anchors: [], relations: [],
    };
    const adapter = new DrawingEditIntentAdapter(complete);

    const intent = await adapter.design({
      goal: '把右手抬起来打招呼',
      observation: observation(),
      featureGraph: graph,
      readImage: () => 'data:image/png;base64,AAAA',
      modelName: 'semantic-model',
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
    });

    expect(intent).toMatchObject({ operation: 'local-redraw', targetNodeIds: ['hand_line'] });
  });

  it('parses candidate geometry as Drawing IR nodes without accepting transaction commands', async () => {
    const complete: DrawingSpatialCompletion = vi.fn(async () => JSON.stringify({
      geometry: [{
        id: 'raised_hand', type: 'line', start: [30, 20], end: [30, 60],
        visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
      }],
    }));
    const adapter = new DrawingGeometryCandidateAdapter(complete);

    const candidates = await adapter.design({
      goal: '把右手抬起来打招呼',
      observation: observation(),
      featureGraph: {
        features: [{
          id: 'right_hand', label: '右手', nodeIds: ['hand_line'],
          bounds: { minX: 20, minY: 10, maxX: 40, maxY: 30 },
          confidence: 0.9, evidenceRefs: ['view_detail'],
        }], anchors: [], relations: [],
      },
      intent: {
        operation: 'local-redraw', targetFeatureIds: ['right_hand'],
        targetNodeIds: ['hand_line'], anchors: [], preserveNodeIds: ['body'],
        preserveRules: [{ type: 'outside-target-unchanged' }], desiredRelations: [],
        confidence: 0.9, evidenceRefs: ['view_detail'],
      },
      readImage: () => 'data:image/png;base64,AAAA',
      modelName: 'semantic-model', signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
    });

    expect(candidates).toEqual([
      expect.objectContaining({ id: 'raised_hand', type: 'line', end: [30, 60] }),
    ]);
  });

  it('designs only the already-resolved region targets', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        kind: 'transform',
        transform: { kind: 'rotate', center: [30, 20], angleDegrees: 45 },
        confidence: 0.94,
        evidenceRefs: ['view_detail'],
      });
    });
    const adapter = new DrawingSpatialDesignAdapter(complete);

    const design = await adapter.design({
      goal: '把右手抬起来打招呼',
      observation: observation(),
      region: {
        id: 'region_right_arm', drawingId: observation().drawingId,
        revision: observation().revision, label: '右臂', sourceViewIds: ['view_detail'],
        maskHandle: 'region_mask_1',
        worldContours: [[[20, 10], [40, 10], [40, 30], [20, 30]]],
        worldHoles: [], anchors: [], confidence: 0.93, evidenceRefs: ['view_detail'],
      },
      selection: {
        regionId: 'region_right_arm', revision: observation().revision,
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
      readImage: () => 'data:image/png;base64,AAAA',
      modelName: 'semantic-model', signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
    });

    expect(design).toMatchObject({
      kind: 'transform', transform: { kind: 'rotate', angleDegrees: 45 },
    });
    expect(received?.userPrompt).toContain('region_right_arm');
    expect(received?.systemPrompt).toContain('不能重新选择 nodeId');
    expect(received?.responseSchema).toMatchObject({ name: 'drawing_spatial_edit_design' });
  });
});

function observation(): VisualObservation {
  const grounding = (nodeId: string, label: string) => ({
    label, nodeId, type: 'line', rgb: [255, 0, 0] as [number, number, number],
    bounds: { x: 1, y: 1, width: 5, height: 5 },
    worldBounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    normalized: { left: 0, top: 0, right: 0.1, bottom: 0.1 },
    selected: false, zOrder: 0, clipped: false,
  });
  const view = (id: string, purpose: 'overview' | 'target-detail') => ({
    id, purpose, cacheKey: `key_${id}`,
    image: { handle: `observation_${id}`, mimeType: 'image/png' as const },
    width: 100, height: 100,
    worldBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    worldToImage: [1, 0, 0, -1, 0, 100] as const,
    grounding: [grounding('hand_line', 'G001'), grounding('arm_line', 'G002'), grounding('body', 'G003')],
  });
  return {
    drawingId: 'drawing_semantic' as VisualObservation['drawingId'],
    revision: 'revision_semantic' as RevisionId,
    rendererVersion: 'scene-1.0',
    selectedIds: [],
    vectorDigest: {
      unit: 'mm', counts: { geometry: 3, annotation: 0, relation: 0, feature: 0 },
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      nodes: [
        { id: 'hand_line', type: 'line', bounds: { minX: 20, minY: 10, maxX: 40, maxY: 30 } },
        { id: 'arm_line', type: 'line', bounds: { minX: 10, minY: 10, maxX: 30, maxY: 20 } },
        { id: 'body', type: 'circle', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
      ],
    },
    views: [view('view_overview', 'overview'), view('view_detail', 'target-detail')],
  };
}
