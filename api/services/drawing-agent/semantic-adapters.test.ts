import { describe, expect, it, vi } from 'vitest';

import type { RevisionId } from '../../../src/drawing/index.js';
import type { VisualFeatureGraph } from '../../../src/contracts/drawing-spatial-agent.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  DrawingEditIntentAdapter,
  DrawingFeatureGraphAdapter,
  type DrawingSpatialCompletion,
} from './semantic-adapters.js';

describe('drawing semantic model adapters', () => {
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
    });

    expect(graph.features[0].nodeIds).toEqual(['hand_line']);
    expect(received?.images).toEqual([
      expect.objectContaining({ id: 'view_overview', dataUrl: 'data:image/png;base64,AAAA' }),
      expect.objectContaining({ id: 'view_detail', dataUrl: 'data:image/png;base64,AAAA' }),
    ]);
    expect(received?.userPrompt).toContain('hand_line');
    expect(received?.systemPrompt).toContain('不得编造 nodeId');
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
