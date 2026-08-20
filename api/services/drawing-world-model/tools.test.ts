import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  DrawingId,
  GeometryId,
  IdFactory,
} from '../../../src/drawing/index.js';
import { MemoryDrawingRepository } from '../../../src/drawing/index.js';
import { DrawingApplication } from '../drawing-application/application.js';
import { CounterfactualWorldService } from '../drawing-preview-world/service.js';
import { DrawingModelTools } from '../drawing-tools/drawing-tools.js';
import { ModelDrawingToolRegistry } from '../drawing-tools/registry.js';
import { DrawingWorldModelTools } from './tools.js';

describe('DrawingWorldModelTools', () => {
  it('reads a large scope in real revision-bound pages and inspects exact refs on demand', async () => {
    const prepared = await setup();

    const first = await prepared.invoke('build_world_slice', { limit: 1 });
    expect(first).toMatchObject({
      receipt: { status: 'succeeded', access: 'read' },
      output: {
        sliceHandle: expect.any(String),
        world: {
          knowledge: { state: 'partial' },
          counts: { sourceSpans: 1 },
          sourceSpans: [expect.objectContaining({ sourceNodeId: 'line_a' })],
          continuationToken: expect.any(String),
        },
      },
    });
    const firstOutput = first.output as BuildOutput;
    const second = await prepared.invoke('inspect_world_slice', {
      sliceHandle: firstOutput.sliceHandle,
      continuationToken: firstOutput.world.continuationToken,
      refs: [],
      includeSamples: false,
    });
    expect(second).toMatchObject({
      receipt: { status: 'succeeded' },
      output: {
        sliceHandle: expect.not.stringMatching(firstOutput.sliceHandle),
        world: { sourceSpans: [expect.objectContaining({ sourceNodeId: 'line_b' })] },
      },
    });

    const inspected = await prepared.invoke('inspect_world_slice', {
      sliceHandle: firstOutput.sliceHandle,
      refs: [firstOutput.world.sourceSpans[0].id],
      includeSamples: true,
    });
    expect(inspected).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a'] },
      output: {
        entities: [expect.objectContaining({
          kind: 'source-span', sourceNodeId: 'line_a', samples: [[0, 0], [10, 0]],
        })],
        missingRefs: [],
      },
    });
  });

  it('records model-selected semantic evidence and proposes actions without mutating Drawing IR', async () => {
    const prepared = await setup();
    const built = await prepared.invoke('build_world_slice', {
      nodeIds: ['line_a', 'line_b'], limit: 20,
    });
    const builtOutput = built.output as BuildOutput;
    const spanId = builtOutput.world.sourceSpans.find((span) => span.sourceNodeId === 'line_a')!.id;

    const grounded = await prepared.invoke('ground_semantic_entities', {
      sliceHandle: builtOutput.sliceHandle,
      goalDescription: 'raise the selected member',
      referringExpression: 'the member on the left',
      evidenceRefs: ['observation_overview'],
      candidates: [{
        id: 'hypothesis_member', label: 'member', confidence: 0.86,
        observationRefs: ['observation_overview'], regionRefs: [],
        supports: [{ kind: 'source-span', ref: spanId, weight: 1, role: 'boundary' }],
        excludedSupports: ['node:line_b'], interfaceRefs: [spanId],
      }, {
        id: 'hypothesis_context', label: 'context object', confidence: 0.8,
        observationRefs: ['observation_overview'], regionRefs: [],
        supports: [], excludedSupports: [], interfaceRefs: [],
      }],
      selectedCandidateIds: ['hypothesis_member', 'hypothesis_context'],
      abstraction: 'part',
      relations: [
        {
          kind: 'connected-to', from: 'hypothesis_member', to: 'hypothesis_context',
          confidence: 0.91, evidenceRefs: ['observation_overview'],
        },
        {
          kind: 'part-of', from: 'hypothesis_member', to: 'whole_object',
          confidence: 0.88, evidenceRefs: ['observation_overview'],
        },
      ],
    });
    expect(grounded).toMatchObject({
      receipt: { status: 'succeeded', access: 'read' },
      output: {
        ledger: { current: expect.arrayContaining([expect.objectContaining({
          hypothesisId: 'hypothesis_member', status: 'selected',
        })]) },
        taskRelevantView: {
          entities: expect.arrayContaining([
            expect.objectContaining({ id: 'hypothesis_member' }),
            expect.objectContaining({ id: 'hypothesis_context' }),
          ]),
          abstraction: 'part',
          relations: [expect.objectContaining({ kind: 'connected-to' })],
        },
        ignoredRelations: [expect.objectContaining({
          relation: expect.objectContaining({ kind: 'part-of', to: 'whole_object' }),
          reason: 'endpoint-not-selected',
        })],
        interactionFrame: {
          kind: 'spatial', phase: 'grounding', label: 'member',
          strokes: expect.arrayContaining([
            expect.objectContaining({
              ref: spanId, nodeId: 'line_a', role: 'boundary', points: [[0, 0], [10, 0]],
            }),
            expect.objectContaining({ nodeId: 'line_b', role: 'excluded' }),
          ]),
          markers: expect.arrayContaining([
            expect.objectContaining({ role: 'interface', point: [0, 0] }),
            expect.objectContaining({ role: 'interface', point: [10, 0] }),
          ]),
        },
      },
    });

    const refined = await prepared.invoke('refine_semantic_entity', {
      hypothesisId: 'hypothesis_member', kind: 'refined', confidence: 0.93,
      addedSupports: [], removedSupportRefs: [],
      evidenceRefs: ['observation_focus'], reasonCode: 'FOCUS_CONFIRMED',
    });
    expect(refined).toMatchObject({
      output: {
        current: { hypothesis: { confidence: 0.93 }, status: 'selected' },
        interactionFrame: { kind: 'spatial', phase: 'grounding' },
      },
    });

    const proposed = await prepared.invoke('propose_spatial_actions', {
      sliceHandle: builtOutput.sliceHandle,
      goalDescription: 'raise the selected member',
      targetRefs: [spanId], preserveRefs: ['node:line_b'], interfaceRefs: [],
      methods: ['transform', 'redraw', 'raw'],
    });
    expect(proposed).toMatchObject({
      receipt: { status: 'succeeded', access: 'read', affectedNodeIds: ['line_a'] },
      output: { proposals: expect.arrayContaining([
        expect.objectContaining({ method: 'transform', feasibility: 'ready' }),
        expect.objectContaining({ method: 'redraw', feasibility: 'ready' }),
        expect.objectContaining({ method: 'raw', feasibility: 'ready' }),
      ]), interactionFrame: {
        kind: 'spatial', phase: 'planning',
        strokes: expect.arrayContaining([
          expect.objectContaining({ ref: spanId, nodeId: 'line_a', role: 'target' }),
          expect.objectContaining({ nodeId: 'line_b', role: 'context' }),
        ]),
      } },
    });
    expect((await prepared.application.open(prepared.base.drawingId)).document).toEqual(prepared.document);
    expect((await prepared.application.open(prepared.base.drawingId)).commits).toEqual([]);
  });

  it('inspects only the current episode counterfactual branch and rejects unresolved grounding refs', async () => {
    const prepared = await setup();
    const built = await prepared.invoke('build_world_slice', { nodeIds: ['line_a'] });
    const builtOutput = built.output as BuildOutput;
    const invalidGrounding = await prepared.invoke('ground_semantic_entities', {
      sliceHandle: builtOutput.sliceHandle,
      goalDescription: 'select a missing fragment',
      referringExpression: 'missing fragment', evidenceRefs: [],
      candidates: [{
        id: 'hypothesis_missing', label: 'missing', confidence: 0.5,
        observationRefs: [], regionRefs: [],
        supports: [{ kind: 'source-span', ref: 'span_missing', weight: 1, role: 'boundary' }],
        excludedSupports: [], interfaceRefs: [],
      }],
      selectedCandidateIds: [], abstraction: 'part', relations: [],
    });
    expect(invalidGrounding).toMatchObject({
      receipt: {
        status: 'rejected',
        error: { code: 'GROUNDING_SUPPORT_UNRESOLVED', suggestedAction: 'requery' },
      },
    });

    const preview = await prepared.invoke('preview_transaction', {
      baseRevision: prepared.base.revision,
      summary: 'move line a', confidence: 0.8,
      commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 5] } }],
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    });
    const branchId = (preview.output as { counterfactual: { branchId: string } })
      .counterfactual.branchId;
    const inspected = await prepared.invoke('inspect_counterfactual_world', { branchId });
    expect(inspected).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['line_a'] },
      output: {
        branchId,
        delta: { changedNodeIds: ['line_a'] },
        beforeWorld: { knowledge: { state: 'resolved' } },
        afterWorld: { knowledge: { state: 'resolved' } },
      },
    });
  });
});

interface BuildOutput {
  sliceHandle: string;
  world: {
    continuationToken?: string;
    sourceSpans: Array<{ id: string; sourceNodeId: string }>;
  };
}

async function setup() {
  const document = drawing();
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const created = await repository.create(document);
  const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
  const counterfactualWorld = new CounterfactualWorldService({
    handleFactory: () => 'counterfactual_world_1', now: () => 100,
  });
  let previewCount = 0;
  const drawingTools = new DrawingModelTools({
    application, idFactory, counterfactualWorld,
    handleFactory: () => `preview_${++previewCount}`,
  });
  let worldHandleCount = 0;
  let eventCount = 0;
  const worldModelTools = new DrawingWorldModelTools({
    application, counterfactualWorld, now: () => 100,
    handleFactory: (kind) => kind === 'slice'
      ? `world_slice_${++worldHandleCount}`
      : `grounding_event_${++eventCount}`,
  });
  const registry = new ModelDrawingToolRegistry({
    tools: [...drawingTools.definitions, ...worldModelTools.definitions],
    getCurrentRevision: (drawingId) => application.currentRevision(drawingId),
  });
  const base = {
    runId: 'run_world', episodeId: 'episode_world',
    drawingId: document.id, revision: created.revision,
  };
  let call = 0;
  const invoke = (tool: string, input: unknown) => registry.invoke({
    ...base, toolCallId: `world_call_${++call}`, tool, input,
  });
  return { application, base, document, invoke };
}

function ids(): IdFactory {
  let value = 0;
  return { next: (kind) => `${kind}_${++value}` };
}

function drawing(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_world_tools' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      line('line_a', [0, 0], [10, 0]),
      line('line_b', [20, 0], [30, 0]),
      line('line_c', [40, 0], [50, 0]),
    ],
    annotations: [], relations: [], features: [],
  };
}

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
) {
  return {
    id: id as GeometryId, type: 'line' as const, visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] }, start, end,
  };
}
