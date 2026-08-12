import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  DrawingId,
  GeometryId,
  IdFactory,
} from '../../../src/drawing/index';
import { MemoryDrawingRepository } from '../../../src/drawing/index';
import { DrawingApplication } from '../drawing-application/application';
import { DrawingModelTools } from './drawing-tools';
import { ModelDrawingToolRegistry } from './registry';
import { DrawingTopologyTools } from './topology-tools';

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => `${kind}_${(counts.set(kind, (counts.get(kind) ?? 0) + 1), counts.get(kind))}` };
}

async function setup(document: DrawingDocument) {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const created = await repository.create(document);
  const application = new DrawingApplication({ repository, idFactory });
  const drawingTools = new DrawingModelTools({
    application, idFactory, handleFactory: () => 'preview_split', tolerance: 0.01,
  });
  const topologyTools = new DrawingTopologyTools({ application, drawingTools });
  const registry = new ModelDrawingToolRegistry({
    tools: [...drawingTools.definitions, ...topologyTools.definitions],
    getCurrentRevision: (drawingId) => drawingTools.currentRevision(drawingId),
  });
  const base = {
    runId: 'run_topology', episodeId: 'episode_topology',
    drawingId: document.id, revision: created.revision,
  };
  let call = 0;
  const invoke = (tool: string, input: unknown) => registry.invoke({
    ...base, toolCallId: `call_${++call}`, tool, input,
  });
  return { application, base, drawingTools, invoke };
}

describe('DrawingTopologyTools', () => {
  it('builds revision topology and traces ranked alternate paths without write authority', async () => {
    const { invoke } = await setup(branchDocument());

    const built = await invoke('build_topology', { tolerance: 0.01, curveSamples: 32 });
    const traced = await invoke('trace_paths', {
      seedPoints: [[1, 0]],
      stopPoints: [[10, 5]],
      directionHints: [[1, 0]],
      maxDepth: 6,
      maxCandidates: 4,
      tolerance: 0.01,
    });

    expect(built).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['trunk', 'upper', 'lower'] },
      output: {
        revision: expect.any(String), tolerance: 0.01,
        segmentCount: 3, vertexCount: 4,
      },
    });
    expect(traced.output).toMatchObject({
      revision: expect.any(String),
      candidates: [
        expect.objectContaining({ nodeIds: ['trunk', 'upper'], reachedStop: true }),
        expect.objectContaining({ nodeIds: ['trunk', 'lower'], reachedStop: false }),
      ],
      uncertainty: expect.objectContaining({ ambiguous: true, alternateCount: 1 }),
    });
    expect(JSON.stringify(traced.output)).not.toContain('authorization');
    expect(JSON.stringify(traced.output)).not.toContain('accepted');
  });

  it('reports interfaces and local fragments as observations rather than permissions', async () => {
    const { invoke } = await setup(branchDocument());

    const interfaces = await invoke('find_interfaces', {
      nodeIds: ['trunk', 'upper', 'lower'], tolerance: 0.01,
    });
    const fragment = await invoke('inspect_fragment', {
      nodeId: 'upper', range: [0.25, 0.75], samples: 8,
    });

    expect(interfaces.output).toMatchObject({
      interfaces: expect.arrayContaining([
        expect.objectContaining({ degree: 3, connectedNodeIds: ['lower', 'trunk', 'upper'] }),
      ]),
    });
    expect(fragment.output).toMatchObject({
      nodeId: 'upper', range: [0.25, 0.75],
      samples: expect.arrayContaining([[6.25, 1.25], [8.75, 3.75]]),
      sourceType: 'line',
    });
  });

  it('materializes an explicit split plan only into a preview candidate', async () => {
    const document = splitDocument();
    const { application, base, drawingTools, invoke } = await setup(document);

    const materialized = await invoke('materialize_split', {
      summary: 'split the shared path at the requested parameter',
      confidence: 0.9,
      splitPlans: [{
        nodeId: 'shared',
        ranges: [
          { range: [0, 1], role: 'target' },
          { range: [1, 2], role: 'protected' },
        ],
      }],
      evidenceRefs: [],
    });

    expect(materialized).toMatchObject({
      receipt: { status: 'succeeded', revisionBefore: base.revision },
      output: {
        status: 'ready', previewHandle: 'preview_split',
        lineage: expect.arrayContaining([
          expect.objectContaining({ sourceNodeId: 'shared', sourceRange: [0, 1], role: 'target' }),
        ]),
      },
    });
    expect((await application.open(base.drawingId)).document).toEqual(document);
    expect((await application.open(base.drawingId)).commits).toEqual([]);
    expect(drawingTools.snapshot()).toEqual({ candidateCount: 1, documentCount: 0 });

    const committed = await invoke('commit_preview', { previewHandle: 'preview_split' });
    expect(committed.receipt.status).toBe('succeeded');
    const current = await application.open(base.drawingId);
    expect(current.document.geometry).toHaveLength(2);
    expect(current.commits).toHaveLength(1);
  });
});

function branchDocument(): DrawingDocument {
  return document([
    line('trunk', [0, 0], [5, 0]),
    line('upper', [5, 0], [10, 5]),
    line('lower', [5, 0], [10, -5]),
  ], 'drawing_branch');
}

function splitDocument(): DrawingDocument {
  return document([{
    id: 'shared' as GeometryId, type: 'polyline', visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] }, closed: false,
    vertices: [{ point: [0, 0] }, { point: [10, 0] }, { point: [20, 5] }],
  }], 'drawing_split_tool');
}

function line(id: string, start: readonly [number, number], end: readonly [number, number]) {
  return {
    id: id as GeometryId, type: 'line' as const, visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] }, start, end,
  };
}

function document(geometry: DrawingDocument['geometry'], id: string): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: id as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry, annotations: [], relations: [], features: [],
  };
}
