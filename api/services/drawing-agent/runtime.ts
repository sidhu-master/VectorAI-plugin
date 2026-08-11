import {
  DrawingAgentProtocolError,
  type AgentDecision,
  type DrawingAgentPlan,
} from '../../../src/contracts/drawing-agent.js';
import sharp from 'sharp';
import {
  DrawingSpatialRegionProtocolError,
  type FragmentAuthorization,
  type SemanticRegion,
  type SpatialEditStrategy,
  type SpatialSelection,
  type TargetHint,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  Bounds2D,
  DrawingDocument,
  GeometryNode,
  PerceptionPreviewDelta,
  PerceptionPreviewNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';
import type { GroundingSnapshot } from '../drawing-vision/grounding-renderer.js';
import type {
  DrawingFragmentSelectionModelAdapter,
  DrawingSemanticRegionModelAdapter,
  DrawingSpatialDesignModelAdapter,
} from './semantic-adapters.js';
import { buildSemanticRegion } from '../drawing-spatial/semantic-region.js';
import { RegionMediaStore } from '../drawing-spatial/region-media-store.js';
import { buildAtomicGeometryGraph } from '../drawing-spatial/atomic-graph.js';
import { RegionResolver } from '../drawing-spatial/region-resolver.js';
import {
  authorizeSelection,
  buildSelectionCandidateSet,
  renderSelectionProofView,
} from '../drawing-spatial/selection-authorization.js';
import {
  assessSearchEnvelope,
  localityBudgetFor,
} from '../drawing-spatial/locality-guard.js';
import {
  materializeSpatialSplits,
  type MaterializedSplit,
} from '../drawing-spatial/split-materializer.js';
import { routeSpatialEditStrategy } from '../drawing-spatial/strategy-router.js';
import {
  compileSpatialEdit,
  type CompiledSpatialEditCandidate,
  type SpatialEditDesign,
} from '../drawing-spatial/spatial-edit-compiler.js';
import { validateSpatialEditPreview } from '../drawing-spatial/spatial-validator.js';
import { validateGenerativeGeometry } from '../drawing-spatial/generative-validator.js';
import { roughGeometryBounds } from '../drawing-spatial/geometry-sampling.js';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service.js';
import { buildEpisodeModelContext } from '../drawing-episode/context-builder.js';
import type { EditEpisodeStore } from '../drawing-episode/file-episode-store.js';
import type { EditEpisode } from '../drawing-episode/types.js';
import type {
  DrawingPerceptionInput,
  DrawingPerceptionOutput,
} from '../drawing-perception/pipeline.js';
import type { SourceArtifactStore } from '../source-artifacts/types.js';
import type {
  DrawingFeedbackCheckpoint,
  DrawingFeedbackOutput,
  DrawingFeedbackRunInput,
} from '../drawing-feedback/loop-controller.js';
import type { DrawingFeedbackCheckpointStore } from '../drawing-feedback/checkpoint-store.js';
import { feedbackPreviewNodeId } from '../drawing-feedback/preview-projector.js';
import {
  interpretDrawingInput,
  type DrawingInputMode,
} from './input-interpreter.js';
import { RunProgressChannel } from './progress.js';
import type {
  DrawingAgentAuditEvent,
  DrawingAgentAuditStore,
} from './audit-types.js';
import { DRAWING_AGENT_PROMPT_HASHES } from './model-adapters.js';
import {
  checkDrawingAgentBudget,
  createDrawingAgentState,
  reduceDrawingAgentState,
  type DrawingAgentEvent,
  type DrawingAgentLimits,
  type DrawingAgentSafePoint,
  type DrawingAgentState,
} from './state.js';
import type { DrawingToolRegistry } from './tool-registry.js';
import type {
  DrawingAcceptanceModelAdapter,
  DrawingDecisionModelAdapter,
  DrawingPlannerModelAdapter,
  DrawingPreviewVerificationModelAdapter,
  DrawingToolContext,
  DrawingToolEvidence,
  DrawingToolExecution,
  DrawingToolInvocation,
  DrawingVisionContext,
  DrawingModelRole,
  PreparedDrawingTransaction,
  StartDrawingAgentRunInput,
} from './types.js';

interface RuntimeLimitsInput {
  maxDecisions: number;
  maxCommits: number;
  maxConsecutiveReads: number;
  wallClockMs: number;
  maxPerceptionCommits: number;
}

type RuntimeApplication = Pick<DrawingApplication, 'summarize' | 'renderForVision'>
  & Partial<Pick<
    DrawingApplication,
    'open' | 'observeForAgent' | 'observePreviewForAgent' | 'readObservationImage'
  >>;

interface RuntimeTools {
  invoke(input: DrawingToolInvocation): Promise<DrawingToolExecution>;
  discardPrepared(handle: string): boolean;
  discardRun(runId: string): number;
  supersedePrepared?(handle: string): boolean;
}

interface RuntimePerception {
  run(input: DrawingPerceptionInput): AsyncIterable<DrawingPerceptionOutput>;
}

interface RuntimeFeedbackLoop {
  run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput>;
}

interface RunRecord {
  state: DrawingAgentState;
  progress: RunProgressChannel;
  completion: Promise<DrawingAgentState>;
  resolveCompletion: (state: DrawingAgentState) => void;
  resolved: boolean;
  driving: boolean;
  activeController: AbortController | null;
  modelProfile: StartDrawingAgentRunInput['modelProfile'];
  toolEvidence: DrawingToolEvidence[];
  prepared: PreparedDrawingTransaction | null;
  sequence: number;
  auditSequence: number;
  auditQueue: Promise<void>;
  selectedIds: string[];
  stableRules: string[];
  source: StartDrawingAgentRunInput['source'];
  viewport: StartDrawingAgentRunInput['viewport'];
  vision: DrawingVisionContext | null;
  visionRevision: string | null;
  inputMode: DrawingInputMode;
  planningObjective: string;
  perceptionCompleted: boolean;
  commitBaseline: number;
  planCommitBaseline: number;
  perceptionBatchIds: Set<string>;
  perceptionEntityCount: number;
  perceptionLowConfidenceCount: number;
  perceptionCoverageComplete: boolean;
  perceptionIncompleteRegionCount: number;
  perceptionUnresolvedContourCount: number;
  perceptionPreviewIds: Set<string>;
  perceptionPreviewNodes: Map<string, PerceptionPreviewNode>;
  perceptionPreviewSequence: number;
  feedbackCheckpoint: DrawingFeedbackCheckpoint | null;
  previewDefects: import('./types.js').DrawingPreviewDefect[];
  compiledEdit: CompiledSpatialEditCandidate | null;
  spatialPreview: {
    episodeId: string;
    previewVersionId: string;
    selectionVersionId: string;
    region: SemanticRegion;
    selection: SpatialSelection;
    strategy: SpatialEditStrategy;
    tolerance: number;
  } | null;
  spatialPreviewSequence: number;
  episode: EditEpisode | null;
  episodeQueue: Promise<void>;
  editPreviewIds: Set<string>;
  editHiddenIds: Set<string>;
  spatialRepairContext: SpatialRepairContext | null;
  spatialCandidateAttempt: number;
}

interface SpatialRepairContext {
  revision: RevisionId;
  observation: NonNullable<DrawingVisionContext['observation']>;
  document: DrawingDocument;
  episodeId: string;
  proposalViewId: string;
  region: SemanticRegion;
  selection: SpatialSelection;
  authorization: FragmentAuthorization;
  split: MaterializedSplit;
  strategy: SpatialEditStrategy;
  targetGeometry: GeometryNode[];
  regionVersion: number;
  selectionVersion: number;
  selectionVersionId: string;
  tolerance: number;
}

export interface DrawingAgentRunHandle {
  runId: string;
  completion: Promise<DrawingAgentState>;
}

export interface DrawingAgentRuntimeOptions {
  application: RuntimeApplication;
  tools: Pick<DrawingToolRegistry, 'invoke' | 'discardPrepared' | 'discardRun'>
    & Partial<Pick<DrawingToolRegistry, 'supersedePrepared'>>;
  planner: DrawingPlannerModelAdapter;
  decision: DrawingDecisionModelAdapter;
  now?: () => number;
  stageTimeoutMs?: number;
  limits?: Partial<RuntimeLimitsInput>;
  idFactory?: unknown;
  auditStore?: DrawingAgentAuditStore;
  acceptance?: DrawingAcceptanceModelAdapter;
  previewVerifier?: DrawingPreviewVerificationModelAdapter;
  regionProposer?: DrawingSemanticRegionModelAdapter;
  fragmentSelector?: DrawingFragmentSelectionModelAdapter;
  spatialDesigner?: DrawingSpatialDesignModelAdapter;
  regionMediaStore?: RegionMediaStore;
  episodeStore?: EditEpisodeStore;
  redrawService?: Pick<DrawingRegionRedrawService, 'redraw'>;
  promptHashes?: { planner: string; decision: string };
  sourceArtifacts?: SourceArtifactStore;
  perception?: RuntimePerception;
  visionModelName?: string;
  visionRepairModelName?: string;
  feedbackLoop?: RuntimeFeedbackLoop;
  feedbackCheckpointStore?: DrawingFeedbackCheckpointStore;
}

const DEFAULT_LIMITS: RuntimeLimitsInput = {
  maxDecisions: 40,
  maxCommits: 8,
  maxConsecutiveReads: 8,
  wallClockMs: 360_000,
  maxPerceptionCommits: 128,
};
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const MAX_VALIDATION_REPAIRS = 2;
/** planner 输出坏 JSON 时的 schema 纠错重试次数(最后一次用更高配的 repair 模型) */
const MAX_PLANNER_SCHEMA_CORRECTIONS = 3;

export class DrawingAgentRuntime {
  readonly #application: RuntimeApplication;
  readonly #tools: RuntimeTools;
  readonly #planner: DrawingPlannerModelAdapter;
  readonly #decision: DrawingDecisionModelAdapter;
  readonly #now: () => number;
  readonly #stageTimeoutMs: number;
  readonly #limits: RuntimeLimitsInput;
  readonly #runs = new Map<string, RunRecord>();
  readonly #auditStore?: DrawingAgentAuditStore;
  readonly #acceptance?: DrawingAcceptanceModelAdapter;
  readonly #previewVerifier?: DrawingPreviewVerificationModelAdapter;
  readonly #regionProposer?: DrawingSemanticRegionModelAdapter;
  readonly #fragmentSelector?: DrawingFragmentSelectionModelAdapter;
  readonly #spatialDesigner?: DrawingSpatialDesignModelAdapter;
  readonly #regionMediaStore: RegionMediaStore;
  readonly #episodeStore?: EditEpisodeStore;
  readonly #redrawService?: Pick<DrawingRegionRedrawService, 'redraw'>;
  readonly #promptHashes: { planner: string; decision: string };
  readonly #sourceArtifacts?: SourceArtifactStore;
  readonly #perception?: RuntimePerception;
  readonly #visionModelName: string;
  readonly #visionRepairModelName: string;
  readonly #feedbackLoop?: RuntimeFeedbackLoop;
  readonly #feedbackCheckpointStore?: DrawingFeedbackCheckpointStore;

  constructor(options: DrawingAgentRuntimeOptions) {
    this.#application = options.application;
    this.#tools = options.tools;
    this.#planner = options.planner;
    this.#decision = options.decision;
    this.#now = options.now ?? Date.now;
    this.#stageTimeoutMs = options.stageTimeoutMs ?? 120_000;
    this.#limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.#auditStore = options.auditStore;
    this.#acceptance = options.acceptance;
    this.#previewVerifier = options.previewVerifier;
    this.#regionProposer = options.regionProposer;
    this.#fragmentSelector = options.fragmentSelector;
    this.#spatialDesigner = options.spatialDesigner;
    this.#regionMediaStore = options.regionMediaStore ?? new RegionMediaStore();
    this.#episodeStore = options.episodeStore;
    this.#redrawService = options.redrawService;
    this.#promptHashes = options.promptHashes ?? DRAWING_AGENT_PROMPT_HASHES;
    this.#sourceArtifacts = options.sourceArtifacts;
    this.#perception = options.perception;
    this.#visionModelName = options.visionModelName ?? 'doubao-seed-2.0-lite';
    this.#visionRepairModelName = options.visionRepairModelName ?? 'doubao-seed-2.1-turbo';
    this.#feedbackLoop = options.feedbackLoop;
    this.#feedbackCheckpointStore = options.feedbackCheckpointStore;
  }

  start(input: StartDrawingAgentRunInput): DrawingAgentRunHandle {
    if (this.#runs.has(input.runId)) throw new Error(`Agent run already exists: ${input.runId}`);
    const createdAt = this.#now();
    let resolveCompletion!: (state: DrawingAgentState) => void;
    const completion = new Promise<DrawingAgentState>((resolve) => {
      resolveCompletion = resolve;
    });
    const limits: DrawingAgentLimits = {
      maxDecisions: this.#limits.maxDecisions,
      maxCommits: this.#limits.maxCommits,
      maxConsecutiveReads: this.#limits.maxConsecutiveReads,
      deadlineAt: createdAt + this.#limits.wallClockMs,
    };
    const progress = new RunProgressChannel(input.runId, createdAt, 25_000, this.#now);
    const interpretation = interpretDrawingInput({
      goal: input.goal,
      hasSource: Boolean(input.source),
    });
    const record: RunRecord = {
      state: createDrawingAgentState({
        runId: input.runId,
        drawingId: input.drawingId,
        revision: input.baseRevision,
        objective: input.goal,
        createdAt,
        limits,
      }),
      progress,
      completion,
      resolveCompletion,
      resolved: false,
      driving: false,
      activeController: null,
      modelProfile: { ...input.modelProfile },
      toolEvidence: [],
      prepared: null,
      sequence: 0,
      auditSequence: 0,
      auditQueue: Promise.resolve(),
      selectedIds: [...(input.selectedIds ?? [])],
      stableRules: [...(input.stableRules ?? [])],
      source: input.source ? structuredClone(input.source) : undefined,
      viewport: input.viewport ? { ...input.viewport } : undefined,
      vision: null,
      visionRevision: null,
      inputMode: interpretation.mode,
      planningObjective: interpretation.modificationGoal ?? input.goal.trim(),
      perceptionCompleted: !input.source,
      commitBaseline: 0,
      planCommitBaseline: 0,
      perceptionBatchIds: new Set(),
      perceptionEntityCount: 0,
      perceptionLowConfidenceCount: 0,
      perceptionCoverageComplete: true,
      perceptionIncompleteRegionCount: 0,
      perceptionUnresolvedContourCount: 0,
      perceptionPreviewIds: new Set(),
      perceptionPreviewNodes: new Map(),
      perceptionPreviewSequence: 0,
      feedbackCheckpoint: null,
      previewDefects: [],
      compiledEdit: null,
      spatialPreview: null,
      spatialPreviewSequence: 0,
      episode: null,
      episodeQueue: Promise.resolve(),
      editPreviewIds: new Set(),
      editHiddenIds: new Set(),
      spatialRepairContext: null,
      spatialCandidateAttempt: 0,
    };
    this.#runs.set(input.runId, record);
    this.#enqueueAudit(record, () => this.#auditStore!.startRun({
      schemaVersion: 1,
      runId: input.runId,
      drawingId: input.drawingId,
      baseRevision: input.baseRevision,
      startedAt: createdAt,
      drawingProtocolVersion: '1.0',
      commandSchemaVersion: '1.0.0',
      toolSchemaVersion: '1.0.0',
      promptHashes: { ...this.#promptHashes },
      modelProfile: { ...input.modelProfile },
      goalSpec: null,
    }));
    this.#audit(record, 'state', { status: 'planning', revision: input.baseRevision });
    if (input.source) {
      this.#audit(record, 'perception', {
        source: structuredClone(input.source),
        mode: interpretation.mode,
      });
    }
    progress.publish('accepted', '任务已受理');
    void Promise.resolve().then(() => this.#drive(record));
    return { runId: input.runId, completion };
  }

  getState(runId: string): DrawingAgentState | undefined {
    return this.#runs.get(runId)?.state;
  }

  getProgress(runId: string): RunProgressChannel | undefined {
    return this.#runs.get(runId)?.progress;
  }

  async flushAudit(runId: string): Promise<void> {
    const record = this.#require(runId);
    await Promise.all([record.auditQueue, record.episodeQueue]);
  }

  pause(runId: string): DrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'PAUSE_REQUESTED' });
    return record.state;
  }

  resume(runId: string): DrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'RESUME' });
    record.progress.publish('resumed', '任务已继续');
    void Promise.resolve().then(() => this.#drive(record));
    return record.state;
  }

  addInstruction(runId: string, instruction: string): DrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'INSTRUCTION_ADDED', instruction });
    this.#resetSpatialRepair(record);
    this.#audit(record, 'instruction', { instruction: instruction.trim() });
    if (record.episode) {
      const activePreview = record.episode.previewVersions.find((version) => (
        version.status === 'active'
      ));
      if (activePreview) activePreview.status = 'superseded';
      record.episode.feedbackTurns.push({
        id: `feedback_${record.episode.feedbackTurns.length + 1}`,
        text: instruction.trim(),
        receivedAt: this.#now(),
        ...(activePreview ? { againstPreviewVersion: activePreview.version } : {}),
      });
      record.episode.updatedAt = this.#now();
      if (record.prepared) {
        this.#tools.supersedePrepared?.(record.prepared.handle);
        record.prepared = null;
        record.compiledEdit = null;
        record.spatialPreview = null;
      }
      this.#persistEpisode(record);
      record.progress.publish('revising', '已收到新反馈，正在更新当前预览');
    }
    return record.state;
  }

  stop(runId: string): DrawingAgentState {
    const record = this.#require(runId);
    this.#transition(record, { type: 'STOP_REQUESTED' });
    record.activeController?.abort(new Error('Agent run stopped'));
    if (record.state.status === 'stopped') this.#finish(record, 'stopped', '任务已停止');
    return record.state;
  }

  async #drive(record: RunRecord): Promise<void> {
    if (record.driving || isTerminal(record.state)) return;
    record.driving = true;
    try {
      if (!await this.#safePoint(record, 'before_model')) return;
      if (record.source && this.#feedbackLoop) {
        await this.#runFeedback(record);
        return;
      }
      if (!record.perceptionCompleted) {
        if (!await this.#runPerception(record)) return;
      }
      if (record.state.needsReplan || !record.state.plan || record.state.status === 'planning') {
        if (record.inputMode === 'analyze_only' || record.inputMode === 'reconstruct') {
          this.#installPlan(record, perceptionCompletionPlan(record));
        } else if (!await this.#plan(record)) return;
      }
      if (record.prepared) {
        if (!await this.#resumePrepared(record)) return;
      }
      while (record.state.status === 'running') {
        if (record.state.needsReplan) {
          if (!await this.#plan(record)) return;
          continue;
        }
        if (record.state.currentWorkflowNodeId) {
          if (!await this.#runWorkflowNode(record, record.state.currentWorkflowNodeId)) return;
          continue;
        }
        const pending = nextWorkflowNode(record.state);
        if (!pending) {
          if (!record.state.plan?.workflow.every((node) => node.status === 'completed')) {
            throw new Error('工作流依赖无法继续');
          }
          if (!await this.#verifyGoal(record)) {
            // 视觉验收未满足且任务仍在运行 → 重新规划再改;受决策预算约束,避免死循环
            if (record.state.status !== 'running') return;
            this.#transition(record, { type: 'REPLAN_REQUIRED', revision: record.state.revision });
            continue;
          }
          this.#transition(record, { type: 'COMPLETED' });
          this.#finish(record, 'completed', '任务已完成');
          return;
        }
        this.#transition(record, { type: 'WORKFLOW_NODE_STARTED', nodeId: pending.id });
        if (!await this.#runWorkflowNode(record, pending.id)) return;
      }
    } catch (error) {
      if (record.state.status === 'stopping' || isAbort(error)) {
        this.#transition(record, { type: 'SAFE_POINT', point: 'before_model' });
        this.#finish(record, 'stopped', '任务已停止');
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.#transition(record, { type: 'FAILED', error: message });
        this.#finish(record, 'failed', '任务执行失败');
      }
    } finally {
      record.driving = false;
    }
  }

  async #runFeedback(record: RunRecord): Promise<void> {
    if (!record.source || !this.#feedbackLoop) throw new Error('来源反馈循环未配置');
    if (!record.state.plan) this.#installPlan(record, feedbackLoopPlan(record));
    if (!record.feedbackCheckpoint && this.#feedbackCheckpointStore) {
      record.feedbackCheckpoint = await this.#feedbackCheckpointStore.read(record.state.runId) ?? null;
    }
    const controller = new AbortController();
    record.activeController = controller;
    try {
      const outputs = this.#feedbackLoop.run({
        runId: record.state.runId,
        sourceId: record.source.sourceId,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        goal: record.planningObjective || '将来源图纸重建为 Drawing IR',
        modelProfile: { ...record.modelProfile },
        signal: controller.signal,
        ...(record.feedbackCheckpoint ? {
          checkpoint: structuredClone(record.feedbackCheckpoint),
        } : {}),
        shouldPause: () => record.state.status === 'pause_requested',
        readInstructions: () => [
          ...record.state.activeInstructions,
          ...record.state.pendingInstructions,
        ],
      });
      for await (const output of outputs) {
        if (output.kind === 'state') {
          const [type, title] = feedbackStageProgress(output.stage);
          record.progress.publish(type, title);
          continue;
        }
        if (output.kind === 'audit') {
          this.#audit(record, output.type, structuredClone(output.payload));
          continue;
        }
        if (output.kind === 'decision') {
          this.#audit(record, 'decision', structuredClone(output.decision));
          continue;
        }
        if (output.kind === 'controller_feedback') {
          record.progress.publish(
            'validation',
            '正在调整下一步提案',
            output.message,
          );
          this.#audit(record, 'validation', {
            event: 'FEEDBACK_CONTROLLER_REJECTION',
            message: output.message,
          });
          continue;
        }
        if (output.kind === 'protocol_retry') {
          record.progress.publish(
            'validation',
            `正在修正模型输出格式（${output.attempt}/${output.maxAttempts}）`,
            output.message,
          );
          this.#audit(record, 'decision', {
            event: 'FEEDBACK_PROTOCOL_RETRY',
            attempt: output.attempt,
            maxAttempts: output.maxAttempts,
            message: output.message,
          });
          continue;
        }
        if (output.kind === 'tool') {
          record.progress.publish(
            output.execution.receipt.status === 'succeeded' ? 'tool_finished' : 'validation',
            output.execution.receipt.status === 'succeeded' ? '局部证据已返回' : '局部证据调用未完成',
          );
          this.#audit(record, 'cv_tool', {
            receipt: structuredClone(output.execution.receipt),
          });
          continue;
        }
        if (output.kind === 'drawing_tool') {
          this.#recordTool(record, output.execution);
          record.progress.publish(
            output.execution.receipt.status === 'succeeded' ? 'validation' : 'tool_finished',
            output.execution.receipt.status === 'succeeded'
              ? '单对象事务预览已生成'
              : '单对象事务预览需要修正',
          );
          continue;
        }
        if (output.kind === 'inventory') {
          record.progress.publish('tool_finished', `已建立 ${output.candidateCount} 个候选槽位`);
          continue;
        }
        if (output.kind === 'proposal') {
          const nextIds = new Set<string>(output.nodes.map((node) => node.id));
          const removeIds = [...record.perceptionPreviewIds]
            .filter((id) => id.startsWith('feedback_preview_') && !nextIds.has(id));
          this.#publishPerceptionDelta(record, {
            runId: record.state.runId,
            sequence: 0,
            action: 'observe',
            slotIds: [output.slotId],
            upserts: structuredClone(output.nodes),
            removeIds,
            labelsByNodeId: { ...output.labelsByNodeId },
            source: {
              page: record.source.page,
              viewId: 'page',
              ...(output.regionId ? { regionId: output.regionId } : {}),
              stage: 'outline',
            },
          }, 'primary');
          continue;
        }
        if (output.kind === 'residual') {
          record.progress.publish(
            'validation',
            output.accepted ? '局部误差下降' : '该区域尚未收敛',
            `边缘 F1 ${(output.report.geometry.edgeF1 * 100).toFixed(1)}%`,
          );
          continue;
        }
        if (output.kind === 'commit') {
          this.#removeFeedbackPreviews(record, output.slotIds, 'promote');
          this.#recordTool(record, output.execution);
          record.progress.publish('commit', '已提交一个局部图纸修改');
          continue;
        }
        if (output.kind === 'correction') {
          if (output.action === 'reject') {
            this.#markFeedbackPreviewsRejected(record, output.slotIds);
          }
          record.progress.publish('validation', feedbackCorrectionTitle(output.action));
          continue;
        }
        if (output.kind === 'checkpoint') {
          record.feedbackCheckpoint = structuredClone(output.checkpoint);
          await this.#feedbackCheckpointStore?.save(output.checkpoint);
          this.#audit(record, 'state', {
            event: 'FEEDBACK_CHECKPOINT',
            iteration: output.checkpoint.iteration,
            revision: output.checkpoint.revision,
            unresolvedRequired: output.checkpoint.unresolvedRequired,
          });
          continue;
        }
        if (output.kind === 'paused') {
          record.feedbackCheckpoint = structuredClone(output.checkpoint);
          await this.#feedbackCheckpointStore?.save(output.checkpoint);
          this.#transition(record, { type: 'SAFE_POINT', point: 'before_model' });
          record.progress.publish('paused', '任务已暂停');
          return;
        }
        if (output.kind === 'slot_paused') {
          this.#audit(record, 'validation', {
            event: 'FEEDBACK_SLOT_DEFERRED',
            slotId: output.slotId,
            reason: output.reason,
          });
          record.progress.publish('validation', '一个对象已暂缓，继续处理其他对象');
          continue;
        }
        if (output.kind === 'completed') {
          this.#transition(record, { type: 'ANALYSIS_READY', summary: output.summary });
          this.#transition(record, { type: 'COMPLETED' });
          this.#finish(record, 'completed', '任务已完成');
          return;
        }
        if (output.kind === 'stopped') {
          this.#transition(record, { type: 'SAFE_POINT', point: 'before_model' });
          this.#finish(record, 'stopped', '任务已停止');
          return;
        }
        if (output.kind === 'failed') {
          this.#transition(record, { type: 'FAILED', error: output.message });
          this.#finish(record, 'failed', '任务执行失败');
          return;
        }
      }
      if (!isTerminal(record.state) && record.state.status !== 'paused') {
        throw new Error('来源反馈循环意外结束');
      }
    } finally {
      if (record.activeController === controller) record.activeController = null;
    }
  }

  async #runPerception(record: RunRecord): Promise<boolean> {
    if (!record.source || !this.#sourceArtifacts || !this.#perception) {
      throw new Error('图纸来源解析服务未配置');
    }
    const remaining = record.state.limits.deadlineAt - this.#now();
    if (remaining <= 0) throw new Error('任务已超过运行截止时间');
    const controller = new AbortController();
    record.activeController = controller;
    // Perception is a bounded multi-tool pipeline; each vision call owns its model deadline.
    // The outer controller therefore follows the run deadline instead of a single-call timeout.
    const timer = setTimeout(() => controller.abort(new Error('perception timeout')), remaining);
    (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
    record.progress.publish('model_started', '正在理解图纸');
    try {
      const source = await this.#sourceArtifacts.read(record.source.sourceId);
      if (source.metadata.sha256 !== record.source.sha256) {
        throw new Error('图纸来源校验失败');
      }
      const perceptionInput = {
        runId: record.state.runId,
        sourceId: source.metadata.sourceId,
        page: source.metadata.page,
        image: source.bytes.toString('base64'),
        mimeType: source.metadata.mimeType,
        signal: controller.signal,
        deadlineAt: record.state.limits.deadlineAt,
      };
      const primary = await this.#consumePerceptionPass(record, {
        ...perceptionInput, modelName: this.#visionModelName,
      }, 'primary', true);
      if (!primary.continue) return false;
      const deferredPrimary = primary.deferred;
      if (
        deferredPrimary.length > 0
        && this.#visionRepairModelName !== this.#visionModelName
      ) {
        this.#transition(record, {
          type: 'RECOVERY_RECORDED', recovery: 'lowConfidenceEscalations',
        });
        record.progress.publish('model_started', '正在复核低置信度图元');
        this.#audit(record, 'perception', { stage: 'low_confidence_escalation' });
        const coverageSnapshot = {
          complete: record.perceptionCoverageComplete,
          incompleteRegionCount: record.perceptionIncompleteRegionCount,
          unresolvedContourCount: record.perceptionUnresolvedContourCount,
        };
        try {
          const repair = await this.#consumePerceptionPass(record, {
            ...perceptionInput, modelName: this.#visionRepairModelName,
          }, 'repair', false);
          if (!repair.continue) return false;
        } catch (error) {
          record.perceptionCoverageComplete = coverageSnapshot.complete;
          record.perceptionIncompleteRegionCount = coverageSnapshot.incompleteRegionCount;
          record.perceptionUnresolvedContourCount = coverageSnapshot.unresolvedContourCount;
          this.#audit(record, 'perception', {
            stage: 'repair_fallback',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      for (const output of deferredPrimary) {
        if (record.perceptionBatchIds.has(output.batch.componentId)) continue;
        if (!await this.#acceptPerceptionBatch(record, output)) return false;
      }
      const summary = perceptionSummary(record);
      this.#transition(record, { type: 'ANALYSIS_READY', summary });
      this.#audit(record, 'perception', {
        stage: 'analysis_ready',
        entityCount: record.perceptionEntityCount,
        lowConfidenceCount: record.perceptionLowConfidenceCount,
        coverageComplete: record.perceptionCoverageComplete,
        incompleteRegionCount: record.perceptionIncompleteRegionCount,
        unresolvedContourCount: record.perceptionUnresolvedContourCount,
        commitCount: record.state.commitCount,
      });
      record.perceptionCompleted = true;
      record.commitBaseline = record.state.commitCount;
      record.progress.publish('model_finished', '图纸理解完成');
      return true;
    } finally {
      clearTimeout(timer);
      if (record.activeController === controller) record.activeController = null;
    }
  }

  async #consumePerceptionPass(
    record: RunRecord,
    input: DrawingPerceptionInput,
    pass: 'primary' | 'repair',
    deferLowConfidence: boolean,
  ): Promise<{
    deferred: Array<Extract<DrawingPerceptionOutput, { kind: 'command_batch' }>>;
    continue: boolean;
  }> {
    const deferred: Array<Extract<DrawingPerceptionOutput, { kind: 'command_batch' }>> = [];
    for await (const output of this.#perception!.run(input)) {
      if (output.kind === 'command_batch') {
        if (record.perceptionBatchIds.has(output.batch.componentId)) continue;
        if (deferLowConfidence && output.batch.lowConfidenceCount > 0) {
          deferred.push(output);
        } else if (!await this.#acceptPerceptionBatch(record, output)) {
          return { deferred, continue: false };
        }
        continue;
      }
      if (output.kind === 'observation_delta') {
        this.#publishPerceptionDelta(record, output.delta, pass);
        continue;
      }
      if (output.stage === 'asset_prepared') {
        record.perceptionCoverageComplete = true;
        record.perceptionIncompleteRegionCount = 0;
        record.perceptionUnresolvedContourCount = 0;
      } else if (output.stage === 'coverage_completed') {
        record.perceptionCoverageComplete = record.perceptionCoverageComplete
          && output.detail.complete !== false;
        record.perceptionIncompleteRegionCount += nonNegativeInteger(
          output.detail.incompleteRegionCount,
        );
        record.perceptionUnresolvedContourCount += nonNegativeInteger(
          output.detail.unresolvedContourCount,
        );
      }
      record.progress.publish('tool_finished', perceptionStageTitle(output.stage));
      this.#audit(record, 'perception', {
        pass,
        stage: output.stage,
        durationMs: output.durationMs,
        ...(output.viewId ? { viewId: output.viewId } : {}),
        detail: structuredClone(output.detail),
      });
    }
    return { deferred, continue: true };
  }

  async #acceptPerceptionBatch(
    record: RunRecord,
    output: Extract<DrawingPerceptionOutput, { kind: 'command_batch' }>,
  ): Promise<boolean> {
    if (!await this.#safePoint(record, 'before_model')) return false;
    const applied = record.inputMode === 'analyze_only'
      ? true
      : await this.#applyPerceptionBatch(record, output);
    record.perceptionEntityCount += output.batch.commands.length;
    record.perceptionLowConfidenceCount += output.batch.lowConfidenceCount;
    record.perceptionBatchIds.add(output.batch.componentId);
    if (record.inputMode !== 'analyze_only') this.#promotePerceptionBatch(record, output);
    return applied;
  }

  #publishPerceptionDelta(
    record: RunRecord,
    received: PerceptionPreviewDelta,
    pass: 'primary' | 'repair',
  ): void {
    const delta: PerceptionPreviewDelta = {
      ...structuredClone(received),
      runId: record.state.runId,
      sequence: ++record.perceptionPreviewSequence,
    };
    for (const id of delta.removeIds) record.perceptionPreviewIds.delete(id);
    for (const id of delta.removeIds) record.perceptionPreviewNodes.delete(id);
    for (const node of delta.upserts) {
      record.perceptionPreviewIds.add(node.id);
      record.perceptionPreviewNodes.set(node.id, structuredClone(node));
    }
    const count = delta.upserts.length || delta.removeIds.length;
    record.progress.publish(
      'perception_delta',
      delta.action === 'observe' ? `发现 ${count} 个图元` : `更新 ${count} 个图元`,
      undefined,
      delta,
    );
    this.#audit(record, 'perception', {
      pass,
      stage: 'observation_delta',
      sequence: delta.sequence,
      action: delta.action,
      slotIds: [...delta.slotIds],
      upsertIds: delta.upserts.map((node) => node.id),
      removeIds: [...delta.removeIds],
      hideCommittedIds: [...(delta.hideCommittedIds ?? [])],
      showCommittedIds: [...(delta.showCommittedIds ?? [])],
      entityTypes: delta.upserts.map((node) => node.type),
      entities: delta.upserts.map((node) => ({
        id: node.id,
        type: node.type,
        ...(node.quality.confidence === undefined
          ? {}
          : { confidence: node.quality.confidence }),
        evidenceRefs: [...node.quality.evidenceRefs],
      })),
      source: structuredClone(delta.source),
    });
  }

  async #publishEditPreview(
    record: RunRecord,
    execution: DrawingToolExecution,
    rejected: boolean,
  ): Promise<void> {
    if (!execution.previewDocument || !this.#application.open) return;
    const workspace = await this.#application.open(record.state.drawingId);
    const affected = new Set(execution.receipt.affectedNodeIds);
    const currentNodes = [...workspace.document.geometry, ...workspace.document.annotations];
    const previewNodes = [
      ...execution.previewDocument.geometry,
      ...execution.previewDocument.annotations,
    ].filter((node) => affected.has(node.id)).map((node) => {
      const clone = structuredClone(node);
      if (rejected) clone.quality = {
        ...clone.quality,
        status: 'candidate',
        confidence: Math.min(clone.quality.confidence ?? 0.59, 0.59),
      };
      return clone;
    });
    const hidden = currentNodes
      .filter((node) => affected.has(node.id))
      .map((node) => node.id);
    const previousPreviewIds = [...record.editPreviewIds];
    const previousHiddenIds = [...record.editHiddenIds];
    record.editPreviewIds = new Set(previewNodes.map((node) => node.id));
    record.editHiddenIds = new Set(hidden);
    this.#publishPerceptionDelta(record, {
      runId: record.state.runId,
      sequence: 0,
      action: rejected ? 'revise' : 'preview',
      slotIds: [...affected],
      upserts: previewNodes,
      removeIds: previousPreviewIds,
      showCommittedIds: previousHiddenIds,
      hideCommittedIds: hidden,
      source: {
        page: 1,
        viewId: 'agent-edit-preview',
        stage: 'edit-preview',
      },
    }, 'primary');
  }

  #clearEditPreview(record: RunRecord, action: 'promote' | 'reject'): void {
    if (
      record.editPreviewIds.size === 0
      && record.editHiddenIds.size === 0
      && !record.spatialPreview
      && !record.spatialRepairContext
    ) return;
    this.#publishPerceptionDelta(record, {
      runId: record.state.runId,
      sequence: 0,
      action,
      slotIds: [],
      upserts: [],
      removeIds: [...record.editPreviewIds],
      showCommittedIds: [...record.editHiddenIds],
      regionOverlay: null,
      source: {
        page: 1,
        viewId: 'agent-edit-preview',
        stage: 'reconciliation',
      },
    }, 'primary');
    record.editPreviewIds.clear();
    record.editHiddenIds.clear();
  }

  #removeFeedbackPreviews(
    record: RunRecord,
    slotIds: string[],
    action: 'promote' | 'reject',
  ): void {
    const removeIds = slotIds
      .map(feedbackPreviewNodeId)
      .filter((id) => record.perceptionPreviewIds.has(id));
    if (removeIds.length === 0) return;
    this.#publishPerceptionDelta(record, {
      runId: record.state.runId,
      sequence: 0,
      action,
      slotIds: [...slotIds],
      upserts: [],
      removeIds,
      source: {
        page: record.source?.page ?? 1,
        viewId: 'page',
        stage: 'reconciliation',
      },
    }, 'primary');
  }

  #markFeedbackPreviewsRejected(record: RunRecord, slotIds: string[]): void {
    const upserts = slotIds
      .map(feedbackPreviewNodeId)
      .map((id) => record.perceptionPreviewNodes.get(id))
      .filter((node): node is PerceptionPreviewNode => node !== undefined)
      .map((node) => ({
        ...structuredClone(node),
        quality: {
          ...structuredClone(node.quality),
          status: 'candidate' as const,
          confidence: Math.min(node.quality.confidence ?? 0.59, 0.59),
        },
      }));
    if (upserts.length === 0) return;
    this.#publishPerceptionDelta(record, {
      runId: record.state.runId,
      sequence: 0,
      action: 'reject',
      slotIds: [...slotIds],
      upserts,
      removeIds: [],
      source: {
        page: record.source?.page ?? 1,
        viewId: 'page',
        stage: 'reconciliation',
      },
    }, 'primary');
  }

  #promotePerceptionBatch(
    record: RunRecord,
    output: Extract<DrawingPerceptionOutput, { kind: 'command_batch' }>,
  ): void {
    const removeIds = output.batch.commands.flatMap((command) => {
      if (command.type === 'geometry.create' || command.type === 'annotation.create') {
        return command.value.id ? [command.value.id] : [];
      }
      return [];
    }).filter((id) => record.perceptionPreviewIds.has(id));
    if (removeIds.length === 0) return;
    this.#publishPerceptionDelta(record, {
      runId: record.state.runId,
      sequence: 0,
      action: 'promote',
      slotIds: [...output.batch.observationIds],
      upserts: [],
      removeIds,
      source: {
        page: record.source?.page ?? 1,
        viewId: 'page',
        stage: 'reconciliation',
      },
    }, 'primary');
  }

  async #applyPerceptionBatch(
    record: RunRecord,
    output: Extract<DrawingPerceptionOutput, { kind: 'command_batch' }>,
  ): Promise<boolean> {
    if (record.perceptionBatchIds.size >= this.#limits.maxPerceptionCommits) {
      throw new Error(`图纸重建组件数超过上限 ${this.#limits.maxPerceptionCommits}`);
    }
    record.progress.publish('validation', '正在预览识别结果');
    const preview = await this.#tools.invoke({
      capability: 'preview_transaction', caller: 'model',
      toolCallId: this.#callId(record, 'perception_preview'),
      context: this.#toolContext(record),
      input: {
        commands: output.batch.commands,
        postconditions: output.batch.postconditions,
      },
    });
    this.#recordTool(record, preview);
    record.prepared = preview.prepared ?? null;
    if (!preview.prepared) {
      if (preview.receipt.status === 'already_satisfied') return true;
      if (isStale(preview)) throw new Error('图纸重建时 revision 已变化');
      throw new Error(`图纸组件 ${output.batch.componentId} 预览验证失败`);
    }
    const committed = await this.#commitPrepared(record, preview.prepared);
    this.#recordTool(record, committed);
    record.prepared = null;
    if (isStale(committed)) throw new Error('图纸重建提交时 revision 已变化');
    if (committed.receipt.status !== 'succeeded'
      && committed.receipt.status !== 'already_satisfied') {
      throw new Error(`图纸组件 ${output.batch.componentId} 提交失败`);
    }
    record.progress.publish('commit', '已提交一个图纸组件');
    return this.#safePoint(record, 'after_commit');
  }

  async #plan(record: RunRecord): Promise<boolean> {
    this.#discardPrepared(record);
    if (record.state.status === 'running' && record.state.needsReplan) {
      this.#transition(record, { type: 'REPLAN_STARTED' });
    }
    if (!await this.#safePoint(record, 'before_model')) return false;
    record.progress.publish('planning', record.state.plan ? '正在重新规划' : '正在规划任务');
    const summary = await this.#application.summarize({
      drawingId: record.state.drawingId,
      limit: 100,
    });
    if (summary.revision !== record.state.revision) {
      this.#transition(record, { type: 'REPLAN_REQUIRED', revision: summary.revision });
    }
    if (!await this.#safePoint(record, 'before_model')) return false;
    const baseInstruction = [
      record.selectedIds.length > 0
        ? `当前选中对象 ID：${record.selectedIds.join(', ')}`
        : '',
      ...record.stableRules.map((rule) => `稳定规则：${rule}`),
      ...record.state.activeInstructions,
    ].filter(Boolean).join('\n');
    let plan;
    const schemaErrors: string[] = [];
    for (let attempt = 0; ; attempt += 1) {
      try {
        const instruction = [
          baseInstruction,
          ...schemaErrors.map((message) => `上次输出不符合协议：${message}`),
          ...(schemaErrors.length > 0
            ? ['请严格按协议输出合法 JSON。特别注意 selection.count 的 min/equals 必须与 selector 平级（{"type":"selection.count","selector":{...},"min":N}），不要嵌套进 selector 里。']
            : []),
        ].filter(Boolean).join('\n');
        // 最后一次纠错使用更高配的 repair 模型,提高输出合法 JSON 的概率
        const modelName = attempt === MAX_PLANNER_SCHEMA_CORRECTIONS
          ? record.modelProfile.repair
          : record.modelProfile.planner;
        plan = await this.#callModel(record, 'planner', modelName, (signal, onRawReply) => (
          this.#planner.plan({
            objective: record.planningObjective,
            ...(instruction ? { instruction } : {}),
            drawingId: record.state.drawingId,
            revision: summary.revision,
            summary: summary.summary,
            modelName,
            signal,
            deadlineAt: record.state.limits.deadlineAt,
            onRawReply,
          })
        ));
        break;
      } catch (error) {
        if (!(error instanceof DrawingAgentProtocolError)) throw error;
        if (attempt >= MAX_PLANNER_SCHEMA_CORRECTIONS) throw error;
        this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'schemaCorrections' });
        schemaErrors.push(error.message);
      }
    }
    if (record.state.status === 'stopping') return false;
    this.#installPlan(record, plan);
    if (record.state.status === 'paused') {
      record.progress.publish('paused', '任务已暂停');
      return false;
    }
    return true;
  }

  async #runWorkflowNode(record: RunRecord, nodeId: string): Promise<boolean> {
    while (record.state.status === 'running' && record.state.currentWorkflowNodeId === nodeId) {
      const workflowNode = record.state.plan?.workflow.find((item) => item.id === nodeId);
      if (!workflowNode) throw new Error(`Workflow node not found: ${nodeId}`);
      if (workflowNode.capability === 'verify_goal') {
        if (!await this.#verifyWorkflowNode(record, nodeId)) {
          this.#transition(record, { type: 'REPLAN_REQUIRED', revision: record.state.revision });
          return this.#plan(record);
        }
        this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
        return true;
      }
      if (!await this.#safePoint(record, 'before_model')) return false;
      if (record.state.needsReplan) return this.#plan(record);
      const budget = decisionBudget(record.state, this.#now());
      if (budget) throw new Error(budget.message);
      const decision = workflowNode.capability === 'edit_entities'
        && this.#regionProposer && this.#spatialDesigner
        ? await this.#nextRegionFirstEdit(record)
        : await this.#nextDecision(record);
      if (decision.type === 'query' || decision.type === 'inspect') {
        if (!await this.#safePoint(record, 'before_read')) return false;
        if (record.state.needsReplan) return this.#plan(record);
        const execution = await this.#invokeRead(record, decision);
        this.#recordTool(record, execution);
        if (execution.receipt.status === 'not_found') return this.#recoverStale(record);
        if (!await this.#verifyWorkflowNode(record, nodeId)) {
          this.#transition(record, { type: 'REPLAN_REQUIRED', revision: record.state.revision });
          return this.#plan(record);
        }
        this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
        return true;
      }
      if (decision.type === 'transact') {
        if (record.state.commitCount >= effectiveCommitLimit(record)) {
          throw new Error(`已达到最大提交次数 ${effectiveCommitLimit(record)}`);
        }
        record.progress.publish(
          'previewing',
          '正在生成增量修改预览',
          undefined,
          undefined,
          candidateProgressFor(record),
        );
        const preview = await this.#tools.invoke({
          capability: 'preview_transaction', caller: 'model',
          toolCallId: decision.toolCallId,
          context: this.#toolContext(record),
          input: {
            commands: decision.commands,
            postconditions: workflowNode.completionCriteria,
            ...(record.spatialPreview ? {
              previewContext: {
                episodeId: record.spatialPreview.episodeId,
                previewVersionId: record.spatialPreview.previewVersionId,
                regionId: record.spatialPreview.region.id,
                selectionVersionId: record.spatialPreview.selectionVersionId,
                strategy: record.spatialPreview.strategy.mode,
                lineage: record.compiledEdit?.lineage ?? [],
              },
            } : {}),
          },
        });
        this.#recordTool(record, preview);
        record.prepared = preview.prepared ?? null;
        record.progress.publish(
          'validation',
          '增量修改预览完成',
          undefined,
          undefined,
          candidateProgressFor(record),
        );
        if (preview.prepared && preview.previewDocument) {
          await this.#publishEditPreview(record, preview, false);
        }
        if (!await this.#safePoint(record, 'after_preview')) return false;
        if (record.state.needsReplan) return this.#plan(record);
        if (!preview.prepared) {
          if (preview.receipt.status === 'already_satisfied') {
            this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
            return true;
          }
          if (isStale(preview)) return this.#recoverStale(record);
          if (!this.#recordValidationRepair(record)) return false;
          continue;
        }
        if (
          preview.receipt.outcome.kind === 'preview'
          && preview.receipt.outcome.candidate
          && !record.state.plan?.goal.riskPolicy.candidateAllowed
        ) {
          this.#discardPrepared(record);
          if (!this.#recordValidationRepair(record)) return false;
          continue;
        }
        if (!await this.#verifyPreparedPreview(record, preview)) {
          await this.#publishEditPreview(record, preview, true);
          this.#discardPrepared(record);
          record.progress.publish(
            'revising',
            '预览未通过，正在根据缺陷修正',
            record.previewDefects.map((defect) => defect.message).join('；') || undefined,
            undefined,
            candidateProgressFor(record),
          );
          if (!this.#recordValidationRepair(record)) return false;
          continue;
        }
        const committed = await this.#commitPrepared(record, preview.prepared);
        this.#recordTool(record, committed);
        if (committed.receipt.status === 'succeeded'
          || committed.receipt.status === 'already_satisfied') {
          this.#markEpisodePreview(record, 'committed', []);
        }
        record.prepared = null;
        record.compiledEdit = null;
        record.spatialPreview = null;
        if (isStale(committed)) return this.#recoverStale(record);
        if (committed.receipt.status !== 'succeeded'
          && committed.receipt.status !== 'already_satisfied') {
          if (!this.#recordValidationRepair(record)) return false;
          continue;
        }
        record.progress.publish('commit', '增量修改已提交');
        record.progress.publish('committed', '增量修改已通过验证并提交');
        this.#clearEditPreview(record, 'promote');
        this.#resetSpatialRepair(record);
        if (!await this.#safePoint(record, 'after_commit')) return false;
        if (record.state.needsReplan) return this.#plan(record);
        this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
        return true;
      }
      if (await this.#verifyWorkflowNode(record, nodeId)) {
        this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
        return true;
      }
      if (!this.#recordValidationRepair(record)) return false;
    }
    return record.state.status === 'running';
  }

  async #verifyPreparedPreview(
    record: RunRecord,
    preview: DrawingToolExecution,
  ): Promise<boolean> {
    if (!this.#previewVerifier && !record.compiledEdit) return true;
    if (!preview.previewDocument) throw new Error('预览验证缺少候选文档');
    record.progress.publish(
      'verifying',
      '正在验证增量修改预览',
      undefined,
      undefined,
      candidateProgressFor(record),
    );
    if (record.compiledEdit && record.spatialPreview && this.#application.open) {
      const before = await this.#application.open(record.state.drawingId);
      const deterministic = validateSpatialEditPreview({
        before: before.document,
        after: preview.previewDocument,
        region: record.spatialPreview.region,
        selection: record.spatialPreview.selection,
        candidate: record.compiledEdit,
        tolerance: record.spatialPreview.tolerance,
      });
      this.#audit(record, 'verification', {
        phase: 'deterministic-spatial',
        revision: record.state.revision,
        satisfied: deterministic.valid,
        issues: structuredClone(deterministic.issues),
        unexpectedDanglingEndpoints: structuredClone(deterministic.unexpectedDanglingEndpoints),
      });
      if (!deterministic.valid) {
        record.previewDefects = deterministic.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          nodeIds: issue.nodeIds,
          repairHint: '保持区域边界连接、保护片段和 lineage 不变后重新设计目标区域',
        }));
        this.#markEpisodePreview(record, 'rejected', record.previewDefects.map((item) => item.code));
        return false;
      }
      if (record.spatialPreview.strategy.mode !== 'geometric-edit') {
        const protectedIds = new Set([
          ...Object.keys(record.compiledEdit.preserveNodeHashes),
          ...Object.keys(record.compiledEdit.protectedFragmentHashes),
        ]);
        const generative = validateGenerativeGeometry({
          geometry: preview.previewDocument.geometry.filter((node) => (
            record.compiledEdit!.targetNodeIds.includes(node.id)
          )),
          protectedGeometry: preview.previewDocument.geometry.filter((node) => (
            protectedIds.has(node.id)
          )),
          contours: record.spatialPreview.region.worldContours,
          holes: record.spatialPreview.region.worldHoles,
          boundaryAnchors: [
            ...record.spatialPreview.selection.boundaryAnchors,
            ...record.spatialPreview.region.anchors,
          ].map((anchor) => ({ id: anchor.id, point: anchor.point })),
          tolerance: record.spatialPreview.tolerance,
        });
        this.#audit(record, 'verification', {
          phase: 'deterministic-generative',
          revision: record.state.revision,
          satisfied: generative.valid,
          issues: structuredClone(generative.issues),
          connectedAnchorIds: [...generative.connectedAnchorIds],
        });
        if (!generative.valid) {
          record.previewDefects = generative.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            nodeIds: issue.nodeIds,
            repairHint: '把生成结果限制在目标区域内，避开保护轮廓并重新贴合边界锚点',
          }));
          this.#markEpisodePreview(record, 'rejected', record.previewDefects.map((item) => item.code));
          return false;
        }
      }
    }
    if (!this.#previewVerifier) {
      record.previewDefects = [];
      return true;
    }
    const beforeVision = await this.#ensureVision(record);
    let previewObservation;
    if (this.#application.observePreviewForAgent && preview.prepared) {
      const overview = beforeVision?.observation?.views.find((view) => view.purpose === 'overview');
      previewObservation = await this.#application.observePreviewForAgent({
        document: preview.previewDocument,
        revision: record.state.revision,
        previewHandle: preview.prepared.handle,
        includeAnnotations: shouldIncludeAnnotations(record),
        selectedIds: preview.receipt.affectedNodeIds,
        ...(overview ? {
          userViewport: {
            scale: overview.worldToImage[0],
            offsetX: overview.worldToImage[4],
            offsetY: overview.worldToImage[5],
            width: overview.width,
            height: overview.height,
          },
        } : {}),
      });
    }
    const result = await this.#callModel(
      record,
      'verification',
      record.modelProfile.decision,
      (signal, onRawReply) => this.#previewVerifier!.verify({
        goal: record.state.plan!.goal.objective,
        previewDocument: preview.previewDocument!,
        modelName: record.modelProfile.decision,
        signal,
        deadlineAt: record.state.limits.deadlineAt,
        beforeObservation: beforeVision?.observation,
        previewObservation,
        readImage: this.#application.readObservationImage?.bind(this.#application),
        onRawReply,
      }),
    );
    this.#audit(record, 'verification', {
      phase: 'preview',
      revision: record.state.revision,
      satisfied: result.satisfied,
      reason: result.reason,
      defects: structuredClone(result.defects),
      affectedNodeIds: preview.receipt.affectedNodeIds,
    });
    record.previewDefects = result.satisfied ? [] : structuredClone(result.defects);
    if (!result.satisfied) {
      this.#markEpisodePreview(record, 'rejected', result.defects.map((defect) => defect.code));
    }
    return result.satisfied;
  }

  async #ensureVision(record: RunRecord): Promise<DrawingVisionContext | undefined> {
    const viewport = record.viewport;
    if (record.inputMode === 'analyze_only') return undefined;
    // 仅在 revision 未变化时复用缓存;提交后重新渲染,让模型看到更新后的图纸
    if (record.vision && record.visionRevision === record.state.revision) return record.vision;
    if (this.#application.observeForAgent && this.#application.readObservationImage) {
      const observation = await this.#application.observeForAgent({
        drawingId: record.state.drawingId,
        includeAnnotations: shouldIncludeAnnotations(record),
        selectedIds: record.selectedIds,
        userViewport: viewport,
      });
      const view = observation.views.find((item) => item.purpose === 'target-detail')
        ?? observation.views.find((item) => item.purpose === 'user-viewport')
        ?? observation.views[0];
      const imageDataUrl = view && this.#application.readObservationImage(view.image.handle);
      if (view && imageDataUrl) {
        record.vision = {
          snapshot: {
            width: view.width,
            height: view.height,
            imageDataUrl,
            rendererVersion: observation.rendererVersion,
            worldToImage: view.worldToImage,
            nodes: structuredClone(view.grounding),
          },
          selection: [...record.selectedIds],
          observation,
        };
        record.visionRevision = record.state.revision;
        return record.vision;
      }
    }
    if (!viewport) return undefined;
    const snapshot = await this.#application.renderForVision({
      drawingId: record.state.drawingId,
      viewport,
      selectedIds: record.selectedIds,
      maxDimension: 1536,
    });
    record.vision = { snapshot, selection: [...record.selectedIds] };
    record.visionRevision = record.state.revision;
    return record.vision;
  }

  async #nextRegionFirstEdit(record: RunRecord): Promise<AgentDecision> {
    if (!this.#regionProposer || !this.#fragmentSelector || !this.#spatialDesigner) {
      throw new Error('REGION_FIRST_EDIT_ADAPTERS_MISSING');
    }
    if (!this.#application.readObservationImage || !this.#application.open) {
      throw new Error('REGION_FIRST_APPLICATION_CAPABILITY_MISSING');
    }
    this.#transition(record, { type: 'DECISION_RECORDED' });
    record.spatialCandidateAttempt += 1;
    const candidateAttempt = record.spatialCandidateAttempt;
    if (candidateAttempt > MAX_VALIDATION_REPAIRS + 1) {
      throw new Error(`空间编辑已生成 ${MAX_VALIDATION_REPAIRS + 1} 个候选，仍未通过验证`);
    }
    const repairFeedback = structuredClone(record.previewDefects);
    const modelName = candidateAttempt >= MAX_VALIDATION_REPAIRS + 1
      ? record.modelProfile.repair
      : record.modelProfile.decision;
    const reusable = record.spatialRepairContext
      && record.spatialRepairContext.revision === record.state.revision
      && shouldReuseSpatialContext(repairFeedback);
    let context = reusable ? record.spatialRepairContext : null;
    if (context) {
      record.progress.publish(
        'revising',
        '正在基于验证结果修复当前区域',
        repairFeedback.map((item) => item.message).join('；') || undefined,
        undefined,
        candidateProgress(candidateAttempt),
      );
      this.#audit(record, 'state', {
        event: 'SPATIAL_REPAIR_CONTEXT_REUSED',
        revision: context.revision,
        regionId: context.region.id,
        selectionVersionId: context.selectionVersionId,
        candidateAttempt,
      });
    } else {
      context = await this.#prepareSpatialRepairContext(
        record,
        modelName,
        repairFeedback,
        candidateAttempt,
      );
      if (!context) return { type: 'finish', summary: '图纸版本已变化，需要重新规划' };
      record.spatialRepairContext = context;
    }
    const {
      observation, document, episodeId, proposalViewId, region, selection, authorization, split,
      targetGeometry, regionVersion, selectionVersion, selectionVersionId, tolerance,
    } = context;
    let strategy = context.strategy;
    if (selection.wholeNodes.length === 0 && selection.partialSegments.length === 0
      && strategy.mode === 'geometric-edit') {
      record.previewDefects = [{
        code: 'region-selection-empty',
        message: '所选区域没有覆盖当前图中的任何向量；请圈选修改前已存在的完整源对象，而不是修改后的预期位置',
        nodeIds: [],
        repairHint: '重新查看当前图纸，选择现有目标轮廓并覆盖它的实际线条',
      }];
      this.#audit(record, 'verification', {
        phase: 'region-resolution',
        satisfied: false,
        regionId: region.id,
        defects: structuredClone(record.previewDefects),
      });
      record.progress.publish(
        'revising',
        '目标区域未覆盖现有图形，正在重新观察',
        undefined,
        undefined,
        candidateProgress(candidateAttempt),
      );
      record.spatialRepairContext = null;
      this.#recordValidationRepair(record);
      return this.#nextRegionFirstEdit(record);
    }
    const previewVersionId = `${episodeId}:preview:${++record.spatialPreviewSequence}`;
    const episode = await this.#ensureEpisode(record);
    let design: SpatialEditDesign | undefined;
    if (strategy.mode !== 'geometric-edit' && this.#redrawService) {
      record.progress.publish(
        'generating', '正在生成区域重绘方案', undefined, undefined,
        candidateProgress(candidateAttempt),
      );
      try {
        design = await this.#generateSpatialRedraw({
          record, observation, proposalViewId,
          region, strategy, designModelName: modelName,
        });
      } catch (error) {
        if (!strategy.fallbackMode) throw error;
        this.#audit(record, 'generation', {
          event: 'GENERATION_FALLBACK',
          error: error instanceof Error ? error.message : String(error),
          fallbackMode: strategy.fallbackMode,
        });
        record.progress.publish(
          'revising', '局部生成不可用，正在改用几何方案', undefined, undefined,
          candidateProgress(candidateAttempt),
        );
        strategy = { ...strategy, mode: strategy.fallbackMode };
      }
    }
    if (!design) {
      if (strategy.mode !== 'geometric-edit' && !this.#redrawService) {
        this.#audit(record, 'generation', {
          event: 'GENERATION_PROVIDER_UNAVAILABLE', fallbackMode: 'geometric-edit',
        });
        record.progress.publish(
          'revising', '局部生成服务未配置，正在改用几何方案', undefined, undefined,
          candidateProgress(candidateAttempt),
        );
        strategy = { ...strategy, mode: 'geometric-edit' };
      }
      record.progress.publish(
        'designing', '正在设计区域几何修改', undefined, undefined,
        candidateProgress(candidateAttempt),
      );
      design = await this.#callSemanticModel(
        record,
        'design',
        modelName,
        (signal, onRawReply, protocolFeedback) => this.#spatialDesigner!.design({
          goal: record.state.plan!.goal.objective,
          observation,
          region,
          selection,
          strategy,
          targetGeometry,
          readImage: this.#application.readObservationImage!.bind(this.#application),
          modelName,
          signal,
          deadlineAt: record.state.limits.deadlineAt,
          onRawReply,
          repairFeedback,
          episodeContext: buildEpisodeModelContext(episode),
          ...(protocolFeedback ? { protocolFeedback } : {}),
        }),
      );
    }
    let compiled: CompiledSpatialEditCandidate;
    try {
      compiled = compileSpatialEdit({
        document, selection, region, strategy, split, authorization, design,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      record.previewDefects = [{
        code: 'spatial-compile-failed', message, nodeIds: [],
        repairHint: '保持已有选区与锚点，改用可编译的局部形变或替换几何',
      }];
      record.progress.publish(
        'revising', '候选无法编译，正在重新设计', message, undefined,
        candidateProgress(candidateAttempt),
      );
      this.#recordValidationRepair(record);
      return this.#nextRegionFirstEdit(record);
    }
    record.compiledEdit = compiled;
    record.spatialPreview = {
      episodeId,
      previewVersionId,
      selectionVersionId,
      region,
      selection,
      strategy,
      tolerance,
    };
    supersedeActive(episode.previewVersions);
    const episodePreviewVersion = episode.previewVersions.length + 1;
    episode.previewVersions.push({
      version: episodePreviewVersion,
      previewVersionId,
      regionVersion,
      selectionVersion,
      strategy: strategy.mode,
      status: 'active',
      affectedNodeIds: [...compiled.targetNodeIds],
      diffSummary: `${design.kind}:${compiled.commands.length} commands`,
      defectCodes: [],
      createdAt: this.#now(),
    });
    episode.updatedAt = this.#now();
    this.#persistEpisode(record);
    this.#audit(record, 'intent', {
      kind: design.kind,
      confidence: design.confidence,
      evidenceRefs: design.evidenceRefs,
      targetNodeIds: compiled.targetNodeIds,
      authorizedBounds: compiled.authorizedBounds,
      commandCount: compiled.commands.length,
      authorizationId: authorization.id,
      selectionProofId: authorization.selectionProofId,
      candidateAttempt,
      modelTier: candidateAttempt >= MAX_VALIDATION_REPAIRS + 1 ? 'repair' : 'decision',
    });
    this.#audit(record, 'episode', {
      episodeId,
      previewVersionId,
      selectionVersionId,
      regionId: region.id,
      strategy: strategy.mode,
      repairFeedback,
      candidateAttempt,
    });
    return {
      type: 'transact',
      toolCallId: this.#callId(record, 'region_edit'),
      commands: compiled.commands,
      confidence: design.confidence,
    };
  }

  async #prepareSpatialRepairContext(
    record: RunRecord,
    modelName: string,
    repairFeedback: import('./types.js').DrawingPreviewDefect[],
    candidateAttempt: number,
  ): Promise<SpatialRepairContext | null> {
    record.progress.publish('observing', '正在观察当前二维图纸');
    const vision = await this.#ensureVision(record);
    const observation = vision?.observation;
    if (!observation) throw new Error('REGION_FIRST_OBSERVATION_MISSING');
    this.#audit(record, 'observation', {
      revision: observation.revision,
      rendererVersion: observation.rendererVersion,
      selectedIds: observation.selectedIds,
      views: observation.views.map((view) => ({
        id: view.id, purpose: view.purpose, imageHandle: view.image.handle,
        worldBounds: view.worldBounds, groundingCount: view.grounding.length,
      })),
      vectorDigest: observation.vectorDigest,
    });
    const workspace = await this.#application.open!(record.state.drawingId);
    if (workspace.revision !== record.state.revision) return null;
    const episode = await this.#ensureEpisode(record);
    const targetHint = targetHintFor(
      record.state.plan!.goal.objective,
      record.state.plan!.goal.scope.bounds,
      record.selectedIds,
      workspace.document,
      observation.vectorDigest.bounds,
    );
    const budget = localityBudgetFor(targetHint.preferredScale);
    let accepted: {
      proposal: Awaited<ReturnType<DrawingSemanticRegionModelAdapter['propose']>>;
      region: SemanticRegion;
      graph: ReturnType<typeof buildAtomicGeometryGraph>;
      rawSelection: SpatialSelection;
      bounds: Bounds2D;
      tolerance: number;
      locality: ReturnType<typeof assessSearchEnvelope>;
    } | null = null;
    let envelopeFeedback = structuredClone(repairFeedback);
    for (let envelopeAttempt = 1; envelopeAttempt <= 2; envelopeAttempt += 1) {
      record.progress.publish(
        'grounding',
        envelopeAttempt === 1 ? '正在定位目标的最小搜索范围' : '正在缩小目标搜索范围',
        undefined,
        undefined,
        candidateProgress(candidateAttempt),
      );
      let proposal = await this.#proposeSemanticRegion(
        record, observation, modelName, envelopeFeedback, targetHint,
      );
      if (proposal.confidence < LOW_CONFIDENCE_THRESHOLD) {
        proposal = await this.#proposeSemanticRegion(record, observation, modelName, [{
          code: 'low-region-confidence',
          message: `搜索包络置信度 ${proposal.confidence.toFixed(2)}，请重新检查最小目标边界`,
          nodeIds: [],
        }], targetHint);
      }
      const region = await buildSemanticRegion({
        drawingId: record.state.drawingId,
        observation,
        proposal,
        mediaStore: this.#regionMediaStore,
      });
      const bounds = semanticRegionBounds(region);
      const tolerance = spatialTolerance(bounds);
      const graph = buildAtomicGeometryGraph({
        document: workspace.document, revision: workspace.revision,
        regionBounds: bounds, padding: tolerance * 4,
      });
      const rawSelection = new RegionResolver().resolve({
        document: workspace.document, revision: workspace.revision, region, graph, tolerance,
      });
      const locality = assessSearchEnvelope({
        documentBounds: observation.vectorDigest.bounds ?? bounds,
        envelopeBounds: bounds,
        targetHint,
        counts: {
          wholeNodes: rawSelection.wholeNodes.length,
          crossingNodes: rawSelection.crossingNodes.length,
          boundaryAnchors: rawSelection.boundaryAnchors.length,
          candidateFragments: rawSelection.wholeNodes.length + rawSelection.partialSegments.length,
        },
        budget,
      });
      this.#audit(record, 'region', {
        id: region.id, revision: region.revision, label: region.label,
        sourceViewIds: region.sourceViewIds, maskHandle: region.maskHandle,
        contourCount: region.worldContours.length, holeCount: region.worldHoles.length,
        anchorCount: region.anchors.length, confidence: region.confidence,
        evidenceRefs: region.evidenceRefs, candidateAttempt, envelopeAttempt,
        targetHint: structuredClone(targetHint), locality: structuredClone(locality),
      });
      this.#audit(record, 'atomic_graph', {
        revision: graph.revision, segmentCount: graph.segments.length,
        nodeCount: new Set(graph.segments.map((segment) => segment.nodeId)).size,
        segmentIds: graph.segments.slice(0, 200).map((segment) => segment.id),
        truncated: graph.segments.length > 200,
        envelopeAttempt,
      });
      if (!locality.accepted) {
        const detail = locality.issues.map((issue) => issue.message).join('；');
        record.progress.publish(
          'search_envelope_rejected', '搜索范围过大，正在精确缩小', detail,
          undefined, candidateProgress(candidateAttempt),
        );
        this.#audit(record, 'verification', {
          phase: 'search-envelope', satisfied: false, regionId: region.id,
          issues: structuredClone(locality.issues), metrics: structuredClone(locality.metrics),
          candidateAttempt, envelopeAttempt,
        });
        envelopeFeedback = locality.issues.map((issue) => ({
          code: issue.code.toLowerCase(),
          message: issue.message,
          nodeIds: [],
          repairHint: '仅覆盖目标部件及其连接点的最小邻域，不要包含头部、躯干或其他部件',
        }));
        continue;
      }
      accepted = { proposal, region, graph, rawSelection, bounds, tolerance, locality };
      break;
    }
    if (!accepted) throw new Error('SEARCH_ENVELOPE_REJECTED:两次定位仍超过局部编辑预算');
    const { proposal, region, graph, rawSelection, tolerance, locality } = accepted;
    const episodeId = `${record.state.runId}:${record.state.currentWorkflowNodeId ?? 'edit'}`;
    const candidates = buildSelectionCandidateSet({
      document: workspace.document, selection: rawSelection, graph,
    });
    record.progress.publish(
      'candidate_extraction',
      `找到 ${candidates.candidates.length} 个局部片段，正在确认目标`,
      undefined, undefined, candidateProgress(candidateAttempt),
    );
    let proof;
    if (candidates.candidates.length === 0) {
      if (!isAdditiveRedrawGoal(record.state.plan!.goal.objective)) {
        throw new Error('REGION_SELECTION_EMPTY');
      }
      proof = {
        editableFragmentIds: [], anchorIds: [], evidence: [], confidence: region.confidence,
      };
    } else {
      const proofView = await renderSelectionProofView({ document: workspace.document, candidates });
      record.progress.publish(
        'selecting_fragments', '正在确认需要修改的精确轮廓片段',
        `${candidates.candidates.length} 个候选`, undefined,
        candidateProgress(candidateAttempt),
      );
      proof = await this.#callSemanticModel(
        record,
        'grounding',
        modelName,
        (signal, onRawReply, protocolFeedback) => this.#fragmentSelector!.select({
          goal: record.state.plan!.goal.objective,
          observation,
          candidates,
          proofView,
          availableAnchors: rawSelection.boundaryAnchors,
          allowEmptyEditSet: isAdditiveRedrawGoal(record.state.plan!.goal.objective),
          readImage: this.#application.readObservationImage!.bind(this.#application),
          modelName,
          signal,
          deadlineAt: record.state.limits.deadlineAt,
          onRawReply,
          repairFeedback,
          episodeContext: buildEpisodeModelContext(episode),
          ...(protocolFeedback ? { protocolFeedback } : {}),
        }),
      );
    }
    const authorized = authorizeSelection({
      document: workspace.document,
      rawSelection,
      candidates,
      proof,
      locality: locality.metrics,
      maxEditableFragments: budget.maxCandidateFragments,
    });
    const selection = authorized.selection;
    const authorization = authorized.authorization;
    const selectionVersionId = `${authorization.selectionProofId}:selection:${record.state.revision}`;
    record.progress.publish(
      'selection_authorized',
      `已确认 ${authorization.editableFragmentIds.length} 个可编辑片段`,
      `其余 ${authorization.protectedFragmentIds.length + selection.protectedNodes.length} 个对象保持不变`,
      undefined,
      candidateProgress(candidateAttempt),
    );
    const overlayDelta: PerceptionPreviewDelta = {
      runId: record.state.runId,
      sequence: ++record.perceptionPreviewSequence,
      action: 'preview', slotIds: [], upserts: [], removeIds: [],
      regionOverlay: {
        id: region.id, revision: region.revision,
        previewVersionId: `${episodeId}:region:${candidateAttempt}`,
        label: region.label, contours: structuredClone(region.worldContours),
        holes: structuredClone(region.worldHoles), anchors: structuredClone(region.anchors),
        confidence: region.confidence,
      },
      source: {
        page: 1, viewId: proposal.sourceViewId, regionId: region.id, stage: 'edit-preview',
      },
    };
    record.progress.publish(
      'region_overlay', '已确认目标搜索范围', undefined, overlayDelta,
      candidateProgress(candidateAttempt),
    );
    record.progress.publish(
      'region_resolved', '目标片段已解析为可编辑几何',
      `完整图元 ${selection.wholeNodes.length}，跨边界图元 ${selection.crossingNodes.length}`,
      undefined, candidateProgress(candidateAttempt),
    );
    this.#audit(record, 'selection', {
      selectionVersionId, regionId: selection.regionId, revision: selection.revision,
      wholeNodes: selection.wholeNodes, crossingNodes: selection.crossingNodes,
      protectedNodeCount: selection.protectedNodes.length,
      boundaryAnchors: structuredClone(selection.boundaryAnchors),
      uncertainParts: structuredClone(selection.uncertainParts),
      splitPlan: structuredClone(selection.splitPlan), candidateAttempt,
      selectionProof: structuredClone(proof),
      authorization: structuredClone(authorization),
    });
    supersedeActive(episode.regionVersions);
    const regionVersion = episode.regionVersions.length + 1;
    episode.regionVersions.push({
      version: regionVersion, regionId: region.id, maskHandle: region.maskHandle,
      status: 'active', createdAt: this.#now(),
    });
    supersedeActive(episode.selectionVersions);
    const selectionVersion = episode.selectionVersions.length + 1;
    episode.selectionVersions.push({
      version: selectionVersion, selectionVersionId, regionVersion, status: 'active',
      targetNodeIds: [...selection.wholeNodes], crossingNodeIds: [...selection.crossingNodes],
      createdAt: this.#now(),
    });
    episode.updatedAt = this.#now();
    this.#persistEpisode(record);
    const strategy = routeSpatialEditStrategy({
      goal: record.state.plan!.goal.objective,
      document: workspace.document,
      region,
      selection,
    });
    this.#audit(record, 'strategy', {
      ...structuredClone(strategy), candidateAttempt,
    } as unknown as Record<string, unknown>);
    const split = materializeSpatialSplits({ document: workspace.document, selection });
    record.progress.publish(
      'split_materialized',
      split.commands.length > 0 ? '已准备跨边界图元拆分' : '目标边界无需拆分',
      split.fidelityWarnings.join('；') || undefined,
      undefined,
      candidateProgress(candidateAttempt),
    );
    this.#audit(record, 'split', {
      commandCount: split.commands.length, fragmentCount: split.fragments.length,
      fidelityWarnings: split.fidelityWarnings,
    });
    this.#audit(record, 'lineage', {
      regionId: region.id, entries: structuredClone(split.lineage),
    });
    return {
      revision: workspace.revision,
      observation,
      document: workspace.document,
      episodeId,
      proposalViewId: proposal.sourceViewId,
      region,
      selection,
      authorization,
      split,
      strategy,
      targetGeometry: targetGeometryForDesign(workspace.document, selection, split),
      regionVersion,
      selectionVersion,
      selectionVersionId,
      tolerance,
    };
  }

  async #generateSpatialRedraw(input: {
    record: RunRecord;
    observation: NonNullable<DrawingVisionContext['observation']>;
    proposalViewId: string;
    region: SemanticRegion;
    strategy: SpatialEditStrategy;
    designModelName: string;
  }): Promise<SpatialEditDesign> {
    const view = input.observation.views.find((item) => item.id === input.proposalViewId);
    if (!view) throw new Error(`GENERATION_VIEW_MISSING:${input.proposalViewId}`);
    const dataUrl = this.#application.readObservationImage?.(view.image.handle);
    const cropPng = dataUrl ? pngFromDataUrl(dataUrl) : null;
    const maskPng = this.#regionMediaStore.read(input.region.maskHandle);
    if (!cropPng || !maskPng) throw new Error('GENERATION_MEDIA_MISSING');
    const protectedMaskPng = await sharp(maskPng).grayscale().negate().png().toBuffer();
    let vectorizingPublished = false;
    const redraw = await this.#callModel(
      input.record,
      'design',
      input.designModelName,
      (signal) => this.#redrawService!.redraw({
        prompt: [
          input.record.state.plan!.goal.objective,
          `只修改语义区域“${input.region.label}”，区域外像素必须保持。`,
          `必须满足：${input.strategy.requiredGuarantees.join('、') || '区域外不变'}。`,
          '输出白底黑线的干净二维线稿，不添加文字、水印、阴影或填充。',
        ].join('\n'),
        cropPng,
        maskPng,
        protectedMaskPng,
        seed: stableGenerationSeed(input.record.state.runId, input.region.id),
        signal,
        deadlineAt: input.record.state.limits.deadlineAt,
        cropPixelToWorld: invertAffine(view.worldToImage),
        authorizedContours: structuredClone(input.region.worldContours),
        authorizedHoles: structuredClone(input.region.worldHoles),
        maxPixels: Math.min(4_000_000, view.width * view.height),
        onStage: (stage) => {
          if (stage === 'vectorizing') {
            vectorizingPublished = true;
            input.record.progress.publish('vectorizing', '正在转换为可编辑图形');
          }
        },
      }),
    );
    if (!vectorizingPublished) {
      input.record.progress.publish('vectorizing', '已转换为可编辑图形');
    }
    const confidenceValues = redraw.geometry
      .map((node) => node.quality.confidence)
      .filter((value): value is number => value !== undefined && Number.isFinite(value));
    const confidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0.5;
    this.#audit(input.record, 'generation', {
      event: 'GENERATION_VECTORIZED',
      providerRequestId: redraw.providerRequestId,
      generatedSourceId: redraw.generatedSource.sourceId,
      pipelineVersion: redraw.pipelineVersion,
      geometryIds: redraw.geometry.map((node) => node.id),
      geometryTypes: redraw.geometry.map((node) => node.type),
      replaceTarget: !isAdditiveRedrawGoal(input.record.state.plan!.goal.objective),
    });
    return {
      kind: 'local-redraw',
      geometry: structuredClone(redraw.geometry),
      replaceTarget: !isAdditiveRedrawGoal(input.record.state.plan!.goal.objective),
      confidence,
      evidenceRefs: [redraw.generatedSource.sourceId],
    };
  }

  async #proposeSemanticRegion(
    record: RunRecord,
    observation: NonNullable<DrawingVisionContext['observation']>,
    modelName: string,
    repairFeedback: import('./types.js').DrawingPreviewDefect[],
    targetHint: TargetHint,
  ) {
    return this.#callSemanticModel(
      record,
      'grounding',
      modelName,
      (signal, onRawReply, protocolFeedback) => this.#regionProposer!.propose({
        goal: record.state.plan!.goal.objective,
        observation,
        readImage: this.#application.readObservationImage!.bind(this.#application),
        modelName,
        signal,
        deadlineAt: record.state.limits.deadlineAt,
        onRawReply,
        repairFeedback,
        targetHint,
        ...(record.episode ? { episodeContext: buildEpisodeModelContext(record.episode) } : {}),
        ...(protocolFeedback ? { protocolFeedback } : {}),
      }),
    );
  }

  async #callSemanticModel<T>(
    record: RunRecord,
    role: 'grounding' | 'design',
    modelName: string,
    call: (
      signal: AbortSignal,
      onRawReply: (replyRole: DrawingModelRole, reply: string) => void,
      protocolFeedback?: string,
    ) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.#callModel(
        record,
        role,
        modelName,
        (signal, onRawReply) => call(signal, onRawReply),
      );
    } catch (error) {
      if (!(error instanceof DrawingSpatialRegionProtocolError)
        && !(error instanceof DrawingAgentProtocolError)) throw error;
      record.progress.publish('validation', '正在修正空间协议输出', error.message);
      this.#audit(record, 'validation', {
        event: 'SEMANTIC_PROTOCOL_RETRY',
        role,
        message: error.message,
      });
      return this.#callModel(
        record,
        role,
        modelName,
        (signal, onRawReply) => call(signal, onRawReply, error.message),
      );
    }
  }

  async #nextDecision(record: RunRecord): Promise<AgentDecision> {
    const call = async (modelName: string, protocolFeedback?: string) => {
      this.#transition(record, { type: 'DECISION_RECORDED' });
      const vision = await this.#ensureVision(record);
      const decision = await this.#callModel(record, 'decision', modelName, (signal, onRawReply) => this.#decision.decide({
        plan: record.state.plan!,
        currentWorkflowNodeId: record.state.currentWorkflowNodeId!,
        revision: record.state.revision,
        pendingInstructions: [...record.state.activeInstructions],
        recentReceipts: [...record.state.recentReceipts],
        toolEvidence: [...record.toolEvidence],
        attempt: record.state.decisionCount + 1,
        ...(protocolFeedback ? { protocolFeedback } : {}),
        modelName,
        signal,
        deadlineAt: record.state.limits.deadlineAt,
        vision,
        onRawReply,
      }));
      assertDecisionMatchesCapability(record, decision);
      this.#audit(record, 'decision', { decision: structuredClone(decision) });
      return decision;
    };
    let decision: AgentDecision;
    try {
      decision = await call(record.modelProfile.decision);
    } catch (error) {
      if (!(error instanceof DrawingAgentProtocolError) || record.state.recovery.schemaCorrections >= 1) {
        throw error;
      }
      this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'schemaCorrections' });
      decision = await call(record.modelProfile.decision, error.message);
    }
    if (
      decision.type === 'transact'
      && (decision.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD
      && record.state.recovery.lowConfidenceEscalations < 1
    ) {
      this.#transition(record, {
        type: 'RECOVERY_RECORDED', recovery: 'lowConfidenceEscalations',
      });
      try {
        const repair = await call(record.modelProfile.repair);
        if (repair.type === 'transact'
          && (repair.confidence ?? 1) >= LOW_CONFIDENCE_THRESHOLD) return repair;
      } catch {
        // The valid Lite proposal remains available as the safe candidate fallback.
      }
    }
    return decision;
  }

  async #resumePrepared(record: RunRecord): Promise<boolean> {
    const prepared = record.prepared;
    const nodeId = record.state.currentWorkflowNodeId;
    if (!prepared || !nodeId) throw new Error('预览恢复状态不完整');
    const committed = await this.#commitPrepared(record, prepared);
    this.#recordTool(record, committed);
    record.prepared = null;
    if (isStale(committed)) return this.#recoverStale(record);
    if (committed.receipt.status !== 'succeeded'
      && committed.receipt.status !== 'already_satisfied') {
      throw new Error('恢复预览提交失败');
    }
    record.progress.publish('commit', '增量修改已提交');
    if (!await this.#safePoint(record, 'after_commit')) return false;
    if (record.state.needsReplan) return this.#plan(record);
    this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
    return true;
  }

  async #invokeRead(
    record: RunRecord,
    decision: Extract<AgentDecision, { type: 'query' | 'inspect' }>,
  ): Promise<DrawingToolExecution> {
    const invocation = decision.type === 'query'
      ? {
          capability: 'query_entities' as const,
          input: { selector: decision.selector },
        }
      : {
          capability: 'inspect_entity' as const,
          input: { nodeId: decision.nodeId },
        };
    record.progress.publish('tool_started', '正在读取图纸');
    const execution = await this.#tools.invoke({
      ...invocation,
      caller: 'model',
      toolCallId: decision.toolCallId,
      context: this.#toolContext(record),
    });
    record.progress.publish('tool_finished', '图纸读取完成');
    return execution;
  }

  async #commitPrepared(
    record: RunRecord,
    prepared: PreparedDrawingTransaction,
  ): Promise<DrawingToolExecution> {
    return this.#tools.invoke({
      capability: 'commit_transaction', caller: 'runtime',
      toolCallId: `${prepared.handle}:commit`,
      context: this.#toolContext(record),
      input: { previewHandle: prepared.handle },
    });
  }

  async #verifyWorkflowNode(record: RunRecord, nodeId: string): Promise<boolean> {
    const node = record.state.plan?.workflow.find((item) => item.id === nodeId);
    if (!node || node.completionCriteria.length === 0) return true;
    if (!await this.#safePoint(record, 'before_read')) return false;
    const result = await this.#tools.invoke({
      capability: 'verify_goal', caller: 'runtime',
      toolCallId: this.#callId(record, 'verify_node'),
      context: this.#toolContext(record),
      input: { assertions: node.completionCriteria },
    });
    this.#recordTool(record, result);
    return result.receipt.status === 'already_satisfied';
  }

  async #verifyGoal(record: RunRecord): Promise<boolean> {
    if (!await this.#safePoint(record, 'before_read')) return false;
    const result = await this.#tools.invoke({
      capability: 'verify_goal', caller: 'runtime',
      toolCallId: this.#callId(record, 'verify_goal'),
      context: this.#toolContext(record),
      input: { assertions: record.state.plan!.goal.acceptanceCriteria },
    });
    this.#recordTool(record, result);
    if (result.receipt.status !== 'already_satisfied') {
      record.progress.publish('revising', '最终确定性验收未满足，正在重新规划');
      return false;
    }
    // 视觉验收是 Drawing IR 确定性验收之后的附加条件，不能替代向量合法性。
    if (record.viewport && this.#acceptance) {
      return this.#verifyGoalVisual(record);
    }
    return true;
  }

  async #verifyGoalVisual(record: RunRecord): Promise<boolean> {
    const viewport = record.viewport!;
    let snapshot: GroundingSnapshot | undefined;
    if (this.#application.observeForAgent && this.#application.readObservationImage) {
      const observation = await this.#application.observeForAgent({
        drawingId: record.state.drawingId,
        includeAnnotations: shouldIncludeAnnotations(record),
        selectedIds: record.selectedIds,
        userViewport: viewport,
      });
      const overview = observation.views.find((view) => view.purpose === 'overview')
        ?? observation.views[0];
      const imageDataUrl = overview
        ? this.#application.readObservationImage(overview.image.handle)
        : null;
      if (overview && imageDataUrl) {
        snapshot = {
          width: overview.width,
          height: overview.height,
          imageDataUrl,
          rendererVersion: observation.rendererVersion,
          worldToImage: overview.worldToImage,
          nodes: structuredClone(overview.grounding),
        };
        record.vision = { snapshot, selection: [...record.selectedIds], observation };
        record.visionRevision = observation.revision;
      }
    }
    if (!snapshot) {
      snapshot = await this.#application.renderForVision({
        drawingId: record.state.drawingId,
        viewport,
        selectedIds: record.selectedIds,
        maxDimension: 1536,
      });
      record.vision = { snapshot, selection: [...record.selectedIds] };
      record.visionRevision = record.state.revision;
    }
    const result = await this.#callModel(record, 'acceptance', record.modelProfile.decision, (signal, onRawReply) => (
      this.#acceptance!.accept({
        goal: record.state.plan!.goal.objective,
        modelName: record.modelProfile.decision,
        image: snapshot.imageDataUrl,
        width: snapshot.width,
        height: snapshot.height,
        signal,
        deadlineAt: record.state.limits.deadlineAt,
        onRawReply,
      })
    ));
    this.#audit(record, 'state', {
      event: 'VISUAL_ACCEPTANCE',
      revision: record.state.revision,
      satisfied: result.satisfied,
      reason: result.reason,
    });
    record.previewDefects = result.satisfied ? [] : [{
      code: 'final-visual-rejection',
      message: result.reason || '整图视觉验收未满足目标',
      nodeIds: [],
      repairHint: '基于最新整图重新接地目标，避免重复上一轮无效的局部变换',
    }];
    return result.satisfied;
  }

  async #recoverStale(record: RunRecord): Promise<boolean> {
    this.#resetSpatialRepair(record);
    this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'staleRecoveries' });
    const summary = await this.#application.summarize({ drawingId: record.state.drawingId, limit: 100 });
    this.#transition(record, { type: 'REPLAN_REQUIRED', revision: summary.revision });
    return this.#plan(record);
  }

  #recordValidationRepair(record: RunRecord): boolean {
    if (record.spatialCandidateAttempt > 0) {
      if (record.spatialCandidateAttempt >= MAX_VALIDATION_REPAIRS + 1) {
        throw new Error(`空间编辑已生成 ${MAX_VALIDATION_REPAIRS + 1} 个候选，仍未通过验证`);
      }
      this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'validationRepairs' });
      return true;
    }
    if (record.state.recovery.validationRepairs >= MAX_VALIDATION_REPAIRS) {
      throw new Error(`事务验证修复已达到上限 ${MAX_VALIDATION_REPAIRS}`);
    }
    this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'validationRepairs' });
    return true;
  }

  #recordTool(record: RunRecord, execution: DrawingToolExecution): void {
    this.#transition(record, { type: 'RECEIPT_RECORDED', receipt: execution.receipt });
    if (execution.output !== undefined) {
      record.toolEvidence = [
        ...record.toolEvidence,
        { receipt: execution.receipt, output: execution.output },
      ].slice(-20);
    }
    const type = execution.receipt.capability === 'preview_transaction'
      ? 'preview'
      : execution.receipt.capability === 'commit_transaction'
        ? 'commit'
        : execution.receipt.capability === 'verify_goal'
          ? 'validation'
          : 'tool_call';
    this.#audit(record, type, {
      receipt: structuredClone(execution.receipt),
      ...(execution.prepared ? {
        prepared: {
          handle: execution.prepared.handle,
          episodeId: execution.prepared.episodeId,
          previewVersionId: execution.prepared.previewVersionId,
          regionId: execution.prepared.regionId,
          selectionVersionId: execution.prepared.selectionVersionId,
          strategy: execution.prepared.strategy,
        },
      } : {}),
    });
    if (execution.commit) {
      this.#enqueueAudit(record, () => this.#auditStore!.saveCommit(
        record.state.runId,
        execution.commit!,
      ));
    }
  }

  async #ensureEpisode(record: RunRecord): Promise<EditEpisode> {
    if (record.episode) return record.episode;
    const stored = await this.#episodeStore?.read(record.state.runId);
    if (stored) {
      if (stored.drawingId !== record.state.drawingId) throw new Error('EPISODE_SCOPE_MISMATCH');
      record.episode = stored;
      return stored;
    }
    const now = this.#now();
    const episode: EditEpisode = {
      schemaVersion: 1,
      id: `episode_${record.state.runId}`,
      runId: record.state.runId,
      drawingId: record.state.drawingId,
      baseRevision: record.state.revision,
      originalGoal: record.state.objective,
      status: 'active',
      regionVersions: [], selectionVersions: [], previewVersions: [], feedbackTurns: [],
      createdAt: now, updatedAt: now,
    };
    record.episode = episode;
    if (this.#episodeStore) {
      const snapshot = structuredClone(episode);
      record.episodeQueue = record.episodeQueue.then(() => this.#episodeStore!.create(snapshot));
    }
    return episode;
  }

  #persistEpisode(record: RunRecord): void {
    if (!this.#episodeStore || !record.episode) return;
    const snapshot = structuredClone(record.episode);
    record.episodeQueue = record.episodeQueue.then(() => this.#episodeStore!.save(snapshot));
  }

  #markEpisodePreview(
    record: RunRecord,
    status: 'rejected' | 'committed',
    defectCodes: string[],
  ): void {
    const preview = record.episode?.previewVersions.find((version) => version.status === 'active');
    if (!preview || !record.episode) return;
    preview.status = status;
    preview.defectCodes = [...new Set(defectCodes)];
    record.episode.updatedAt = this.#now();
    this.#persistEpisode(record);
  }

  async #safePoint(record: RunRecord, point: DrawingAgentSafePoint): Promise<boolean> {
    this.#transition(record, { type: 'SAFE_POINT', point });
    if (record.state.status === 'stopped') {
      this.#finish(record, 'stopped', '任务已停止');
      return false;
    }
    if (record.state.status === 'paused') {
      record.progress.publish('paused', '任务已暂停');
      return false;
    }
    return record.state.status === 'running' || record.state.status === 'planning';
  }

  async #callModel<T>(
    record: RunRecord,
    role: DrawingModelRole,
    _modelName: string,
    call: (
      signal: AbortSignal,
      onRawReply: (replyRole: DrawingModelRole, reply: string) => void,
    ) => Promise<T>,
  ): Promise<T> {
    const remaining = record.state.limits.deadlineAt - this.#now();
    if (remaining <= 0) throw new Error('任务已超过运行截止时间');
    const controller = new AbortController();
    record.activeController = controller;
    const timer = setTimeout(() => controller.abort(new Error(`${role} timeout`)), (
      Math.min(this.#stageTimeoutMs, remaining)
    ));
    (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
    record.progress.publish('model_started', role === 'planner' ? '正在规划' : '正在决定下一步');
    try {
      const result = await call(
        controller.signal,
        (replyRole, reply) => this.#auditRaw(record, replyRole, reply),
      );
      record.progress.publish('model_finished', role === 'planner' ? '规划完成' : '决策完成');
      return result;
    } finally {
      clearTimeout(timer);
      if (record.activeController === controller) record.activeController = null;
    }
  }

  /** 把模型原始返回写入审计(截断以避免审计体积过大),用于排查模型输出问题 */
  #auditRaw(record: RunRecord, role: DrawingModelRole, reply: string): void {
    const MAX_LENGTH = 8_000;
    const truncated = reply.length > MAX_LENGTH;
    this.#audit(record, 'model', {
      role,
      reply: truncated ? `${reply.slice(0, MAX_LENGTH)}…[truncated ${reply.length}]` : reply,
      truncated,
    });
  }

  #toolContext(record: RunRecord): DrawingToolContext {
    return {
      runId: record.state.runId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      actor: { type: 'AI', id: record.state.runId },
      ...(record.state.plan?.goal.id ? { goalId: record.state.plan.goal.id } : {}),
    };
  }

  #installPlan(record: RunRecord, plan: DrawingAgentPlan): void {
    record.planCommitBaseline = record.state.commitCount;
    this.#transition(record, { type: 'PLAN_READY', plan });
    this.#audit(record, 'plan', { plan: structuredClone(plan) });
    this.#enqueueAudit(record, async () => {
      const run = await this.#auditStore!.readRun(record.state.runId);
      await this.#auditStore!.updateManifest({
        ...run.manifest,
        goalSpec: structuredClone(plan.goal),
      });
    });
  }

  #discardPrepared(record: RunRecord): void {
    if (record.prepared) this.#tools.discardPrepared(record.prepared.handle);
    record.prepared = null;
    record.compiledEdit = null;
    record.spatialPreview = null;
  }

  #resetSpatialRepair(record: RunRecord): void {
    record.spatialRepairContext = null;
    record.spatialCandidateAttempt = 0;
  }

  #callId(record: RunRecord, prefix: string): string {
    record.sequence += 1;
    return `${prefix}_${record.sequence}`;
  }

  #transition(record: RunRecord, event: DrawingAgentEvent): void {
    const result = reduceDrawingAgentState(record.state, event);
    if (result.error) throw new Error(result.error.message);
    record.state = result.state;
    this.#audit(record, event.type === 'REPLAN_STARTED' || event.type === 'REPLAN_REQUIRED'
      ? 'replan'
      : 'state', {
      event: event.type,
      status: record.state.status,
      revision: record.state.revision,
      currentWorkflowNodeId: record.state.currentWorkflowNodeId,
      ...(event.type === 'SAFE_POINT' ? { point: event.point } : {}),
      ...(event.type === 'RECOVERY_RECORDED' ? { recovery: event.recovery } : {}),
      ...(event.type === 'FAILED' ? { error: event.error } : {}),
    });
  }

  #finish(
    record: RunRecord,
    type: 'stopped' | 'completed' | 'failed',
    title: string,
  ): void {
    if (record.resolved) return;
    this.#clearEditPreview(record, 'reject');
    this.#discardPrepared(record);
    this.#resetSpatialRepair(record);
    this.#tools.discardRun(record.state.runId);
    if (record.episode) {
      record.episode.status = type === 'completed' ? 'completed' : 'failed';
      record.episode.updatedAt = this.#now();
      this.#persistEpisode(record);
    }
    if (type !== 'failed' && record.perceptionPreviewIds.size > 0) {
      this.#publishPerceptionDelta(record, {
        runId: record.state.runId,
        sequence: 0,
        action: 'reject',
        slotIds: [],
        upserts: [],
        removeIds: [...record.perceptionPreviewIds],
        source: {
          page: record.source?.page ?? 1,
          viewId: 'page',
          stage: 'reconciliation',
        },
      }, 'primary');
    }
    record.progress.publish(
      type,
      title,
      type === 'failed' ? record.state.error ?? undefined : undefined,
    );
    record.resolved = true;
    record.resolveCompletion(record.state);
  }

  #require(runId: string): RunRecord {
    const record = this.#runs.get(runId);
    if (!record) throw new Error(`Agent run not found: ${runId}`);
    return record;
  }

  #audit(
    record: RunRecord,
    type: DrawingAgentAuditEvent['type'],
    payload: Record<string, unknown>,
  ): void {
    if (!this.#auditStore) return;
    record.auditSequence += 1;
    const event: DrawingAgentAuditEvent = {
      schemaVersion: 1,
      id: `audit_${record.auditSequence}`,
      runId: record.state.runId,
      type,
      timestamp: this.#now(),
      payload,
    };
    this.#enqueueAudit(record, () => this.#auditStore!.appendEvent(event));
  }

  #enqueueAudit(record: RunRecord, operation: () => Promise<void>): void {
    if (!this.#auditStore) return;
    record.auditQueue = record.auditQueue.then(operation);
  }
}

function semanticRegionBounds(region: SemanticRegion): Bounds2D {
  const points = region.worldContours.flatMap((contour) => contour);
  if (points.length === 0) throw new Error('SEMANTIC_REGION_BOUNDS_EMPTY');
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function targetHintFor(
  semanticDescription: string,
  scopeBounds: Bounds2D | undefined,
  selectedIds: string[],
  document: DrawingDocument,
  documentBounds: Bounds2D | null,
): TargetHint {
  const selectedBounds = unionBounds(selectedIds
    .map((id) => document.geometry.find((node) => node.id === id))
    .filter((node): node is GeometryNode => node !== undefined)
    .map((node) => roughGeometryBounds(node))
    .filter((bounds): bounds is Bounds2D => bounds !== null));
  const approximateBounds = scopeBounds ?? selectedBounds ?? undefined;
  return {
    semanticDescription,
    ...(approximateBounds ? { approximateBounds } : {}),
    preferredScale: preferredTargetScale(approximateBounds, documentBounds),
  };
}

function preferredTargetScale(
  target: Bounds2D | undefined,
  document: Bounds2D | null,
): TargetHint['preferredScale'] {
  if (!target || !document) return 'part';
  const documentArea = Math.max(document.maxX - document.minX, 1)
    * Math.max(document.maxY - document.minY, 1);
  const targetArea = Math.max(target.maxX - target.minX, 1)
    * Math.max(target.maxY - target.minY, 1);
  const ratio = targetArea / documentArea;
  if (ratio >= 0.55) return 'drawing';
  if (ratio >= 0.2) return 'assembly';
  if (ratio <= 0.015) return 'detail';
  return 'part';
}

function unionBounds(values: Bounds2D[]): Bounds2D | null {
  if (values.length === 0) return null;
  return {
    minX: Math.min(...values.map((bounds) => bounds.minX)),
    minY: Math.min(...values.map((bounds) => bounds.minY)),
    maxX: Math.max(...values.map((bounds) => bounds.maxX)),
    maxY: Math.max(...values.map((bounds) => bounds.maxY)),
  };
}

function spatialTolerance(bounds: Bounds2D): number {
  return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1) * 1e-6;
}

function pngFromDataUrl(value: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.byteLength > 0 ? bytes : null;
}

function invertAffine(transform: AffineTransform): AffineTransform {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('GENERATION_TRANSFORM_SINGULAR');
  }
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function stableGenerationSeed(runId: string, regionId: string): number {
  let hash = 2_166_136_261;
  for (const character of `${runId}\0${regionId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function isAdditiveRedrawGoal(goal: string): boolean {
  return /增加|添加|加上|新增|画上|戴上|长出/.test(goal);
}

function targetGeometryForDesign(
  document: DrawingDocument,
  selection: SpatialSelection,
  split: MaterializedSplit,
): GeometryNode[] {
  const targetFragmentIds = new Set(split.lineage
    .filter((entry) => entry.role === 'target')
    .map((entry) => entry.fragmentId));
  const targets = [
    ...selection.wholeNodes.map((id) => document.geometry.find((node) => node.id === id)),
    ...split.fragments.filter((node) => targetFragmentIds.has(node.id)),
  ].filter((node): node is GeometryNode => node !== undefined);
  return [...new Map(targets.map((node) => [node.id, structuredClone(node)])).values()];
}

function candidateProgress(candidateAttempt: number) {
  return {
    candidateAttempt,
    maxCandidateAttempts: MAX_VALIDATION_REPAIRS + 1,
  };
}

function candidateProgressFor(record: RunRecord) {
  return record.spatialCandidateAttempt > 0
    ? candidateProgress(record.spatialCandidateAttempt)
    : undefined;
}

function shouldReuseSpatialContext(
  repairFeedback: import('./types.js').DrawingPreviewDefect[],
): boolean {
  if (repairFeedback.length === 0) return false;
  return !repairFeedback.some((defect) => (
    /region-selection|selection-empty|wrong-target|target-not-found|stale|final-visual-rejection/i
      .test(defect.code)
  ));
}

function supersedeActive<T extends { status: string }>(versions: T[]): void {
  versions.forEach((version) => {
    if (version.status === 'active') version.status = 'superseded';
  });
}

function nextWorkflowNode(state: DrawingAgentState) {
  return state.plan?.workflow.find((node) => (
    node.status === 'pending'
    && node.dependsOn.every((dependency) => (
      state.plan!.workflow.find((candidate) => candidate.id === dependency)?.status === 'completed'
    ))
  ));
}

function assertDecisionMatchesCapability(record: RunRecord, decision: AgentDecision): void {
  const capability = record.state.plan?.workflow.find((node) => (
    node.id === record.state.currentWorkflowNodeId
  ))?.capability;
  const allowed = capability === 'query_entities'
    ? decision.type === 'query'
    : capability === 'inspect_entity'
      ? decision.type === 'inspect'
      : capability === 'edit_entities'
        ? decision.type === 'transact' || decision.type === 'finish'
        : false;
  if (!allowed) {
    throw new DrawingAgentProtocolError(
      'decision.type',
      `工作流能力 ${capability ?? 'unknown'} 不允许 ${decision.type} 决策`,
    );
  }
}

function decisionBudget(state: DrawingAgentState, now: number) {
  const budget = checkDrawingAgentBudget(state, now);
  return budget?.code === 'MAX_COMMITS' ? null : budget;
}

function shouldIncludeAnnotations(record: RunRecord): boolean {
  return /文字|文本|标注|尺寸|注释|text|annotation|dimension/i.test(record.planningObjective);
}

function effectiveCommitLimit(record: RunRecord): number {
  return Math.min(
    record.commitBaseline + record.state.limits.maxCommits,
    record.planCommitBaseline + (record.state.plan?.goal.riskPolicy.maxCommits ?? Infinity),
  );
}

function perceptionCompletionPlan(record: RunRecord): DrawingAgentPlan {
  const objective = record.inputMode === 'analyze_only'
    ? '分析图纸并形成可审计结果'
    : '将来源图纸重建为 Drawing IR';
  return {
    goal: {
      id: `goal_${record.state.runId}_perception`,
      objective,
      scope: { limit: 1 },
      acceptanceCriteria: [{ type: 'document.valid' }],
      riskPolicy: { candidateAllowed: true, maxCommits: Math.max(1, record.state.commitCount) },
    },
    workflow: [{
      id: 'verify_perception_result',
      capability: 'verify_goal',
      dependsOn: [],
      completionCriteria: [{ type: 'document.valid' }],
      status: 'pending',
    }],
    summary: objective,
  };
}

function feedbackLoopPlan(record: RunRecord): DrawingAgentPlan {
  const objective = record.inputMode === 'analyze_only'
    ? '逐步观察并分析来源图纸'
    : '通过来源反馈循环重建 Drawing IR';
  return {
    goal: {
      id: `goal_${record.state.runId}_feedback`,
      objective,
      scope: { limit: 1 },
      acceptanceCriteria: [{ type: 'document.valid' }],
      riskPolicy: { candidateAllowed: true, maxCommits: record.state.limits.maxCommits },
    },
    workflow: [],
    summary: objective,
  };
}

function feedbackStageProgress(stage: import('../drawing-feedback/loop-controller.js').FeedbackStage) {
  switch (stage) {
    case 'OBSERVE': return ['tool_started', '正在观察图纸轮廓'] as const;
    case 'VECTORIZE_SOURCE': return ['tool_started', '正在提取图纸中心线'] as const;
    case 'DRAW_VECTOR_DRAFT': return ['tool_started', '正在逐条绘制矢量底稿'] as const;
    case 'PROMOTE_PRIMITIVE': return ['validation', '正在提升为规范图元'] as const;
    case 'ANNOTATE_GEOMETRY': return ['tool_started', '正在逐条生成工程标注'] as const;
    case 'SELECT_TARGET': return ['model_started', '正在选择下一观察目标'] as const;
    case 'ACQUIRE_EVIDENCE': return ['tool_started', '正在提取局部证据'] as const;
    case 'PROPOSE_PATCH': return ['model_started', '正在生成局部修改'] as const;
    case 'PREVIEW_AND_RENDER': return ['validation', '正在把局部修改渲染回原图'] as const;
    case 'COMPARE': return ['validation', '正在比较来源与当前图纸'] as const;
    case 'COMMIT_LOCAL_RESULT': return ['validation', '局部验证通过，正在提交'] as const;
  }
  const exhaustive: never = stage;
  throw new Error(`未知反馈阶段: ${exhaustive}`);
}

function feedbackCorrectionTitle(action: import('../drawing-feedback/types.js').SlotLineageAction): string {
  switch (action) {
    case 'create': return '已建立一个图元';
    case 'update': return '已修正图元参数';
    case 'retype': return '已修正图元类型';
    case 'merge': return '已合并图元';
    case 'split': return '已拆分图元';
    case 'delete': return '已删除错误图元';
    case 'reject': return '已拒绝错误候选';
  }
}

function perceptionSummary(record: RunRecord): string {
  const candidate = record.perceptionLowConfidenceCount > 0
    ? `，其中 ${record.perceptionLowConfidenceCount} 个低置信度结果已标为候选`
    : '';
  const action = record.inputMode === 'analyze_only'
    ? '未修改当前图纸'
    : `形成 ${record.state.commitCount} 个增量提交`;
  const coverage = record.perceptionCoverageComplete
    ? ''
    : [
        record.perceptionIncompleteRegionCount > 0
          ? `${record.perceptionIncompleteRegionCount} 个区域尚未完整读取`
          : '',
        record.perceptionUnresolvedContourCount > 0
          ? `${record.perceptionUnresolvedContourCount} 个全局轮廓尚未参数化`
          : '',
      ].filter(Boolean).join('，');
  return `识别到 ${record.perceptionEntityCount} 个图元${candidate}；${action}${coverage ? `；注意：${coverage}` : ''}。`;
}

function perceptionStageTitle(stage: Extract<DrawingPerceptionOutput, { kind: 'stage' }>['stage']): string {
  switch (stage) {
    case 'asset_prepared': return '图纸来源已准备';
    case 'sheet_analyzed': return '图纸版面分析完成';
    case 'views_segmented': return '视图拆分完成';
    case 'global_contours_built': return '全局轮廓建档完成';
    case 'coverage_assessed': return '区域覆盖检查完成';
    case 'coverage_completed': return '图纸读取覆盖已收敛';
    case 'view_perceived': return '局部图元识别完成';
    case 'topology_built': return '几何拓扑构建完成';
    case 'dimensions_associated': return '尺寸关联完成';
    case 'patches_built': return '增量修改已生成';
    case 'completed': return '图纸解析完成';
  }
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function isStale(execution: DrawingToolExecution): boolean {
  return execution.receipt.status === 'stale'
    || (execution.receipt.outcome.kind === 'error'
      && execution.receipt.outcome.codes.includes('STALE_REVISION'));
}

function isTerminal(state: DrawingAgentState): boolean {
  return state.status === 'stopped' || state.status === 'completed' || state.status === 'failed';
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (
    error.name === 'AbortError'
    || /abort|stopped/i.test(error.message)
  );
}
