import { describe, expect, it } from 'vitest';

import {
  type DrawingTransaction,
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing/index.js';
import { DrawingApplication } from '../drawing-application/application.js';
import { DrawingModelTools } from '../drawing-tools/drawing-tools.js';
import { ModelDrawingToolRegistry } from '../drawing-tools/registry.js';

describe('task-driven spatial edit integration', () => {
  it('moves a generic carrier, reconnects explicit interfaces, preserves context, and commits atomically', async () => {
    const idFactory = deterministicIds();
    const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
    const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
    const created = await application.create();
    const seeded = await application.execute({
      drawingId: created.document.id,
      transaction: seedTransaction(created.revision),
    });
    if (seeded.status !== 'committed') throw new Error('fixture seed failed');

    let previewSequence = 0;
    const drawingTools = new DrawingModelTools({
      application,
      idFactory,
      handleFactory: () => `preview_integration_${++previewSequence}`,
      tolerance: 0.01,
    });
    const registry = new ModelDrawingToolRegistry({
      tools: drawingTools.definitions,
      getCurrentRevision: (drawingId) => application.currentRevision(drawingId),
    });
    let callSequence = 0;
    const invoke = (tool: string, input: unknown) => registry.invoke({
      runId: 'run_spatial_integration', episodeId: 'episode_spatial_integration',
      drawingId: created.document.id, revision: seeded.revision,
      toolCallId: `call_${++callSequence}`, tool, input,
    });

    const canonicalBefore = await application.readCurrent(created.document.id);
    const unrelatedBefore = structuredClone(
      canonicalBefore.document.geometry.find((node) => node.id === 'unrelated'),
    );
    const previewed = await invoke('preview_spatial_program', {
      baseRevision: seeded.revision,
      summary: 'move one carrier and reconnect two explicit interfaces',
      intent: 'change only the selected carrier and its two connector endpoints',
      targets: [{
        id: 'carrier_target', description: 'the explicitly selected closed carrier',
        nodeRefs: ['carrier'],
        interfaceRefs: [
          { kind: 'node_anchor', nodeId: 'connector_upper', anchor: 'start' },
          { kind: 'node_anchor', nodeId: 'connector_lower', anchor: 'start' },
        ],
      }],
      operations: [
        {
          kind: 'translate', nodeIds: ['carrier'],
          from: { kind: 'node_anchor', nodeId: 'carrier', anchor: 'center' },
          to: { kind: 'world', frameId: 'document', point: [0, 8] },
        },
        {
          kind: 'set_endpoint', nodeId: 'connector_upper', endpoint: 'start',
          point: { kind: 'world', frameId: 'document', point: [2, 8] },
        },
        {
          kind: 'set_endpoint', nodeId: 'connector_lower', endpoint: 'start',
          point: { kind: 'world', frameId: 'document', point: [0, 6] },
        },
      ],
      preserveNodeRefs: ['unrelated'],
      postconditions: [
        {
          kind: 'anchor_at',
          anchor: { kind: 'node_anchor', nodeId: 'carrier', anchor: 'center' },
          point: { kind: 'world', frameId: 'document', point: [0, 8] },
        },
        { kind: 'nodes_unchanged', nodeIds: ['unrelated'] },
      ],
      evidenceRefs: [], confidence: 0.93,
    });

    expect(previewed).toMatchObject({
      receipt: {
        status: 'succeeded',
        affectedNodeIds: ['carrier', 'connector_upper', 'connector_lower'],
      },
      output: {
        status: 'ready', previewHandle: 'preview_integration_1',
        programDiagnostics: [
          { kind: 'anchor_at', status: 'passed' },
          { kind: 'nodes_unchanged', status: 'passed' },
        ],
        interactionFrame: {
          kind: 'spatial', phase: 'previewing',
          strokes: expect.any(Array), markers: expect.any(Array), vectors: expect.any(Array),
        },
      },
    });
    const candidate = drawingTools.readCandidate({
      runId: 'run_spatial_integration', episodeId: 'episode_spatial_integration',
      drawingId: created.document.id, revision: seeded.revision,
      previewHandle: 'preview_integration_1',
    });
    expect(candidate).not.toBeNull();
    const candidatePreview = await application.preview({
      drawingId: created.document.id,
      transaction: candidate!.transaction,
    });
    if (candidatePreview.status !== 'ready') throw new Error('candidate could not be replayed');
    const candidateDocument = candidatePreview.resultingDocument;
    const carrier = candidateDocument.geometry.find((node) => node.id === 'carrier');
    const upper = candidateDocument.geometry.find((node) => node.id === 'connector_upper');
    const lower = candidateDocument.geometry.find((node) => node.id === 'connector_lower');
    const unrelatedAfter = candidateDocument.geometry.find((node) => node.id === 'unrelated');
    expect(carrier).toMatchObject({ type: 'circle', center: [0, 8], radius: 2 });
    expect(upper).toMatchObject({ type: 'line', start: [2, 8], end: [10, 4] });
    expect(lower).toMatchObject({ type: 'line', start: [0, 6], end: [10, -4] });
    expect(unrelatedAfter).toEqual(unrelatedBefore);
    if (!carrier || carrier.type !== 'circle'
      || !upper || upper.type !== 'line'
      || !lower || lower.type !== 'line') throw new Error('candidate fixture type changed');
    expect(distance(upper.start, carrier.center)).toBeCloseTo(carrier.radius);
    expect(distance(lower.start, carrier.center)).toBeCloseTo(carrier.radius);

    expect((await application.readCurrent(created.document.id)).document).toEqual(
      canonicalBefore.document,
    );
    const committed = await invoke('commit_preview', {
      previewHandle: 'preview_integration_1',
    });
    expect(committed).toMatchObject({
      receipt: { status: 'succeeded', revisionAfter: expect.any(String) },
      output: { status: 'committed' },
    });
    expect(committed.receipt.revisionAfter).not.toBe(seeded.revision);
    expect((await application.readCurrent(created.document.id)).document.geometry).toEqual(
      candidateDocument.geometry,
    );
    expect(registry.snapshot().consumedToolCallCount).toBe(2);
  });
});

function seedTransaction(baseRevision: DrawingTransaction['baseRevision']): DrawingTransaction {
  const quality = { status: 'confirmed' as const, evidenceRefs: [] };
  return {
    id: 'transaction_seed_spatial_integration', baseRevision,
    actor: { type: 'user', id: 'fixture' },
    commands: [
      {
        type: 'geometry.create', value: {
          id: 'carrier' as GeometryId, type: 'circle', center: [0, 0], radius: 2,
          visible: true, quality,
        },
      },
      {
        type: 'geometry.create', value: {
          id: 'connector_upper' as GeometryId, type: 'line', start: [2, 0], end: [10, 4],
          visible: true, quality,
        },
      },
      {
        type: 'geometry.create', value: {
          id: 'connector_lower' as GeometryId, type: 'line', start: [0, -2], end: [10, -4],
          visible: true, quality,
        },
      },
      {
        type: 'geometry.create', value: {
          id: 'unrelated' as GeometryId, type: 'line', start: [-8, -8], end: [-4, -5],
          visible: true, quality,
        },
      },
    ],
    preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
  };
}

function deterministicIds(): IdFactory {
  const counters = new Map<string, number>();
  return { next: (kind) => {
    const sequence = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, sequence);
    return `${kind}_${sequence}`;
  } };
}

function distance(
  first: readonly [number, number],
  second: readonly [number, number],
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}
