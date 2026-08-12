import { describe, expect, it } from 'vitest';

import {
  type DrawingTransaction,
  type AnnotationId,
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing/index';
import { DrawingApplication } from '../drawing-application/application';
import { DrawingModelTools } from './drawing-tools';
import { ModelDrawingToolRegistry } from './registry';

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

async function setup() {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const created = await application.create();
  const seeded = await application.execute({
    drawingId: created.document.id,
    transaction: seedTransaction(created.revision),
  });
  if (seeded.status !== 'committed') throw new Error('expected seed commit');
  let handle = 0;
  const drawingTools = new DrawingModelTools({
    application,
    idFactory,
    handleFactory: () => `preview_${++handle}`,
    tolerance: 0.01,
  });
  const registry = new ModelDrawingToolRegistry({
    tools: drawingTools.definitions,
    getCurrentRevision: (drawingId) => drawingTools.currentRevision(drawingId),
  });
  const base = {
    runId: 'run_1', episodeId: 'episode_1', drawingId: created.document.id,
    revision: seeded.revision,
  };
  let call = 0;
  const invoke = (tool: string, input: unknown) => registry.invoke({
    ...base, toolCallId: `call_${++call}`, tool, input,
  });
  return { application, base, drawingTools, invoke };
}

describe('DrawingModelTools', () => {
  it('queries and inspects any Drawing IR plane against the canonical revision', async () => {
    const { invoke } = await setup();

    const queried = await invoke('query_nodes', {
      selector: { plane: 'geometry', types: ['line'], limit: 10 },
    });
    const inspected = await invoke('inspect_nodes', { nodeIds: ['line_a', 'dimension_a'] });

    expect(queried).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a', 'line_b'] },
      output: {
        revision: expect.any(String),
        items: [
          { id: 'line_a', plane: 'geometry', type: 'line' },
          { id: 'line_b', plane: 'geometry', type: 'line' },
        ],
      },
    });
    expect(inspected).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a', 'dimension_a'] },
      output: {
        nodes: [
          { node: { id: 'line_a', type: 'line' } },
          { node: { id: 'dimension_a', type: 'dimension' } },
        ],
        missingNodeIds: [],
      },
    });
  });

  it('renders an overview with world mapping and measures geometry without mutation', async () => {
    const { application, base, invoke } = await setup();

    const rendered = await invoke('render_drawing', {
      view: 'focus', selectedIds: ['line_a'], includeAnnotations: false,
    });
    const measured = await invoke('measure_geometry', {
      measurements: [
        { id: 'distance_1', kind: 'distance', from: [0, 0], to: [3, 4] },
        { id: 'angle_1', kind: 'angle', first: [0, 0], vertex: [1, 0], second: [1, 1] },
        { id: 'bounds_1', kind: 'bounds', nodeIds: ['line_a', 'line_b'] },
        { id: 'closed_1', kind: 'closure', nodeIds: ['line_a', 'line_b'], tolerance: 0.01 },
      ],
    });

    expect(rendered.output).toMatchObject({
      revision: base.revision,
      rendererVersion: 'scene-1.0',
      selectedIds: ['line_a'],
      views: [
        { purpose: 'overview', image: { handle: expect.any(String) }, worldToImage: expect.any(Array) },
        { purpose: 'target-detail', image: { handle: expect.any(String) }, worldToImage: expect.any(Array) },
      ],
    });
    expect(measured.output).toMatchObject({
      measurements: [
        { id: 'distance_1', kind: 'distance', value: 5 },
        { id: 'angle_1', kind: 'angle', value: 90 },
        { id: 'bounds_1', kind: 'bounds', bounds: { minX: 0, minY: 0, maxX: 20, maxY: 0 } },
        { id: 'closed_1', kind: 'closure', closed: false },
      ],
    });
    expect((await application.open(base.drawingId)).commits).toHaveLength(1);
  });

  it('previews, diagnoses, renders, and atomically commits a free Drawing transaction', async () => {
    const { application, base, drawingTools, invoke } = await setup();

    const previewed = await invoke('preview_transaction', {
      summary: 'replace both lines with a connected raised shape',
      confidence: 0.82,
      commands: [
        { type: 'geometry.update', id: 'line_a', changes: { end: [10, 10] } },
        { type: 'geometry.update', id: 'line_b', changes: { start: [10, 10], end: [20, 15] } },
        { type: 'annotation.delete', id: 'dimension_a' },
      ],
      preconditions: [{ type: 'node.exists', nodeId: 'line_a' }],
      postconditions: [{ type: 'document.valid' }],
      evidenceRefs: [],
      lineage: [{
        sourceIds: ['line_a', 'line_b'], resultIds: ['line_a', 'line_b'],
        operation: 'transform', evidenceRefs: [],
      }],
    });

    expect(previewed).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a', 'line_b', 'dimension_a'] },
      output: {
        status: 'ready', previewHandle: 'preview_1',
        candidate: false, validationValid: true, goalSatisfied: true,
      },
    });
    expect((await application.open(base.drawingId)).document.geometry[0]).toMatchObject({
      id: 'line_a', end: [10, 0],
    });
    expect(drawingTools.snapshot()).toEqual({ candidateCount: 1, documentCount: 0 });

    const evaluated = await invoke('evaluate_preview', {
      previewHandle: 'preview_1', includeRender: true, selectedIds: ['line_a', 'line_b'],
    });
    expect(evaluated).toMatchObject({
      receipt: { status: 'succeeded' },
      output: {
        previewHandle: 'preview_1', hardValid: true,
        changedNodeIds: ['dimension_a', 'line_a', 'line_b'],
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: 'ANNOTATION_REMOVED' }),
        ]),
        previewDelta: {
          upserts: [
            expect.objectContaining({ id: 'line_a', end: [10, 10] }),
            expect.objectContaining({ id: 'line_b', end: [20, 15] }),
          ],
          removeIds: ['dimension_a'],
        },
        observation: expect.objectContaining({
          revision: base.revision,
          views: expect.arrayContaining([
            expect.objectContaining({
              image: expect.objectContaining({ handle: expect.any(String) }),
            }),
          ]),
        }),
      },
    });

    const committed = await invoke('commit_preview', { previewHandle: 'preview_1' });
    expect(committed).toMatchObject({
      receipt: {
        status: 'succeeded', revisionBefore: base.revision,
        revisionAfter: expect.not.stringMatching(base.revision),
      },
      output: { status: 'committed', commitId: expect.any(String) },
    });
    const current = await application.open(base.drawingId);
    expect(current.document).toMatchObject({
      geometry: [
        expect.objectContaining({ id: 'line_a', end: [10, 10] }),
        expect.objectContaining({ id: 'line_b', start: [10, 10], end: [20, 15] }),
      ],
      annotations: [],
    });
    expect(current.commits.at(-1)).toMatchObject({
      metadata: {
        episodeId: 'episode_1',
        summary: 'replace both lines with a connected raised shape',
        confidence: 0.82,
      },
    });
    expect(drawingTools.snapshot()).toEqual({ candidateCount: 0, documentCount: 0 });
  });

  it('never exposes a handle for a schema-invalid candidate', async () => {
    const { invoke } = await setup();

    const rejected = await invoke('preview_transaction', {
      summary: 'create invalid reference',
      commands: [{
        type: 'feature.create',
        value: {
          id: 'feature_invalid', type: 'feature', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
          semanticType: 'part', geometryIds: ['missing'], annotationIds: [], relationIds: [],
          properties: {},
        },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });

    expect(rejected).toMatchObject({
      receipt: { status: 'succeeded' },
      output: {
        status: 'rejected',
        errors: [expect.objectContaining({ code: expect.any(String) })],
      },
    });
    expect(rejected.output).not.toHaveProperty('previewHandle');
  });

  it('lets the runtime inspect a scoped candidate transaction without exposing a second document', async () => {
    const { base, drawingTools, invoke } = await setup();
    await invoke('preview_transaction', {
      summary: 'runtime policy candidate',
      commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [9, 3] } }],
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });

    const candidate = drawingTools.readCandidate({
      ...base, previewHandle: 'preview_1',
    });

    expect(candidate).toMatchObject({
      previewHandle: 'preview_1', baseRevision: base.revision,
      affectedNodeIds: ['line_a'],
      transaction: {
        baseRevision: base.revision,
        commands: [{ type: 'geometry.update', id: 'line_a' }],
      },
    });
    expect(candidate).not.toHaveProperty('document');
    expect(drawingTools.readCandidate({
      ...base, runId: 'another_run', previewHandle: 'preview_1',
    })).toBeNull();
  });
});

function seedTransaction(revision: DrawingTransaction['baseRevision']): DrawingTransaction {
  return {
    id: 'tx_seed', baseRevision: revision,
    actor: { type: 'user', id: 'fixture' },
    commands: [
      {
        type: 'geometry.create', value: {
          id: 'line_a' as GeometryId, type: 'line', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] }, start: [0, 0], end: [10, 0],
        },
      },
      {
        type: 'geometry.create', value: {
          id: 'line_b' as GeometryId, type: 'line', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] }, start: [10, 0], end: [20, 0],
        },
      },
      {
        type: 'annotation.create', value: {
          id: 'dimension_a' as AnnotationId, type: 'dimension', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
          dimensionKind: 'linear', associationStatus: 'resolved',
          targets: [{ geometryId: 'line_a' as GeometryId, anchor: { kind: 'start' } }],
          textPosition: [5, 2], definitionPoints: [[0, 0], [10, 0]], computedValue: 10,
        },
      },
    ],
    preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
  };
}
