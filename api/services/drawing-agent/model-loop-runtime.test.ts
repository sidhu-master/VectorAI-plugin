import { describe, expect, it } from 'vitest';

import type {
  DrawingAgentAction,
  DrawingAgentProgressEvent,
  HumanDecisionResponse,
} from '../../../src/contracts/drawing-agent';
import {
  type DrawingDocument,
  type DrawingId,
  type GeometryId,
  type IdFactory,
  type RevisionId,
  MemoryDrawingRepository,
} from '../../../src/drawing';
import { DrawingApplication } from '../drawing-application/application';
import { createModelDrawingToolGateway } from '../drawing-tools';
import { HumanInteractionPolicy } from '../human-interaction/policy';
import type {
  HumanInteractionRecord,
  HumanInteractionStore,
} from '../human-interaction/types';
import type { DrawingAgentActionModel, ModelLoopActionInput } from './model-loop-adapter';
import { ModelLedDrawingAgentRuntime } from './model-loop-runtime';

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => `${kind}_${(counts.set(kind, (counts.get(kind) ?? 0) + 1), counts.get(kind))}` };
}

class ScriptedActionModel implements DrawingAgentActionModel {
  readonly contexts: ModelLoopActionInput[] = [];
  constructor(private readonly actions: Array<
    DrawingAgentAction | ((input: ModelLoopActionInput) => DrawingAgentAction)
  >) {}

  async next(input: ModelLoopActionInput): Promise<DrawingAgentAction> {
    this.contexts.push({
      ...input,
      recentToolResults: structuredClone(input.recentToolResults),
      recentDiagnostics: structuredClone(input.recentDiagnostics),
      decisions: structuredClone(input.decisions),
      appendedInstructions: [...input.appendedInstructions],
      observations: structuredClone(input.observations),
      signal: new AbortController().signal,
      onRawReply: undefined,
    });
    const action = this.actions.shift();
    if (!action) throw new Error('script exhausted');
    return typeof action === 'function' ? action(input) : structuredClone(action);
  }
}

class MemoryHumanStore implements HumanInteractionStore {
  records: HumanInteractionRecord[] = [];
  async appendRequest(_runId: string, request: HumanInteractionRecord['request']) {
    this.records.push({ request: structuredClone(request), grants: [], createdAt: Date.now() });
  }
  async resolveRequest(
    _runId: string,
    response: HumanDecisionResponse,
    grants: HumanInteractionRecord['grants'],
  ) {
    const record = this.records.find((item) => item.request.id === response.requestId);
    if (!record) throw new Error('HUMAN_DECISION_REQUEST_NOT_FOUND');
    if (record.response) throw new Error('HUMAN_DECISION_ALREADY_RESOLVED');
    record.response = structuredClone(response);
    record.grants = structuredClone(grants);
    record.resolvedAt = response.decidedAt;
    return structuredClone(record);
  }
  async getPending() {
    return structuredClone(this.records.find((record) => !record.response)?.request ?? null);
  }
  async list() { return structuredClone(this.records); }
}

async function setup(actions: ConstructorParameters<typeof ScriptedActionModel>[0]) {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const created = await repository.create(fixtureDocument());
  const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
  const gateway = createModelDrawingToolGateway({ application, idFactory });
  const model = new ScriptedActionModel(actions);
  const interactions = new MemoryHumanStore();
  const runtime = new ModelLedDrawingAgentRuntime({
    application,
    registry: gateway.registry,
    drawingTools: gateway.drawingTools,
    model,
    interactions,
    interactionPolicy: new HumanInteractionPolicy(),
    limits: {
      maxActions: 30, maxToolCalls: 24, maxConsecutiveReads: 10,
      maxCommits: 2, maxProtocolCorrections: 2, wallClockMs: 60_000,
    },
  });
  const start = {
    runId: 'run_model_loop', drawingId: created.document.id, baseRevision: created.revision,
    goal: '将目标部件改成新的连续轮廓',
    modelProfile: { planner: 'lite', decision: 'lite', repair: 'high' },
  };
  return { application, gateway, interactions, model, runtime, start };
}

describe('ModelLedDrawingAgentRuntime', () => {
  it('lets the model inspect topology, revise a four-plane Preview, stream both previews, and commit atomically', async () => {
    const commands1 = fourPlaneCommands(8);
    const commands2 = fourPlaneCommands(12);
    const { application, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'trace_1', tool: 'trace_paths', input: {
          seedPoints: [[1, 0]], stopPoints: [[20, 10]], directionHints: [[1, 0]],
          maxDepth: 8, maxCandidates: 4, tolerance: 0.01,
        },
      },
      {
        type: 'tool', toolCallId: 'render_1', tool: 'render_drawing', input: {
          view: 'focus', selectedIds: ['line_a', 'line_b'], includeAnnotations: true,
        },
      },
      {
        type: 'tool', toolCallId: 'preview_1', tool: 'preview_transaction', input: {
          summary: 'first free candidate', commands: commands1,
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'tool', toolCallId: 'evaluate_1', tool: 'evaluate_preview', input: {
          previewHandle: input.currentPreviewHandle, includeRender: true,
          selectedIds: ['line_a', 'line_b'],
        },
      }),
      {
        type: 'tool', toolCallId: 'preview_2', tool: 'preview_transaction', input: {
          summary: 'revised free candidate', commands: commands2,
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'tool', toolCallId: 'evaluate_2', tool: 'evaluate_preview', input: {
          previewHandle: input.currentPreviewHandle, includeRender: true,
          selectedIds: ['line_a', 'line_b'],
        },
      }),
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit the inspected revision', confidence: 0.86,
      }),
      { type: 'finish', summary: '已根据视觉与 IR 复核并提交' },
    ]);
    const handle = runtime.start(start);
    const channel = runtime.getProgress(start.runId)!;
    const terminal = await handle.completion;

    expect(terminal, terminal.error ?? 'runtime failed without error').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    const current = await application.open(start.drawingId);
    expect(current.document).toMatchObject({
      geometry: [
        expect.objectContaining({ id: 'line_a', end: [10, 12] }),
        expect.objectContaining({ id: 'line_b', start: [10, 12], end: [20, 10] }),
      ],
      annotations: [expect.objectContaining({ id: 'dimension_a', computedValue: 12 })],
      features: [expect.objectContaining({ id: 'feature_a', properties: { state: 'revised' } })],
    });
    expect(current.document.relations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'topology_a', kind: 'closed' }),
    ]));
    const events = channel.events();
    const deltas = events.filter((event) => event.perceptionDelta);
    expect(deltas).toHaveLength(2);
    expect(deltas.map((event) => event.perceptionDelta?.upserts.find((node) => node.id === 'line_a')))
      .toEqual([
        expect.objectContaining({ end: [10, 8] }),
        expect.objectContaining({ end: [10, 12] }),
      ]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'topology_resolved', overlay: expect.objectContaining({ kind: 'paths' }),
      }),
      expect.objectContaining({
        type: 'region_overlay', overlay: expect.objectContaining({ kind: 'nodes' }),
      }),
      expect.objectContaining({ type: 'committed' }),
    ]));
    expect(model.contexts[3].recentDiagnostics).toEqual(expect.any(Array));
    expect(model.contexts.at(-1)?.revision).toBe(current.revision);
  });

  it('pauses on a candidate-scoped constraint decision and resumes the same model loop after approval', async () => {
    const { application, interactions, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_constraint', tool: 'preview_transaction', input: {
          summary: 'replace an existing constraint',
          commands: [
            { type: 'relation.delete', id: 'constraint_a' },
            { type: 'geometry.update', id: 'line_a', changes: { end: [10, 6] } },
          ],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit authorized candidate',
      }),
      (input) => {
        expect(input.decisions).toHaveLength(1);
        expect(input.decisions[0].grants[0]).toMatchObject({ effect: 'allow', scope: 'candidate' });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit authorized candidate',
        };
      },
      { type: 'finish', summary: '授权修改已提交' },
    ]);
    const handle = runtime.start(start);
    await waitFor(() => {
      const status = runtime.getState(start.runId)?.status;
      return status === 'waiting_for_user' || status === 'failed';
    });
    const waiting = runtime.getState(start.runId)!;
    expect(waiting, waiting.error ?? 'runtime did not wait').toMatchObject({
      status: 'waiting_for_user',
    });
    expect(waiting.pendingDecision).toMatchObject({
      kind: 'grant-permission', previewHandle: waiting.currentPreviewHandle,
      affectedResources: [{ plane: 'relation', ids: ['constraint_a'], action: 'constraint.delete' }],
    });
    expect(interactions.records).toHaveLength(1);

    await runtime.respondToDecision(start.runId, {
      requestId: waiting.pendingDecision!.id,
      selectedOptionId: 'allow_once',
      additionalInstruction: '只对当前候选生效',
      decidedAt: Date.now(),
    });
    const terminal = await handle.completion;
    expect(terminal).toMatchObject({ status: 'completed', commitCount: 1 });
    expect(model.contexts.at(-2)?.appendedInstructions).toContain('只对当前候选生效');
    const current = await application.open(start.drawingId);
    expect(current.document.relations.some((relation) => relation.id === 'constraint_a')).toBe(false);
    expect(current.commits.at(-1)?.metadata?.decisionGrantRefs).toHaveLength(1);
  });

  it('returns a denial to the model without committing, then accepts a replacement candidate', async () => {
    const replacement = fourPlaneCommands(5);
    const { application, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_forbidden', tool: 'preview_transaction', input: {
          summary: 'candidate requiring permission',
          commands: [{ type: 'relation.delete', id: 'constraint_a' }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!, summary: 'try candidate',
      }),
      (input) => {
        expect(input.decisions[0].response).toMatchObject({ selectedOptionId: 'deny' });
        expect(input.decisions[0].grants[0]).toMatchObject({ effect: 'deny' });
        return {
          type: 'tool', toolCallId: 'preview_replacement', tool: 'preview_transaction', input: {
            summary: 'candidate that preserves protected resources', commands: replacement,
            preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!, summary: 'commit replacement',
      }),
      { type: 'finish', summary: '已重新规划并提交' },
    ]);
    const handle = runtime.start(start);
    await waitFor(() => runtime.getState(start.runId)?.status === 'waiting_for_user');
    const request = runtime.getState(start.runId)!.pendingDecision!;
    await runtime.respondToDecision(start.runId, {
      requestId: request.id, selectedOptionId: 'deny', decidedAt: Date.now(),
    });

    const terminal = await handle.completion;
    expect(terminal).toMatchObject({ status: 'completed', commitCount: 1 });
    expect(model.contexts.some((input) => input.decisions[0]?.response?.selectedOptionId === 'deny'))
      .toBe(true);
    const current = await application.open(start.drawingId);
    expect(current.document.relations.some((relation) => relation.id === 'constraint_a')).toBe(true);
    expect(current.document.geometry[0]).toMatchObject({ end: [10, 5] });
  });

  it('invalidates a pending candidate decision when the drawing revision changes', async () => {
    const { application, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_stale', tool: 'preview_transaction', input: {
          summary: 'candidate that will become stale',
          commands: [{ type: 'relation.delete', id: 'constraint_a' }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!, summary: 'request permission',
      }),
    ]);
    const handle = runtime.start(start);
    await waitFor(() => runtime.getState(start.runId)?.status === 'waiting_for_user');
    const request = runtime.getState(start.runId)!.pendingDecision!;
    const external = await application.execute({
      drawingId: start.drawingId,
      transaction: {
        id: 'external_tx', baseRevision: start.baseRevision,
        actor: { type: 'user', id: 'external' },
        commands: [{ type: 'geometry.update', id: 'line_b' as GeometryId, changes: { end: [21, 0] } }],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    expect(external.status).toBe('committed');

    await expect(runtime.respondToDecision(start.runId, {
      requestId: request.id, selectedOptionId: 'allow_once', decidedAt: Date.now(),
    })).rejects.toThrow('HUMAN_DECISION_REVISION_EXPIRED');
    expect(runtime.getState(start.runId)).toMatchObject({
      status: 'waiting_for_user', revision: start.baseRevision,
    });
    runtime.stop(start.runId);
    await handle.completion;
  });
});

function fourPlaneCommands(height: number) {
  return [
    { type: 'geometry.update' as const, id: 'line_a' as GeometryId, changes: { end: [10, height] } },
    { type: 'geometry.update' as const, id: 'line_b' as GeometryId, changes: { start: [10, height], end: [20, 10] } },
    { type: 'annotation.update' as const, id: 'dimension_a', changes: { computedValue: height } },
    { type: 'relation.update' as const, id: 'topology_a', changes: { kind: 'closed' } },
    { type: 'feature.update' as const, id: 'feature_a', changes: { properties: { state: 'revised' } } },
  ];
}

function fixtureDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_model_loop' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      line('line_a', [0, 0], [10, 0]),
      line('line_b', [10, 0], [20, 0]),
    ],
    annotations: [{
      id: 'dimension_a' as never, type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'linear', associationStatus: 'resolved',
      targets: [{ geometryId: 'line_a' as GeometryId, anchor: { kind: 'start' } }],
      textPosition: [5, 2], definitionPoints: [[0, 0], [10, 0]], computedValue: 10,
    }],
    relations: [{
      id: 'topology_a' as never, type: 'topology', plane: 'topology', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      kind: 'connected', nodeIds: ['line_a', 'line_b'],
    }, {
      id: 'constraint_a' as never, type: 'constraint', plane: 'constraint', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      kind: 'horizontal', geometryIds: ['line_a' as GeometryId], status: 'satisfied',
    }],
    features: [{
      id: 'feature_a' as never, type: 'feature', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, semanticType: 'part',
      geometryIds: ['line_a' as GeometryId, 'line_b' as GeometryId],
      annotationIds: ['dimension_a' as never], relationIds: ['topology_a' as never],
      properties: { state: 'original' },
    }],
  };
}

function line(id: string, start: readonly [number, number], end: readonly [number, number]) {
  return {
    id: id as GeometryId, type: 'line' as const, visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] }, start, end,
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
