import { createHash, randomUUID } from 'node:crypto';

import {
  DrawingAgentProtocolError,
  type DrawingAgentCanvasOverlay,
  type DrawingAgentAction,
  type DrawingAgentSpatialMarker,
  type HumanDecisionDraft,
  type HumanDecisionRequest,
  type HumanDecisionResponse,
  type PermissionGrant,
  type PerceptionPreviewDelta,
} from '../../../src/contracts/drawing-agent.js';
import type {
  DrawingCommand,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import { buildPartitionedAnnotationSteps } from '../drawing-annotation/partition-steps.js';
import type { AutomaticAnnotationStep } from '../drawing-annotation/build-steps.js';
import {
  PARTITION_SEMANTIC_TYPE,
  partitionToFeature,
  readDrawingPartitions,
  type DrawingPartition,
} from '../../../src/contracts/drawing-partition.js';
import { DrawingPartitionService } from '../drawing-partition/partitioner.js';
import type { DrawingPartitionModelAdapter } from '../drawing-partition/partition-model.js';
import { projectDocumentIntentFrame } from '../drawing-interaction/projector.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';
import type { CvSourceImage } from '../drawing-cv/types.js';
import type { DrawingModelTools } from '../drawing-tools/drawing-tools.js';
import type { DrawingGenerationTools } from '../drawing-tools/generation-tools.js';
import type { ModelDrawingToolRegistry } from '../drawing-tools/registry.js';
import type { ModelToolResult } from '../drawing-tools/types.js';
import { DrawingSpatialContextIndex } from '../drawing-spatial/context-index.js';
import type { WorldModelKnowledgeStateKind } from '../drawing-world-model/types.js';
import { findConnectedCarrierCandidates } from '../drawing-spatial-actions/connected-transform.js';
import {
  resolveSpatialPoint,
  type SpatialPointRef,
} from '../drawing-spatial-program/index.js';
import { digestDrawingTransaction, HumanInteractionPolicy } from '../human-interaction/policy.js';
import type {
  HumanInteractionProtection,
  HumanInteractionStore,
} from '../human-interaction/types.js';
import type { DrawingAgentAuditStore } from './audit-types.js';
import type {
  DrawingAgentActionModel,
  ModelLoopObservation,
} from './model-loop-adapter.js';
import { RunProgressChannel } from './progress.js';
import { selectVisualWorkingSet } from './visual-working-set.js';
import { pendingSourceCropHandle } from './visual-working-set.js';
import { RevisionContextLedger } from './context-ledger.js';
import {
  createModelDecisionContext,
  type ModelDecisionContext,
  type ModelDecisionPhase,
} from './model-decision-context.js';
import { buildModelWorldContext } from './world-model-context.js';
import { selectModelToolCatalog } from './tool-catalog-policy.js';
import {
  checkModelLedDrawingAgentBudget,
  createModelLedDrawingAgentState,
  reduceModelLedDrawingAgentState,
  type ModelLedDrawingAgentEvent,
  type ModelLedDrawingAgentLimits,
  type ModelLedDrawingAgentState,
} from './state.js';
import { interpretDrawingInput } from './input-interpreter.js';
import type {
  DrawingPreviewVerificationModelAdapter,
  PreviewReviewEvidence,
  StartDrawingAgentRunInput,
} from './types.js';

interface ModelLedRuntimeLimits extends Omit<ModelLedDrawingAgentLimits, 'deadlineAt'> {
  wallClockMs: number;
  spatialModelCallMs: number;
  partitionModelCallMs: number;
  previewVerificationMs: number;
  maxCandidateAttempts: number;
}

export interface ModelLedDrawingAgentRuntimeOptions {
  application: DrawingApplication;
  registry: ModelDrawingToolRegistry;
  drawingTools: DrawingModelTools;
  generationTools?: Pick<DrawingGenerationTools, 'advanceVectorizationBatch'>;
  runResources?: { discardRun(runId: string): unknown };
  model: DrawingAgentActionModel;
  previewVerifier?: DrawingPreviewVerificationModelAdapter;
  /** 分区模型适配器：支撑「补充信息 -> AI 分区 -> 预览编辑 -> 自动标注」工作流 */
  partitionModel?: DrawingPartitionModelAdapter;
  interactions: HumanInteractionStore;
  interactionPolicy?: HumanInteractionPolicy;
  protections?: (document: DrawingDocument) => HumanInteractionProtection[];
  auditStore?: DrawingAgentAuditStore;
  sourceImages?: { read(sourceId: string): Promise<CvSourceImage> };
  sourceCrops?: { read(mediaHandle: string): Promise<{
    mediaHandle: string;
    mimeType: string;
    bytes: Uint8Array;
    width: number;
    height: number;
  }> };
  limits?: Partial<ModelLedRuntimeLimits>;
  now?: () => number;
}

export interface ModelLedDrawingAgentRunHandle {
  runId: string;
  completion: Promise<ModelLedDrawingAgentState>;
}

interface RunRecord {
  state: ModelLedDrawingAgentState;
  input: StartDrawingAgentRunInput;
  progress: RunProgressChannel;
  completion: Promise<ModelLedDrawingAgentState>;
  resolveCompletion: (state: ModelLedDrawingAgentState) => void;
  resolved: boolean;
  driving: boolean;
  controller: AbortController | null;
  protocolFeedback?: string;
  visibleProtocolRepair?: { attempt: number; limit: number };
  modelRetryCount: number;
  toolProtocolFailureCount: number;
  previewSequence: number;
  auditSequence: number;
  auditQueue: Promise<void>;
  sourceImage?: Promise<NonNullable<import('./model-loop-adapter.js').ModelLoopActionInput['sourceImage']>>;
  initialObservation?: Promise<ModelLoopObservation[]>;
  sourceBootstrapDelivered: boolean;
  deliveredSourceCropHandles: Set<string>;
  contextLedger: RevisionContextLedger;
  decisionSequence: number;
  projectedWorldKey?: string;
  projectedWorldEvidenceRef?: string;
  projectedWorldKnowledgeState?: WorldModelKnowledgeStateKind;
  streamedPreviewHandles: Set<string>;
  vectorizationBatchCount: number;
  committedVectorizationBatchCount: number;
  imageImportCandidateHandle?: string;
  imageImportCompleted: boolean;
  currentPreviewReview?: PreviewReviewEvidence;
  semanticCandidateAttempt: number;
}

const DEFAULT_LIMITS: ModelLedRuntimeLimits = {
  maxActions: 36,
  maxToolCalls: 28,
  maxConsecutiveReads: 12,
  maxCommits: 3,
  maxProtocolCorrections: 2,
  maxCandidateAttempts: 3,
  wallClockMs: 15 * 60_000,
  spatialModelCallMs: 2 * 60_000,
  partitionModelCallMs: 8 * 60_000,
  previewVerificationMs: 30_000,
};

class ModelCallTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`MODEL_CALL_TIMEOUT: 模型在 ${Math.ceil(timeoutMs / 1_000)} 秒内未返回`);
    this.name = 'ModelCallTimeoutError';
  }
}

const TERMINAL = new Set<ModelLedDrawingAgentState['status']>([
  'completed', 'failed', 'stopped',
]);

export class ModelLedDrawingAgentRuntime {
  readonly #application: DrawingApplication;
  readonly #registry: ModelDrawingToolRegistry;
  readonly #drawingTools: DrawingModelTools;
  readonly #generationTools?: Pick<DrawingGenerationTools, 'advanceVectorizationBatch'>;
  readonly #runResources?: { discardRun(runId: string): unknown };
  readonly #model: DrawingAgentActionModel;
  readonly #previewVerifier?: DrawingPreviewVerificationModelAdapter;
  readonly #partitionService?: DrawingPartitionService;
  readonly #interactions: HumanInteractionStore;
  readonly #interactionPolicy: HumanInteractionPolicy;
  readonly #protections: (document: DrawingDocument) => HumanInteractionProtection[];
  readonly #auditStore?: DrawingAgentAuditStore;
  readonly #sourceImages?: { read(sourceId: string): Promise<CvSourceImage> };
  readonly #sourceCrops?: ModelLedDrawingAgentRuntimeOptions['sourceCrops'];
  readonly #limits: ModelLedRuntimeLimits;
  readonly #now: () => number;
  readonly #runs = new Map<string, RunRecord>();

  constructor(options: ModelLedDrawingAgentRuntimeOptions) {
    this.#application = options.application;
    this.#registry = options.registry;
    this.#drawingTools = options.drawingTools;
    this.#generationTools = options.generationTools;
    this.#runResources = options.runResources;
    this.#model = options.model;
    this.#previewVerifier = options.previewVerifier;
    this.#partitionService = options.partitionModel
      ? new DrawingPartitionService({ model: options.partitionModel })
      : undefined;
    this.#interactions = options.interactions;
    this.#interactionPolicy = options.interactionPolicy ?? new HumanInteractionPolicy();
    this.#protections = options.protections ?? (() => []);
    this.#auditStore = options.auditStore;
    this.#sourceImages = options.sourceImages;
    this.#sourceCrops = options.sourceCrops;
    this.#limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.#now = options.now ?? Date.now;
  }

  start(input: StartDrawingAgentRunInput): ModelLedDrawingAgentRunHandle {
    if (this.#runs.has(input.runId)) throw new Error(`Agent run already exists: ${input.runId}`);
    const createdAt = this.#now();
    let resolveCompletion!: (state: ModelLedDrawingAgentState) => void;
    const completion = new Promise<ModelLedDrawingAgentState>((resolve) => {
      resolveCompletion = resolve;
    });
    const state = createModelLedDrawingAgentState({
      runId: input.runId,
      episodeId: `episode_${input.runId}`,
      drawingId: input.drawingId,
      revision: input.baseRevision,
      objective: input.goal,
      createdAt,
      limits: {
        maxActions: this.#limits.maxActions,
        maxToolCalls: this.#limits.maxToolCalls,
        maxConsecutiveReads: this.#limits.maxConsecutiveReads,
        maxCommits: this.#limits.maxCommits,
        maxProtocolCorrections: this.#limits.maxProtocolCorrections,
        deadlineAt: createdAt + this.#limits.wallClockMs,
      },
    });
    const record: RunRecord = {
      state,
      input: structuredClone(input),
      progress: new RunProgressChannel(input.runId, createdAt, 25_000, this.#now),
      completion,
      resolveCompletion,
      resolved: false,
      driving: false,
      controller: null,
      modelRetryCount: 0,
      toolProtocolFailureCount: 0,
      previewSequence: 0,
      auditSequence: 0,
      auditQueue: Promise.resolve(),
      sourceBootstrapDelivered: false,
      deliveredSourceCropHandles: new Set(),
      contextLedger: new RevisionContextLedger(state.revision),
      decisionSequence: 0,
      projectedWorldKey: undefined,
      projectedWorldEvidenceRef: undefined,
      projectedWorldKnowledgeState: undefined,
      streamedPreviewHandles: new Set(),
      vectorizationBatchCount: 0,
      committedVectorizationBatchCount: 0,
      imageImportCompleted: false,
      semanticCandidateAttempt: 0,
    };
    this.#runs.set(input.runId, record);
    this.#startAudit(record);
    this.#audit(record, 'state', { status: 'running', revision: state.revision });
    record.progress.publish('accepted', '任务已受理');
    void Promise.resolve().then(() => this.#drive(record));
    return { runId: input.runId, completion };
  }

  getState(runId: string): ModelLedDrawingAgentState | undefined {
    return this.#runs.get(runId)?.state;
  }

  getProgress(runId: string): RunProgressChannel | undefined {
    return this.#runs.get(runId)?.progress;
  }

  pause(runId: string): ModelLedDrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'PAUSE_REQUESTED' });
    record.controller?.abort(new Error('Agent run paused'));
    record.progress.publish('paused', '任务已暂停');
    return record.state;
  }

  resume(runId: string): ModelLedDrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'RESUME' });
    record.progress.publish('resumed', '任务已继续');
    if (record.state.status === 'running') void Promise.resolve().then(() => this.#drive(record));
    return record.state;
  }

  addInstruction(runId: string, instruction: string): ModelLedDrawingAgentState {
    const record = this.#require(runId);
    record.semanticCandidateAttempt = 0;
    this.#transition(record, { type: 'INSTRUCTION_ADDED', instruction });
    this.#audit(record, 'instruction', { instruction: instruction.trim() });
    record.progress.publish('revising', '已收到新的指令，将在下一步应用');
    return record.state;
  }

  stop(runId: string): ModelLedDrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'STOP_REQUESTED' });
    record.controller?.abort(new Error('Agent run stopped'));
    this.#finish(record, 'stopped', '任务已停止');
    return record.state;
  }

  async stopActiveRunsForDrawing(drawingId: string): Promise<string[]> {
    const active = [...this.#runs.values()].filter((record) => (
      record.state.drawingId === drawingId && !TERMINAL.has(record.state.status)
    ));
    for (const record of active) this.stop(record.state.runId);
    await Promise.all(active.map((record) => record.completion));
    return active.map((record) => record.state.runId);
  }

  async flushAudit(runId: string): Promise<void> {
    await this.#require(runId).auditQueue;
  }

  async respondToDecision(
    runId: string,
    response: HumanDecisionResponse,
  ): Promise<ModelLedDrawingAgentState> {
    const record = this.#require(runId);
    const request = record.state.pendingDecision;
    if (record.state.status !== 'waiting_for_user' || !request) {
      throw new Error('HUMAN_DECISION_NOT_PENDING');
    }
    if (response.requestId !== request.id) throw new Error('HUMAN_DECISION_REQUEST_MISMATCH');
    const currentRevision = await this.#application.currentRevision(record.state.drawingId);
    if (currentRevision !== request.revision) {
      throw new Error('HUMAN_DECISION_REVISION_EXPIRED');
    }
    if (request.previewHandle) {
      const currentCandidate = this.#drawingTools.readCandidate({
        runId: record.state.runId,
        episodeId: record.state.episodeId,
        drawingId: record.state.drawingId,
        revision: request.revision,
        previewHandle: request.previewHandle,
      });
      if (!currentCandidate
        || (request.transactionDigest
          && digestDrawingTransaction(currentCandidate.transaction) !== request.transactionDigest)) {
        throw new Error('HUMAN_DECISION_CANDIDATE_EXPIRED');
      }
    }
    const option = request.options.find((candidate) => candidate.id === response.selectedOptionId);
    if (!option) throw new Error('HUMAN_DECISION_OPTION_NOT_FOUND');
    const grants = decisionGrants(request, option.effect, () => `grant_${randomUUID()}`);
    await this.#interactions.resolveRequest(runId, response, grants);
    this.#transition(record, {
      type: 'HUMAN_DECISION_RESOLVED',
      requestId: request.id,
      grants,
      response,
    });
    if (response.additionalInstruction) {
      this.#transition(record, {
        type: 'INSTRUCTION_ADDED', instruction: response.additionalInstruction,
      });
      this.#audit(record, 'instruction', { instruction: response.additionalInstruction });
    }
    this.#audit(record, 'human_decision', {
      requestId: request.id,
      selectedOptionId: response.selectedOptionId,
      grantRefs: grants.map((grant) => grant.id),
    });
    record.progress.publish('resumed', '已收到你的决定，正在继续');
    void Promise.resolve().then(() => this.#drive(record));
    return record.state;
  }

  async #drive(record: RunRecord): Promise<void> {
    if (record.driving || record.state.status !== 'running') return;
    record.driving = true;
    try {
      while (record.state.status === 'running') {
        const budget = checkModelLedDrawingAgentBudget(record.state, this.#now());
        if (budget) {
          this.#fail(record, `${budget.code}: ${budget.message}`);
          return;
        }
        if (record.input.workflow === 'partition') {
          await this.#advancePartitionWorkflow(record);
          return;
        }
        if (record.input.workflow === 'partitioned-annotation') {
          await this.#advancePartitionedAnnotation(record);
          return;
        }
        if (record.state.pendingInstructions.length > 0) {
          this.#transition(record, { type: 'INSTRUCTIONS_ACTIVATED' });
        }
        if (isImageOnlyImport(record) && !record.imageImportCompleted) {
          await this.#advanceImageOnlyImport(record);
          if (record.state.status !== 'running') return;
          if (!record.imageImportCompleted) continue;
          if (record.state.pendingInstructions.length === 0
            && record.state.activeInstructions.length === 0) {
            const workspace = await this.#application.open(record.state.drawingId);
            const summary = [
              `图片矢量化完成：${workspace.document.geometry.length} 个图元。`,
              '自动标注将在分区确认后生成——请发送补充信息（台阶说明、区域用途等，可上传文档），',
              '我将结合补充信息按台阶特征对图纸分区；也可以直接发送“开始分区”。',
            ].join('');
            this.#transition(record, { type: 'COMPLETED', summary });
            this.#finish(record, 'completed', summary);
            return;
          }
        }
        const next = await this.#nextAction(record);
        if (!next) return;
        const { action: modelAction, availableTools } = next;
        const action = this.#bindRuntimeEditBase(record, modelAction);
        if (action.type === 'tool'
          && action.tool === 'preview_vectorization_batch'
          && !availableTools.has(action.tool)) {
          const feedback = [
            'TOOL_NOT_AVAILABLE_IN_CURRENT_TURN:',
            `${action.tool} 不在本轮 toolCatalog 中。`,
            '当前存在 Preview 时必须先使用 commit 动作提交或 evaluate_preview 检查；不得继续创建会覆盖它的新 Preview。',
          ].join(' ');
          this.#transition(record, { type: 'PROTOCOL_CORRECTION_RECORDED' });
          record.protocolFeedback = feedback;
          record.progress.publish('validation', '正在修正工具调用顺序', feedback);
          continue;
        }
        const editBaseFeedback = this.#editBaseProtocolFeedback(record, action);
        if (editBaseFeedback) {
          this.#transition(record, { type: 'PROTOCOL_CORRECTION_RECORDED' });
          record.protocolFeedback = editBaseFeedback;
          record.progress.publish(
            'validation',
            '正在确认本轮修改基于哪个版本',
            editBaseFeedback,
          );
          this.#audit(record, 'state', {
            event: 'EDIT_BASE_REJECTED',
            action: auditSafeAction(action),
            detail: editBaseFeedback,
          });
          continue;
        }
        this.#transition(record, {
          type: 'ACTION_STARTED',
          title: actionTitle(action),
          actionKind: actionKind(action),
        });
        this.#audit(record, 'model_action', auditSafeAction(action));
        if (action.type === 'tool') {
          await this.#executeTool(record, action);
          continue;
        }
        if (action.type === 'request-human-decision') {
          await this.#waitForDecision(record, this.#requestFromDraft(record, action.request));
          return;
        }
        if (action.type === 'commit') {
          const continued = await this.#commit(record, action);
          if (!continued) return;
          continue;
        }
        if (sourceReconstructionNeedsCommittedEvidence(record)) {
          const feedback = [
            'SOURCE_RECONSTRUCTION_INCOMPLETE:',
            '当前是带源图的重建任务，但仍有源图增量尚未提交。',
            '不得宣称已完成；请继续处理下一批证据，直到所有 Drawing IR 增量均已提交。',
          ].join(' ');
          this.#transition(record, { type: 'PROTOCOL_CORRECTION_RECORDED' });
          record.protocolFeedback = feedback;
          record.progress.publish(
            'validation',
            '重建尚未产生图纸增量',
            '正在继续解析源图',
          );
          this.#audit(record, 'state', {
            event: 'SOURCE_RECONSTRUCTION_FINISH_REJECTED',
            revision: record.state.revision,
            commitCount: record.state.commitCount,
          });
          continue;
        }
        if (isSourceReconstructionRun(record)) {
          const summarySuffix = ' 自动标注将在分区确认后生成：请发送补充信息（可上传文档），我将按台阶特征对图纸分区。';
          this.#transition(record, { type: 'COMPLETED', summary: action.summary + summarySuffix });
          this.#finish(record, 'completed', action.summary + summarySuffix);
          return;
        }
        this.#transition(record, { type: 'COMPLETED', summary: action.summary });
        this.#finish(record, 'completed', action.summary);
        return;
      }
    } catch (error) {
      if (record.state.status !== 'running') return;
      this.#fail(record, error instanceof Error ? error.message : String(error));
    } finally {
      record.controller = null;
      record.driving = false;
      if (record.state.status === 'running' && !record.resolved) {
        void Promise.resolve().then(() => this.#drive(record));
      }
    }
  }

  async #advanceImageOnlyImport(record: RunRecord): Promise<void> {
    const source = record.input.source;
    if (!source) throw new Error('IMAGE_IMPORT_SOURCE_MISSING');

    if (record.state.currentPreviewHandle) {
      const vectorBatch = currentVectorizationBatch(record);
      await this.#withRunController(record, () => this.#commit(record, {
        type: 'commit',
        previewHandle: record.state.currentPreviewHandle!,
        summary: vectorBatch
          ? `提交源图矢量化第 ${vectorBatch.batchIndex + 1}/${record.vectorizationBatchCount} 批`
          : '提交源图矢量化结果',
      }, vectorBatch ? {} : {
        countsTowardBudget: false,
        committedTitle: '矢量化结果已提交',
      }));
      return;
    }

    if (!record.imageImportCandidateHandle) {
      record.progress.publish('vectorizing', '正在读取图片并提取线稿');
      const result = await this.#executeDeterministicTool(record, {
        type: 'tool',
        toolCallId: `runtime_vectorize_${randomUUID()}`,
        tool: 'vectorize_image',
        input: { sourceId: source.sourceId },
      });
      if (!result) return;
      const output = asRecord(result.output);
      if (typeof output?.candidateHandle !== 'string' || record.vectorizationBatchCount < 1) {
        throw new Error('IMAGE_IMPORT_VECTORIZATION_INVENTORY_INVALID');
      }
      record.imageImportCandidateHandle = output.candidateHandle;
      return;
    }

    if (record.committedVectorizationBatchCount < record.vectorizationBatchCount) {
      await this.#executeDeterministicTool(record, {
        type: 'tool',
        toolCallId: `runtime_vector_batch_${record.committedVectorizationBatchCount}_${randomUUID()}`,
        tool: 'preview_vectorization_batch',
        input: {
          candidateHandle: record.imageImportCandidateHandle,
          batchIndex: record.committedVectorizationBatchCount,
        },
      });
      return;
    }

    record.imageImportCompleted = true;
    record.progress.publish('verifying', '矢量化图元已完成，等待补充信息后分区');
  }

  /**
   * 分区工作流：结合用户补充信息（goal + 附件）与图纸台阶特征，
   * 由分区模型产出分区方案并以 feature 分区提交；完成后交由用户预览编辑。
   */
  async #advancePartitionWorkflow(record: RunRecord): Promise<void> {
    if (!this.#partitionService) {
      this.#fail(record, 'PARTITION_MODEL_UNAVAILABLE: 分区模型未配置，无法执行分区');
      return;
    }
    const workspace = await this.#application.open(record.state.drawingId);
    const document = workspace.document;
    if (document.geometry.length === 0) {
      this.#fail(record, 'PARTITION_NO_GEOMETRY: 图纸还没有几何图元，请先导入图纸');
      return;
    }
    const pendingFeedback = [...record.state.activeInstructions, ...record.state.pendingInstructions];
    if (record.state.pendingInstructions.length > 0) {
      this.#transition(record, { type: 'INSTRUCTIONS_ACTIVATED' });
    }
    const feedback = pendingFeedback.length > 0 ? pendingFeedback.join('；') : undefined;
    const sourceImage = await this.#loadPartitionSourceImage(record);
    await this.#withRunController(record, async () => {
      this.#transition(record, {
        type: 'ACTION_STARTED',
        title: '正在结合补充信息对图纸分区',
        actionKind: 'model',
      });
      record.progress.publish('planning', '正在结合补充信息按台阶特征分区');
      this.#audit(record, 'state', {
        event: 'PARTITION_STARTED',
        revision: record.state.revision,
        hasFeedback: Boolean(feedback),
        hasSourceImage: Boolean(sourceImage),
      });
      // 分区模型调用超时保护：组合运行中止信号与专用超时，避免网关挂起时无限等待
      const runSignal = record.controller?.signal ?? new AbortController().signal;
      const partitionRemainingMs = record.state.limits.deadlineAt - this.#now();
      if (partitionRemainingMs <= 0) {
        throw new Error('PARTITION_DEADLINE_EXCEEDED: 任务已超过运行截止时间');
      }
      const partitionTimeoutMs = Math.min(partitionRemainingMs, this.#limits.partitionModelCallMs);
      const partitionController = new AbortController();
      const forwardRunAbort = () => partitionController.abort(runSignal.reason);
      if (runSignal.aborted) forwardRunAbort();
      else runSignal.addEventListener('abort', forwardRunAbort, { once: true });
      const partitionTimer = setTimeout(() => {
        partitionController.abort(new Error(
          `PARTITION_MODEL_TIMEOUT: 分区模型 ${Math.ceil(partitionTimeoutMs / 1_000)} 秒内未返回，请重试或配置更快的分区模型（COMPANY_AI_PARTITION_MODEL）`,
        ));
      }, partitionTimeoutMs);
      let partitions: DrawingPartition[];
      try {
        partitions = await this.#partitionService.generate({
          document,
          supplements: record.input.goal,
          feedback,
          sourceImage,
          signal: partitionController.signal,
        });
      } finally {
        clearTimeout(partitionTimer);
        runSignal.removeEventListener('abort', forwardRunAbort);
      }
      if (partitions.length === 0) {
        throw new Error('PARTITION_EMPTY: 未能生成有效分区，请补充更明确的分区说明后重试');
      }
      const preview = await this.#drawingTools.previewCandidate({
        runId: record.state.runId,
        episodeId: record.state.episodeId,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        summary: `生成 ${partitions.length} 个分区`,
        commands: buildPartitionCommands(document, partitions),
        confidence: 0.8,
      });
      if (preview.status !== 'ready') {
        throw new Error('PARTITION_PREVIEW_REJECTED: 分区方案未通过校验，请调整分区要求后重试');
      }
      const partitionCandidate = this.#drawingTools.readCandidate({
        runId: record.state.runId,
        episodeId: record.state.episodeId,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        previewHandle: preview.previewHandle,
      });
      if (!partitionCandidate) throw new Error('PARTITION_PREVIEW_MISSING');
      this.#transition(record, {
        type: 'PREVIEW_READY',
        previewHandle: partitionCandidate.previewHandle,
        candidateDigest: digestDrawingTransaction(partitionCandidate.transaction),
      });
      const commitCountBefore = record.state.commitCount;
      const continued = await this.#commit(record, {
        type: 'commit',
        previewHandle: preview.previewHandle,
        summary: `提交 ${partitions.length} 个分区`,
      }, {
        countsTowardBudget: false,
        committedTitle: '分区方案已生成',
      });
      if (!continued) return;
      if (record.state.commitCount === commitCountBefore) {
        throw new Error('PARTITION_COMMIT_SKIPPED: 分区方案未能提交，请重试');
      }
      this.#audit(record, 'state', {
        event: 'PARTITION_COMMITTED',
        partitionIds: partitions.map((partition) => partition.id),
        partitionNames: partitions.map((partition) => partition.name),
      });
      const summary = [
        `已按台阶特征生成 ${partitions.length} 个分区：${partitions.map((partition) => partition.name).join('、')}。`,
        '可直接在画布拖动分区顶点调整边界，或点击分区重命名；不满意请回复修改意见重新分区；',
        '满意后点击「确认分区并自动标注」生成分区标注。',
      ].join('');
      this.#transition(record, { type: 'COMPLETED', summary });
      this.#finish(record, 'completed', summary);
    });
  }

  /** 分区标注工作流：按用户确认（可能已编辑）的分区生成自动标注 */
  async #advancePartitionedAnnotation(record: RunRecord): Promise<void> {
    const workspace = await this.#application.open(record.state.drawingId);
    const document = workspace.document;
    const partitions = readDrawingPartitions(document);
    if (partitions.length === 0) {
      this.#fail(record, 'PARTITION_MISSING: 尚未生成分区，请先补充分区信息并生成分区方案');
      return;
    }
    this.#transition(record, {
      type: 'ACTION_STARTED',
      title: '正在生成开角标注',
      actionKind: 'tool',
    });
    record.progress.publish('planning', '正在检测图纸上的开角并生成角度标注');
    this.#audit(record, 'state', {
      event: 'PARTITIONED_ANNOTATION_INVENTORY',
      partitionCount: partitions.length,
      partitionIds: partitions.map((partition) => partition.id),
    });
    const plan = buildPartitionedAnnotationSteps({
      drawingId: document.id,
      document,
      partitions,
    });
    const continued = await this.#commitAnnotationSteps(record, plan, {
      inventoryEvent: 'PARTITIONED_ANNOTATION_STEPS',
      startedTitle: '正在生成开角标注',
      skipMessage: '当前图纸未检测到新的开角标注（开角可能不存在或标注已存在）',
    });
    if (!continued || record.state.status !== 'running') return;
    const createdCount = plan.filter((item) => (
      item.commands.some((command) => command.type === 'annotation.create')
    )).length;
    const removedCount = plan.length - createdCount;
    const summary = createdCount > 0 || removedCount > 0
      ? `已提交 ${createdCount} 项轴端开角（角度）标注${removedCount > 0 ? `，并清理 ${removedCount} 项过期开角标注` : ''}。其余自动标注已暂停（逐段调整中）。`
      : '未检测到轴端开角（角度）标注。其余自动标注已暂停（逐段调整中）。';
    this.#transition(record, { type: 'COMPLETED', summary });
    this.#finish(record, 'completed', summary);
  }

  async #loadPartitionSourceImage(record: RunRecord): Promise<{ id: string; dataUrl: string } | undefined> {
    const source = record.input.source;
    if (!source || !this.#sourceImages) return undefined;
    try {
      const image = await this.#sourceImages.read(source.sourceId);
      if (!image.mimeType.startsWith('image/')) return undefined;
      return {
        id: 'partition-source',
        dataUrl: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString('base64')}`,
      };
    } catch {
      return undefined;
    }
  }

  async #executeDeterministicTool(
    record: RunRecord,
    action: Extract<DrawingAgentAction, { type: 'tool' }>,
  ): Promise<ModelToolResult | null> {
    this.#transition(record, {
      type: 'ACTION_STARTED',
      title: actionTitle(action),
      actionKind: actionKind(action),
    });
    this.#audit(record, 'state', {
      event: 'DETERMINISTIC_IMAGE_IMPORT_ACTION',
      tool: action.tool,
      toolCallId: action.toolCallId,
      revision: record.state.revision,
    });
    await this.#withRunController(record, () => this.#executeTool(record, action));
    if (record.state.status !== 'running') return null;
    const result = [...record.state.recentToolResults].reverse().find((item) => (
      item.receipt.toolCallId === action.toolCallId
    ));
    if (!result) throw new Error(`IMAGE_IMPORT_TOOL_RECEIPT_MISSING: ${action.tool}`);
    if (result.receipt.status !== 'succeeded') {
      throw new Error(
        `IMAGE_IMPORT_TOOL_FAILED: ${action.tool}: ${result.receipt.error?.code ?? 'UNKNOWN'}`,
      );
    }
    return result;
  }

  async #withRunController<T>(record: RunRecord, operation: () => Promise<T>): Promise<T> {
    const controller = new AbortController();
    record.controller = controller;
    try {
      return await operation();
    } finally {
      if (record.controller === controller) record.controller = null;
    }
  }

  #editBaseProtocolFeedback(
    record: RunRecord,
    action: DrawingAgentAction,
  ): string | null {
    if (action.type !== 'tool') return null;
    const input = asRecord(action.input);
    if (action.tool === 'preview_transaction' || action.tool === 'preview_spatial_program') {
      if (input?.baseRevision !== record.state.revision) {
        return [
          'PREVIEW_BASE_REVISION_MISMATCH:',
          `${action.tool}.baseRevision 必须等于当前正式版本 ${record.state.revision}。`,
        ].join(' ');
      }
      const current = record.state.currentPreviewHandle;
      const replacement = typeof input.replacesPreviewHandle === 'string'
        ? input.replacesPreviewHandle
        : null;
      if (current && replacement !== current) {
        return [
          'PREVIEW_REPLACEMENT_MISMATCH:',
          action.tool === 'preview_spatial_program'
            ? `在当前候选上继续编译必须显式设置 replacesPreviewHandle=${current}。`
            : `从正式版本重做会舍弃当前候选，必须显式设置 replacesPreviewHandle=${current}。`,
        ].join(' ');
      }
      if (!current && replacement) {
        return [
          'PREVIEW_REPLACEMENT_MISMATCH:',
          '当前没有可被舍弃的 Preview，不得提供 replacesPreviewHandle。',
        ].join(' ');
      }
      return null;
    }
    if (action.tool !== 'revise_preview') return null;
    const current = record.state.currentPreviewHandle;
    if (!current || input?.basePreviewHandle !== current) {
      return [
        'PREVIEW_BASE_NOT_CURRENT:',
        `revise_preview 必须基于当前 Preview ${current ?? 'none'}。`,
      ].join(' ');
    }
    const candidate = this.#drawingTools.readCandidate({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      previewHandle: current,
    });
    if (!candidate) return 'PREVIEW_BASE_NOT_CURRENT: 当前 Preview 已不可用。';
    if (input.baseTransactionDigest !== candidate.transactionDigest) {
      return [
        'PREVIEW_BASE_DIGEST_MISMATCH:',
        'revise_preview.baseTransactionDigest 与当前 Preview 不一致。',
      ].join(' ');
    }
    return null;
  }

  #bindRuntimeEditBase(
    record: RunRecord,
    action: DrawingAgentAction,
  ): DrawingAgentAction {
    if (action.type !== 'tool'
      || (action.tool !== 'preview_transaction' && action.tool !== 'preview_spatial_program')) {
      return action;
    }
    const input = asRecord(action.input);
    if (!input || input.baseRevision === record.state.revision) return action;
    const suppliedBaseRevision = typeof input.baseRevision === 'string'
      ? input.baseRevision
      : null;
    this.#audit(record, 'state', {
      event: 'RUNTIME_EDIT_BASE_BOUND',
      suppliedBaseRevision,
      boundBaseRevision: record.state.revision,
    });
    return {
      ...action,
      input: { ...input, baseRevision: record.state.revision },
    };
  }

  async #nextAction(record: RunRecord): Promise<{
    action: DrawingAgentAction;
    availableTools: Set<string>;
  } | null> {
    const controller = new AbortController();
    record.controller = controller;
    const modelName = modelForSpatialAction(record);
    const current = await this.#application.readCurrent(record.state.drawingId);
    const summary = await this.#application.summarize({
      drawingId: record.state.drawingId,
      limit: 12,
    });
    if (current.revision !== record.state.revision) {
      record.state = { ...record.state, revision: current.revision, currentPreviewHandle: null };
      record.contextLedger.advanceRevision(current.revision);
      record.currentPreviewReview = undefined;
      record.projectedWorldKey = undefined;
      record.projectedWorldEvidenceRef = undefined;
      record.projectedWorldKnowledgeState = undefined;
    }
    const spatialIndex = new DrawingSpatialContextIndex(current.document);
    record.contextLedger.registerNodeIds([
      ...current.document.geometry.map((node) => node.id),
      ...current.document.annotations.map((node) => node.id),
      ...current.document.relations.map((node) => node.id),
      ...current.document.features.map((node) => node.id),
    ]);
    const connectedCarrierFacts = findConnectedCarrierCandidates(current.document).map((fact) => ({
      carrierNodeRef: record.contextLedger.alias(fact.carrierNodeId),
      carrierType: fact.carrierType,
      contactedOpenConnectorCount: fact.contactedOpenConnectorCount,
      contactedPortCount: fact.contactedPortCount,
      preferredTool: 'preview_connected_transform' as const,
    }));
    record.contextLedger.markActive(record.input.selectedIds ?? []);
    const activeNodeIds = unique([
      ...(record.input.selectedIds ?? []),
      ...record.contextLedger.activeNodeIds(),
    ]);
    const workingSet = spatialIndex.workingSet(activeNodeIds, { limit: 48 });
    record.contextLedger.registerNodeIds(workingSet.nodes.map((item) => item.id));
    const localGeometryNodeIds = workingSet.nodes
      .filter((item) => item.plane === 'geometry')
      .map((item) => item.id);
    const targetGeometryNodeIds = activeNodeIds.filter((id) => (
      current.document.geometry.some((node) => node.id === id)
    ));
    const worldProjectionKey = localGeometryNodeIds.length === 0
      ? undefined
      : `${current.revision}:${[...localGeometryNodeIds].sort().join(',')}`;
    const includeWorldProjection = worldProjectionKey !== undefined
      && record.projectedWorldKey !== worldProjectionKey;
    const worldContext = includeWorldProjection
      ? buildModelWorldContext({
          document: current.document,
          revision: current.revision,
          localGeometryNodeIds,
          targetGeometryNodeIds,
          alias: (nodeId) => record.contextLedger.alias(nodeId),
        })
      : undefined;
    const projectedWorkingSet = record.contextLedger.projectValue({
      ...workingSet,
      nodes: workingSet.nodes.map((item) => ({
        alias: record.contextLedger.alias(item.id),
        plane: item.plane,
        type: item.type,
        relevance: item.relevance,
        ...(item.bounds ? { bounds: item.bounds } : {}),
        // The exact geometry is already present in the bounded World Model on projection turns.
        // On later stateless model calls it is restored here so no prior-turn memory is assumed.
        ...(worldContext ? {} : { node: item.node }),
      })),
    });
    const initialObservation = await this.#loadInitialObservation(record);
    const candidateObservations = mergeObservations(initialObservation, observationsFromToolResults(
      record.state.recentToolResults,
      (handle) => this.#application.readObservationImage(handle),
      record.state.currentPreviewHandle,
    ));
    const sourceCropHandle = pendingSourceCropHandle(
      record.state.recentToolResults,
      record.deliveredSourceCropHandles,
    );
    const sourceCropImage = sourceCropHandle
      ? await this.#loadSourceCrop(sourceCropHandle)
      : undefined;
    const sourceImage = sourceCropImage ?? (record.sourceBootstrapDelivered
      ? undefined
      : await this.#loadSourceImage(record));
    const visual = selectVisualWorkingSet({
      ...(sourceImage ? { sourceImage } : {}),
      observations: candidateObservations,
      sourceBootstrapPending: Boolean(sourceCropImage) || !record.sourceBootstrapDelivered,
    });
    const remainingMs = record.state.limits.deadlineAt - this.#now();
    if (remainingMs <= 0) throw new Error('MODEL_LOOP_DEADLINE_EXCEEDED');
    const timeoutMs = Math.min(remainingMs, this.#limits.spatialModelCallMs);
    const timeout = setTimeout(() => {
      controller.abort(new ModelCallTimeoutError(timeoutMs));
    }, timeoutMs);
    record.progress.publish('model_started', '正在根据当前图纸决定下一步');
    const worldEvidenceRef = worldContext?.evidenceRef
      ?? (record.projectedWorldKey === worldProjectionKey
        ? record.projectedWorldEvidenceRef
        : undefined)
      ?? `drawing-map:${current.revision}`;
    const decisionContext = this.#decisionContext(record, worldEvidenceRef);
    const toolCatalog = selectModelToolCatalog(this.#registry.catalog(), {
      hasSource: Boolean(record.input.source),
      allowSourceReconstruction: record.input.attachmentPurpose === 'drawing-source',
      currentPreview: Boolean(record.state.currentPreviewHandle),
      latestTool: record.state.recentToolResults.at(-1)?.receipt.tool,
      knowledgeState: worldContext?.worldModelSlice.knowledge.state
        ?? (record.projectedWorldKey === worldProjectionKey
          ? record.projectedWorldKnowledgeState
          : undefined)
        ?? 'unknown',
      hasDiagnostics: record.state.recentDiagnostics.length > 0,
      decisionSequence: decisionContext.sequence,
      pendingVectorizationBatches: record.vectorizationBatchCount === 0
        || record.committedVectorizationBatchCount < record.vectorizationBatchCount,
      completedTools: record.state.recentToolResults
        .filter((result) => result.receipt.status === 'succeeded'
          && (result.receipt.revisionBefore === current.revision
            || isRevisionIndependentSourceTool(result.receipt.tool)))
        .map((result) => result.receipt.tool),
      hasExplicitSelection: (record.input.selectedIds?.length ?? 0) > 0,
    });
    this.#audit(record, decisionContext.sequence === 1 ? 'decision' : 'escalation', {
      ...structuredClone(decisionContext),
      revision: record.state.revision,
    });
    const currentPreviewCandidate = record.state.currentPreviewHandle
      ? this.#drawingTools.readCandidate({
          runId: record.state.runId,
          episodeId: record.state.episodeId,
          drawingId: record.state.drawingId,
          revision: record.state.revision,
          previewHandle: record.state.currentPreviewHandle,
        })
      : null;
    if (record.state.currentPreviewHandle && !currentPreviewCandidate) {
      throw new Error('CURRENT_PREVIEW_CANDIDATE_MISSING');
    }
    try {
      const action = await this.#model.next({
        objective: record.state.objective,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        episodeId: record.state.episodeId,
        drawingSummary: summary.summary,
        spatialContext: {
          globalMap: spatialIndex.globalMap(),
          workingSet: projectedWorkingSet,
          evidenceLedger: record.contextLedger.project({
            excludeNodeIds: workingSet.nodes.map((item) => item.id),
          }),
          connectedCarrierFacts,
          ...(worldContext ? {
            worldModelSlice: worldContext.worldModelSlice,
            actionFacts: worldContext.actionFacts,
          } : {}),
        },
        decisionContext,
        nodeAliases: record.contextLedger.aliasesByNode(),
        toolCatalog,
        recentToolResults: record.state.recentToolResults,
        recentDiagnostics: record.state.recentDiagnostics,
        decisions: record.state.decisions,
        appendedInstructions: record.state.activeInstructions,
        stableRules: record.input.stableRules ?? [],
        ...(currentPreviewCandidate ? {
          currentPreview: {
            previewHandle: currentPreviewCandidate.previewHandle,
            transactionDigest: currentPreviewCandidate.transactionDigest,
            affectedNodeIds: currentPreviewCandidate.affectedNodeIds.map((nodeId) => (
              record.contextLedger.alias(nodeId)
            )),
          },
        } : {}),
        ...(record.input.source ? {
          source: {
            sourceId: record.input.source.sourceId,
            mimeType: record.input.source.mimeType,
            byteLength: record.input.source.byteLength,
            ...(record.input.source.page ? { page: record.input.source.page } : {}),
          },
        } : {}),
        ...(visual.sourceImage ? { sourceImage: visual.sourceImage } : {}),
        ...(record.state.currentPreviewHandle
          ? { currentPreviewHandle: record.state.currentPreviewHandle }
          : {}),
        ...(record.currentPreviewReview
          ? { currentPreviewReview: structuredClone(record.currentPreviewReview) }
          : {}),
        ...(record.semanticCandidateAttempt > 0 ? {
          candidateBudget: {
            attempt: record.semanticCandidateAttempt,
            max: this.#limits.maxCandidateAttempts,
          },
        } : {}),
        observations: visual.observations,
        modelName,
        attempt: modelAttempt(record),
        ...(record.protocolFeedback ? { protocolFeedback: record.protocolFeedback } : {}),
        signal: controller.signal,
        deadlineAt: record.state.limits.deadlineAt,
        onRawReply: (reply) => {
          if (visual.sourceImage) record.sourceBootstrapDelivered = true;
          if (sourceCropHandle && visual.sourceImage) {
            record.deliveredSourceCropHandles.add(sourceCropHandle);
          }
          this.#audit(record, 'model', {
            role: 'drawing-action', reply: safeModelReply(reply),
          });
        },
        onModelTelemetry: (telemetry) => this.#audit(record, 'model_call', {
          ...telemetry,
          attempt: modelAttempt(record),
          revision: record.state.revision,
        }),
      });
      if (visual.sourceImage) record.sourceBootstrapDelivered = true;
      if (worldContext && worldProjectionKey) {
        record.projectedWorldKey = worldProjectionKey;
        record.projectedWorldEvidenceRef = worldContext.evidenceRef;
        record.projectedWorldKnowledgeState = worldContext.worldModelSlice.knowledge.state;
      }
      if (sourceCropHandle && visual.sourceImage) {
        record.deliveredSourceCropHandles.add(sourceCropHandle);
      }
      const recoveredProtocolRepair = record.visibleProtocolRepair;
      record.protocolFeedback = undefined;
      record.visibleProtocolRepair = undefined;
      record.modelRetryCount = 0;
      record.progress.publish(
        recoveredProtocolRepair ? 'protocol_recovered' : 'model_finished',
        recoveredProtocolRepair ? '输出格式已恢复，继续执行' : '已确定下一步',
        recoveredProtocolRepair
          ? `第 ${recoveredProtocolRepair.attempt}/${recoveredProtocolRepair.limit} 次自动纠正已成功`
          : undefined,
      );
      const resolvedAction = action.type === 'tool'
        ? { ...action, input: record.contextLedger.resolveAliases(action.input) }
        : action;
      return {
        action: normalizeModelAction(resolvedAction, current.document),
        availableTools: new Set(toolCatalog.map((tool) => tool.name)),
      };
    } catch (error) {
      const timeoutError = controller.signal.reason instanceof ModelCallTimeoutError
        ? controller.signal.reason
        : null;
      if (controller.signal.aborted && !timeoutError) return null;
      if (timeoutError && this.#now() >= record.state.limits.deadlineAt) {
        throw new Error('MODEL_LOOP_DEADLINE_EXCEEDED');
      }
      if (error instanceof DrawingAgentProtocolError) {
        this.#transition(record, { type: 'PROTOCOL_CORRECTION_RECORDED' });
        record.protocolFeedback = error.message;
        const attempt = record.state.protocolCorrectionCount;
        const limit = record.state.limits.maxProtocolCorrections;
        record.visibleProtocolRepair = { attempt, limit };
        const exhausted = attempt >= limit;
        record.progress.publish(
          'protocol_repairing',
          exhausted ? '模型输出格式仍未通过校验' : '模型输出格式需要校正',
          exhausted
            ? `已达到 ${attempt}/${limit} 次协议纠正上限`
            : `正在进行第 ${attempt}/${limit} 次自动纠正`,
        );
        if (exhausted) {
          throw new Error(`MAX_PROTOCOL_CORRECTIONS: 已达到最大协议纠错次数 ${limit}`);
        }
        return this.#nextAction(record);
      }
      if (record.modelRetryCount < 2) {
        record.modelRetryCount += 1;
        record.progress.publish(
          'revising',
          '模型响应异常，正在重试',
          `第 ${record.modelRetryCount + 1} 次尝试`,
        );
        this.#audit(record, 'model', {
          role: 'drawing-action',
          status: 'retrying',
          attempt: record.modelRetryCount + 1,
          error: safeModelError(timeoutError ?? error),
        });
        return this.#nextAction(record);
      }
      throw timeoutError ?? error;
    } finally {
      clearTimeout(timeout);
    }
  }

  #decisionContext(record: RunRecord, worldEvidenceRef: string): ModelDecisionContext {
    const sequence = ++record.decisionSequence;
    if (sequence === 1) {
      return createModelDecisionContext({
        sequence,
        phase: 'initial',
        reason: 'initial-world-state',
        evidenceRefs: [
          worldEvidenceRef,
          ...record.input.source ? [`source:${record.input.source.sha256}`] : [],
          ...record.input.selectedIds?.map((id) => `selected:${id}`) ?? [],
        ],
        diagnosticCodes: [],
      });
    }
    const trigger = decisionTrigger(record, worldEvidenceRef);
    return createModelDecisionContext({ sequence, ...trigger });
  }

  #loadSourceImage(
    record: RunRecord,
  ): Promise<NonNullable<import('./model-loop-adapter.js').ModelLoopActionInput['sourceImage']>>
    | undefined {
    const source = record.input.source;
    if (!source || !this.#sourceImages) return undefined;
    record.sourceImage ??= this.#sourceImages.read(source.sourceId).then((image) => ({
      id: `source_${source.sourceId}_page_${source.page}`,
      imageDataUrl: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString('base64')}`,
      width: image.width,
      height: image.height,
    }));
    return record.sourceImage;
  }

  async #loadSourceCrop(
    mediaHandle: string,
  ): Promise<NonNullable<import('./model-loop-adapter.js').ModelLoopActionInput['sourceImage']>> {
    if (!this.#sourceCrops) throw new Error('SOURCE_CROP_READER_UNAVAILABLE');
    const crop = await this.#sourceCrops.read(mediaHandle);
    if (crop.mediaHandle !== mediaHandle) throw new Error('SOURCE_CROP_HANDLE_MISMATCH');
    return {
      id: mediaHandle,
      imageDataUrl: `data:${crop.mimeType};base64,${Buffer.from(crop.bytes).toString('base64')}`,
      width: crop.width,
      height: crop.height,
    };
  }

  #loadInitialObservation(record: RunRecord): Promise<ModelLoopObservation[]> {
    record.initialObservation ??= this.#application.observeForAgent({
      drawingId: record.state.drawingId,
      includeAnnotations: false,
      selectedIds: record.input.selectedIds ?? [],
      selectionIsTarget: false,
      ...(record.input.viewport ? { userViewport: record.input.viewport } : {}),
    }).then((observation) => observation.views.flatMap((view) => {
      const imageDataUrl = this.#application.readObservationImage(view.image.handle);
      if (!imageDataUrl) return [];
      return [{
        id: view.id,
        purpose: previewPurpose(view.purpose, false),
        imageDataUrl,
        width: view.width,
        height: view.height,
        worldBounds: view.worldBounds,
        worldToImage: view.worldToImage,
        grounding: structuredClone(view.grounding),
      } satisfies ModelLoopObservation];
    }));
    return record.initialObservation;
  }

  async #executeTool(
    record: RunRecord,
    action: Extract<DrawingAgentAction, { type: 'tool' }>,
  ): Promise<void> {
    const presentation = toolPresentation(action.tool);
    const resolvedInput = record.contextLedger.resolveAliases(action.input);
    const intentOverlay = await this.#projectToolIntent(
      record,
      action.tool,
      resolvedInput,
      presentation.started,
    );
    if (record.state.status !== 'running' || record.controller?.signal.aborted) return;
    record.progress.publish(
      'tool_started',
      presentation.started,
      undefined,
      undefined,
      intentOverlay ? { overlay: intentOverlay } : undefined,
    );
    const result = await this.#registry.invoke({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      toolCallId: action.toolCallId,
      tool: action.tool,
      input: resolvedInput,
    }, { signal: record.controller?.signal });
    if (record.state.status !== 'running' || record.controller?.signal.aborted) return;
    this.#transition(record, { type: 'MODEL_TOOL_RECORDED', result });
    record.contextLedger.record(result);
    const spatialProgramExecution = action.tool === 'preview_spatial_program'
      ? spatialProgramAuditExecution(result.output)
      : undefined;
    this.#audit(record, 'tool_call', {
      receipt: result.receipt,
      ...(spatialProgramExecution ? { spatialProgramExecution } : {}),
    });
    if (result.receipt.status !== 'succeeded') {
      if (result.receipt.error?.code === 'TOOL_INPUT_INVALID'
        || result.receipt.error?.code === 'UNSUPPORTED_TOOL'
        || result.receipt.error?.code === 'DUPLICATE_TOOL_CALL_ID') {
        record.toolProtocolFailureCount = Math.min(2, record.toolProtocolFailureCount + 1);
      }
      record.progress.publish('tool_finished', presentation.failed, result.receipt.error?.code);
      return;
    }
    record.toolProtocolFailureCount = 0;
    const output = asRecord(result.output);
    if (action.tool === 'vectorize_image') {
      const inventory = asRecord(output?.inventory);
      if (Number.isInteger(inventory?.batchCount) && Number(inventory?.batchCount) > 0) {
        record.vectorizationBatchCount = Number(inventory!.batchCount);
        record.committedVectorizationBatchCount = 0;
      }
    }
    if (output?.previewHandle && typeof output.previewHandle === 'string') {
      const candidate = this.#drawingTools.readCandidate({
        runId: record.state.runId,
        episodeId: record.state.episodeId,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        previewHandle: output.previewHandle,
      });
      if (candidate) {
        record.currentPreviewReview = undefined;
        this.#transition(record, {
          type: 'PREVIEW_READY',
          previewHandle: candidate.previewHandle,
          candidateDigest: candidate.transactionDigest,
        });
        this.#audit(record, 'state', {
          event: 'PREVIEW_BASE_SELECTED',
          previewHandle: candidate.previewHandle,
          transactionDigest: candidate.transactionDigest,
          editBase: structuredClone(candidate.editBase),
        });
      }
    }
    if (Array.isArray(output?.diagnostics)) {
      const diagnostics = parseDiagnostics(output.diagnostics);
      this.#transition(record, { type: 'DIAGNOSTICS_RECORDED', diagnostics });
      const nodeIds = unique(diagnostics.flatMap((item) => item.nodeIds));
      record.progress.publish('verifying', '已检查当前候选', undefined, undefined, {
        overlay: {
          kind: 'diagnostics', nodeIds, codes: unique(diagnostics.map((item) => item.code)),
        },
      });
    }
    const perceptionDelta = previewDelta(record, action.tool, output);
    const overlay = toolOverlay(action.tool, result);
    record.progress.publish(
      progressType(action.tool),
      presentation.finished,
      undefined,
      perceptionDelta,
      overlay ? { overlay } : undefined,
    );
    if (isSemanticPreviewTool(action.tool)
      && typeof output?.previewHandle === 'string') {
      const visuallyAccepted = await this.#independentlyVerifyPreview(
        record,
        output.previewHandle,
        output,
      );
      if (!visuallyAccepted) return;
    }
    if (action.tool === 'evaluate_preview'
      && action.input && typeof action.input === 'object'
      && !Array.isArray(action.input)
      && (action.input as Record<string, unknown>).includeRender === true
      && typeof output?.previewHandle === 'string') {
      const visuallyAccepted = await this.#independentlyVerifyPreview(
        record,
        output.previewHandle,
        output,
      );
      if (!visuallyAccepted) return;
    }
    if (action.tool === 'preview_vectorization_batch'
      && typeof output?.previewHandle === 'string') {
      record.progress.publish(
        'verifying',
        '当前批次已通过局部几何校验，正在提交',
      );
      await this.#commit(record, {
        type: 'commit',
        previewHandle: output.previewHandle,
        summary: vectorizationBatchSummary(output),
      });
    }
  }

  async #projectToolIntent(
    record: RunRecord,
    tool: string,
    input: unknown,
    label: string,
  ): Promise<Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> | undefined> {
    if (!hasProjectableToolIntent(tool)) return undefined;
    try {
      const current = await this.#application.readCurrent(record.state.drawingId);
      return projectToolIntentFrame(
        current.document,
        tool,
        input,
        label,
        (value) => {
          const reference = asRecord(value);
          if (!reference
            || !['observation', 'world', 'node_anchor'].includes(String(reference.kind))) {
            return undefined;
          }
          try {
            return resolveSpatialPoint(value as SpatialPointRef, {
              document: current.document,
              drawingId: record.state.drawingId,
              revision: record.state.revision,
              readObservationView: (viewId) => this.#application.readObservationView(viewId),
            });
          } catch {
            return undefined;
          }
        },
      );
    } catch {
      // Interaction projection is advisory UI state and must never block the real tool.
      return undefined;
    }
  }

  async #independentlyVerifyPreview(
    record: RunRecord,
    previewHandle: string,
    output: Record<string, unknown>,
  ): Promise<boolean> {
    const candidate = this.#drawingTools.readCandidate({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      previewHandle,
    });
    if (!candidate) throw new Error('PREVIEW_VERIFICATION_CANDIDATE_MISSING');
    const candidateAttempt = record.semanticCandidateAttempt + 1;
    const candidateProgress = {
      candidateAttempt,
      maxCandidateAttempts: this.#limits.maxCandidateAttempts,
    };
    const deterministicDiagnostics = parseDiagnosticsFromOutput(output);
    if (!this.#previewVerifier) throw new Error('PREVIEW_VERIFIER_UNAVAILABLE');
    if (!asRecord(output.observation)) {
      throw new Error('PREVIEW_VERIFICATION_OBSERVATION_MISSING');
    }
    const workspace = await this.#application.readCurrent(record.state.drawingId);
    const preview = await this.#application.preview({
      drawingId: record.state.drawingId,
      transaction: structuredClone(candidate.transaction),
    });
    if (preview.status !== 'ready') return false;
    const beforeObservation = await this.#application.observeForAgent({
      drawingId: record.state.drawingId,
      includeAnnotations: false,
      selectedIds: [],
      selectionIsTarget: false,
    });
    const beforeView = beforeObservation.views.find((view) => view.purpose === 'overview')
      ?? beforeObservation.views[0];
    const previewObservation = await this.#application.observePreviewForAgent({
      document: preview.resultingDocument,
      revision: record.state.revision,
      previewHandle,
      includeAnnotations: false,
      selectedIds: candidate.affectedNodeIds,
      ...(beforeView ? {
        userViewport: {
          scale: beforeView.worldToImage[0],
          offsetX: beforeView.worldToImage[4],
          offsetY: beforeView.worldToImage[5],
          width: beforeView.width,
          height: beforeView.height,
        },
      } : {}),
    });
    const verificationFrame = spatialInteractionFrame(output.interactionFrame);
    if (verificationFrame) verificationFrame.phase = 'verifying';
    const verify = async (
      modelName: string,
      phase: 'preview-screening' | 'preview-final',
      title: string,
      protocolFeedback?: string,
    ) => {
      record.progress.publish(
        'verifying',
        title,
        undefined,
        undefined,
        {
          ...candidateProgress,
          ...(verificationFrame ? { overlay: structuredClone(verificationFrame) } : {}),
        },
      );
      const parentSignal = record.controller?.signal;
      const reviewController = new AbortController();
      const forwardParentAbort = () => reviewController.abort(parentSignal?.reason);
      if (parentSignal?.aborted) forwardParentAbort();
      else parentSignal?.addEventListener('abort', forwardParentAbort, { once: true });
      const remainingMs = Math.max(1, record.state.limits.deadlineAt - this.#now());
      const reviewTimeoutMs = Math.min(remainingMs, this.#limits.previewVerificationMs);
      const reviewTimeout = setTimeout(() => {
        reviewController.abort(new ModelCallTimeoutError(reviewTimeoutMs));
      }, reviewTimeoutMs);
      let verification;
      try {
        verification = await this.#previewVerifier!.verify({
          goal: effectiveReviewObjective(record),
          previewDocument: preview.resultingDocument,
          modelName,
          signal: reviewController.signal,
          deadlineAt: Math.min(record.state.limits.deadlineAt, this.#now() + reviewTimeoutMs),
          beforeObservation,
          previewObservation,
          deterministicDiagnostics,
          candidateContext: previewCandidateContext(previewHandle, candidate, output),
          ...(protocolFeedback ? { protocolFeedback } : {}),
          readImage: (handle) => this.#application.readObservationImage(handle),
          onRawReply: (_role, reply) => this.#audit(record, 'model', {
            role: phase, reply: safeModelReply(reply),
          }),
        });
      } finally {
        clearTimeout(reviewTimeout);
        parentSignal?.removeEventListener('abort', forwardParentAbort);
      }
      this.#audit(record, 'verification', {
        phase,
        previewHandle,
        satisfied: verification.satisfied,
        reason: verification.reason,
        defects: structuredClone(verification.defects),
        beforeRevision: workspace.revision,
      });
      return verification;
    };
    const verificationModel = modelForPreviewVerification(record);
    const recordUnavailableReview = (input: {
      code: string;
      message: string;
      detail: string;
      phase: string;
      retryCount: number;
    }): false => {
      const diagnostics: DrawingDiagnostic[] = [{
        code: input.code,
        severity: 'warning',
        message: input.message,
        nodeIds: [...candidate.affectedNodeIds],
        facts: { detail: input.detail, retryCount: input.retryCount },
      }];
      record.currentPreviewReview = {
        revision: record.state.revision,
        previewHandle,
        transactionDigest: candidate.transactionDigest,
        status: 'unavailable',
        reason: input.detail,
        defects: [],
        reviewedAt: this.#now(),
      };
      this.#transition(record, { type: 'DIAGNOSTICS_RECORDED', diagnostics });
      this.#audit(record, 'verification', {
        phase: input.phase,
        previewHandle,
        satisfied: false,
        reason: input.detail,
        retry: input.retryCount,
        beforeRevision: workspace.revision,
      });
      record.progress.publish(
        'revising',
        '独立复核暂时不可用，已返回主模型判断',
        input.detail,
        undefined,
        {
          overlay: {
            kind: 'diagnostics',
            nodeIds: [...candidate.affectedNodeIds],
            codes: [input.code],
          },
        },
      );
      return false;
    };
    let verification: Awaited<ReturnType<DrawingPreviewVerificationModelAdapter['verify']>>;
    try {
      verification = await verify(
        verificationModel,
        'preview-final',
        '正在做候选图纸的视觉复核',
      );
    } catch (error) {
      if (!isRepairablePreviewVerificationError(error)) {
        if (record.controller?.signal.aborted || this.#now() >= record.state.limits.deadlineAt) {
          throw error;
        }
        return recordUnavailableReview({
          code: 'PREVIEW_REVIEW_UNAVAILABLE',
          message: '独立复核服务暂时不可用',
          detail: safeModelError(error),
          phase: 'preview-review-unavailable',
          retryCount: 0,
        });
      }
      const protocolFeedback = safeModelError(error);
      this.#audit(record, 'verification', {
        phase: 'preview-protocol-correction',
        previewHandle,
        satisfied: false,
        reason: protocolFeedback,
        retry: 1,
        beforeRevision: workspace.revision,
      });
      record.progress.publish(
        'verifying',
        '视觉复核响应不完整，正在纠错重试',
        protocolFeedback,
        undefined,
        candidateProgress,
      );
      try {
        verification = await verify(
          verificationModel,
          'preview-final',
          '正在重新校验候选图纸',
          protocolFeedback,
        );
      } catch (retryError) {
        if (!isRepairablePreviewVerificationError(retryError)) {
          if (record.controller?.signal.aborted || this.#now() >= record.state.limits.deadlineAt) {
            throw retryError;
          }
          return recordUnavailableReview({
            code: 'PREVIEW_REVIEW_UNAVAILABLE',
            message: '独立复核服务暂时不可用',
            detail: safeModelError(retryError),
            phase: 'preview-review-unavailable',
            retryCount: 1,
          });
        }
        return recordUnavailableReview({
          code: 'PREVIEW_VERIFIER_PROTOCOL_INVALID',
          message: '视觉复核连续返回无法解析的协议结果',
          detail: safeModelError(retryError),
          phase: 'preview-protocol-invalid',
          retryCount: 1,
        });
      }
    }
    record.semanticCandidateAttempt = candidateAttempt;
    if (verification.satisfied) {
      record.currentPreviewReview = {
        revision: record.state.revision,
        previewHandle,
        transactionDigest: candidate.transactionDigest,
        status: 'satisfied',
        reason: verification.reason,
        defects: [],
        reviewedAt: this.#now(),
      };
      this.#audit(record, 'verification', {
        phase: 'preview-review-result',
        previewHandle,
        transactionDigest: candidate.transactionDigest,
        revision: record.state.revision,
        modelName: verificationModel,
        satisfied: true,
      });
      record.progress.publish(
        'verifying', '独立视觉复核已通过', undefined, undefined, candidateProgress,
      );
      return true;
    }
    record.currentPreviewReview = {
      revision: record.state.revision,
      previewHandle,
      transactionDigest: candidate.transactionDigest,
      status: 'needs_revision',
      reason: verification.reason,
      defects: structuredClone(verification.defects),
      reviewedAt: this.#now(),
    };
    const diagnostics = verification.defects.map((defect) => ({
      code: defect.code,
      severity: 'warning' as const,
      nodeIds: [...defect.nodeIds],
      message: defect.message,
      ...(defect.repairHint ? { action: defect.repairHint } : {}),
    }));
    this.#transition(record, { type: 'DIAGNOSTICS_RECORDED', diagnostics });
    record.progress.publish(
      'revising',
      '独立复核发现偏差，已返回主模型判断',
      verification.reason,
      undefined,
      {
        ...candidateProgress,
        overlay: {
          kind: 'diagnostics',
          nodeIds: unique(verification.defects.flatMap((defect) => defect.nodeIds)),
          codes: verification.defects.map((defect) => defect.code),
        },
      },
    );
    if (candidateAttempt >= this.#limits.maxCandidateAttempts) {
      this.#fail(
        record,
        [
          'PREVIEW_REVIEW_ATTEMPTS_EXHAUSTED:',
          `连续 ${candidateAttempt} 个候选未通过独立复核。`,
          '正式图纸未提交，可重试或补充指令。',
        ].join(' '),
      );
    }
    return false;
  }

  async #commit(
    record: RunRecord,
    action: Extract<DrawingAgentAction, { type: 'commit' }>,
    options: {
      countsTowardBudget?: boolean;
      committedTitle?: string;
    } = {},
  ): Promise<boolean> {
    const candidate = this.#drawingTools.readCandidate({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      previewHandle: action.previewHandle,
    });
    if (!candidate) {
      this.#recordSyntheticResult(record, 'commit_preview', 'PREVIEW_NOT_FOUND');
      this.#transition(record, { type: 'PREVIEW_CLEARED' });
      return true;
    }
    if (record.state.currentPreviewHandle !== action.previewHandle) {
      const detail = [
        'PREVIEW_NOT_CURRENT:',
        '只能提交当前仍显示给用户和主模型的 Preview。',
        `requested=${action.previewHandle}`,
        `current=${record.state.currentPreviewHandle ?? 'none'}`,
      ].join(' ');
      this.#recordSyntheticResult(
        record,
        'commit_preview',
        'PREVIEW_NOT_CURRENT',
        detail,
      );
      record.protocolFeedback = detail;
      record.progress.publish(
        'validation',
        '提交目标不是当前预览',
        '请基于当前画布候选继续判断',
      );
      this.#audit(record, 'verification', {
        phase: 'current-preview-gate',
        previewHandle: action.previewHandle,
        transactionDigest: digestDrawingTransaction(candidate.transaction),
        revision: record.state.revision,
        satisfied: false,
        reason: 'preview-handle-is-not-current',
      });
      return true;
    }
    const workspace = await this.#application.readCurrent(record.state.drawingId);
    const grants = record.state.decisionGrants;
    const transaction = structuredClone(candidate.transaction);
    transaction.metadata = {
      ...transaction.metadata!,
      decisionGrantRefs: unique([
        ...transaction.metadata?.decisionGrantRefs ?? [],
        ...grants.map((grant) => grant.id),
      ]),
    };
    const policy = this.#interactionPolicy.evaluate({
      document: workspace.document,
      transaction,
      protections: this.#protections(workspace.document),
      grants,
      diagnostics: record.state.recentDiagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity === 'decision_required'
          ? 'candidate' as const
          : diagnostic.severity,
      })),
    });
    if (policy.status === 'decision_required') {
      await this.#waitForDecision(record, permissionRequest(record, candidate, policy.requirements));
      return false;
    }
    if (policy.status === 'denied') {
      this.#recordSyntheticResult(record, 'commit_preview', 'CANDIDATE_PERMISSION_DENIED');
      return true;
    }
    record.progress.publish('commit', '正在原子提交当前候选');
    const result = await this.#registry.invoke({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      toolCallId: `runtime_commit_${record.state.actionCount}_${randomUUID()}`,
      tool: 'commit_preview',
      input: {
        previewHandle: action.previewHandle,
        decisionGrantRefs: policy.status === 'allowed' ? policy.grantRefs : [],
      },
    }, { signal: record.controller?.signal });
    if (record.state.status !== 'running' || record.controller?.signal.aborted) return false;
    this.#transition(record, { type: 'MODEL_TOOL_RECORDED', result });
    record.contextLedger.record(result);
    this.#audit(record, 'tool_call', { receipt: result.receipt });
    if (result.receipt.status !== 'succeeded') {
      record.progress.publish('tool_finished', '提交未成功', result.receipt.error?.code);
      return true;
    }
    const output = asRecord(result.output);
    if (output?.status === 'committed') {
      this.#transition(record, {
        type: 'COMMIT_RECORDED',
        revision: result.receipt.revisionAfter,
        countsTowardBudget: options.countsTowardBudget
          ?? !currentVectorizationBatch(record),
      });
      record.contextLedger.advanceRevision(result.receipt.revisionAfter);
      record.currentPreviewReview = undefined;
      record.semanticCandidateAttempt = 0;
      record.streamedPreviewHandles.clear();
      record.initialObservation = undefined;
      const current = await this.#application.open(record.state.drawingId);
      const commit = current.commits.at(-1);
      if (commit) this.#enqueueAudit(record, () => this.#auditStore!.saveCommit(record.state.runId, commit));
      this.#audit(record, 'commit', {
        commitId: output.commitId,
        revision: result.receipt.revisionAfter,
        summary: action.summary,
      });
      record.progress.publish('committed', options.committedTitle ?? '增量修改已提交', undefined, undefined, {
        overlay: { kind: 'clear' },
      });
      if (isSourceReconstructionRun(record)) {
        const vectorBatch = currentVectorizationBatch(record);
        if (vectorBatch && this.#generationTools) {
          const progress = this.#generationTools.advanceVectorizationBatch({
            runId: record.state.runId,
            candidateHandle: vectorBatch.candidateHandle,
            batchIndex: vectorBatch.batchIndex,
          });
          record.committedVectorizationBatchCount = progress.nextBatchIndex;
          this.#audit(record, 'state', {
            event: 'VECTORIZATION_BATCH_COMMITTED',
            candidateHandle: vectorBatch.candidateHandle,
            batchIndex: vectorBatch.batchIndex,
            ...progress,
          });
          if (!progress.completed) {
            record.progress.publish(
              isImageOnlyImport(record) ? 'vectorizing' : 'model_started',
              `已提交第 ${vectorBatch.batchIndex + 1}/${progress.batchCount} 批，正在继续`,
            );
            return true;
          }
        }
        record.progress.publish(
          isImageOnlyImport(record) ? 'vectorizing' : 'model_started',
          isImageOnlyImport(record)
            ? '导入增量已提交，正在继续'
            : '正在基于新版本验收重建结果',
        );
        return true;
      }
      this.#transition(record, { type: 'COMPLETED', summary: action.summary });
      this.#finish(record, 'completed', action.summary);
    }
    return true;
  }

  async #commitAnnotationSteps(
    record: RunRecord,
    steps: AutomaticAnnotationStep[],
    input: { inventoryEvent: string; startedTitle: string; skipMessage: string },
  ): Promise<boolean> {
    this.#audit(record, 'state', {
      event: input.inventoryEvent,
      annotationCount: steps.length,
    });
    if (steps.length === 0) {
      record.progress.publish('validation', input.skipMessage);
      return true;
    }

    record.progress.publish('tool_started', input.startedTitle);
    const preview = await this.#drawingTools.previewCandidate({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      summary: `更新 ${steps.length} 项自动标注`,
      commands: steps.flatMap((step) => step.commands),
      confidence: Math.min(...steps.map((step) => step.annotation.quality.confidence ?? 1)),
    });
    if (preview.status !== 'ready') {
      record.progress.publish('validation', '自动标注未生成，已保留几何重建结果');
      this.#audit(record, 'validation', {
        event: 'AUTOMATIC_ANNOTATION_PREVIEW_SKIPPED',
        status: preview.status,
      });
      return true;
    }

    const candidate = this.#drawingTools.readCandidate({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      previewHandle: preview.previewHandle,
    });
    if (!candidate) throw new Error('AUTOMATIC_ANNOTATION_PREVIEW_MISSING');
    this.#transition(record, {
      type: 'PREVIEW_READY',
      previewHandle: candidate.previewHandle,
      candidateDigest: digestDrawingTransaction(candidate.transaction),
    });
    record.streamedPreviewHandles.add(preview.previewHandle);
    const delta: PerceptionPreviewDelta = {
      runId: record.state.runId,
      sequence: ++record.previewSequence,
      action: record.previewSequence === 1 ? 'preview' : 'revise',
      slotIds: preview.previewDelta.upserts.map((node) => node.id),
      upserts: structuredClone(preview.previewDelta.upserts),
      removeIds: [...preview.previewDelta.removeIds],
      hideCommittedIds: unique([
        ...preview.previewDelta.upserts.map((node) => node.id),
        ...preview.previewDelta.removeIds,
      ]),
      labelsByNodeId: Object.fromEntries(steps.map((step) => [
        step.annotation.id,
        step.label,
      ])),
      source: {
        page: record.input.source?.page ?? 1,
        viewId: preview.previewHandle,
        stage: 'annotation',
      },
    };
    record.progress.publish(
      'previewing',
      `已生成 ${steps.length} 个自动标注预览`,
      undefined,
      delta,
      {
        overlay: {
          kind: 'preview',
          previewHandle: preview.previewHandle,
          affectedNodeIds: [...preview.affectedNodeIds],
        },
      },
    );
    this.#audit(record, 'state', {
      event: 'AUTOMATIC_ANNOTATION_PREVIEW_READY',
      previewHandle: preview.previewHandle,
      annotationIds: steps.map((step) => step.annotation.id),
    });
    const commitCountBefore = record.state.commitCount;
    const continued = await this.#commit(record, {
      type: 'commit',
      previewHandle: preview.previewHandle,
      summary: `提交 ${steps.length} 个自动标注`,
    }, {
      countsTowardBudget: false,
      committedTitle: `已提交 ${steps.length} 个自动标注`,
    });
    if (!continued) return false;
    if (record.state.commitCount === commitCountBefore) {
      record.progress.publish('validation', '自动标注未提交，已保留几何重建结果');
    }
    return record.state.status === 'running';
  }

  async #waitForDecision(record: RunRecord, request: HumanDecisionRequest): Promise<void> {
    await this.#interactions.appendRequest(record.state.runId, request);
    this.#transition(record, { type: 'HUMAN_DECISION_REQUIRED', request });
    this.#audit(record, 'human_decision', {
      phase: 'requested', request: auditSafeDecision(request),
    });
    record.progress.publish('validation', '需要你确认后继续', request.question);
  }

  #requestFromDraft(record: RunRecord, draft: HumanDecisionDraft): HumanDecisionRequest {
    const candidate = draft.previewHandle
      ? this.#drawingTools.readCandidate({
          runId: record.state.runId,
          episodeId: record.state.episodeId,
          drawingId: record.state.drawingId,
          revision: record.state.revision,
          previewHandle: draft.previewHandle,
        })
      : null;
    return {
      id: `decision_${randomUUID()}`,
      episodeId: record.state.episodeId,
      revision: record.state.revision,
      ...(candidate ? {
        candidateId: candidate.previewHandle,
        transactionDigest: digestDrawingTransaction(candidate.transaction),
      } : {}),
      ...structuredClone(draft),
      expiresWhenRevisionChanges: true,
    };
  }

  #recordSyntheticResult(
    record: RunRecord,
    tool: string,
    code: string,
    detail?: string,
  ): void {
    const result: ModelToolResult = {
      schemaVersion: 1,
      receipt: {
        schemaVersion: 1,
        runId: record.state.runId,
        episodeId: record.state.episodeId,
        drawingId: record.state.drawingId,
        toolCallId: `runtime_feedback_${randomUUID()}`,
        tool,
        toolVersion: 'runtime',
        access: 'write',
        status: 'rejected',
        revisionBefore: record.state.revision,
        revisionAfter: record.state.revision,
        affectedNodeIds: [],
        inputDigest: digest(code),
        durationMs: 0,
        error: {
          code,
          retryable: true,
          ...(detail ? { detail } : {}),
          suggestedAction: 'replan',
        },
      },
    };
    this.#transition(record, { type: 'MODEL_TOOL_RECORDED', result });
    record.contextLedger.record(result);
  }

  #transition(record: RunRecord, event: ModelLedDrawingAgentEvent): void {
    const transition = reduceModelLedDrawingAgentState(record.state, event);
    if (transition.error) throw new Error(transition.error.message);
    record.state = transition.state;
    this.#audit(record, 'state', {
      event: event.type,
      status: record.state.status,
      revision: record.state.revision,
      currentPreviewHandle: record.state.currentPreviewHandle,
    });
  }

  #fail(record: RunRecord, message: string): void {
    if (!TERMINAL.has(record.state.status)) {
      this.#transition(record, { type: 'FAILED', error: message });
    }
    this.#finish(record, 'failed', '任务执行失败', message);
  }

  #finish(
    record: RunRecord,
    type: 'stopped' | 'completed' | 'failed',
    title: string,
    detail?: string,
  ): void {
    if (record.resolved) return;
    record.resolved = true;
    if (this.#runResources) this.#runResources.discardRun(record.state.runId);
    else this.#drawingTools.discardRun(record.state.runId);
    const visibleDetail = detail ?? (type === 'completed'
      && record.state.protocolCorrectionCount > 0
      ? `执行期间已完成 ${record.state.protocolCorrectionCount} 次自动纠正`
      : undefined);
    record.progress.publish(type, title, visibleDetail, undefined, { overlay: { kind: 'clear' } });
    record.resolveCompletion(record.state);
  }

  #startAudit(record: RunRecord): void {
    if (!this.#auditStore) return;
    this.#enqueueAudit(record, () => this.#auditStore!.startRun({
      schemaVersion: 1,
      runId: record.state.runId,
      drawingId: record.state.drawingId,
      baseRevision: record.state.revision,
      startedAt: record.state.createdAt,
      drawingProtocolVersion: '1.0',
      commandSchemaVersion: '1.0.0',
      toolSchemaVersion: '1.0.0',
      promptHashes: { planner: 'model-led:none', decision: 'model-led:v1' },
      modelProfile: { ...record.input.modelProfile },
      goalSpec: null,
    }));
  }

  #audit(record: RunRecord, type: string, payload: Record<string, unknown>): void {
    if (!this.#auditStore) return;
    const allowedType = type as Parameters<DrawingAgentAuditStore['appendEvent']>[0]['type'];
    this.#enqueueAudit(record, () => this.#auditStore!.appendEvent({
      schemaVersion: 1,
      id: `${record.state.runId}_event_${++record.auditSequence}`,
      runId: record.state.runId,
      type: allowedType,
      timestamp: this.#now(),
      payload: structuredClone(payload),
    }));
  }

  #enqueueAudit(record: RunRecord, operation: () => Promise<void>): void {
    if (!this.#auditStore) return;
    record.auditQueue = record.auditQueue.then(operation, operation).then(
      () => undefined,
      () => undefined,
    );
  }

  #require(runId: string): RunRecord {
    const record = this.#runs.get(runId);
    if (!record) throw new Error(`Agent run does not exist: ${runId}`);
    return record;
  }
}

function modelForSpatialAction(record: RunRecord): string {
  return record.input.modelProfile.repair;
}

function effectiveReviewObjective(record: RunRecord): string {
  return [
    record.state.objective,
    ...record.state.activeInstructions,
    ...(record.input.stableRules ?? []),
  ].map((item) => item.trim()).filter(Boolean).join('\n');
}

function modelForPreviewVerification(
  record: RunRecord,
): string {
  return record.input.modelProfile.reviewer;
}

function isSemanticPreviewTool(tool: string): boolean {
  return tool === 'preview_spatial_program'
    || tool === 'preview_transaction'
    || tool === 'revise_preview'
    || tool === 'preview_connected_transform';
}

/** 生成分区提交命令：替换现有分区 feature（删除旧分区 + 创建新分区） */
function buildPartitionCommands(
  document: DrawingDocument,
  partitions: DrawingPartition[],
): DrawingCommand[] {
  const staleFeatures = document.features
    .filter((feature) => feature.semanticType === PARTITION_SEMANTIC_TYPE)
    .map((feature) => ({ type: 'feature.delete' as const, id: feature.id }));
  return [
    ...staleFeatures,
    ...partitions.map((partition) => ({
      type: 'feature.create' as const,
      value: partitionToFeature(partition),
    })),
  ];
}

function isSourceReconstructionRun(record: RunRecord): boolean {
  if (!record.input.source || record.input.attachmentPurpose !== 'drawing-source') return false;
  const mode = interpretDrawingInput({
    goal: record.state.objective,
    hasSource: true,
    attachmentPurpose: record.input.attachmentPurpose,
  }).mode;
  return mode === 'reconstruct' || mode === 'reconstruct_then_modify';
}

function isImageOnlyImport(record: RunRecord): boolean {
  return record.input.attachmentPurpose === 'drawing-source'
    && record.input.goal.trim() === ''
    && Boolean(record.input.source?.mimeType.startsWith('image/'));
}

function sourceReconstructionNeedsCommittedEvidence(record: RunRecord): boolean {
  return isSourceReconstructionRun(record) && (
    record.state.commitCount === 0
    || record.committedVectorizationBatchCount < record.vectorizationBatchCount
  );
}

function vectorizationBatchSummary(output: Record<string, unknown>): string {
  const batchIndex = Number(output.batchIndex);
  const batchCount = Number(output.batchCount);
  if (Number.isInteger(batchIndex) && Number.isInteger(batchCount) && batchCount > 0) {
    return `提交源图矢量化第 ${batchIndex + 1}/${batchCount} 批`;
  }
  return '提交源图矢量化增量';
}

function currentVectorizationBatch(record: RunRecord): {
  candidateHandle: string;
  batchIndex: number;
} | null {
  if (record.vectorizationBatchCount === 0
    || record.committedVectorizationBatchCount >= record.vectorizationBatchCount) {
    return null;
  }
  for (const result of [...record.state.recentToolResults].reverse()) {
    if (result.receipt.tool !== 'preview_vectorization_batch'
      || result.receipt.status !== 'succeeded') continue;
    const output = asRecord(result.output);
    if (typeof output?.sourceCandidateHandle !== 'string'
      || !Number.isInteger(output.batchIndex)
      || output.batchIndex !== record.committedVectorizationBatchCount) continue;
    return {
      candidateHandle: output.sourceCandidateHandle,
      batchIndex: output.batchIndex as number,
    };
  }
  return null;
}

function isRevisionIndependentSourceTool(tool: string): boolean {
  return tool === 'vectorize_image' || tool === 'inspect_source_overview';
}

function decisionTrigger(
  record: RunRecord,
  worldEvidenceRef: string,
): {
  phase: ModelDecisionPhase;
  reason: string;
  evidenceRefs: string[];
  diagnosticCodes: string[];
} {
  if (record.protocolFeedback) {
    return {
      phase: 'protocol-repair',
      reason: 'protocol-feedback',
      evidenceRefs: [`protocol:${digest(record.protocolFeedback)}`],
      diagnosticCodes: [],
    };
  }
  if (record.modelRetryCount > 0) {
    return {
      phase: 'model-retry',
      reason: 'model-upstream-failure',
      evidenceRefs: [`model-retry:${record.modelRetryCount}`],
      diagnosticCodes: [],
    };
  }
  const latestDecision = record.state.decisions.at(-1);
  if (latestDecision?.response) {
    return {
      phase: 'user-feedback',
      reason: 'human-decision-resolved',
      evidenceRefs: [
        `decision:${latestDecision.request.id}:${latestDecision.response.selectedOptionId}`,
      ],
      diagnosticCodes: [],
    };
  }
  const latestInstruction = record.state.activeInstructions.at(-1);
  const latest = record.state.recentToolResults.at(-1);
  const diagnosticCodes = unique(record.state.recentDiagnostics.map((item) => item.code));
  if (latest) {
    const resultRef = `tool:${latest.receipt.toolCallId}:${latest.receipt.outputDigest
      ?? latest.receipt.inputDigest}`;
    if (latest.receipt.tool === 'commit_preview'
      && latest.receipt.status === 'succeeded'
      && latest.receipt.revisionAfter !== latest.receipt.revisionBefore) {
      return {
        phase: 'post-commit',
        reason: 'canonical-revision-changed',
        evidenceRefs: [resultRef, `revision:${latest.receipt.revisionAfter}`],
        diagnosticCodes,
      };
    }
    return {
      phase: latest.receipt.tool === 'preview_spatial_program'
        || latest.receipt.tool === 'preview_transaction'
        || latest.receipt.tool === 'revise_preview'
        || latest.receipt.tool === 'preview_connected_transform'
        || latest.receipt.tool === 'evaluate_preview'
        ? 'preview-review'
        : 'tool-evidence',
      reason: latest.receipt.status === 'succeeded'
        ? `${latest.receipt.tool}-completed`
        : `${latest.receipt.tool}-${latest.receipt.error?.code ?? latest.receipt.status}`,
      evidenceRefs: [
        resultRef,
        ...diagnosticCodes.map((code) => `diagnostic:${code}`),
        ...(latestInstruction ? [`instruction:${digest(latestInstruction)}`] : []),
      ],
      diagnosticCodes,
    };
  }
  if (latestInstruction) {
    return {
      phase: 'user-feedback',
      reason: 'user-instruction-added',
      evidenceRefs: [`instruction:${digest(latestInstruction)}`],
      diagnosticCodes,
    };
  }
  return {
    phase: 'tool-evidence',
    reason: 'world-state-refreshed',
    evidenceRefs: [worldEvidenceRef, `runtime-turn:${record.decisionSequence}`],
    diagnosticCodes,
  };
}

function modelAttempt(record: RunRecord): number {
  return Math.max(
    record.state.protocolCorrectionCount,
    record.modelRetryCount,
    record.toolProtocolFailureCount,
  ) + 1;
}

function normalizeModelAction(
  action: DrawingAgentAction,
  document: DrawingDocument,
): DrawingAgentAction {
  if (action.type !== 'tool' || (
    action.tool !== 'preview_transaction'
    && action.tool !== 'revise_preview'
    && action.tool !== 'preview_connected_transform'
  )) return action;
  const input = asRecord(action.input);
  const commandKey = action.tool === 'revise_preview' ? 'corrections' : 'commands';
  const commands = input?.[commandKey];
  if (!input || !Array.isArray(commands)) return action;
  const geometryById = new Map(document.geometry.map((node) => [node.id as string, node]));
  return {
    ...action,
    input: {
      ...input,
      [commandKey]: commands.map((command) => normalizeCompactGeometryCommand(
        command,
        geometryById,
      )),
    },
  };
}

function normalizeCompactGeometryCommand(
  value: unknown,
  geometryById: ReadonlyMap<string, GeometryNode>,
): unknown {
  const command = asRecord(value);
  if (command?.type !== 'geometry.update' || !isString(command.id)) return value;
  const changes = asRecord(command.changes);
  if (!changes || !Array.isArray(changes.parameters)) return value;
  const node = geometryById.get(command.id);
  const projected = node ? changesFromPrimitiveParameters(node, changes.parameters) : null;
  if (!projected) return value;
  const otherChanges = Object.fromEntries(
    Object.entries(changes).filter(([key]) => key !== 'parameters'),
  );
  return { ...command, changes: { ...otherChanges, ...projected } };
}

function changesFromPrimitiveParameters(
  node: GeometryNode,
  parameters: unknown[],
): Record<string, unknown> | null {
  if (!parameters.every((item) => typeof item === 'number' || typeof item === 'boolean')) return null;
  const numbers = parameters.filter((item): item is number => typeof item === 'number');
  switch (node.type) {
    case 'point': return numbers.length === 2 ? { x: numbers[0], y: numbers[1] } : null;
    case 'line': return numbers.length === 4
      ? { start: [numbers[0], numbers[1]], end: [numbers[2], numbers[3]] }
      : null;
    case 'ray':
    case 'xline': return numbers.length === 4
      ? { origin: [numbers[0], numbers[1]], direction: [numbers[2], numbers[3]] }
      : null;
    case 'circle': return numbers.length === 3
      ? { center: [numbers[0], numbers[1]], radius: numbers[2] }
      : null;
    case 'arc': return parameters.length === 6 && typeof parameters[5] === 'boolean'
      ? {
          center: [numbers[0], numbers[1]], radius: numbers[2],
          startAngle: numbers[3], endAngle: numbers[4], counterClockwise: parameters[5],
        }
      : null;
    default: return null;
  }
}

function actionTitle(action: DrawingAgentAction): string {
  if (action.type === 'tool') return toolPresentation(action.tool).started;
  if (action.type === 'commit') return '正在决定是否提交当前候选';
  if (action.type === 'request-human-decision') return '正在请求用户决定';
  return '正在完成任务';
}

function actionKind(action: DrawingAgentAction): 'model' | 'tool' | 'preview' | 'decision' | 'commit' {
  if (action.type === 'tool') {
    return action.tool === 'preview_spatial_program'
      || action.tool === 'preview_transaction'
      || action.tool === 'revise_preview'
      || action.tool === 'preview_connected_transform'
      ? 'preview'
      : 'tool';
  }
  if (action.type === 'request-human-decision') return 'decision';
  if (action.type === 'commit') return 'commit';
  return 'model';
}

function previewCandidateContext(
  previewHandle: string,
  candidate: NonNullable<ReturnType<DrawingModelTools['readCandidate']>>,
  output: Record<string, unknown>,
): NonNullable<import('./types.js').DrawingPreviewVerificationInput['candidateContext']> {
  const program = asRecord(output.spatialProgram);
  const targets = Array.isArray(program?.targets) ? program.targets : [];
  const operations = Array.isArray(program?.operations) ? program.operations : [];
  const targetNodeIds = unique(targets.flatMap((raw) => {
    const target = asRecord(raw);
    return Array.isArray(target?.nodeRefs) ? target.nodeRefs.filter(isString) : [];
  }));
  const operationKinds = unique(operations.flatMap((raw) => {
    const operation = asRecord(raw);
    return isString(operation?.kind) ? [operation.kind] : [];
  }));
  const metadata = asRecord(candidate.transaction.metadata);
  const summary = isString(program?.summary)
    ? program.summary
    : isString(metadata?.summary)
      ? metadata.summary
      : 'Drawing IR Preview';
  return {
    previewHandle,
    transactionDigest: candidate.transactionDigest,
    tool: program ? 'preview_spatial_program' : 'drawing_transaction',
    summary,
    ...(isString(program?.intent) ? { intent: program.intent } : {}),
    targetNodeIds: targetNodeIds.length > 0 ? targetNodeIds : [...candidate.affectedNodeIds],
    operationKinds,
    preserveNodeIds: Array.isArray(program?.preserveNodeRefs)
      ? unique(program.preserveNodeRefs.filter(isString))
      : [],
  };
}

function toolPresentation(tool: string): { started: string; finished: string; failed: string } {
  const titles: Record<string, [string, string]> = {
    render_drawing: ['正在观察图纸', '图纸观察已更新'],
    query_nodes: ['正在查询图元', '图元查询完成'],
    inspect_nodes: ['正在检查图元结构', '图元结构已读取'],
    measure_geometry: ['正在测量几何关系', '几何测量完成'],
    build_world_slice: ['正在构建局部二维世界', '局部空间事实已建立'],
    inspect_world_slice: ['正在读取局部空间细节', '局部空间细节已读取'],
    ground_semantic_entities: ['正在映射语义与图形', '语义候选已映射'],
    refine_semantic_entity: ['正在修正语义证据', '语义证据已更新'],
    propose_spatial_actions: ['正在计算可行修改方式', '空间动作候选已生成'],
    inspect_counterfactual_world: ['正在检查候选前后变化', '候选空间变化已读取'],
    build_topology: ['正在建立全图拓扑', '全图拓扑已建立'],
    trace_paths: ['正在沿连接路径追踪', '路径候选已找到'],
    find_interfaces: ['正在检查连接接口', '连接接口已读取'],
    inspect_fragment: ['正在检查局部曲线', '局部曲线已读取'],
    materialize_split: ['正在生成拆分候选', '拆分候选已生成'],
    preview_spatial_program: ['正在编译空间编辑计划', '空间编辑预览已生成'],
    preview_connected_transform: ['正在计算连通部件变换', '连通部件预览已生成'],
    preview_transaction: ['正在生成增量预览', '增量预览已生成'],
    revise_preview: ['正在基于当前候选修订', '候选修订预览已生成'],
    evaluate_preview: ['正在检查当前预览', '预览诊断已完成'],
    redraw_region: ['正在重绘局部形状', '局部重绘候选已生成'],
    vectorize_image: ['正在转换为可编辑图形', '矢量候选已生成'],
    fit_geometry: ['正在拟合解析图元', '几何拟合候选已生成'],
    recompute_annotations: ['正在重算派生标注', '标注候选已生成'],
  };
  const [started, finished] = titles[tool] ?? ['正在调用图纸工具', '图纸工具已完成'];
  return { started, finished, failed: `${finished}失败` };
}

function hasProjectableToolIntent(tool: string): boolean {
  return tool === 'preview_spatial_program'
    || tool === 'preview_transaction'
    || tool === 'revise_preview'
    || tool === 'preview_connected_transform'
    || tool === 'materialize_split'
    || tool === 'redraw_region';
}

function projectToolIntentFrame(
  document: DrawingDocument,
  tool: string,
  value: unknown,
  label: string,
  resolveProgramPoint?: (value: unknown) => Vec2 | undefined,
): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> | undefined {
  const input = asRecord(value);
  if (!input) return undefined;
  const nodeIds: string[] = [];
  const markers: DrawingAgentSpatialMarker[] = [];
  const motions: Array<{ id: string; nodeId: string; from?: Vec2; to: Vec2 }> = [];
  const strokes: Array<{
    id: string;
    ref?: string;
    role: 'boundary';
    points: Vec2[];
    closed: boolean;
  }> = [];

  if (tool === 'preview_spatial_program') {
    if (Array.isArray(input.targets)) {
      for (const [targetIndex, rawTarget] of input.targets.entries()) {
        const target = asRecord(rawTarget);
        if (Array.isArray(target?.nodeRefs)) nodeIds.push(...target.nodeRefs.filter(isString));
        const visualAnchors = Array.isArray(target?.visualAnchors) ? target.visualAnchors : [];
        for (const [anchorIndex, rawAnchor] of visualAnchors.entries()) {
          const point = spatialPointIntentValue(document, rawAnchor, resolveProgramPoint);
          if (!point) continue;
          markers.push({
            id: `spatial-program:target:${targetIndex}:anchor:${anchorIndex}`,
            ...(isString(target?.id) ? { ref: target.id } : {}),
            role: 'anchor',
            point,
          });
        }
        const interfaceRefs = Array.isArray(target?.interfaceRefs) ? target.interfaceRefs : [];
        for (const [interfaceIndex, rawInterface] of interfaceRefs.entries()) {
          const point = spatialPointIntentValue(document, rawInterface, resolveProgramPoint);
          if (!point) continue;
          markers.push({
            id: `spatial-program:target:${targetIndex}:interface:${interfaceIndex}`,
            ...(isString(target?.id) ? { ref: target.id } : {}),
            role: 'interface',
            point,
          });
        }
      }
    }
    if (Array.isArray(input.operations)) {
      for (const [operationIndex, rawOperation] of input.operations.entries()) {
        const operation = asRecord(rawOperation);
        if (!operation) continue;
        if (Array.isArray(operation.nodeIds)) nodeIds.push(...operation.nodeIds.filter(isString));
        if (isString(operation.nodeId)) nodeIds.push(operation.nodeId);
        const destinationRef = operation.kind === 'translate'
          ? operation.to
          : operation.kind === 'set_endpoint'
            ? operation.point
            : undefined;
        const destination = spatialPointIntentValue(document, destinationRef, resolveProgramPoint);
        if (destination) {
          const endpointEdit = operation.kind === 'set_endpoint';
          markers.push({
            id: `spatial-program:${operationIndex}:target`,
            ...(isString(operation.nodeId)
              ? { ref: `node:${operation.nodeId}` }
              : {}),
            role: endpointEdit ? 'interface' : 'target',
            point: destination,
          });
          if (operation.kind === 'translate') {
            const movingNodeId = Array.isArray(operation.nodeIds)
              ? operation.nodeIds.find(isString)
              : undefined;
            const from = spatialPointIntentValue(document, operation.from, resolveProgramPoint);
            if (movingNodeId && from) {
              motions.push({
                id: `spatial-program:${operationIndex}:motion`,
                nodeId: movingNodeId,
                from,
                to: destination,
              });
            }
          } else if (endpointEdit && isString(operation.nodeId) && isString(operation.endpoint)) {
            const from = spatialPointIntentValue(document, {
              kind: 'node_anchor', nodeId: operation.nodeId, anchor: operation.endpoint,
            }, resolveProgramPoint);
            if (from) {
              motions.push({
                id: `spatial-program:${operationIndex}:motion`,
                nodeId: operation.nodeId,
                from,
                to: destination,
              });
            }
          }
        }
        if (operation.kind === 'create_path' && Array.isArray(operation.points)) {
          const points = operation.points
            .map((point) => spatialPointIntentValue(document, point, resolveProgramPoint))
            .filter((point): point is Vec2 => Boolean(point));
          if (points.length >= 2) {
            strokes.push({
              id: `spatial-program:${operationIndex}:path`,
              ref: `spatial-program:${operationIndex}`,
              role: 'boundary',
              points,
              closed: operation.closed === true,
            });
          }
        }
      }
    }
  }
  const editCommands = tool === 'revise_preview' ? input.corrections : input.commands;
  if ((tool === 'preview_transaction' || tool === 'revise_preview')
    && Array.isArray(editCommands)) {
    for (const [commandIndex, rawCommand] of editCommands.entries()) {
      const command = asRecord(rawCommand);
      if (!command || typeof command.type !== 'string') continue;
      const nodeId = isString(command.id) && command.type.startsWith('geometry.')
        ? command.id
        : undefined;
      if (nodeId) nodeIds.push(nodeId);
      const geometry = asRecord(command.changes) ?? asRecord(command.value);
      if (!geometry) continue;
      for (const [pointIndex, point] of geometryIntentPoints(geometry).entries()) {
        markers.push({
          id: `command:${commandIndex}:target:${pointIndex}`,
          ...(nodeId ? { ref: `node:${nodeId}` } : {}),
          role: 'target',
          point,
        });
      }
      const destination = vec2Value(geometry.center) ?? vec2Value(geometry.point);
      if (nodeId && destination) {
        motions.push({ id: `command:${commandIndex}:motion`, nodeId, to: destination });
      }
    }
  } else if (tool === 'preview_connected_transform') {
    if (isString(input.carrierNodeId)) nodeIds.push(input.carrierNodeId);
    const targetCenter = vec2Value(input.targetCenter);
    if (targetCenter) {
      markers.push({
        id: 'connected-transform:target-center',
        ...(isString(input.carrierNodeId) ? { ref: `node:${input.carrierNodeId}` } : {}),
        role: 'target',
        point: targetCenter,
      });
      if (isString(input.carrierNodeId)) {
        motions.push({
          id: `connected-transform:motion:${input.carrierNodeId}`,
          nodeId: input.carrierNodeId,
          to: targetCenter,
        });
      }
    }
  } else if (tool === 'materialize_split' && Array.isArray(input.splitPlans)) {
    for (const value of input.splitPlans) {
      const plan = asRecord(value);
      if (isString(plan?.nodeId)) nodeIds.push(plan.nodeId);
    }
  } else if (tool === 'redraw_region') {
    if (Array.isArray(input.selectedIds)) nodeIds.push(...input.selectedIds.filter(isString));
    if (Array.isArray(input.contours)) {
      for (const [index, rawContour] of input.contours.entries()) {
        if (!Array.isArray(rawContour)) continue;
        const points = rawContour.map(vec2Value).filter((point): point is Vec2 => Boolean(point));
        if (points.length < 2) continue;
        strokes.push({
          id: `redraw-contour:${index}`,
          ref: `redraw-contour:${index}`,
          role: 'boundary',
          points,
          closed: true,
        });
      }
    }
  }

  if (nodeIds.length === 0 && strokes.length === 0 && markers.length === 0) return undefined;
  return projectDocumentIntentFrame({
    document,
    nodeIds,
    label,
    strokes,
    markers,
    motions,
  });
}

function geometryIntentPoints(value: Record<string, unknown>): Vec2[] {
  const points: Vec2[] = [];
  for (const key of ['point', 'start', 'end', 'center', 'origin']) {
    const point = vec2Value(value[key]);
    if (point) points.push(point);
  }
  if (Array.isArray(value.controlPoints)) {
    points.push(...value.controlPoints.map(vec2Value).filter((point): point is Vec2 => Boolean(point)));
  }
  if (Array.isArray(value.vertices)) {
    for (const vertex of value.vertices) {
      const point = vec2Value(asRecord(vertex)?.point);
      if (point) points.push(point);
    }
  }
  return points.slice(0, 24);
}

function vec2Value(value: unknown): Vec2 | undefined {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? [value[0] as number, value[1] as number]
    : undefined;
}

function spatialPointIntentValue(
  document: DrawingDocument,
  value: unknown,
  resolvePoint?: (value: unknown) => Vec2 | undefined,
): Vec2 | undefined {
  const resolved = resolvePoint?.(value);
  if (resolved) return resolved;
  const reference = asRecord(value);
  if (!reference) return undefined;
  if (reference.kind === 'world') return vec2Value(reference.point);
  if (reference.kind !== 'node_anchor' || !isString(reference.nodeId)) return undefined;
  const node = document.geometry.find((item) => item.id === reference.nodeId);
  if (!node) return undefined;
  if (reference.anchor === 'center') {
    if ('center' in node) return [...node.center];
    if (node.type === 'point') return [node.x, node.y];
  }
  if (reference.anchor === 'start') {
    if (node.type === 'line') return [...node.start];
    if (node.type === 'polyline') return node.vertices[0]?.point;
    if (node.type === 'spline') return node.controlPoints[0];
  }
  if (reference.anchor === 'end') {
    if (node.type === 'line') return [...node.end];
    if (node.type === 'polyline') return node.vertices.at(-1)?.point;
    if (node.type === 'spline') return node.controlPoints.at(-1);
  }
  if (reference.anchor === 'vertex'
    && Number.isInteger(reference.index)
    && node.type === 'polyline') {
    return node.vertices[Number(reference.index)]?.point;
  }
  return undefined;
}

function progressType(tool: string) {
  if (tool === 'trace_paths' || tool === 'build_topology' || tool === 'build_world_slice') {
    return 'topology_resolved' as const;
  }
  if (tool === 'ground_semantic_entities' || tool === 'refine_semantic_entity') {
    return 'grounding' as const;
  }
  if (tool === 'render_drawing' || tool === 'query_nodes' || tool === 'inspect_nodes'
    || tool === 'inspect_world_slice' || tool === 'propose_spatial_actions') {
    return 'region_overlay' as const;
  }
  if (tool === 'materialize_split') return 'split_materialized' as const;
  if (tool === 'revise_preview') return 'revising' as const;
  if (tool === 'preview_spatial_program'
    || tool === 'preview_transaction'
    || tool === 'preview_connected_transform') {
    return 'previewing' as const;
  }
  if (tool === 'preview_vectorization_batch') return 'previewing' as const;
  if (tool === 'evaluate_preview') return 'verifying' as const;
  if (tool === 'redraw_region') return 'generating' as const;
  if (tool === 'vectorize_image' || tool === 'fit_geometry') return 'vectorizing' as const;
  return 'tool_finished' as const;
}

function toolOverlay(tool: string, result: ModelToolResult) {
  const output = asRecord(result.output);
  const interactionFrame = spatialInteractionFrame(output?.interactionFrame);
  if (interactionFrame) return interactionFrame;
  if (tool === 'trace_paths' && Array.isArray(output?.candidates)) {
    return {
      kind: 'paths' as const,
      role: 'candidate' as const,
      paths: output.candidates.slice(0, 8).flatMap((value, index) => {
        const candidate = asRecord(value);
        return candidate && Array.isArray(candidate.nodeIds)
          ? [{ id: `path_${index + 1}`, nodeIds: candidate.nodeIds.filter(isString) }]
          : [];
      }),
    };
  }
  if ((tool === 'preview_spatial_program'
    || tool === 'preview_transaction'
    || tool === 'revise_preview'
    || tool === 'preview_connected_transform'
    || tool === 'preview_vectorization_batch')
    && typeof output?.previewHandle === 'string') {
    return {
      kind: 'preview' as const,
      previewHandle: output.previewHandle,
      affectedNodeIds: result.receipt.affectedNodeIds,
    };
  }
  if (result.receipt.affectedNodeIds.length > 0) {
    return {
      kind: 'nodes' as const,
      nodeIds: result.receipt.affectedNodeIds,
      role: tool === 'render_drawing' ? 'observed' as const : 'considered' as const,
    };
  }
  return undefined;
}

function spatialInteractionFrame(
  value: unknown,
): Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }> | undefined {
  const frame = asRecord(value);
  if (frame?.kind !== 'spatial'
    || !['observing', 'grounding', 'planning', 'previewing', 'verifying'].includes(String(frame.phase))
    || !Array.isArray(frame.strokes)
    || !Array.isArray(frame.markers)
    || !Array.isArray(frame.vectors)) return undefined;
  return structuredClone(value) as Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }>;
}

function previewDelta(
  record: RunRecord,
  tool: string,
  output: Record<string, unknown> | null,
): PerceptionPreviewDelta | undefined {
  if (tool !== 'preview_spatial_program'
    && tool !== 'preview_transaction'
    && tool !== 'revise_preview'
    && tool !== 'preview_connected_transform'
    && tool !== 'preview_vectorization_batch'
    && tool !== 'evaluate_preview') return undefined;
  const raw = asRecord(output?.previewDelta);
  if (!raw || !Array.isArray(raw.upserts) || !Array.isArray(raw.removeIds)) return undefined;
  const upserts = raw.upserts.filter((node): node is PerceptionPreviewDelta['upserts'][number] => {
    const value = asRecord(node);
    return typeof value?.id === 'string' && typeof value.type === 'string';
  });
  const previewHandle = typeof output?.previewHandle === 'string'
    ? output.previewHandle
    : record.state.currentPreviewHandle ?? 'preview';
  if (record.streamedPreviewHandles.has(previewHandle)) return undefined;
  record.streamedPreviewHandles.add(previewHandle);
  return {
    runId: record.state.runId,
    sequence: ++record.previewSequence,
    action: record.previewSequence === 1 ? 'preview' : 'revise',
    slotIds: upserts.map((node) => node.id),
    upserts: structuredClone(upserts),
    removeIds: raw.removeIds.filter(isString),
    hideCommittedIds: unique([
      ...upserts.map((node) => node.id),
      ...raw.removeIds.filter(isString),
    ]),
    source: {
      page: record.input.source?.page ?? 1,
      viewId: previewHandle,
      stage: tool === 'preview_vectorization_batch' ? 'outline' : 'edit-preview',
    },
  };
}

function observationsFromToolResults(
  results: ModelToolResult[],
  readImage: (handle: string) => string | null,
  currentPreviewHandle: string | null,
): ModelLoopObservation[] {
  const latestCommitted = new Map<string, ModelLoopObservation>();
  let currentPreview: ModelLoopObservation | null = null;
  for (const result of [...results].reverse()) {
    const output = asRecord(result.output);
    const observation = output?.observation ? asRecord(output.observation) : output;
    if (!observation || !Array.isArray(observation.views)) continue;
    const previewHandle = isString(output?.previewHandle) ? output.previewHandle : null;
    if (previewHandle && previewHandle !== currentPreviewHandle) continue;
    const parsedViews: Array<{ rawPurpose: string; value: ModelLoopObservation }> = [];
    for (const rawView of observation.views) {
      const view = asRecord(rawView);
      const image = asRecord(view?.image);
      if (!view || !image || !isString(image.handle)
        || !isString(view.id) || !isString(view.purpose)
        || !isFiniteNumber(view.width) || !isFiniteNumber(view.height)
        || !Array.isArray(view.worldToImage)) continue;
      const imageDataUrl = readImage(image.handle);
      if (!imageDataUrl) continue;
      parsedViews.push({ rawPurpose: view.purpose, value: {
        id: view.id,
        purpose: previewPurpose(view.purpose, Boolean(previewHandle)),
        imageDataUrl,
        width: view.width,
        height: view.height,
        worldBounds: view.worldBounds as ModelLoopObservation['worldBounds'],
        worldToImage: view.worldToImage as unknown as ModelLoopObservation['worldToImage'],
        grounding: Array.isArray(view.grounding)
          ? view.grounding as ModelLoopObservation['grounding']
          : [],
      } });
    }
    if (previewHandle) {
      currentPreview ??= preferredObservation(parsedViews);
      continue;
    }
    for (const parsed of parsedViews) {
      if (!latestCommitted.has(parsed.rawPurpose)) {
        latestCommitted.set(parsed.rawPurpose, parsed.value);
      }
    }
  }
  return [
    ...latestCommitted.values(),
    ...(currentPreview ? [currentPreview] : []),
  ].slice(-3);
}

function preferredObservation(
  views: Array<{ rawPurpose: string; value: ModelLoopObservation }>,
): ModelLoopObservation | null {
  return views.find((item) => item.rawPurpose === 'target-detail')?.value
    ?? views.find((item) => item.rawPurpose === 'user-viewport')?.value
    ?? views.find((item) => item.rawPurpose === 'overview')?.value
    ?? views[0]?.value
    ?? null;
}

function mergeObservations(
  initial: ModelLoopObservation[],
  recent: ModelLoopObservation[],
): ModelLoopObservation[] {
  const merged = new Map(initial.map((observation) => [observation.id, observation]));
  for (const observation of recent) merged.set(observation.id, observation);
  return [...merged.values()].slice(-6);
}

function previewPurpose(
  purpose: string,
  preview: boolean,
): ModelLoopObservation['purpose'] {
  if (preview) return 'preview';
  if (purpose === 'target-detail') return 'target-detail';
  if (purpose === 'user-viewport') return 'user-viewport';
  return 'overview';
}

function parseDiagnostics(value: unknown[]): Array<Pick<
  DrawingDiagnostic, 'code' | 'severity' | 'nodeIds'
> & {
  message?: string;
  action?: string;
  facts?: Record<string, unknown>;
}> {
  return value.flatMap((item) => {
    const entry = asRecord(item);
    if (!entry || !isString(entry.code) || !isString(entry.severity)
      || !Array.isArray(entry.nodeIds)) return [];
    if (!['info', 'warning', 'candidate', 'decision_required'].includes(entry.severity)) return [];
    return [{
      code: entry.code,
      severity: entry.severity as DrawingDiagnostic['severity'],
      nodeIds: entry.nodeIds.filter(isString),
      ...(isString(entry.message) ? { message: entry.message } : {}),
      ...(isString(entry.action) ? { action: entry.action } : {}),
      ...(asRecord(entry.facts) ? { facts: entry.facts as Record<string, unknown> } : {}),
    }];
  });
}

function parseDiagnosticsFromOutput(output: Record<string, unknown>): DrawingDiagnostic[] {
  if (!Array.isArray(output.diagnostics)) return [];
  return output.diagnostics.flatMap((item) => {
    const entry = asRecord(item);
    if (!entry || !isString(entry.code) || !isString(entry.severity)
      || !isString(entry.message) || !Array.isArray(entry.nodeIds)
      || !['info', 'warning', 'candidate', 'decision_required'].includes(entry.severity)) {
      return [];
    }
    return [{
      code: entry.code,
      severity: entry.severity as DrawingDiagnostic['severity'],
      message: entry.message,
      nodeIds: entry.nodeIds.filter(isString),
      ...(isString(entry.action) ? { action: entry.action } : {}),
      ...(asRecord(entry.facts) ? { facts: entry.facts as Record<string, unknown> } : {}),
    }];
  });
}

function permissionRequest(
  record: RunRecord,
  candidate: NonNullable<ReturnType<DrawingModelTools['readCandidate']>>,
  requirements: Array<{ action: string; resourceId: string; reasonCode: string }>,
): HumanDecisionRequest {
  const actions = unique(requirements.map((item) => item.action));
  const resourceIds = unique(requirements.map((item) => item.resourceId));
  return {
    id: `decision_${randomUUID()}`,
    episodeId: record.state.episodeId,
    revision: record.state.revision,
    candidateId: candidate.previewHandle,
    transactionDigest: digestDrawingTransaction(candidate.transaction),
    kind: 'grant-permission',
    question: '是否允许当前候选修改受保护内容？',
    reason: '当前增量事务需要一次性权限，授权只对这个 revision 和候选生效。',
    options: [{
      id: 'allow_once',
      label: '仅允许本次',
      description: '只对当前候选事务生效',
      effect: {
        type: 'permission', decision: 'allow', actions, resourceIds,
      },
    }, {
      id: 'deny',
      label: '不允许',
      description: '保留受保护内容，让 AI 重新规划',
      effect: {
        type: 'permission', decision: 'deny', actions, resourceIds,
      },
    }],
    recommendedOptionId: 'allow_once',
    affectedResources: requirements.map((item) => ({
      plane: 'relation' as const,
      ids: [item.resourceId],
      action: item.action,
    })),
    previewHandle: candidate.previewHandle,
    expiresWhenRevisionChanges: true,
  };
}

function decisionGrants(
  request: HumanDecisionRequest,
  effect: HumanDecisionRequest['options'][number]['effect'],
  idFactory: () => string,
): PermissionGrant[] {
  if (effect?.type !== 'permission' || !request.transactionDigest) return [];
  return [{
    id: idFactory(),
    requestId: request.id,
    episodeId: request.episodeId,
    revision: request.revision,
    transactionDigest: request.transactionDigest,
    actions: [...effect.actions],
    resourceIds: [...effect.resourceIds],
    effect: effect.decision,
    scope: 'candidate',
  }];
}

function auditSafeAction(action: DrawingAgentAction): Record<string, unknown> {
  if (action.type !== 'tool') return structuredClone(action) as unknown as Record<string, unknown>;
  return {
    type: action.type,
    toolCallId: action.toolCallId,
    tool: action.tool,
    inputDigest: digest(action.input),
  };
}

function spatialProgramAuditExecution(value: unknown): Record<string, unknown> | undefined {
  const output = asRecord(value);
  const program = asRecord(output?.spatialProgram);
  if (!output || !program || !isString(output.previewHandle)) return undefined;
  const operationReceipts = Array.isArray(output.operationReceipts)
    ? output.operationReceipts.flatMap((raw) => {
      const receipt = asRecord(raw);
      if (!receipt) return [];
      return [{
        operationIndex: receipt.operationIndex,
        kind: receipt.kind,
        affectedNodeIds: receipt.affectedNodeIds,
        resolvedPoints: receipt.resolvedPoints,
      }];
    })
    : [];
  return {
    previewHandle: output.previewHandle,
    program: structuredClone(program),
    operationReceipts: structuredClone(operationReceipts),
    programDiagnostics: structuredClone(output.programDiagnostics ?? []),
    editBase: structuredClone(output.editBase ?? null),
  };
}

function auditSafeDecision(request: HumanDecisionRequest): Record<string, unknown> {
  return {
    id: request.id,
    kind: request.kind,
    revision: request.revision,
    candidateId: request.candidateId,
    transactionDigest: request.transactionDigest,
    affectedResources: request.affectedResources,
  };
}

function safeModelReply(reply: string): string {
  return reply.length <= 20_000 ? reply : `${reply.slice(0, 20_000)}…`;
}

function safeModelError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(?:Bearer\s+|api[_-]?key[=:]\s*)[^\s]+/gi, '[redacted]').slice(0, 500);
}

function isRepairablePreviewVerificationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const path = (error as Error & { path?: unknown }).path;
  return typeof path === 'string'
    || error.message === 'PREVIEW_VERIFICATION_JSON_INVALID';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
