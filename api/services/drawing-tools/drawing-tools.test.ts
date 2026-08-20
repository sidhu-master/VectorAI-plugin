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
      baseRevision: base.revision,
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
        interactionFrame: {
          kind: 'spatial', phase: 'previewing',
          strokes: expect.arrayContaining([
            expect.objectContaining({
              nodeId: 'line_a', role: 'before', points: [[0, 0], [10, 0]],
            }),
            expect.objectContaining({
              nodeId: 'line_a', role: 'after', points: [[0, 0], [10, 10]],
            }),
          ]),
          vectors: expect.arrayContaining([
            { id: 'motion:line_a', role: 'motion', from: [5, 0], to: [5, 5] },
          ]),
        },
        observation: expect.objectContaining({
          revision: base.revision,
          views: expect.arrayContaining([
            expect.objectContaining({
              image: expect.objectContaining({ handle: expect.any(String) }),
            }),
          ]),
        }),
        counterfactual: {
          branchId: expect.stringMatching(/^counterfactual_/),
          knowledge: expect.objectContaining({ state: 'resolved' }),
          affectedScope: expect.objectContaining({
            nodeIds: ['dimension_a', 'line_a', 'line_b'],
            bounds: expect.any(Object),
          }),
          delta: expect.objectContaining({
            changedNodeIds: ['dimension_a', 'line_a', 'line_b'],
            deletedNodeIds: ['dimension_a'],
          }),
        },
      },
    });
    expect((await application.open(base.drawingId)).document.geometry[0]).toMatchObject({
      id: 'line_a', end: [10, 0],
    });
    expect(drawingTools.snapshot()).toEqual({ candidateCount: 1, documentCount: 0 });
    const branchId = (previewed.output as {
      counterfactual: { branchId: string };
    }).counterfactual.branchId;

    const evaluated = await invoke('evaluate_preview', {
      previewHandle: 'preview_1', includeRender: true, selectedIds: ['line_a', 'line_b'],
    });
    expect(evaluated).toMatchObject({
      receipt: { status: 'succeeded' },
      output: {
        previewHandle: 'preview_1', hardValid: true,
        interactionFrame: { kind: 'spatial', phase: 'verifying' },
        counterfactual: {
          branchId,
          knowledge: expect.objectContaining({ state: 'resolved' }),
          delta: expect.objectContaining({
            changedNodeIds: ['dimension_a', 'line_a', 'line_b'],
          }),
        },
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

  it('compiles a task-driven spatial program into a live auditable Preview', async () => {
    const { application, base, invoke } = await setup();

    const previewed = await invoke('preview_spatial_program', {
      baseRevision: base.revision,
      summary: 'move and reconnect an explicit path',
      intent: 'move the selected path and set its interface endpoint',
      targets: [{
        id: 'path_target', description: 'the selected open path', nodeRefs: ['line_a'],
        interfaceRefs: [{ kind: 'node_anchor', nodeId: 'line_a', anchor: 'end' }],
      }],
      operations: [
        {
          kind: 'translate', nodeIds: ['line_a'],
          from: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'start' },
          to: { kind: 'world', frameId: 'frame_document', point: [5, 5] },
        },
        {
          kind: 'set_endpoint', nodeId: 'line_a', endpoint: 'end',
          point: { kind: 'world', frameId: 'frame_document', point: [20, 10] },
        },
      ],
      preserveNodeRefs: ['line_b'],
      postconditions: [
        {
          kind: 'anchor_at',
          anchor: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'end' },
          point: { kind: 'world', frameId: 'frame_document', point: [20, 10] },
        },
        { kind: 'nodes_unchanged', nodeIds: ['line_b'] },
      ],
      evidenceRefs: [], confidence: 0.86,
    });

    expect(previewed).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a'] },
      output: {
        status: 'ready', previewHandle: 'preview_1',
        spatialProgram: {
          summary: 'move and reconnect an explicit path',
          operations: [{ kind: 'translate' }, { kind: 'set_endpoint' }],
        },
        operationReceipts: [
          { operationIndex: 0, kind: 'translate', affectedNodeIds: ['line_a'] },
          { operationIndex: 1, kind: 'set_endpoint', affectedNodeIds: ['line_a'] },
        ],
        programDiagnostics: [
          { kind: 'anchor_at', status: 'passed' },
          { kind: 'nodes_unchanged', status: 'passed' },
        ],
        previewDelta: {
          upserts: [expect.objectContaining({ id: 'line_a', start: [5, 5], end: [20, 10] })],
          removeIds: [],
        },
        interactionFrame: {
          kind: 'spatial', phase: 'previewing',
          markers: expect.arrayContaining([
            expect.objectContaining({ role: 'target', point: [5, 5] }),
            expect.objectContaining({ role: 'interface', point: [20, 10] }),
          ]),
          vectors: expect.arrayContaining([
            expect.objectContaining({ role: 'motion', from: [5, 0], to: [12.5, 7.5] }),
          ]),
        },
        observation: expect.objectContaining({ revision: base.revision }),
        counterfactual: expect.objectContaining({ branchId: expect.any(String) }),
        editBase: { kind: 'canonical', revision: base.revision },
      },
    });
    expect((await application.open(base.drawingId)).document.geometry)
      .toContainEqual(expect.objectContaining({ id: 'line_a', start: [0, 0], end: [10, 0] }));

    const continued = await invoke('preview_spatial_program', {
      baseRevision: base.revision,
      replacesPreviewHandle: 'preview_1',
      summary: 'continue from the exact candidate and reconnect its neighbor',
      intent: 'preserve the first candidate and connect the adjacent path',
      targets: [{ id: 'neighbor', description: 'adjacent open path', nodeRefs: ['line_b'] }],
      operations: [{
        kind: 'set_endpoint', nodeId: 'line_b', endpoint: 'start',
        point: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'end' },
      }],
      postconditions: [{
        kind: 'anchors_coincident',
        first: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'end' },
        second: { kind: 'node_anchor', nodeId: 'line_b', anchor: 'start' },
      }],
    });
    expect(continued).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a', 'line_b'] },
      output: {
        status: 'ready', previewHandle: 'preview_2',
        editBase: {
          kind: 'preview', revision: base.revision, previewHandle: 'preview_1',
          transactionDigest: expect.stringMatching(/^sha256:/),
        },
        previewDelta: { upserts: expect.arrayContaining([
          expect.objectContaining({ id: 'line_a', start: [5, 5], end: [20, 10] }),
          expect.objectContaining({ id: 'line_b', start: [20, 10] }),
        ]) },
        programDiagnostics: [{ kind: 'anchors_coincident', status: 'passed' }],
      },
    });

    await invoke('commit_preview', { previewHandle: 'preview_2' });
    expect((await application.open(base.drawingId)).document.geometry)
      .toContainEqual(expect.objectContaining({ id: 'line_a', start: [5, 5], end: [20, 10] }));
    expect((await application.open(base.drawingId)).document.geometry)
      .toContainEqual(expect.objectContaining({ id: 'line_b', start: [20, 10] }));
  });

  it('returns a stable recoverable error when a program references an expired observation', async () => {
    const { base, invoke } = await setup();

    const result = await invoke('preview_spatial_program', {
      baseRevision: base.revision,
      summary: 'move using unavailable visual evidence', intent: 'test observation binding',
      targets: [{ id: 'target', description: 'one line', nodeRefs: ['line_a'] }],
      operations: [{
        kind: 'translate', nodeIds: ['line_a'],
        from: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'start' },
        to: { kind: 'observation', observationId: 'view_expired', normalized: [0.5, 0.5] },
      }],
    });

    expect(result).toMatchObject({
      receipt: {
        status: 'rejected',
        error: {
          code: 'SPATIAL_OBSERVATION_EXPIRED', retryable: true, suggestedAction: 'requery',
        },
      },
    });

    const invalid = await invoke('preview_spatial_program', {
      baseRevision: base.revision,
      summary: 'invalid empty plan', intent: 'verify stable parser code',
      targets: [{ id: 'target', description: 'one line', nodeRefs: ['line_a'] }],
      operations: [],
    });
    expect(invalid).toMatchObject({
      receipt: {
        status: 'rejected',
        error: { code: 'SPATIAL_PROGRAM_INVALID', retryable: true, suggestedAction: 'replan' },
      },
    });
  });

  it('previews a code-computed connected transform without asking the model for connector coordinates', async () => {
    const { application, base } = await setup();
    await application.execute({
      drawingId: base.drawingId,
      transaction: {
        id: 'seed_connected_carrier', baseRevision: base.revision,
        actor: { type: 'user', id: 'fixture' },
        commands: [
          {
            type: 'geometry.create', value: {
              id: 'carrier' as GeometryId, type: 'circle', center: [0, 20], radius: 10,
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          },
          {
            type: 'geometry.create', value: {
              id: 'connector' as GeometryId, type: 'line', start: [0, 10], end: [20, 0],
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          },
        ],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    const revision = await application.currentRevision(base.drawingId);
    let call = 0;
    const noEffect = await invokeAtRevision('preview_connected_transform', {
      summary: 'leave the connected carrier at its current pose',
      carrierNodeId: 'carrier',
      targetCenter: [0, 20],
      evidenceRefs: [],
    });
    expect(noEffect).toMatchObject({
      receipt: {
        status: 'rejected',
        error: {
          code: 'CONNECTED_TRANSFORM_NO_EFFECT',
          retryable: true,
          suggestedAction: 'replan',
        },
      },
    });

    const result = await invokeAtRevision('preview_connected_transform', {
      summary: 'move the closed part with its connected boundary',
      carrierNodeId: 'carrier',
      delta: [-20, 10],
      rotationDegrees: 15,
      evidenceRefs: [],
    });

    expect(result).toMatchObject({
      receipt: { status: 'succeeded', revisionBefore: revision },
      output: {
        status: 'ready', previewHandle: expect.any(String),
        affectedNodeIds: ['carrier', 'connector'],
        connectedTransform: {
          carrierNodeId: 'carrier', connectorNodeIds: ['connector'],
          ports: [{ connectorNodeId: 'connector', fixedAnchor: [20, 0] }],
        },
        interactionFrame: {
          kind: 'spatial', phase: 'previewing',
          markers: expect.arrayContaining([
            expect.objectContaining({ role: 'interface', point: [0, 10] }),
            expect.objectContaining({ role: 'target', point: expect.any(Array) }),
          ]),
        },
        diagnostics: [],
      },
    });
    expect((await application.open(base.drawingId)).document.geometry)
      .toContainEqual(expect.objectContaining({ id: 'carrier', center: [0, 20] }));

    async function invokeAtRevision(tool: string, input: unknown) {
      const gateway = new ModelDrawingToolRegistry({
        tools: new DrawingModelTools({ application }).definitions,
        getCurrentRevision: (drawingId) => application.currentRevision(drawingId),
      });
      return gateway.invoke({
        ...base, revision, toolCallId: `connected_${++call}`, tool, input,
      });
    }
  });

  it('exposes connected-interface risk facts as advisory Preview evidence', async () => {
    const { application, base, drawingTools } = await setup();
    const seeded = await application.execute({
      drawingId: base.drawingId,
      transaction: {
        id: 'seed_risky_connected_carrier', baseRevision: base.revision,
        actor: { type: 'user', id: 'fixture' },
        commands: [
          {
            type: 'geometry.create', value: {
              id: 'risky_carrier' as GeometryId, type: 'circle',
              center: [61.710477, 204.929327], radius: 41.487229,
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          },
          {
            type: 'geometry.create', value: {
              id: 'risky_upper' as GeometryId, type: 'line',
              start: [64.694509, 247.32261], end: [124.143616, 289.214202],
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          },
          {
            type: 'geometry.create', value: {
              id: 'risky_lower' as GeometryId, type: 'line',
              start: [102.064374, 193.174903], end: [118.992472, 204.116046],
              visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          },
          {
            type: 'geometry.create', value: {
              id: 'risky_extent' as GeometryId, type: 'point', x: 500, y: 650,
              visible: false, quality: { status: 'confirmed', evidenceRefs: [] },
            },
          },
        ],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    expect(seeded.status).toBe('committed');
    if (seeded.status !== 'committed') throw new Error('expected risky fixture commit');
    const registry = new ModelDrawingToolRegistry({
      tools: drawingTools.definitions,
      getCurrentRevision: (drawingId) => drawingTools.currentRevision(drawingId),
    });
    const result = await registry.invoke({
      ...base,
      revision: seeded.revision,
      toolCallId: 'risky_connected_preview',
      tool: 'preview_connected_transform',
      input: {
        summary: 'intentional high-deformation connected transform',
        carrierNodeId: 'risky_carrier', targetCenter: [80, 280], rotationDegrees: 90,
        evidenceRefs: [],
      },
    });

    expect(result).toMatchObject({
      receipt: { status: 'succeeded' },
      output: {
        status: 'ready', previewHandle: expect.any(String),
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'CONNECTED_INTERFACE_AREA_COLLAPSED',
            facts: expect.objectContaining({ areaRetentionRatio: expect.any(Number) }),
          }),
          expect.objectContaining({ code: 'CONNECTED_INTERFACE_EXCESSIVE_STRETCH' }),
        ]),
        connectedTransform: {
          interfaceMetrics: expect.objectContaining({
            selectedRotationDegrees: 90,
            minimumDeformationRotationDegrees: expect.any(Number),
          }),
        },
      },
    });
  });

  it('never exposes a handle for a schema-invalid candidate', async () => {
    const { base, invoke } = await setup();

    const rejected = await invoke('preview_transaction', {
      baseRevision: base.revision,
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
      baseRevision: base.revision,
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

  it('revises a candidate relatively while preserving its complete four-plane transaction', async () => {
    const { application, base, drawingTools, invoke } = await setup();
    const first = await invoke('preview_transaction', {
      baseRevision: base.revision,
      summary: 'complete parent candidate',
      commands: [
        { type: 'geometry.update', id: 'line_a', changes: { end: [10, 10] } },
        { type: 'annotation.update', id: 'dimension_a', changes: { computedValue: 14 } },
        {
          type: 'relation.create', value: {
            id: 'topology_candidate', type: 'topology', plane: 'topology', kind: 'connected',
            nodeIds: ['line_a', 'line_b'], visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
        {
          type: 'feature.create', value: {
            id: 'feature_candidate', type: 'feature', semanticType: 'candidate-part',
            geometryIds: ['line_a', 'line_b'], annotationIds: ['dimension_a'],
            relationIds: ['topology_candidate'], properties: { state: 'parent' }, visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
      ],
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });
    expect(first).toMatchObject({
      receipt: { status: 'succeeded' }, output: { status: 'ready', previewHandle: 'preview_1' },
    });
    const parent = drawingTools.readCandidate({ ...base, previewHandle: 'preview_1' });
    expect(parent).not.toBeNull();

    const revised = await invoke('revise_preview', {
      basePreviewHandle: 'preview_1',
      baseTransactionDigest: parent!.transactionDigest,
      summary: 'only correct the second line',
      corrections: [{
        type: 'geometry.update', id: 'line_b',
        changes: { start: [10, 10], end: [20, 20] },
        expected: { start: [10, 0], end: [20, 0] },
      }],
      postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });

    expect(revised).toMatchObject({
      receipt: { status: 'succeeded' },
      output: {
        status: 'ready', previewHandle: 'preview_2',
        editBase: {
          kind: 'preview', previewHandle: 'preview_1',
          transactionDigest: parent!.transactionDigest,
        },
        previewDelta: {
          upserts: expect.arrayContaining([
            expect.objectContaining({ id: 'line_a', end: [10, 10] }),
            expect.objectContaining({ id: 'line_b', start: [10, 10], end: [20, 20] }),
            expect.objectContaining({ id: 'dimension_a', computedValue: 14 }),
          ]),
        },
      },
    });
    const child = drawingTools.readCandidate({ ...base, previewHandle: 'preview_2' });
    expect(child).toMatchObject({
      editBase: {
        kind: 'preview', previewHandle: 'preview_1',
        transactionDigest: parent!.transactionDigest,
      },
      transaction: { baseRevision: base.revision },
    });

    const committed = await invoke('commit_preview', { previewHandle: 'preview_2' });
    expect(committed.receipt.status).toBe('succeeded');
    const current = await application.open(base.drawingId);
    expect(current.document.geometry).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'line_a', end: [10, 10] }),
      expect.objectContaining({ id: 'line_b', start: [10, 10], end: [20, 20] }),
    ]));
    expect(current.document.annotations).toContainEqual(
      expect.objectContaining({ id: 'dimension_a', computedValue: 14 }),
    );
    expect(current.document.relations).toContainEqual(
      expect.objectContaining({ id: 'topology_candidate', kind: 'connected' }),
    );
    expect(current.document.features).toContainEqual(
      expect.objectContaining({ id: 'feature_candidate', properties: { state: 'parent' } }),
    );
  });

  it('rejects a candidate revision whose parent digest is not exact', async () => {
    const { base, invoke } = await setup();
    await invoke('preview_transaction', {
      baseRevision: base.revision,
      summary: 'parent candidate',
      commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 4] } }],
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });

    const revised = await invoke('revise_preview', {
      basePreviewHandle: 'preview_1', baseTransactionDigest: 'sha256:wrong',
      summary: 'stale correction',
      corrections: [{ type: 'geometry.update', id: 'line_b', changes: { end: [20, 4] } }],
      evidenceRefs: [],
    });

    expect(revised).toMatchObject({
      receipt: {
        status: 'rejected',
        error: { code: 'PREVIEW_BASE_DIGEST_MISMATCH', retryable: true },
      },
    });
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
