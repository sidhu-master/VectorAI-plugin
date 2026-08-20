import { describe, expect, it, vi } from 'vitest';

import type { DrawingId, GeometryId, RevisionId } from '../../../src/drawing';
import { MODEL_DRAWING_TOOL_GUIDES } from '../drawing-tools/catalog';
import type { ModelToolResult } from '../drawing-tools/types';
import { DrawingSpatialContextIndex } from '../drawing-spatial/context-index';
import { RevisionContextLedger } from './context-ledger';
import { ModelLoopActionAdapter, type ModelLoopCompletion } from './model-loop-adapter';

describe('model context budget', () => {
  it('keeps a 160-node drawing bounded, exact for the local workset, and single-image', async () => {
    const document = fixtureDocument(160);
    const revision = 'revision_budget' as RevisionId;
    const spatial = new DrawingSpatialContextIndex(document);
    const ledger = new RevisionContextLedger(revision);
    ledger.registerNodeIds(document.geometry.map((node) => node.id));
    ledger.markActive(['node_vector_0080_long_identifier']);
    ledger.record(renderResult(revision, document.geometry.map((node) => node.id)));
    const workingSet = spatial.workingSet(['node_vector_0080_long_identifier'], { limit: 16 });
    let request: Parameters<ModelLoopCompletion>[0] | undefined;
    const complete = vi.fn<ModelLoopCompletion>(async (input) => {
      request = input;
      return '{"type":"finish","summary":"bounded"}';
    });

    await new ModelLoopActionAdapter(complete).next({
      objective: '移动中心附近的目标并保持连接',
      drawingId: document.id,
      revision,
      episodeId: 'episode_budget',
      drawingSummary: {
        unit: 'mm',
        counts: { geometry: 160, annotation: 0, relation: 0, feature: 0 },
        items: [], truncated: true,
      },
      spatialContext: {
        globalMap: spatial.globalMap(),
        workingSet: ledger.projectValue(workingSet),
        evidenceLedger: ledger.project({
          excludeNodeIds: workingSet.nodes.map((node) => node.id),
        }),
      },
      nodeAliases: ledger.aliasesByNode(),
      toolCatalog: [{
        name: 'inspect_nodes', version: '1.0.0', access: 'read', timeoutMs: 5_000,
        ...MODEL_DRAWING_TOOL_GUIDES.inspect_nodes,
      }],
      recentToolResults: [renderResult(revision, document.geometry.map((node) => node.id))],
      recentDiagnostics: [], decisions: [], appendedInstructions: [],
      observations: [
        observation('overview', 'overview', document.geometry.map((node, index) => ({
          nodeId: node.id, label: `G${index + 1}`, type: 'line',
        }))),
        observation('focus', 'target-detail', document.geometry.slice(72, 89).map((node, index) => ({
          nodeId: node.id, label: `G${index + 1}`, type: 'line',
        }))),
      ],
      modelName: 'model', attempt: 1, signal: new AbortController().signal,
      deadlineAt: Date.now() + 60_000,
    });

    expect(request?.images).toHaveLength(1);
    expect(request?.images[0]?.id).toBe('focus');
    const context = JSON.parse(request!.userPrompt);
    const schemaBytes = Buffer.byteLength(JSON.stringify(request!.responseSchema));
    const legacyContextBytes = Buffer.byteLength(JSON.stringify(legacyContext({
      document,
      revision,
      toolResult: renderResult(revision, document.geometry.map((node) => node.id)),
    })));
    const metrics = {
      nodeCount: document.geometry.length,
      legacyContextBytes,
      contextBytes: Buffer.byteLength(request!.userPrompt),
      schemaBytes,
      totalTextBytes: Buffer.byteLength(request!.userPrompt) + schemaBytes,
      imageCount: request!.images.length,
      workingSetNodes: context.drawing.workingSet.nodes.length,
    };
    expect(metrics).toMatchInlineSnapshot(`
      {
        "contextBytes": 14833,
        "imageCount": 1,
        "legacyContextBytes": 118864,
        "nodeCount": 160,
        "schemaBytes": 1563,
        "totalTextBytes": 16396,
        "workingSetNodes": 5,
      }
    `);
    expect(context.observationIndex.map((item: { id: string }) => item.id)).toEqual(['focus']);
    expect(context.observationIndex[0].groundingColumns).toEqual([
      'alias', 'visualLabel', 'type', 'rgb', 'normalizedLTRB', 'selected', 'clipped',
    ]);
    expect(request?.userPrompt).toContain('drawing-cartesian');
    expect(request?.userPrompt).toContain('visual-up');
    expect(request?.userPrompt).toContain('image-pixel');
    expect(request?.userPrompt).toContain('observation-normalized');
    expect(request?.userPrompt).toContain('"resolvedBy":"backend"');
    expect(request?.userPrompt).not.toContain('px = m0*x + m2*y + m4');
    expect(metrics.contextBytes).toBeLessThan(16_384);
    expect(metrics.schemaBytes).toBeLessThan(8_192);
    expect(metrics.totalTextBytes).toBeLessThan(32_768);
    expect(context.drawing.workingSet.nodes.length).toBeGreaterThan(0);
    expect(context.drawing.workingSet.nodes.length).toBeLessThanOrEqual(16);
    expect(context.drawing.workingSet.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'g81', relevance: 'target' }),
    ]));
    expect(JSON.stringify(context)).not.toContain('vectorDigest');
    expect(JSON.stringify(context)).not.toContain('image_handle_large');
    expect(JSON.stringify(context)).not.toContain('node_vector_0159_long_identifier');
    expect(JSON.stringify(context)).toContain('g81');
  });
});

function legacyContext(input: {
  document: ReturnType<typeof fixtureDocument>;
  revision: RevisionId;
  toolResult: ModelToolResult;
}) {
  return {
    objective: '移动中心附近的目标并保持连接',
    drawing: {
      id: input.document.id,
      revision: input.revision,
      summary: {
        unit: 'mm',
        counts: { geometry: 160, annotation: 0, relation: 0, feature: 0 },
        items: input.document.geometry.map((node) => ({
          id: node.id, plane: 'geometry', type: node.type,
          summary: `line ${JSON.stringify(node.start)} -> ${JSON.stringify(node.end)}`,
        })),
        truncated: false,
      },
    },
    recentToolResults: [input.toolResult],
    observationIndex: [
      observation('overview', 'overview', input.document.geometry.map((node, index) => ({
        nodeId: node.id, label: `G${index + 1}`, type: 'line',
      }))),
      observation('focus', 'target-detail', input.document.geometry.slice(72, 89).map((node, index) => ({
        nodeId: node.id, label: `G${index + 1}`, type: 'line',
      }))),
    ].map((item) => Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'imageDataUrl'),
    )),
  };
}

function fixtureDocument(count: number) {
  return {
    protocol: 'VectorAI-Drawing' as const,
    schemaVersion: '1.0' as const,
    id: 'drawing_budget' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm' as const, angle: 'deg' as const },
    coordinateFrames: [], annotations: [], relations: [], features: [],
    geometry: Array.from({ length: count }, (_, index) => ({
      id: `node_vector_${String(index).padStart(4, '0')}_long_identifier` as GeometryId,
      type: 'line' as const,
      visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
      start: [index * 2, 0] as const,
      end: [index * 2 + 1, 10] as const,
    })),
  };
}

function renderResult(revision: RevisionId, nodeIds: string[]): ModelToolResult {
  return {
    schemaVersion: 1,
    receipt: {
      schemaVersion: 1, runId: 'run_budget', episodeId: 'episode_budget',
      drawingId: 'drawing_budget' as DrawingId,
      toolCallId: 'render_1', tool: 'render_drawing', toolVersion: '1.0.0', access: 'read',
      status: 'succeeded', revisionBefore: revision, revisionAfter: revision,
      affectedNodeIds: nodeIds, inputDigest: 'sha256:input', outputDigest: 'sha256:output',
      durationMs: 20,
    },
    output: {
      revision,
      views: [{ image: { handle: 'image_handle_large' } }],
      vectorDigest: { nodes: nodeIds.map((id) => ({ id, detail: 'x'.repeat(200) })) },
    },
  };
}

function observation(id: string, purpose: 'overview' | 'target-detail', nodes: Array<{
  nodeId: string; label: string; type: string;
}>) {
  return {
    id, purpose, imageDataUrl: 'data:image/png;base64,AAAA', width: 1000, height: 800,
    worldBounds: { minX: 0, minY: 0, maxX: 320, maxY: 10 },
    worldToImage: [3, 0, 0, -3, 0, 800] as const,
    grounding: nodes.map((node, index) => ({
      ...node,
      rgb: [100, 150, 200] as [number, number, number],
      bounds: { x: index * 3, y: 1, width: 2, height: 30 },
      worldBounds: { minX: index * 2, minY: 0, maxX: index * 2 + 1, maxY: 10 },
      normalized: { left: 0.1, top: 0.1, right: 0.2, bottom: 0.2 },
      selected: false, zOrder: index, clipped: false,
    })),
  };
}
