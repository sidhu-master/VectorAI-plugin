import { describe, expect, it, vi } from 'vitest';

import type {
  DrawingAgentAction,
  HumanDecisionResponse,
} from '../../../src/contracts/drawing-agent';
import { DrawingAgentProtocolError } from '../../../src/contracts/drawing-agent';
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
import { ModelDrawingToolRegistry } from '../drawing-tools/registry';
import type { PersistedCleanLineVectorizationResult } from '../drawing-vectorization/types';
import { HumanInteractionPolicy } from '../human-interaction/policy';
import type {
  HumanInteractionRecord,
  HumanInteractionStore,
} from '../human-interaction/types';
import type { DrawingAgentActionModel, ModelLoopActionInput } from './model-loop-adapter';
import { ModelLedDrawingAgentRuntime } from './model-loop-runtime';
import type { DrawingPreviewVerificationModelAdapter } from './types';
import type {
  DrawingAgentAuditEvent,
  DrawingAgentAuditManifest,
  DrawingAgentAuditRun,
  DrawingAgentAuditStore,
} from './audit-types';

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
    const resolved = typeof action === 'function' ? action(input) : structuredClone(action);
    return withExplicitTestEditBase(resolved, input);
  }
}

function withExplicitTestEditBase(
  action: DrawingAgentAction,
  input: ModelLoopActionInput,
): DrawingAgentAction {
  if (action.type !== 'tool' || action.tool !== 'preview_transaction') return action;
  const raw = action.input && typeof action.input === 'object' && !Array.isArray(action.input)
    ? action.input as Record<string, unknown>
    : {};
  return {
    ...action,
    input: {
      baseRevision: input.revision,
      ...(input.currentPreview
        ? { replacesPreviewHandle: input.currentPreview.previewHandle }
        : {}),
      ...raw,
    },
  };
}

class BlockingActionModel implements DrawingAgentActionModel {
  calls = 0;
  aborted = 0;
  async next(input: ModelLoopActionInput): Promise<DrawingAgentAction> {
    this.calls += 1;
    return new Promise((_resolve, reject) => {
      input.signal.addEventListener('abort', () => {
        this.aborted += 1;
        reject(input.signal.reason);
      }, { once: true });
    });
  }
}

class TimeoutThenFinishActionModel implements DrawingAgentActionModel {
  readonly calls: Array<{ attempt: number; modelName: string }> = [];

  async next(input: ModelLoopActionInput): Promise<DrawingAgentAction> {
    this.calls.push({ attempt: input.attempt, modelName: input.modelName });
    if (this.calls.length >= 3) return { type: 'finish', summary: 'third attempt completed' };
    return new Promise((_resolve, reject) => {
      input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
    });
  }
}

class SingleToolActionModel implements DrawingAgentActionModel {
  calls = 0;
  constructor(readonly action: Extract<DrawingAgentAction, { type: 'tool' }>) {}

  async next(): Promise<DrawingAgentAction> {
    this.calls += 1;
    if (this.calls === 1) return structuredClone(this.action);
    return new Promise(() => undefined);
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

class MemoryAuditStore implements DrawingAgentAuditStore {
  manifest?: DrawingAgentAuditManifest;
  readonly events: DrawingAgentAuditEvent[] = [];
  readonly commits: DrawingAgentAuditRun['commits'] = [];

  async startRun(manifest: DrawingAgentAuditManifest) {
    this.manifest = structuredClone(manifest);
  }

  async updateManifest(manifest: DrawingAgentAuditManifest) {
    this.manifest = structuredClone(manifest);
  }

  async appendEvent(event: DrawingAgentAuditEvent) {
    this.events.push(structuredClone(event));
  }

  async saveCommit(_runId: string, commit: DrawingAgentAuditRun['commits'][number]) {
    this.commits.push(structuredClone(commit));
  }

  async readRun(): Promise<DrawingAgentAuditRun> {
    if (!this.manifest) throw new Error('audit run has not started');
    return {
      manifest: structuredClone(this.manifest),
      events: structuredClone(this.events),
      commits: structuredClone(this.commits),
    };
  }
}

function acceptingPreviewVerifier(): DrawingPreviewVerificationModelAdapter {
  return {
    verify: vi.fn(async () => ({
      satisfied: true,
      reason: 'candidate matches the visual objective',
      defects: [],
    })),
  };
}

async function setup(
  actions: ConstructorParameters<typeof ScriptedActionModel>[0],
  runtimeOptions: Pick<
    ConstructorParameters<typeof ModelLedDrawingAgentRuntime>[0],
    'sourceImages' | 'previewVerifier' | 'limits' | 'auditStore'
  > = {},
) {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const created = await repository.create(fixtureDocument());
  const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
  const gateway = createModelDrawingToolGateway({ application, idFactory });
  const model = new ScriptedActionModel(actions);
  const interactions = new MemoryHumanStore();
  const { limits: limitOverrides, ...runtimeDependencies } = runtimeOptions;
  const runtime = new ModelLedDrawingAgentRuntime({
    application,
    registry: gateway.registry,
    drawingTools: gateway.drawingTools,
    runResources: gateway,
    model,
    previewVerifier: runtimeOptions.previewVerifier ?? acceptingPreviewVerifier(),
    interactions,
    ...runtimeDependencies,
    interactionPolicy: new HumanInteractionPolicy(),
    limits: {
      maxActions: 30, maxToolCalls: 24, maxConsecutiveReads: 10,
      maxCommits: 2, maxProtocolCorrections: 2, wallClockMs: 60_000,
      ...limitOverrides,
    },
  });
  const start = {
    runId: 'run_model_loop', drawingId: created.document.id, baseRevision: created.revision,
    goal: '将目标部件改成新的连续轮廓',
    modelProfile: {
      planner: 'lite', decision: 'lite', repair: 'high', reviewer: 'independent-reviewer',
    },
  };
  return { application, gateway, interactions, model, runtime, start };
}

async function seedRiskyConnectedFixture(
  application: DrawingApplication,
  drawingId: DrawingId,
  revision: RevisionId,
): Promise<RevisionId> {
  const seeded = await application.execute({
    drawingId,
    transaction: {
      id: 'seed_structural_loop', baseRevision: revision,
      actor: { type: 'user', id: 'fixture' },
      commands: [
        {
          type: 'geometry.create', value: {
            id: 'circle_risk' as GeometryId, type: 'circle',
            center: [61.710477, 204.929327], radius: 41.487229,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
        {
          type: 'geometry.create', value: {
            id: 'boundary_upper_risk' as GeometryId, type: 'line',
            start: [64.694509, 247.32261], end: [124.143616, 289.214202],
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
        {
          type: 'geometry.create', value: {
            id: 'boundary_lower_risk' as GeometryId, type: 'line',
            start: [102.064374, 193.174903], end: [118.992472, 204.116046],
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
        {
          type: 'geometry.create', value: {
            id: 'extent_risk' as GeometryId, type: 'point', x: 500, y: 650,
            visible: false, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        },
      ],
      preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    },
  });
  if (seeded.status !== 'committed') throw new Error('expected structural-loop fixture commit');
  return seeded.revision;
}

describe('ModelLedDrawingAgentRuntime', () => {
  it('streams protocol correction and recovery as a trustworthy non-terminal process', async () => {
    const { model, runtime, start } = await setup([
      () => {
        throw new DrawingAgentProtocolError('response.json', '模型返回的内容不是合法 JSON');
      },
      (input) => {
        expect(input.protocolFeedback).toContain('response.json');
        return { type: 'finish', summary: '格式修复后完成' };
      },
    ]);

    const terminal = await runtime.start(start).completion;
    const events = runtime.getProgress(start.runId)!.events();
    const repairingIndex = events.findIndex((event) => event.type === 'protocol_repairing');
    const recoveredIndex = events.findIndex((event) => event.type === 'protocol_recovered');

    expect(terminal).toMatchObject({
      status: 'completed', protocolCorrectionCount: 1,
    });
    expect(model.contexts).toHaveLength(2);
    expect(events[repairingIndex]).toMatchObject({
      title: '模型输出格式需要校正',
      detail: '正在进行第 1/2 次自动纠正',
    });
    expect(events[recoveredIndex]).toMatchObject({
      title: '输出格式已恢复，继续执行',
      detail: '第 1/2 次自动纠正已成功',
    });
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      detail: '执行期间已完成 1 次自动纠正',
    });
    expect(recoveredIndex).toBeGreaterThan(repairingIndex);
    expect(events.some((event) => event.detail?.includes('不是合法 JSON'))).toBe(false);
  });

  it('enforces the protocol-correction limit between recursive model calls', async () => {
    const invalid = () => {
      throw new DrawingAgentProtocolError('response.json', '模型返回的内容不是合法 JSON');
    };
    const { model, runtime, start } = await setup([invalid, invalid]);

    const terminal = await runtime.start(start).completion;

    expect(terminal).toMatchObject({
      status: 'failed', protocolCorrectionCount: 2,
      error: expect.stringContaining('MAX_PROTOCOL_CORRECTIONS'),
    });
    expect(model.contexts).toHaveLength(2);
  });

  it('bounds each model call and retries spatial work with the high model', async () => {
    const prepared = await setup([]);
    const model = new TimeoutThenFinishActionModel();
    const runtime = new ModelLedDrawingAgentRuntime({
      application: prepared.application,
      registry: prepared.gateway.registry,
      drawingTools: prepared.gateway.drawingTools,
      model,
      interactions: prepared.interactions,
      limits: {
        maxActions: 6, maxToolCalls: 4, maxConsecutiveReads: 4,
        maxCommits: 1, maxProtocolCorrections: 2, wallClockMs: 1_000,
        spatialModelCallMs: 20,
      },
    });

    const terminal = await runtime.start(prepared.start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({ status: 'completed' });
    expect(model.calls).toEqual([
      { attempt: 1, modelName: 'high' },
      { attempt: 2, modelName: 'high' },
      { attempt: 3, modelName: 'high' },
    ]);
    expect(runtime.getProgress(prepared.start.runId)?.events().filter((event) => (
      event.type === 'revising' && event.title === '模型响应异常，正在重试'
    ))).toHaveLength(2);
  });

  it('bootstraps from an uploaded source once, then uses the current Drawing observation', async () => {
    const sourceImages = {
      read: vi.fn(async () => ({
        sourceId: 'source_image', mimeType: 'image/png',
        bytes: Uint8Array.from([1, 2, 3, 4]), width: 1360, height: 2048,
      })),
    };
    const { gateway, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'query_1', tool: 'measure_geometry',
        input: { measurements: [{ id: 'bounds_1', kind: 'bounds', nodeIds: ['line_a'] }] },
      },
      { type: 'finish', summary: '视觉源图已读取' },
    ], { sourceImages });
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start({
      ...start,
      goal: '分析并说明上传图纸',
      source: {
        sourceId: 'source_image', sha256: 'a'.repeat(64), mimeType: 'image/png',
        byteLength: 4, page: 1,
      },
      attachmentPurpose: 'drawing-source',
    }).completion;

    expect(terminal.status).toBe('completed');
    expect(sourceImages.read).toHaveBeenCalledTimes(1);
    expect(model.contexts).toHaveLength(2);
    expect(model.contexts.map((context) => context.sourceImage)).toEqual([
      {
        id: 'source_source_image_page_1',
        imageDataUrl: 'data:image/png;base64,AQIDBA==',
        width: 1360,
        height: 2048,
      },
      undefined,
    ]);
    expect(model.contexts[0].observations).toEqual([]);
    expect(model.contexts[1].observations).toHaveLength(1);
    expect(model.contexts[1].observations[0]).toMatchObject({ purpose: 'overview' });
    expect(model.contexts[1].recentToolResults).toHaveLength(1);
    expect(model.contexts[1].recentToolResults[0].receipt.toolCallId).toBe('query_1');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('rejects an ungrounded source reconstruction finish and requires an explicit post-commit turn', async () => {
    const { model, runtime, start } = await setup([
      { type: 'finish', summary: '上传图纸已经完整重建' },
      (input) => {
        expect(input.protocolFeedback).toContain('SOURCE_RECONSTRUCTION_INCOMPLETE');
        return {
          type: 'tool', toolCallId: 'preview_after_premature_finish',
          tool: 'preview_transaction', input: {
            summary: '从源图证据产生可审计增量',
            commands: [{
              type: 'geometry.update', id: 'line_a', changes: { end: [10, 7] },
            }],
            preconditions: [], postconditions: [{ type: 'document.valid' }],
            evidenceRefs: [],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: '提交源图重建增量',
      }),
      (input) => {
        expect(input.decisionContext).toMatchObject({ phase: 'post-commit' });
        return { type: 'finish', summary: '已在新 revision 上验收重建结果' };
      },
    ]);

    const terminal = await runtime.start({
      ...start,
      goal: '解析并重建上传的二维图纸',
      source: {
        sourceId: 'source_image', sha256: 'a'.repeat(64), mimeType: 'image/png',
        byteLength: 4, page: 1,
      },
      attachmentPurpose: 'drawing-source',
    }).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, budgetedCommitCount: 1,
      protocolCorrectionCount: 1,
    });
    expect(model.contexts).toHaveLength(4);
    expect(model.contexts[1].protocolFeedback).toContain('SOURCE_RECONSTRUCTION_INCOMPLETE');
  });

  it('requires every deterministic vectorization batch to be committed before finishing', async () => {
    const idFactory = ids();
    const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
    const created = await repository.create(fixtureDocument());
    const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
    const vectorization = {
      vectorizeSource: vi.fn(async (): Promise<PersistedCleanLineVectorizationResult> => ({
        sourceId: 'source_image', pipelineVersion: 'fixture-v1', width: 100, height: 100,
        analysisScale: 1, medianLineWidthPx: 1,
        chains: Array.from({ length: 49 }, (_, index) => ({
          id: `chain_${index}`, closed: false,
          samples: [[index, 0], [index, 10]] as [[number, number], [number, number]],
          simplified: [[index, 0], [index, 10]] as [[number, number], [number, number]],
          bounds: { x: index, y: 0, width: 1, height: 10 },
          pieces: [{
            id: `piece_${index}`, sampleRange: [0, 1] as [number, number],
            wraps: false, closed: false,
            simplified: [[index, 0], [index, 10]] as [[number, number], [number, number]],
            bounds: { x: index, y: 0, width: 1, height: 10 },
            candidate: {
              type: 'line' as const,
              parameters: { start: [index, 0], end: [index, 10] },
              fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
            },
          }],
          segmentation: {
            algorithmVersion: 'fixture', drawingDiagonalPx: 100, chainLengthPx: 10,
            fitTolerancePx: 1, nearWindowPx: 1, farWindowPx: 2,
            minimumSpanPx: 1, splitPenalty: 1, decisions: [],
          },
          evidence: {
            handle: `evidence_${index}`, sourceId: 'source_image',
            regionId: `region_${index}`, kind: 'line-candidate' as const,
            bounds: { x: index, y: 0, width: 1, height: 10 }, confidence: 0.99,
            touchesRegionEdge: false, sampleCount: 2,
          },
        })),
      })),
    };
    const gateway = createModelDrawingToolGateway({ application, idFactory, vectorization });
    let candidateHandle = '';
    const model = new ScriptedActionModel([
      {
        type: 'tool', toolCallId: 'vectorize_all', tool: 'vectorize_image',
        input: { sourceId: 'source_image' },
      },
      (input) => {
        const output = input.recentToolResults.find((result) => (
          result.receipt.tool === 'vectorize_image'
        ))?.output as { candidateHandle?: string; inventory?: { batchCount?: number } };
        candidateHandle = output.candidateHandle ?? '';
        expect(output.inventory?.batchCount).toBe(2);
        return {
          type: 'tool', toolCallId: 'preview_batch_0', tool: 'preview_vectorization_batch',
          input: { candidateHandle, batchIndex: 0 },
        };
      },
      { type: 'finish', summary: 'incorrectly finish after only the first batch' },
      (input) => {
        expect(input.protocolFeedback).toContain('SOURCE_RECONSTRUCTION_INCOMPLETE');
        return {
          type: 'tool', toolCallId: 'preview_batch_1', tool: 'preview_vectorization_batch',
          input: { candidateHandle, batchIndex: 1 },
        };
      },
      {
        type: 'tool', toolCallId: 'semantic_preview_after_import', tool: 'preview_transaction',
        input: {
          summary: 'post-import semantic refinement',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 6] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'semantic refinement committed',
      }),
      { type: 'finish', summary: 'all import and semantic work committed' },
    ]);
    const interactions = new MemoryHumanStore();
    const runtime = new ModelLedDrawingAgentRuntime({
      application, registry: gateway.registry, drawingTools: gateway.drawingTools,
      generationTools: gateway.generationTools, runResources: gateway,
      model, previewVerifier: acceptingPreviewVerifier(), interactions,
      limits: {
        maxActions: 20, maxToolCalls: 12, maxConsecutiveReads: 8,
        maxCommits: 2, maxProtocolCorrections: 2, wallClockMs: 60_000,
      },
    });

    const terminal = await runtime.start({
      runId: 'run_all_batches', drawingId: created.document.id,
      baseRevision: created.revision, goal: '解析并重建上传的二维图纸',
      modelProfile: { planner: 'lite', decision: 'lite', repair: 'high', reviewer: 'reviewer' },
      source: {
        sourceId: 'source_image', sha256: 'a'.repeat(64), mimeType: 'image/png',
        byteLength: 4, page: 1,
      },
      attachmentPurpose: 'drawing-source',
    }).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 3, budgetedCommitCount: 1,
      protocolCorrectionCount: 1,
    });
    expect(vectorization.vectorizeSource).toHaveBeenCalledTimes(1);
  });

  it('commits a deterministic vectorization batch without asking the whole-drawing verifier', async () => {
    const idFactory = ids();
    const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
    const created = await repository.create(fixtureDocument());
    const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
    const vectorization = {
      vectorizeSource: vi.fn(async (): Promise<PersistedCleanLineVectorizationResult> => ({
        sourceId: 'source_image', pipelineVersion: 'fixture-v1', width: 100, height: 100,
        analysisScale: 1, medianLineWidthPx: 1,
        chains: [{
          id: 'chain_0', closed: false,
          samples: [[0, 0], [10, 0]], simplified: [[0, 0], [10, 0]],
          bounds: { x: 0, y: 0, width: 10, height: 1 },
          pieces: [{
            id: 'piece_0', sampleRange: [0, 1], wraps: false, closed: false,
            simplified: [[0, 0], [10, 0]], bounds: { x: 0, y: 0, width: 10, height: 1 },
            candidate: {
              type: 'line', parameters: { start: [0, 0], end: [10, 0] },
              fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
            },
          }],
          segmentation: {
            algorithmVersion: 'fixture', drawingDiagonalPx: 100, chainLengthPx: 10,
            fitTolerancePx: 1, nearWindowPx: 1, farWindowPx: 2,
            minimumSpanPx: 1, splitPenalty: 1, decisions: [],
          },
          evidence: {
            handle: 'evidence_0', sourceId: 'source_image', regionId: 'region_0',
            kind: 'line-candidate', bounds: { x: 0, y: 0, width: 10, height: 1 },
            confidence: 0.99, touchesRegionEdge: false, sampleCount: 2,
          },
        }],
      })),
    };
    const gateway = createModelDrawingToolGateway({ application, idFactory, vectorization });
    let candidateHandle = '';
    const model = new ScriptedActionModel([
      {
        type: 'tool', toolCallId: 'vectorize_once', tool: 'vectorize_image',
        input: { sourceId: 'source_image' },
      },
      (input) => {
        candidateHandle = (input.recentToolResults.at(-1)?.output as {
          candidateHandle: string;
        }).candidateHandle;
        return {
          type: 'tool', toolCallId: 'preview_once', tool: 'preview_vectorization_batch',
          input: { candidateHandle, batchIndex: 0 },
        };
      },
      { type: 'finish', summary: 'vectorization committed' },
    ]);
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => ({ satisfied: false, reason: 'must not run per batch', defects: [] })),
    };
    const runtime = new ModelLedDrawingAgentRuntime({
      application, registry: gateway.registry, drawingTools: gateway.drawingTools,
      generationTools: gateway.generationTools, runResources: gateway,
      model, previewVerifier, interactions: new MemoryHumanStore(),
      limits: {
        maxActions: 12, maxToolCalls: 8, maxConsecutiveReads: 6,
        maxCommits: 2, maxProtocolCorrections: 2, wallClockMs: 60_000,
      },
    });

    const terminal = await runtime.start({
      runId: 'run_deterministic_batch', drawingId: created.document.id,
      baseRevision: created.revision, goal: '解析并重建上传的二维图纸',
      modelProfile: { planner: 'lite', decision: 'lite', repair: 'high', reviewer: 'reviewer' },
      source: {
        sourceId: 'source_image', sha256: 'a'.repeat(64), mimeType: 'image/png',
        byteLength: 4, page: 1,
      },
      attachmentPurpose: 'drawing-source',
    }).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, budgetedCommitCount: 0,
    });
    expect(previewVerifier.verify).not.toHaveBeenCalled();
    expect(runtime.getProgress('run_deterministic_batch')?.events()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'previewing',
        overlay: expect.objectContaining({ kind: 'preview' }),
        perceptionDelta: expect.objectContaining({
          source: expect.objectContaining({ stage: 'outline' }),
          upserts: [expect.objectContaining({ type: 'line' })],
        }),
      }),
    ]));
  });

  it('treats an image-only attachment as reference context unless import is explicit', async () => {
    const { model, runtime, start } = await setup([
      { type: 'finish', summary: '参考图片已作为上下文读取，图纸未修改' },
    ]);

    const terminal = await runtime.start({
      ...start,
      goal: '',
      source: {
        sourceId: 'reference_image', sha256: 'a'.repeat(64), mimeType: 'image/png',
        byteLength: 4, page: 1,
      },
    }).completion;

    expect(terminal).toMatchObject({ status: 'completed', commitCount: 0 });
    expect(model.contexts).toHaveLength(1);
    expect(model.contexts[0]?.toolCatalog.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining(['vectorize_image', 'preview_vectorization_batch']),
    );
  });

  it('imports an image-only source without calling the model', async () => {
    const idFactory = ids();
    const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
    const base = fixtureDocument();
    base.geometry = [];
    base.annotations = [];
    base.relations = [];
    base.features = [];
    const created = await repository.create(base);
    const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
    const vectorization = {
      vectorizeSource: vi.fn(async (): Promise<PersistedCleanLineVectorizationResult> => ({
        sourceId: 'source_image', pipelineVersion: 'fixture-v1', width: 100, height: 100,
        analysisScale: 1, medianLineWidthPx: 1,
        chains: [{
          id: 'circle_chain', closed: true,
          samples: [[40, 50], [50, 40], [60, 50], [50, 60]] as never,
          simplified: [[40, 50], [50, 40], [60, 50], [50, 60]] as never,
          bounds: { x: 40, y: 40, width: 20, height: 20 },
          pieces: [{
            id: 'circle_piece', sampleRange: [0, 3], wraps: true, closed: true,
            simplified: [[40, 50], [50, 40], [60, 50], [50, 60]] as never,
            bounds: { x: 40, y: 40, width: 20, height: 20 },
            candidate: {
              type: 'circle', parameters: { center: [50, 50], radius: 10 },
              fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
            },
          }],
          segmentation: {
            algorithmVersion: 'fixture', drawingDiagonalPx: 100, chainLengthPx: 60,
            fitTolerancePx: 1, nearWindowPx: 1, farWindowPx: 2,
            minimumSpanPx: 1, splitPenalty: 1, decisions: [],
          },
          evidence: {
            handle: 'evidence_circle', sourceId: 'source_image', regionId: 'region_circle',
            kind: 'circle-candidate', bounds: { x: 40, y: 40, width: 20, height: 20 },
            confidence: 0.99, touchesRegionEdge: false, sampleCount: 4,
          },
        }],
      })),
    };
    const gateway = createModelDrawingToolGateway({ application, idFactory, vectorization });
    const model = new ScriptedActionModel([]);
    const runtime = new ModelLedDrawingAgentRuntime({
      application, registry: gateway.registry, drawingTools: gateway.drawingTools,
      generationTools: gateway.generationTools, runResources: gateway,
      model, interactions: new MemoryHumanStore(),
      limits: {
        maxActions: 12, maxToolCalls: 8, maxConsecutiveReads: 6,
        maxCommits: 2, maxProtocolCorrections: 2, wallClockMs: 60_000,
      },
    });

    const terminal = await runtime.start({
      runId: 'run_source_annotations', drawingId: created.document.id,
      baseRevision: created.revision, goal: '',
      modelProfile: { planner: 'lite', decision: 'lite', repair: 'high', reviewer: 'reviewer' },
      source: {
        sourceId: 'source_image', sha256: 'a'.repeat(64), mimeType: 'image/png',
        byteLength: 4, page: 1,
      },
      attachmentPurpose: 'drawing-source',
    }).completion;

    const current = await application.open(created.document.id);
    const events = runtime.getProgress('run_source_annotations')!.events();
    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, budgetedCommitCount: 0,
    });
    expect(model.contexts).toHaveLength(0);
    expect(vectorization.vectorizeSource).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === 'model_started')).toBe(false);
    expect(current.document.geometry.length).toBeGreaterThan(0);
    // 分区标注流程：导入阶段不产生自动标注，等待用户补充信息
    expect(current.document.annotations).toEqual([]);
    const completedEvent = events.find((event) => event.type === 'completed');
    expect(completedEvent?.title).toContain('分区');
    expect(events.findIndex((event) => event.type === 'vectorizing')).toBeGreaterThanOrEqual(0);
    expect(events.findIndex((event) => event.type === 'previewing')).toBeGreaterThan(
      events.findIndex((event) => event.type === 'vectorizing'),
    );
    expect(events.some((event) => (
      event.type === 'previewing'
      && event.perceptionDelta?.source.stage === 'annotation'
    ))).toBe(false);
  });

  it('starts every run with a grounded overview and defers exact world compilation until needed', async () => {
    const { model, runtime, start } = await setup([
      { type: 'finish', summary: '当前图纸已经观察完成' },
    ]);

    const terminal = await runtime.start(start).completion;

    expect(terminal.status).toBe('completed');
    expect(model.contexts).toHaveLength(1);
    expect(model.contexts[0].observations).toEqual([
      expect.objectContaining({
        purpose: 'overview',
        imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
        grounding: expect.arrayContaining([
          expect.objectContaining({ nodeId: 'line_a' }),
        ]),
      }),
    ]);
    expect(model.contexts[0].observations[0].grounding.some((node) => (
      node.nodeId === 'dimension_a'
    ))).toBe(false);
    expect(model.contexts[0].spatialContext).toMatchObject({
      globalMap: expect.objectContaining({ counts: expect.objectContaining({ geometry: 2 }) }),
      workingSet: expect.objectContaining({ nodes: [] }),
    });
    expect(model.contexts[0].spatialContext).not.toHaveProperty('worldModelSlice');
    expect(model.contexts[0].spatialContext).not.toHaveProperty('actionFacts');
    expect(model.contexts[0].decisionContext).toMatchObject({
      sequence: 1,
      phase: 'initial',
      evidenceDelta: {
        evidenceRefs: expect.arrayContaining([expect.stringMatching(/^drawing-map:/)]),
      },
    });
  });

  it('projects an exact bounded World Model when the user supplied an explicit target', async () => {
    const { model, runtime, start } = await setup([
      { type: 'finish', summary: 'selected target observed' },
    ]);

    const terminal = await runtime.start({ ...start, selectedIds: ['line_a'] }).completion;

    expect(terminal.status).toBe('completed');
    expect(model.contexts[0].spatialContext).toMatchObject({
      worldModelSlice: {
        compilerVersion: 'world-model-0.1.0',
        knowledge: { state: 'resolved' },
        primitiveRows: expect.arrayContaining([
          expect.arrayContaining([expect.any(String), 'line']),
        ]),
      },
      actionFacts: expect.any(Array),
    });
    const selectedWorkingSet = model.contexts[0].spatialContext?.workingSet as {
      nodes: Array<Record<string, unknown>>;
    };
    expect(selectedWorkingSet.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({
        alias: expect.any(String), plane: 'geometry', relevance: 'target',
      })]),
    );
    expect(selectedWorkingSet.nodes[0]).not.toHaveProperty('node');
    expect(model.contexts[0].decisionContext?.evidenceDelta.evidenceRefs)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^world:/)]));
  });

  it('forwards stable edit invariants as model-visible context instead of silently dropping them', async () => {
    const { model, runtime, start } = await setup([
      (input) => {
        expect(input.stableRules).toEqual([
          '保持非目标内容与已有连接关系不变',
        ]);
        return { type: 'finish', summary: 'stable rules received' };
      },
    ]);

    const terminal = await runtime.start({
      ...start, stableRules: ['保持非目标内容与已有连接关系不变'],
    }).completion;

    expect(terminal.status).toBe('completed');
    expect(model.contexts).toHaveLength(1);
  });

  it('starts spatial reasoning with the high model and never downgrades retries', async () => {
    const calls: Array<{ modelName: string; attempt: number }> = [];
    const model: DrawingAgentActionModel = {
      next: async (input) => {
        calls.push({ modelName: input.modelName, attempt: input.attempt });
        if (calls.length < 3) throw new Error('MODEL_UPSTREAM_TIMEOUT');
        return { type: 'finish', summary: '第三次模型调用成功' };
      },
    };
    const { runtime: baseRuntime, ...prepared } = await setup([]);
    void baseRuntime;
    const runtime = new ModelLedDrawingAgentRuntime({
      application: prepared.application,
      registry: prepared.gateway.registry,
      drawingTools: prepared.gateway.drawingTools,
      model,
      interactions: prepared.interactions,
      limits: {
        maxActions: 30, maxToolCalls: 24, maxConsecutiveReads: 10,
        maxCommits: 2, maxProtocolCorrections: 2, wallClockMs: 60_000,
      },
    });

    const terminal = await runtime.start(prepared.start).completion;

    expect(terminal.status).toBe('completed');
    expect(calls).toEqual([
      { modelName: 'high', attempt: 1 },
      { modelName: 'high', attempt: 2 },
      { modelName: 'high', attempt: 3 },
    ]);
    expect(runtime.getProgress(prepared.start.runId)?.events()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'revising', title: '模型响应异常，正在重试' }),
    ]));
  });

  it('gives compiler feedback back to the high spatial model', async () => {
    const { model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'invalid_preview_1', tool: 'preview_transaction',
        input: {
          summary: 'first invalid candidate',
          commands: [{ type: 'update', nodeId: 'line_a', updates: { end: [10, 5] } }],
          preconditions: [], postconditions: [], evidenceRefs: [],
        },
      },
      {
        type: 'tool', toolCallId: 'invalid_preview_2', tool: 'preview_transaction',
        input: {
          summary: 'second invalid candidate',
          commands: [{ command: 'update-node', nodeId: 'line_a', updates: { end: [10, 5] } }],
          preconditions: [], postconditions: [], evidenceRefs: [],
        },
      },
      { type: 'finish', summary: 'repair model received exact compiler feedback' },
    ]);

    const terminal = await runtime.start(start).completion;

    expect(terminal.status).toBe('completed');
    expect(model.contexts.map(({ modelName, attempt }) => ({ modelName, attempt }))).toEqual([
      { modelName: 'high', attempt: 1 },
      { modelName: 'high', attempt: 2 },
      { modelName: 'high', attempt: 3 },
    ]);
    expect(model.contexts[1].recentToolResults.at(-1)?.receipt.error).toMatchObject({
      code: 'TOOL_INPUT_INVALID', detail: expect.stringContaining('commands[0].type'),
    });
  });

  it('commits a deterministically valid Preview without a mandatory visual-model round', async () => {
    const preview = {
      type: 'tool' as const, toolCallId: 'preview_requires_visual_check',
      tool: 'preview_transaction' as const,
      input: {
        summary: 'candidate requiring visual check',
        commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 7] } }],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    };
    const { application, model, runtime, start } = await setup([
      preview,
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit deterministic preview',
      }),
    ]);

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect(model.contexts).toHaveLength(2);
    expect(terminal.revision).toBe((await application.open(start.drawingId)).revision);
    expect(runtime.getProgress(start.runId)?.events()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'previewing',
        perceptionDelta: expect.objectContaining({
          action: 'preview', upserts: [expect.objectContaining({ id: 'line_a', end: [10, 7] })],
        }),
      }),
    ]));
  });

  it('rejects a tool that is not available in the current model turn', async () => {
    const { gateway, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_for_catalog_gate',
        tool: 'preview_transaction', input: {
          summary: 'candidate before an invalid direct commit tool call',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 7] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      {
        type: 'tool', toolCallId: 'invalid_direct_commit',
        tool: 'preview_vectorization_batch',
        input: { candidateHandle: 'not-currently-callable', batchIndex: 1 },
      },
      (input) => {
        expect(input.protocolFeedback).toContain('TOOL_NOT_AVAILABLE_IN_CURRENT_TURN');
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit through the runtime action',
        };
      },
    ]);
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start(start).completion;

    expect(terminal).toMatchObject({
      status: 'completed', commitCount: 1, protocolCorrectionCount: 1,
    });
    expect(invoke.mock.calls.map((call) => call[0].tool)).toEqual([
      'preview_transaction', 'commit_preview',
    ]);
    expect(model.contexts).toHaveLength(3);
  });

  it('completes the bounded World Model fast path without redundant evidence reads', async () => {
    const { application, gateway, model, runtime, start } = await setup([
      (input) => {
        expect(input.decisionContext).toMatchObject({ sequence: 1, phase: 'initial' });
        expect(input.spatialContext?.worldModelSlice).toMatchObject({
          knowledge: { state: 'resolved' },
        });
        expect(input.toolCatalog.map((tool) => tool.name)).not.toEqual(expect.arrayContaining([
          'query_nodes', 'inspect_nodes', 'inspect_world_slice', 'trace_paths',
        ]));
        return {
          type: 'tool', toolCallId: 'preview_fast_path', tool: 'preview_transaction',
          input: {
            summary: 'direct deterministic candidate',
            commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 7] } }],
            preconditions: [], postconditions: [{ type: 'document.valid' }],
            evidenceRefs: [input.decisionContext!.evidenceDelta.evidenceRefs[0]],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit direct deterministic candidate', confidence: 0.91,
      }),
    ]);
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start({ ...start, selectedIds: ['line_a'] }).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 2, toolCallCount: 2,
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[0]?.[0]).toMatchObject({ tool: 'preview_transaction' });
    expect(invoke.mock.calls[1]?.[0]).toMatchObject({ tool: 'commit_preview' });
    expect((await application.open(start.drawingId)).document.geometry[0]).toMatchObject({
      id: 'line_a', end: [10, 7],
    });
    expect(model.contexts).toHaveLength(2);
    expect(model.contexts[1].observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        purpose: 'preview',
        grounding: expect.arrayContaining([
          expect.objectContaining({ nodeId: 'line_a' }),
        ]),
      }),
    ]));
  });

  it('streams and independently reviews a task-driven spatial program before commit', async () => {
    const previewVerifier = acceptingPreviewVerifier();
    const auditStore = new MemoryAuditStore();
    const { application, gateway, model, runtime, start } = await setup([
      (input) => {
        expect(input.toolCatalog.map((tool) => tool.name)).toContain('preview_spatial_program');
        const overview = input.observations.find((view) => view.purpose === 'overview');
        expect(overview).toBeDefined();
        return {
          type: 'tool', toolCallId: 'spatial_program_1', tool: 'preview_spatial_program',
          input: {
            baseRevision: input.revision,
            summary: 'move path and reconnect its interface',
            intent: 'move the explicit target and update one endpoint',
            targets: [{
              id: 'path', description: 'selected path', nodeRefs: ['line_a'],
              visualAnchors: [{
                kind: 'node_anchor', nodeId: 'line_a', anchor: 'start',
              }],
              interfaceRefs: [{
                kind: 'node_anchor', nodeId: 'line_a', anchor: 'end',
              }],
            }],
            operations: [
              {
                kind: 'translate', nodeIds: ['line_a'],
                from: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'start' },
                to: {
                  kind: 'observation', observationId: overview!.id,
                  normalized: [0.29, 0.29],
                },
              },
              {
                kind: 'set_endpoint', nodeId: 'line_a', endpoint: 'end',
                point: { kind: 'world', frameId: 'document', point: [15, 10] },
              },
            ],
            preserveNodeRefs: ['line_b'],
            postconditions: [{
              kind: 'anchor_at',
              anchor: { kind: 'node_anchor', nodeId: 'line_a', anchor: 'end' },
              point: { kind: 'world', frameId: 'document', point: [15, 10] },
            }],
            evidenceRefs: [], confidence: 0.9,
          },
        };
      },
      (input) => {
        expect(input.currentPreviewReview).toMatchObject({ status: 'satisfied' });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit reviewed spatial program',
        };
      },
    ], { previewVerifier, auditStore });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 2,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(1);
    expect(previewVerifier.verify).toHaveBeenCalledWith(expect.objectContaining({
      candidateContext: expect.objectContaining({
        tool: 'preview_spatial_program',
        summary: 'move path and reconnect its interface',
        intent: 'move the explicit target and update one endpoint',
        targetNodeIds: ['line_a'],
        operationKinds: ['translate', 'set_endpoint'],
        preserveNodeIds: ['line_b'],
      }),
    }));
    expect(gateway.registry.snapshot().consumedToolCallCount).toBe(2);
    const committedLine = (await application.readCurrent(start.drawingId)).document.geometry[0];
    expect(committedLine).toMatchObject({ id: 'line_a', end: [15, 10] });
    expect(committedLine.type === 'line' ? committedLine.start[0] : Number.NaN).toBeCloseTo(5);
    expect(committedLine.type === 'line' ? committedLine.start[1] : Number.NaN).toBeCloseTo(5);
    expect(model.contexts).toHaveLength(2);
    const programAudit = (await auditStore.readRun()).events.find((event) => (
      event.type === 'tool_call'
      && (event.payload.receipt as { tool?: string } | undefined)?.tool === 'preview_spatial_program'
    ));
    expect(programAudit?.payload).toMatchObject({
      spatialProgramExecution: {
        previewHandle: expect.any(String),
        program: {
          summary: 'move path and reconnect its interface',
          intent: 'move the explicit target and update one endpoint',
          operations: [{ kind: 'translate' }, { kind: 'set_endpoint' }],
        },
        operationReceipts: [
          { operationIndex: 0, kind: 'translate', affectedNodeIds: ['line_a'] },
          { operationIndex: 1, kind: 'set_endpoint', affectedNodeIds: ['line_a'] },
        ],
        editBase: { kind: 'canonical', revision: start.baseRevision },
      },
    });
    expect(JSON.stringify(programAudit?.payload)).not.toContain('commands');
    expect(JSON.stringify(programAudit?.payload)).not.toContain('imageDataUrl');
    expect(runtime.getProgress(start.runId)?.events()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool_started', title: '正在编译空间编辑计划',
        overlay: expect.objectContaining({
          kind: 'spatial', phase: 'planning',
          strokes: expect.arrayContaining([expect.objectContaining({ nodeId: 'line_a' })]),
          markers: expect.arrayContaining([
            expect.objectContaining({ role: 'anchor', point: [0, 0] }),
            expect.objectContaining({ role: 'interface', point: [10, 0] }),
            expect.objectContaining({ role: 'interface', point: [15, 10] }),
            expect.objectContaining({ role: 'target' }),
          ]),
          vectors: expect.arrayContaining([
            expect.objectContaining({ role: 'motion', from: [0, 0] }),
            expect.objectContaining({ role: 'motion', from: [10, 0], to: [15, 10] }),
          ]),
        }),
      }),
      expect.objectContaining({
        type: 'previewing',
        perceptionDelta: expect.objectContaining({
          upserts: [expect.objectContaining({ id: 'line_a', start: [5, 5], end: [15, 10] })],
        }),
        overlay: expect.objectContaining({ kind: 'spatial', phase: 'previewing' }),
      }),
      expect.objectContaining({
        type: 'verifying', overlay: expect.objectContaining({ kind: 'spatial', phase: 'verifying' }),
      }),
    ]));
    const planning = runtime.getProgress(start.runId)?.events().find((event) => (
      event.type === 'tool_started' && event.overlay?.kind === 'spatial'
    ));
    const observationMarker = planning?.overlay?.kind === 'spatial'
      ? planning.overlay.markers.find((marker) => marker.id === 'spatial-program:0:target')
      : undefined;
    expect(observationMarker?.point[0]).toBeCloseTo(5);
    expect(observationMarker?.point[1]).toBeCloseTo(5);
  });

  it('binds the canonical base revision in runtime instead of spending a repair turn on model copying', async () => {
    const auditStore = new MemoryAuditStore();
    const { application, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'spatial_program_runtime_base',
        tool: 'preview_spatial_program',
        input: {
          baseRevision: 'revision_typo_from_model',
          summary: 'update one explicit interface',
          intent: 'move the selected endpoint to an exact world point',
          targets: [{ id: 'path', description: 'selected path', nodeRefs: ['line_a'] }],
          operations: [{
            kind: 'set_endpoint', nodeId: 'line_a', endpoint: 'end',
            point: { kind: 'world', frameId: 'document', point: [15, 10] },
          }],
          preserveNodeRefs: [], postconditions: [], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit runtime-bound edit base',
      }),
    ], { auditStore });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, protocolCorrectionCount: 0,
    });
    expect(model.contexts).toHaveLength(2);
    expect((await application.open(start.drawingId)).document.geometry[0]).toMatchObject({
      id: 'line_a', end: [15, 10],
    });
    expect((await auditStore.readRun()).events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'state',
        payload: {
          event: 'RUNTIME_EDIT_BASE_BOUND',
          suppliedBaseRevision: 'revision_typo_from_model',
          boundBaseRevision: start.baseRevision,
        },
      }),
    ]));
  });

  it('stops a rejected visual repair loop after a small explicit candidate budget', async () => {
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => ({
        satisfied: false,
        reason: 'candidate still does not satisfy the visual objective',
        defects: [{
          code: 'VISUAL_GOAL_NOT_MET', message: 'candidate needs another design', nodeIds: ['line_a'],
        }],
      })),
    };
    const candidate = (attempt: number) => (input: ModelLoopActionInput): DrawingAgentAction => ({
      type: 'tool', toolCallId: `candidate_${attempt}`, tool: 'preview_spatial_program',
      input: {
        baseRevision: input.revision,
        ...(input.currentPreview
          ? { replacesPreviewHandle: input.currentPreview.previewHandle }
          : {}),
        summary: `generic candidate ${attempt}`,
        intent: 'move one explicit endpoint toward the visual target',
        targets: [{ id: 'target', description: 'explicit path', nodeRefs: ['line_a'] }],
        operations: [{
          kind: 'set_endpoint', nodeId: 'line_a', endpoint: 'end',
          point: { kind: 'world', frameId: 'document', point: [10, attempt] },
        }],
        preserveNodeRefs: ['line_b'], postconditions: [], evidenceRefs: [],
      },
    });
    const { application, model, runtime, start } = await setup([
      candidate(1), candidate(2), candidate(3),
    ], {
      previewVerifier,
      limits: { maxCandidateAttempts: 3 },
    });

    const terminal = await runtime.start(start).completion;

    expect(terminal).toMatchObject({
      status: 'failed', commitCount: 0,
      error: expect.stringContaining('PREVIEW_REVIEW_ATTEMPTS_EXHAUSTED'),
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(3);
    expect(model.contexts).toHaveLength(3);
    expect(model.contexts.map((context) => context.candidateBudget)).toEqual([
      undefined,
      { attempt: 1, max: 3 },
      { attempt: 2, max: 3 },
    ]);
    expect((await application.readCurrent(start.drawingId)).document.geometry[0])
      .toMatchObject({ id: 'line_a', end: [10, 0] });
    expect(runtime.getProgress(start.runId)?.events()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'revising', candidateAttempt: 3, maxCandidateAttempts: 3,
      }),
      expect.objectContaining({
        type: 'failed', detail: expect.stringContaining('PREVIEW_REVIEW_ATTEMPTS_EXHAUSTED'),
      }),
    ]));
  });

  it('repairs compact primitive parameter updates before previewing', async () => {
    const { application, gateway, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_compact_parameters', tool: 'preview_transaction',
        input: {
          summary: 'move the line through compact primitive parameters',
          commands: [{
            type: 'geometry.update', id: 'line_a', changes: { parameters: [1, 2, 11, 12] },
          }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!, summary: 'commit compact update',
      }),
      { type: 'finish', summary: 'compact update committed' },
    ]);
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start(start).completion;

    expect(terminal.status).toBe('completed');
    expect(invoke.mock.calls[0]?.[0]).toMatchObject({
      tool: 'preview_transaction',
      input: {
        commands: [{
          type: 'geometry.update', id: 'line_a', changes: { start: [1, 2], end: [11, 12] },
        }],
      },
    });
    expect((await application.open(start.drawingId)).document.geometry[0]).toMatchObject({
      start: [1, 2], end: [11, 12],
    });
  });

  it('repairs compact primitive parameters after resolving model node aliases', async () => {
    const { application, gateway, runtime, start } = await setup([
      (input) => {
        const alias = input.nodeAliases?.line_a;
        expect(alias).toMatch(/^g\d+$/);
        return {
          type: 'tool', toolCallId: 'preview_alias_parameters', tool: 'preview_transaction',
          input: {
            summary: 'move the aliased line through compact primitive parameters',
            commands: [{
              type: 'geometry.update', id: alias!, changes: { parameters: [2, 3, 12, 13] },
            }],
            preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!, summary: 'commit aliased update',
      }),
    ]);
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start(start).completion;

    expect(terminal.status).toBe('completed');
    expect(invoke.mock.calls[0]?.[0]).toMatchObject({
      tool: 'preview_transaction',
      input: {
        commands: [{
          type: 'geometry.update', id: 'line_a', changes: { start: [2, 3], end: [12, 13] },
        }],
      },
    });
    expect((await application.open(start.drawingId)).document.geometry[0]).toMatchObject({
      start: [2, 3], end: [12, 13],
    });
    expect((await application.open(start.drawingId)).document.geometry[0]).not.toHaveProperty('parameters');
  });

  it('streams and commits a connected transform selected by alias while code computes its ports', async () => {
    const { application, gateway, runtime, start } = await setup([
      (input) => {
        expect(input.spatialContext?.connectedCarrierFacts).toEqual(expect.arrayContaining([
          expect.objectContaining({
            carrierNodeRef: input.nodeAliases?.circle_a,
            carrierType: 'circle', contactedOpenConnectorCount: 1,
            preferredTool: 'preview_connected_transform',
          }),
        ]));
        return {
          type: 'tool', toolCallId: 'preview_connected', tool: 'preview_connected_transform',
          input: {
            summary: 'move the closed carrier with its contacted boundary',
            carrierNodeId: input.nodeAliases?.circle_a,
            targetCenter: [5, 45],
            evidenceRefs: [],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'connected transform committed',
      }),
    ]);
    const current = await application.readCurrent(start.drawingId);
    await application.execute({
      drawingId: start.drawingId,
      transaction: {
        id: 'seed_runtime_carrier', baseRevision: current.revision,
        actor: { type: 'user', id: 'fixture' },
        commands: [{
          type: 'geometry.create', value: {
            id: 'circle_a' as GeometryId, type: 'circle', center: [0, 30], radius: 10,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        }, {
          type: 'geometry.update', id: 'line_a' as GeometryId,
          changes: { start: [0, 20], end: [20, 20] },
        }],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    start.baseRevision = await application.currentRevision(start.drawingId);
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 2,
    });
    expect(invoke.mock.calls[0]?.[0]).toMatchObject({
      tool: 'preview_connected_transform',
      input: { carrierNodeId: 'circle_a' },
    });
    expect((await application.readCurrent(start.drawingId)).document.geometry)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'circle_a', center: [5, 45] }),
        expect.objectContaining({
          id: 'line_a', start: [10.144957554, 36.425070743], end: [20, 20],
        }),
      ]));
    expect(runtime.getProgress(start.runId)?.events()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool_started',
        overlay: expect.objectContaining({
          kind: 'spatial', phase: 'planning',
          markers: [expect.objectContaining({ role: 'target', point: [5, 45] })],
          vectors: [expect.objectContaining({ role: 'motion', to: [5, 45] })],
        }),
      }),
      expect.objectContaining({
        type: 'previewing', perceptionDelta: expect.objectContaining({ action: 'preview' }),
      }),
    ]));
  });

  it('passes structural risk facts to the independent reviewer without clearing the Preview', async () => {
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async (input) => {
        expect(input.deterministicDiagnostics).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'CONNECTED_INTERFACE_AREA_COLLAPSED',
            facts: expect.objectContaining({ areaRetentionRatio: expect.any(Number) }),
          }),
          expect.objectContaining({ code: 'CONNECTED_INTERFACE_EXCESSIVE_STRETCH' }),
        ]));
        return { satisfied: true, reason: 'candidate satisfies the instruction', defects: [] };
      }),
    };
    const { application, gateway, model, runtime, start } = await setup([
      (input) => ({
        type: 'tool', toolCallId: 'preview_risky_connected', tool: 'preview_connected_transform',
        input: {
          summary: 'first high-deformation candidate',
          carrierNodeId: input.nodeAliases?.circle_risk,
          targetCenter: [80, 280], rotationDegrees: 90, evidenceRefs: [],
        },
      }),
      (input) => {
        expect(input.currentPreviewHandle).toMatch(/^preview_/);
        expect(input.currentPreviewReview).toMatchObject({
          status: 'satisfied', reason: 'candidate satisfies the instruction',
        });
        expect(input.observations).toEqual(expect.arrayContaining([
          expect.objectContaining({ purpose: 'preview' }),
        ]));
        expect(input.recentDiagnostics).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'CONNECTED_INTERFACE_AREA_COLLAPSED',
            facts: expect.objectContaining({
              areaRetentionRatio: expect.any(Number),
              minimumDeformationRotationDegrees: expect.any(Number),
            }),
          }),
          expect.objectContaining({ code: 'CONNECTED_INTERFACE_EXCESSIVE_STRETCH' }),
        ]));
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit main-model-approved connected candidate',
        };
      },
    ], { previewVerifier });
    const current = await application.readCurrent(start.drawingId);
    start.baseRevision = await seedRiskyConnectedFixture(
      application,
      start.drawingId,
      current.revision,
    );

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 2,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(1);
    expect(gateway.registry.snapshot().consumedToolCallCount).toBe(2);
    expect(model.contexts).toHaveLength(2);
    expect((await application.readCurrent(start.drawingId)).document.geometry)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'circle_risk', center: [80, 280] }),
        expect.objectContaining({
          id: 'boundary_lower_risk',
          start: expect.any(Array),
        }),
      ]));
  });

  it('lets the main model explicitly keep a risky candidate from advisory facts', async () => {
    const diagnosticCodes = [
      'CONNECTED_INTERFACE_AREA_COLLAPSED',
      'CONNECTED_INTERFACE_EXCESSIVE_STRETCH',
      'CONNECTED_TRANSFORM_NON_MINIMUM_ORIENTATION',
      'GEOMETRY_LENGTH_DISTORTION',
    ];
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async (input) => {
        expect(input.modelName).toBe('independent-reviewer');
        expect(input.deterministicDiagnostics?.map((item) => item.code).sort())
          .toEqual([...diagnosticCodes].sort());
        return { satisfied: true, reason: 'model-intended candidate is visually coherent', defects: [] };
      }),
    };
    const riskyPreview = (
      input: ModelLoopActionInput,
      callId: string,
    ): DrawingAgentAction => ({
      type: 'tool', toolCallId: callId, tool: 'preview_connected_transform', input: {
        summary: 'model-intended high-deformation candidate',
        carrierNodeId: input.nodeAliases?.circle_risk,
        targetCenter: [80, 280], rotationDegrees: 90, evidenceRefs: [],
      },
    });
    const { application, gateway, runtime, start } = await setup([
      (input) => riskyPreview(input, 'preview_risk_candidate'),
      (input) => {
        expect(input.recentDiagnostics.map((item) => item.code).sort())
          .toEqual([...diagnosticCodes].sort());
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'main model deliberately accepts measured structural risk',
        };
      },
    ], { previewVerifier });
    const current = await application.readCurrent(start.drawingId);
    start.baseRevision = await seedRiskyConnectedFixture(
      application,
      start.drawingId,
      current.revision,
    );

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 2,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(1);
    expect(gateway.registry.snapshot().consumedToolCallCount).toBe(2);
  });

  it('rejects a replaced Preview handle and keeps the latest candidate current', async () => {
    let replacedHandle = '';
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => ({ satisfied: true, reason: 'candidate reviewed', defects: [] })),
    };
    const riskyPreview = (
      input: ModelLoopActionInput,
      callId: string,
    ): DrawingAgentAction => ({
      type: 'tool', toolCallId: callId, tool: 'preview_connected_transform', input: {
        summary: 'high-deformation candidate',
        carrierNodeId: input.nodeAliases?.circle_risk,
        targetCenter: [80, 280], rotationDegrees: 90, evidenceRefs: [],
      },
    });
    const { application, runtime, start } = await setup([
      (input) => riskyPreview(input, 'preview_that_will_be_replaced'),
      (input) => {
        const previewResult = [...input.recentToolResults].reverse().find((result) => (
          typeof (result.output as { previewHandle?: unknown } | undefined)?.previewHandle === 'string'
        ));
        const output = previewResult?.output as { previewHandle?: string };
        replacedHandle = output.previewHandle ?? '';
        expect(replacedHandle).not.toBe('');
        return riskyPreview(input, 'replacement_preview');
      },
      () => ({
        type: 'commit', previewHandle: replacedHandle,
        summary: 'attempt commit of replaced candidate',
      }),
      (input) => {
        expect(input.protocolFeedback).toContain('PREVIEW_NOT_CURRENT');
        expect(input.recentToolResults.at(-1)?.receipt.error).toMatchObject({
          code: 'PREVIEW_NOT_CURRENT', suggestedAction: 'replan',
        });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit current replacement candidate',
        };
      },
    ], { previewVerifier });
    const current = await application.readCurrent(start.drawingId);
    start.baseRevision = await seedRiskyConnectedFixture(
      application,
      start.drawingId,
      current.revision,
    );

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 4,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(2);
  });

  it('repairs a free-form preview with interface diagnostics through the connected transform tool', async () => {
    const { application, gateway, runtime, start } = await setup([
      (input) => ({
        type: 'tool', toolCallId: 'preview_free_break', tool: 'preview_transaction',
        input: {
          summary: 'first free-form attempt',
          commands: [{
            type: 'geometry.update', id: input.nodeAliases?.circle_a,
            changes: { center: [5, 45] },
          }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      }),
      (input) => {
        expect(input.recentDiagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
          'NEW_DANGLING_ENDPOINT', 'BROKEN_EXISTING_CONNECTION',
        ]));
        return {
          type: 'tool', toolCallId: 'preview_connected_repair',
          tool: 'preview_connected_transform',
          input: {
            summary: 'repair with preserved interface ports',
            carrierNodeId: input.nodeAliases?.circle_a,
            targetCenter: [5, 45],
            evidenceRefs: [],
          },
        };
      },
      (input) => {
        expect(input.recentDiagnostics).toEqual([]);
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'repaired connected preview committed',
        };
      },
    ]);
    const current = await application.readCurrent(start.drawingId);
    await application.execute({
      drawingId: start.drawingId,
      transaction: {
        id: 'seed_repair_carrier', baseRevision: current.revision,
        actor: { type: 'user', id: 'fixture' },
        commands: [{
          type: 'geometry.create', value: {
            id: 'circle_a' as GeometryId, type: 'circle', center: [0, 30], radius: 10,
            visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
          },
        }, {
          type: 'geometry.update', id: 'line_a' as GeometryId,
          changes: { start: [0, 20], end: [20, 20] },
        }],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    start.baseRevision = await application.currentRevision(start.drawingId);
    const invoke = vi.spyOn(gateway.registry, 'invoke');

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 3,
    });
    expect(invoke.mock.calls.map((call) => call[0].tool)).toEqual([
      'preview_transaction', 'preview_connected_transform', 'commit_preview',
    ]);
    expect((await application.readCurrent(start.drawingId)).document.geometry)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'circle_a', center: [5, 45] }),
        expect.objectContaining({
          id: 'line_a', start: [10.144957554, 36.425070743], end: [20, 20],
        }),
      ]));
  });

  it('reuses the revision world projection after a read-only evidence turn', async () => {
    const { model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'measure_once', tool: 'measure_geometry', input: {
          measurements: [{ id: 'bounds_once', kind: 'bounds', nodeIds: ['line_a'] }],
        },
      },
      { type: 'finish', summary: 'read evidence completed' },
    ]);

    const terminal = await runtime.start({ ...start, selectedIds: ['line_a'] }).completion;

    expect(terminal.status).toBe('completed');
    expect(model.contexts).toHaveLength(2);
    expect(model.contexts[0].spatialContext?.worldModelSlice).toBeDefined();
    expect(model.contexts[1].spatialContext?.worldModelSlice).toBeUndefined();
    expect(model.contexts[1].spatialContext?.evidenceLedger.receipts.at(-1)).toMatchObject({
      tool: 'measure_geometry', status: 'succeeded',
    });
    expect(model.contexts[1].decisionContext).toMatchObject({
      sequence: 2, phase: 'tool-evidence',
      evidenceDelta: { evidenceRefs: [expect.stringMatching(/^tool:measure_once:/)] },
    });
  });

  it('automatically verifies every semantic Preview and repairs rejected directions', async () => {
    const verificationCalls: Array<{ modelName: string; endY: number }> = [];
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async (input) => {
        expect(input.beforeObservation?.vectorDigest.counts.annotation).toBe(0);
        expect(input.previewObservation?.vectorDigest.counts.annotation).toBe(0);
        const beforeView = input.beforeObservation?.views.find((view) => view.purpose === 'overview');
        const previewView = input.previewObservation?.views.find((view) => (
          view.purpose === 'user-viewport'
        ));
        expect(previewView?.worldToImage).toEqual(beforeView?.worldToImage);
        expect(previewView?.worldBounds).toEqual(beforeView?.worldBounds);
        const line = input.previewDocument.geometry.find((node) => node.id === 'line_a');
        expect(line?.type).toBe('line');
        const endY = line?.type === 'line' ? line.end[1] : -1;
        verificationCalls.push({ modelName: input.modelName, endY });
        expect(input.deterministicDiagnostics).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: 'NEW_DANGLING_ENDPOINT' }),
        ]));
        return endY < 7
          ? {
              satisfied: false,
              reason: `candidate ${endY} moves in the wrong visual direction`,
              defects: [{
                code: 'objective-direction-mismatch',
                message: '候选的视觉方向与用户目标相反',
                nodeIds: ['line_a'],
                repairHint: '依据 before/preview/diff 重新规划世界坐标',
              }],
            }
          : { satisfied: true, reason: 'candidate matches the visual objective', defects: [] };
      }),
    };
    const previewAt = (height: number, callId: string): DrawingAgentAction => ({
      type: 'tool', toolCallId: callId, tool: 'preview_transaction', input: {
        summary: `candidate ${height}`,
        commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, height] } }],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    const { model, runtime, start } = await setup([
      previewAt(5, 'preview_visual_1'),
      (input) => {
        expect(input).toMatchObject({ attempt: 1, modelName: 'high' });
        expect(input.currentPreviewHandle).toMatch(/^preview_/);
        expect(input.currentPreviewReview).toMatchObject({
          previewHandle: input.currentPreviewHandle,
          status: 'needs_revision',
          reason: 'candidate 5 moves in the wrong visual direction',
          defects: [expect.objectContaining({ code: 'objective-direction-mismatch' })],
        });
        expect(input.recentToolResults.at(-1)?.receipt).toMatchObject({
          tool: 'preview_transaction', status: 'succeeded',
        });
        expect(input.recentDiagnostics.at(-1)).toMatchObject({
          code: 'objective-direction-mismatch', nodeIds: ['line_a'],
        });
        return previewAt(6, 'preview_visual_2');
      },
      (input) => {
        expect(input).toMatchObject({ attempt: 1, modelName: 'high' });
        return previewAt(7, 'preview_visual_3');
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!, summary: 'verified candidate',
      }),
    ], { previewVerifier });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect(verificationCalls).toEqual([
      { modelName: 'independent-reviewer', endY: 5 },
      { modelName: 'independent-reviewer', endY: 6 },
      { modelName: 'independent-reviewer', endY: 7 },
    ]);
    const progressEvents = runtime.getProgress(start.runId)!.events();
    const rejectedEvents = progressEvents.filter((event) => (
      event.type === 'revising' && event.title === '独立复核发现偏差，已返回主模型判断'
    ));
    expect(rejectedEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        overlay: expect.objectContaining({ kind: 'diagnostics' }),
      }),
    ]));
    expect(rejectedEvents.every((event) => event.perceptionDelta === undefined)).toBe(true);
    const firstPreviewIndex = progressEvents.findIndex((event) => (
      event.type === 'previewing'
      && event.perceptionDelta?.upserts.some((node) => (
        node.id === 'line_a' && node.type === 'line' && node.end[1] === 5
      ))
    ));
    const firstRejectionIndex = progressEvents.findIndex((event) => (
      event.type === 'revising' && event.title === '独立复核发现偏差，已返回主模型判断'
    ));
    expect(firstPreviewIndex).toBeGreaterThanOrEqual(0);
    expect(firstRejectionIndex).toBeGreaterThan(firstPreviewIndex);
    expect(model.contexts.map(({ attempt, modelName }) => ({ attempt, modelName }))).toEqual([
      { attempt: 1, modelName: 'high' },
      { attempt: 1, modelName: 'high' },
      { attempt: 1, modelName: 'high' },
      { attempt: 1, modelName: 'high' },
    ]);
  });

  it('preserves the parent candidate when the model chooses a relative Preview revision', async () => {
    let reviewCount = 0;
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => {
        reviewCount += 1;
        return reviewCount === 1
          ? {
              satisfied: false,
              reason: 'the second segment still needs correction',
              defects: [{
                code: 'second-segment-mismatch', message: '第二条线仍需修正',
                nodeIds: ['line_b'],
              }],
            }
          : { satisfied: true, reason: 'the revised candidate is accepted', defects: [] };
      }),
    };
    const auditStore = new MemoryAuditStore();
    const { application, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'parent_preview', tool: 'preview_transaction', input: {
          summary: 'change both connected segments',
          commands: [
            { type: 'geometry.update', id: 'line_a', changes: { end: [10, 5] } },
            { type: 'geometry.update', id: 'line_b', changes: { start: [10, 5] } },
          ],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => {
        expect(input.currentPreview).toMatchObject({
          previewHandle: expect.stringMatching(/^preview_/),
          transactionDigest: expect.stringMatching(/^sha256:/),
        });
        expect(input.currentPreviewReview).toMatchObject({
          previewHandle: input.currentPreview!.previewHandle,
          transactionDigest: input.currentPreview!.transactionDigest,
          status: 'needs_revision',
        });
        return {
          type: 'tool', toolCallId: 'relative_revision', tool: 'revise_preview', input: {
            basePreviewHandle: input.currentPreview!.previewHandle,
            baseTransactionDigest: input.currentPreview!.transactionDigest,
            summary: 'correct only the second segment',
            corrections: [{
              type: 'geometry.update', id: 'line_b', changes: { end: [20, 8] },
            }],
            evidenceRefs: [],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreview!.previewHandle,
        summary: 'commit the relative revision',
      }),
    ], { previewVerifier, auditStore });

    const terminal = await runtime.start(start).completion;
    await runtime.flushAudit(start.runId);

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    const current = await application.readCurrent(start.drawingId);
    expect(current.document.geometry).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'line_a', end: [10, 5] }),
      expect.objectContaining({ id: 'line_b', start: [10, 5], end: [20, 8] }),
    ]));
    expect(runtime.getProgress(start.runId)?.events()).toContainEqual(expect.objectContaining({
      type: 'revising', title: '候选修订预览已生成',
    }));
    const selectedBases = auditStore.events
      .filter((event) => event.payload.event === 'PREVIEW_BASE_SELECTED')
      .map((event) => event.payload);
    expect(selectedBases).toHaveLength(2);
    expect(selectedBases[0]).toMatchObject({
      previewHandle: expect.stringMatching(/^preview_/),
      transactionDigest: expect.stringMatching(/^sha256:/),
      editBase: { kind: 'canonical', revision: start.baseRevision },
    });
    expect(selectedBases[1]).toMatchObject({
      previewHandle: expect.stringMatching(/^preview_/),
      transactionDigest: expect.stringMatching(/^sha256:/),
      editBase: {
        kind: 'preview',
        revision: start.baseRevision,
        previewHandle: selectedBases[0].previewHandle,
        transactionDigest: selectedBases[0].transactionDigest,
      },
    });
  });

  it('drops parent changes only when the model explicitly restarts from canonical', async () => {
    let reviewCount = 0;
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => {
        reviewCount += 1;
        return reviewCount === 1
          ? {
              satisfied: false, reason: 'restart requested by the main model',
              defects: [{ code: 'replan', message: '需要重新设计', nodeIds: ['line_a'] }],
            }
          : { satisfied: true, reason: 'replacement accepted', defects: [] };
      }),
    };
    const { application, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'discarded_parent', tool: 'preview_transaction', input: {
          summary: 'parent changes the first segment',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 5] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'tool', toolCallId: 'canonical_restart', tool: 'preview_transaction', input: {
          baseRevision: input.revision,
          replacesPreviewHandle: input.currentPreview!.previewHandle,
          summary: 'discard parent and change only the second segment',
          commands: [{ type: 'geometry.update', id: 'line_b', changes: { end: [20, 9] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      }),
      (input) => ({
        type: 'commit', previewHandle: input.currentPreview!.previewHandle,
        summary: 'commit canonical restart',
      }),
    ], { previewVerifier });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    const current = await application.readCurrent(start.drawingId);
    expect(current.document.geometry).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'line_a', end: [10, 0] }),
      expect.objectContaining({ id: 'line_b', end: [20, 9] }),
    ]));
  });

  it('rejects an ambiguous canonical restart until the model names the replaced Preview', async () => {
    const { runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'current_candidate', tool: 'preview_transaction', input: {
          summary: 'create current candidate',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 4] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'tool', toolCallId: 'ambiguous_restart', tool: 'preview_transaction', input: {
          baseRevision: input.revision,
          replacesPreviewHandle: undefined,
          summary: 'ambiguous restart',
          commands: [{ type: 'geometry.update', id: 'line_b', changes: { end: [20, 4] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      }),
      (input) => {
        expect(input.protocolFeedback).toContain('PREVIEW_REPLACEMENT_MISMATCH');
        return {
          type: 'tool', toolCallId: 'explicit_restart', tool: 'preview_transaction', input: {
            baseRevision: input.revision,
            replacesPreviewHandle: input.currentPreview!.previewHandle,
            summary: 'explicit restart',
            commands: [{ type: 'geometry.update', id: 'line_b', changes: { end: [20, 4] } }],
            preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
          },
        };
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreview!.previewHandle,
        summary: 'commit explicit restart',
      }),
    ]);

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, protocolCorrectionCount: 1,
    });
  });

  it('repairs one contradictory visual-verifier response instead of failing the drawing loop', async () => {
    const protocolError = Object.assign(
      new Error('verification.defects: 通过的预览不能同时包含缺陷'),
      { path: 'verification.defects' },
    );
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async (input) => {
        if (!input.protocolFeedback) throw protocolError;
        expect(input.protocolFeedback).toContain('verification.defects');
        return { satisfied: true, reason: 'corrected verifier response', defects: [] };
      }),
    };
    const { runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_for_verifier_repair', tool: 'preview_transaction',
        input: {
          summary: 'candidate requiring verifier protocol repair',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 7] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit after verifier protocol repair',
      }),
    ], { previewVerifier });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(2);
    expect(runtime.getProgress(start.runId)?.events()).toContainEqual(expect.objectContaining({
      type: 'verifying', title: '视觉复核响应不完整，正在纠错重试',
    }));
  });

  it('returns repeated verifier protocol failures to the drawing model instead of terminating', async () => {
    let verificationCall = 0;
    const protocolError = Object.assign(
      new Error('verification.defects: 通过的预览不能同时包含缺陷'),
      { path: 'verification.defects' },
    );
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => {
        verificationCall += 1;
        if (verificationCall <= 2) throw protocolError;
        return { satisfied: true, reason: 'next candidate verified', defects: [] };
      }),
    };
    const previewAt = (height: number, callId: string): DrawingAgentAction => ({
      type: 'tool', toolCallId: callId, tool: 'preview_transaction', input: {
        summary: `candidate ${height}`,
        commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, height] } }],
        preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });
    const { runtime, start } = await setup([
      previewAt(7, 'preview_with_invalid_verifier'),
      (input) => {
        expect(input.currentPreviewHandle).toMatch(/^preview_/);
        expect(input.currentPreviewReview).toMatchObject({
          status: 'unavailable', previewHandle: input.currentPreviewHandle,
        });
        expect(input.recentToolResults.at(-1)?.receipt).toMatchObject({
          tool: 'preview_transaction', status: 'succeeded',
        });
        expect(input.recentDiagnostics).toContainEqual(expect.objectContaining({
          code: 'PREVIEW_VERIFIER_PROTOCOL_INVALID',
        }));
        return previewAt(8, 'preview_after_invalid_verifier');
      },
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit candidate after verifier recovered',
      }),
    ], { previewVerifier });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1, actionCount: 3,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(3);
    expect(runtime.getProgress(start.runId)?.events()).toContainEqual(expect.objectContaining({
      type: 'revising', title: '独立复核暂时不可用，已返回主模型判断',
    }));
  });

  it('returns reviewer transport failure as unavailable while preserving the current Preview', async () => {
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => {
        throw new Error('review provider connection reset');
      }),
    };
    const { application, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_before_review_transport_failure',
        tool: 'preview_transaction', input: {
          summary: 'candidate survives unavailable reviewer',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 8] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => {
        expect(input.currentPreviewHandle).toMatch(/^preview_/);
        expect(input.currentPreviewReview).toMatchObject({
          previewHandle: input.currentPreviewHandle,
          status: 'unavailable',
          reason: 'review provider connection reset',
        });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'main model accepts candidate with unavailable third-party review',
        };
      },
    ], { previewVerifier });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect((await application.readCurrent(start.drawingId)).document.geometry[0]).toMatchObject({
      end: [10, 8],
    });
  });

  it('bounds an unresponsive independent reviewer and returns the intact Preview to the model', async () => {
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async (input) => new Promise<never>((_resolve, reject) => {
        input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
      })),
    };
    const { runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_before_review_timeout',
        tool: 'preview_transaction', input: {
          summary: 'candidate survives reviewer timeout',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 9] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => {
        expect(input.currentPreviewReview).toMatchObject({
          previewHandle: input.currentPreviewHandle,
          status: 'unavailable',
          reason: expect.stringContaining('MODEL_CALL_TIMEOUT'),
        });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'main model accepts candidate after bounded reviewer timeout',
        };
      },
    ], { previewVerifier, limits: { previewVerificationMs: 10 } });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect(previewVerifier.verify).toHaveBeenCalledTimes(1);
    expect(runtime.getProgress(start.runId)?.events()).toContainEqual(expect.objectContaining({
      type: 'revising', title: '独立复核暂时不可用，已返回主模型判断',
    }));
  });

  it('lets the main model commit the current Preview after considering a negative review', async () => {
    const previewVerifier: DrawingPreviewVerificationModelAdapter = {
      verify: vi.fn(async () => ({
        satisfied: false,
        reason: 'the reviewer sees a possible mismatch',
        defects: [{
          code: 'possible-mismatch',
          message: '候选可能未完全满足指令',
          nodeIds: ['line_a'],
        }],
      })),
    };
    const { application, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_advisory_review', tool: 'preview_transaction', input: {
          summary: 'candidate kept for main-model judgment',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 8] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      (input) => {
        expect(input.currentPreviewReview).toMatchObject({
          status: 'needs_revision',
          reason: 'the reviewer sees a possible mismatch',
        });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'main model confirms current candidate after review',
        };
      },
    ], { previewVerifier });

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect((await application.readCurrent(start.drawingId)).document.geometry[0]).toMatchObject({
      end: [10, 8],
    });
  });

  it('rejects a non-current Preview handle even when its transaction is otherwise valid', async () => {
    let unverifiedHandle = '';
    const { application, gateway, model, runtime, start } = await setup([
      {
        type: 'tool', toolCallId: 'preview_verified', tool: 'preview_transaction', input: {
          summary: 'verified candidate',
          commands: [{ type: 'geometry.update', id: 'line_a', changes: { end: [10, 8] } }],
          preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
        },
      },
      () => ({
        type: 'commit', previewHandle: unverifiedHandle,
        summary: 'attempt to swap in an unverified transaction',
      }),
      (input) => {
        expect(input.protocolFeedback).toContain('PREVIEW_NOT_CURRENT');
        expect(input.recentToolResults.at(-1)?.receipt.error).toMatchObject({
          code: 'PREVIEW_NOT_CURRENT',
        });
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit the current transaction',
        };
      },
    ]);
    const unverified = await gateway.drawingTools.previewCandidate({
      runId: start.runId,
      episodeId: `episode_${start.runId}`,
      drawingId: start.drawingId,
      revision: start.baseRevision,
      summary: 'unverified replacement',
      commands: [{ type: 'geometry.update', id: 'line_a' as GeometryId, changes: { end: [10, -50] } }],
    });
    expect(unverified.status).toBe('ready');
    if (unverified.status !== 'ready') throw new Error('test candidate was not created');
    unverifiedHandle = unverified.previewHandle;

    const terminal = await runtime.start(start).completion;

    expect(terminal, terminal.error ?? 'runtime failed').toMatchObject({
      status: 'completed', commitCount: 1,
    });
    expect(model.contexts).toHaveLength(3);
    expect((await application.readCurrent(start.drawingId)).document.geometry[0]).toMatchObject({
      end: [10, 8],
    });
  });

  it('pauses an in-flight model call and resumes the same episode from a fresh turn', async () => {
    const blocking = new BlockingActionModel();
    const prepared = await setup([]);
    const runtime = new ModelLedDrawingAgentRuntime({
      application: prepared.application,
      registry: prepared.gateway.registry,
      drawingTools: prepared.gateway.drawingTools,
      model: blocking,
      interactions: prepared.interactions,
    });
    const handle = runtime.start(prepared.start);
    await waitFor(() => blocking.calls === 1);

    const paused = runtime.pause(prepared.start.runId);
    expect(paused.status).toBe('paused');
    await waitFor(() => blocking.aborted === 1);

    runtime.resume(prepared.start.runId);
    await waitFor(() => blocking.calls === 2);
    expect(runtime.getState(prepared.start.runId)?.status).toBe('running');

    runtime.stop(prepared.start.runId);
    await expect(handle.completion).resolves.toMatchObject({ status: 'stopped' });
  });

  it('aborts an in-flight write tool and never records its late result after stop', async () => {
    const prepared = await setup([]);
    let started = false;
    let aborted = false;
    const registry = new ModelDrawingToolRegistry({
      getCurrentRevision: (drawingId) => prepared.application.currentRevision(drawingId),
      tools: [{
      name: 'blocking_write', version: '1.0.0', access: 'write', timeoutMs: 5_000,
      parseInput: () => ({}),
      execute: async ({ signal }) => {
        started = true;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(signal.reason);
          }, { once: true });
        });
      },
      }],
    });
    const model = new SingleToolActionModel({
      type: 'tool', toolCallId: 'blocking_write_1', tool: 'blocking_write', input: {},
    } as unknown as Extract<DrawingAgentAction, { type: 'tool' }>);
    const runtime = new ModelLedDrawingAgentRuntime({
      application: prepared.application,
      registry,
      drawingTools: prepared.gateway.drawingTools,
      model,
      interactions: prepared.interactions,
    });
    const handle = runtime.start(prepared.start);
    await waitFor(() => started);

    runtime.stop(prepared.start.runId);
    await expect(handle.completion).resolves.toMatchObject({ status: 'stopped' });
    await waitFor(() => aborted);

    expect(runtime.getState(prepared.start.runId)?.recentToolResults).toHaveLength(0);
    expect(runtime.getProgress(prepared.start.runId)?.events().at(-1)).toMatchObject({
      type: 'stopped', title: '任务已停止',
    });
  });

  it('lets the model inspect topology, revise a four-plane Preview, stream both previews, and commit atomically', async () => {
    const commands1 = fourPlaneCommands(8);
    const commands2 = fourPlaneCommands(12);
    const { application, gateway, model, runtime, start } = await setup([
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
    ]);
    const invoke = vi.spyOn(gateway.registry, 'invoke');
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
      expect.objectContaining({
        type: 'tool_started', title: '正在生成增量预览',
        overlay: expect.objectContaining({ kind: 'spatial', phase: 'planning' }),
      }),
      expect.objectContaining({
        type: 'previewing',
        overlay: expect.objectContaining({ kind: 'spatial', phase: 'previewing' }),
      }),
      expect.objectContaining({
        type: 'verifying',
        overlay: expect.objectContaining({ kind: 'spatial', phase: 'verifying' }),
      }),
      expect.objectContaining({ type: 'committed' }),
    ]));
    const planningFrameIndex = events.findIndex((event) => (
      event.type === 'tool_started'
      && event.overlay?.kind === 'spatial'
      && event.overlay.phase === 'planning'
    ));
    const previewFrameIndex = events.findIndex((event) => (
      event.type === 'previewing'
      && event.overlay?.kind === 'spatial'
      && event.overlay.phase === 'previewing'
    ));
    expect(planningFrameIndex).toBeGreaterThanOrEqual(0);
    expect(previewFrameIndex).toBeGreaterThan(planningFrameIndex);
    expect(model.contexts[3].recentDiagnostics).toEqual(expect.any(Array));
    expect(model.contexts[4].observations.filter((view) => view.purpose === 'preview')).toHaveLength(1);
    expect(model.contexts[5].observations.filter((view) => view.purpose === 'preview')).toHaveLength(1);
    expect(model.contexts[5].observations.find((view) => view.purpose === 'preview')?.id)
      .not.toBe(model.contexts[4].observations.find((view) => view.purpose === 'preview')?.id);
    expect(model.contexts[6].observations.filter((view) => view.purpose === 'preview')).toHaveLength(1);
    expect(model.contexts[6].observations.find((view) => view.purpose === 'preview')?.id)
      .not.toBe(model.contexts[4].observations.find((view) => view.purpose === 'preview')?.id);
    expect(invoke).toHaveBeenCalledTimes(7);
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
        type: 'tool', toolCallId: 'evaluate_constraint', tool: 'evaluate_preview', input: {
          previewHandle: input.currentPreviewHandle, includeRender: true,
          selectedIds: ['line_a'],
        },
      }),
      (input) => ({
        type: 'commit', previewHandle: input.currentPreviewHandle!,
        summary: 'commit authorized candidate',
      }),
      (input) => {
        expect(input.decisions).toHaveLength(1);
        expect(input.decisions[0].grants[0]).toMatchObject({ effect: 'allow', scope: 'candidate' });
        expect(input.appendedInstructions).toContain('只对当前候选生效');
        return {
          type: 'commit', previewHandle: input.currentPreviewHandle!,
          summary: 'commit authorized candidate',
        };
      },
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
    expect(model.contexts.at(-1)?.appendedInstructions).toContain('只对当前候选生效');
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
        type: 'tool', toolCallId: 'evaluate_forbidden', tool: 'evaluate_preview', input: {
          previewHandle: input.currentPreviewHandle, includeRender: true,
        },
      }),
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
        type: 'tool', toolCallId: 'evaluate_replacement', tool: 'evaluate_preview', input: {
          previewHandle: input.currentPreviewHandle, includeRender: true,
          selectedIds: ['line_a', 'line_b'],
        },
      }),
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
        type: 'tool', toolCallId: 'evaluate_stale', tool: 'evaluate_preview', input: {
          previewHandle: input.currentPreviewHandle, includeRender: true,
        },
      }),
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
