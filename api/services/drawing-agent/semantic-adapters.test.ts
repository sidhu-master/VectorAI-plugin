import { describe, expect, it, vi } from 'vitest';

import type { RevisionId } from '../../../src/drawing/index.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  DrawingSemanticRegionAdapter,
  DrawingSpatialDesignAdapter,
  type DrawingSpatialCompletion,
} from './semantic-adapters.js';

describe('drawing topology-grounded model adapters', () => {
  it('grounds intent, mode, search envelope, and generic topology anchors in one call', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        label: 'target component',
        operation: 'modify-existing',
        preferredEditMode: 'geometric-edit',
        sourceViewId: 'view_overview',
        contours: [[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]],
        holes: [],
        anchors: [
          { id: 'seed', role: 'target-seed', point: [0.6, 0.5], confidence: 0.96 },
          { id: 'port', role: 'boundary', point: [0.2, 0.5], confidence: 0.94 },
        ],
        confidence: 0.95,
        evidenceRefs: ['view_overview'],
      });
    });

    const proposal = await new DrawingSemanticRegionAdapter(complete).propose({
      goal: 'rotate the selected connected component',
      observation: observation(),
      targetHint: { semanticDescription: 'target component', preferredScale: 'part' },
      readImage: () => 'data:image/png;base64,AAAA',
      modelName: 'semantic-model',
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
    });

    expect(proposal).toMatchObject({
      operation: 'modify-existing', preferredEditMode: 'geometric-edit',
    });
    expect(proposal.anchors).toContainEqual(expect.objectContaining({ role: 'target-seed' }));
    expect(received?.systemPrompt).toContain('全局拓扑');
    expect(received?.systemPrompt).toContain('target-seed');
    expect(received?.systemPrompt).not.toContain('fragmentId');
    expect(received?.responseSchema).toMatchObject({ name: 'drawing_semantic_region' });
  });

  it('rejects semantic roles outside the generic anchor vocabulary', async () => {
    const complete: DrawingSpatialCompletion = vi.fn(async () => JSON.stringify({
      label: 'target', operation: 'modify-existing', preferredEditMode: 'geometric-edit',
      sourceViewId: 'view_overview',
      contours: [[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]],
      holes: [],
      anchors: [{ id: 'invalid', role: 'domain-specific-role', point: [0.5, 0.5], confidence: 0.9 }],
      confidence: 0.9, evidenceRefs: ['view_overview'],
    }));

    await expect(new DrawingSemanticRegionAdapter(complete).propose({
      goal: 'modify a component', observation: observation(),
      readImage: () => 'data:image/png;base64,AAAA', modelName: 'semantic-model',
      signal: new AbortController().signal, deadlineAt: Date.now() + 1_000,
    })).rejects.toThrow('regionProposal.anchors[0].role');
  });

  it('designs only the topology-authorized geometry and preserves generic invariants', async () => {
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
      goal: 'rotate the connected component', observation: current,
      region: {
        id: 'region_component', drawingId: current.drawingId, revision: current.revision,
        label: 'component', operation: 'modify-existing', preferredEditMode: 'geometric-edit',
        sourceViewIds: ['view_detail'], maskHandle: 'region_mask_1',
        worldContours: [[[20, 10], [40, 10], [40, 30], [20, 30]]],
        worldHoles: [], anchors: [], confidence: 0.93, evidenceRefs: ['view_detail'],
      },
      selection: {
        regionId: 'region_component', revision: current.revision,
        wholeNodes: ['target_line' as import('../../../src/drawing').GeometryId],
        partialSegments: [], crossingNodes: [], protectedNodes: ['adjacent_line'],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      strategy: {
        mode: 'geometric-edit', regionId: 'region_component', preserveRegionIds: [],
        boundaryAnchorIds: [], requiredGuarantees: ['outside-region-unchanged'],
        primaryReason: 'deterministic transform',
      },
      targetGeometry: [{
        id: 'target_line' as import('../../../src/drawing').GeometryId,
        type: 'line', start: [20, 10], end: [40, 30], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
      }],
      readImage: () => 'data:image/png;base64,AAAA', modelName: 'semantic-model',
      signal: new AbortController().signal, deadlineAt: Date.now() + 1_000,
    });

    expect(design).toMatchObject({ kind: 'transform', transform: { kind: 'rotate' } });
    expect(received?.userPrompt).toContain('maintain-existing-connectivity');
    expect(received?.systemPrompt).toContain('不能重新选择 nodeId');
    expect(received?.systemPrompt).toContain('Y 轴向上');
  });

  it('accepts new geometry when the grounded operation is additive', async () => {
    const complete: DrawingSpatialCompletion = vi.fn(async () => JSON.stringify({
      kind: 'replacement',
      geometry: [{
        id: 'generated_path', type: 'polyline', closed: false,
        vertices: [{ point: [25, 78] }, { point: [50, 96] }, { point: [75, 78] }],
        visible: true,
        quality: { status: 'confirmed', confidence: 0.92, evidenceRefs: ['view_detail'] },
      }],
      confidence: 0.92, evidenceRefs: ['view_detail'],
    }));
    const current = observation();
    const design = await new DrawingSpatialDesignAdapter(complete).design({
      goal: 'add a new path', observation: current,
      region: {
        id: 'region_add', drawingId: current.drawingId, revision: current.revision,
        label: 'new path area', operation: 'add-new', preferredEditMode: 'geometric-edit',
        sourceViewIds: ['view_detail'], maskHandle: 'region_mask_add',
        worldContours: [[[20, 70], [80, 70], [80, 100], [20, 100]]],
        worldHoles: [], anchors: [], confidence: 0.95, evidenceRefs: ['view_detail'],
      },
      selection: {
        regionId: 'region_add', revision: current.revision,
        wholeNodes: [], partialSegments: [], crossingNodes: [], protectedNodes: [],
        boundaryAnchors: [], classifications: [], uncertainParts: [], splitPlan: [],
      },
      strategy: {
        mode: 'geometric-edit', regionId: 'region_add', preserveRegionIds: [],
        boundaryAnchorIds: [], requiredGuarantees: ['outside-region-unchanged'],
        primaryReason: 'new exact geometry',
      },
      targetGeometry: [],
      readImage: () => 'data:image/png;base64,AAAA', modelName: 'semantic-model',
      signal: new AbortController().signal, deadlineAt: Date.now() + 1_000,
    });

    expect(design).toMatchObject({
      kind: 'replacement', geometry: [expect.objectContaining({ id: 'generated_path' })],
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
