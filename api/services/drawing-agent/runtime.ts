import {
  DrawingAgentProtocolError,
  type AgentDecision,
  type DrawingAgentPlan,
} from '../../../src/contracts/drawing-agent.js';
import type { PerceptionPreviewDelta } from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
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
  DrawingDecisionModelAdapter,
  DrawingPlannerModelAdapter,
  DrawingToolContext,
  DrawingToolEvidence,
  DrawingToolExecution,
  DrawingToolInvocation,
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

type RuntimeApplication = Pick<DrawingApplication, 'summarize'>;

interface RuntimeTools {
  invoke(input: DrawingToolInvocation): Promise<DrawingToolExecution>;
  discardPrepared(handle: string): boolean;
  discardRun(runId: string): number;
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
  inputMode: DrawingInputMode;
  planningObjective: string;
  perceptionCompleted: boolean;
  commitBaseline: number;
  perceptionBatchIds: Set<string>;
  perceptionEntityCount: number;
  perceptionLowConfidenceCount: number;
  perceptionCoverageComplete: boolean;
  perceptionIncompleteRegionCount: number;
  perceptionUnresolvedContourCount: number;
  perceptionPreviewIds: Set<string>;
  perceptionPreviewSequence: number;
  feedbackCheckpoint: DrawingFeedbackCheckpoint | null;
}

export interface DrawingAgentRunHandle {
  runId: string;
  completion: Promise<DrawingAgentState>;
}

export interface DrawingAgentRuntimeOptions {
  application: RuntimeApplication;
  tools: Pick<DrawingToolRegistry, 'invoke' | 'discardPrepared' | 'discardRun'>;
  planner: DrawingPlannerModelAdapter;
  decision: DrawingDecisionModelAdapter;
  now?: () => number;
  stageTimeoutMs?: number;
  limits?: Partial<RuntimeLimitsInput>;
  idFactory?: unknown;
  auditStore?: DrawingAgentAuditStore;
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
  wallClockMs: 240_000,
  maxPerceptionCommits: 128,
};
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const MAX_VALIDATION_REPAIRS = 2;

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
      inputMode: interpretation.mode,
      planningObjective: interpretation.modificationGoal ?? input.goal.trim(),
      perceptionCompleted: !input.source,
      commitBaseline: 0,
      perceptionBatchIds: new Set(),
      perceptionEntityCount: 0,
      perceptionLowConfidenceCount: 0,
      perceptionCoverageComplete: true,
      perceptionIncompleteRegionCount: 0,
      perceptionUnresolvedContourCount: 0,
      perceptionPreviewIds: new Set(),
      perceptionPreviewSequence: 0,
      feedbackCheckpoint: null,
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
    await this.#require(runId).auditQueue;
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
    this.#audit(record, 'instruction', { instruction: instruction.trim() });
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
          if (!await this.#verifyGoal(record)) return;
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
        if (output.kind === 'preview') {
          record.progress.publish('validation', '局部修改已进入来源对照');
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
          this.#recordTool(record, output.execution);
          record.progress.publish('commit', '已提交一个局部图纸修改');
          continue;
        }
        if (output.kind === 'correction') {
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
          const message = `槽位 ${output.slotId} 连续三次修正未改善`;
          this.#transition(record, { type: 'FAILED', error: message });
          this.#finish(record, 'failed', '局部区域未收敛');
          return;
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
    for (const node of delta.upserts) record.perceptionPreviewIds.add(node.id);
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
    try {
      plan = await this.#callModel(record, 'planner', record.modelProfile.planner, (signal) => (
        this.#planner.plan({
          objective: record.planningObjective,
          ...(baseInstruction ? { instruction: baseInstruction } : {}),
          drawingId: record.state.drawingId,
          revision: summary.revision,
          summary: summary.summary,
          modelName: record.modelProfile.planner,
          signal,
          deadlineAt: record.state.limits.deadlineAt,
        })
      ));
    } catch (error) {
      if (!(error instanceof DrawingAgentProtocolError) || record.state.recovery.schemaCorrections >= 1) {
        throw error;
      }
      this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'schemaCorrections' });
      plan = await this.#callModel(record, 'planner', record.modelProfile.planner, (signal) => (
        this.#planner.plan({
          objective: record.planningObjective,
          instruction: [baseInstruction, `上次输出不符合协议：${error.message}，请只返回合法 JSON。`]
            .filter(Boolean).join('\n'),
          drawingId: record.state.drawingId,
          revision: summary.revision,
          summary: summary.summary,
          modelName: record.modelProfile.planner,
          signal,
          deadlineAt: record.state.limits.deadlineAt,
        })
      ));
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
          throw new Error(`工作流节点 ${nodeId} 验收条件未满足`);
        }
        this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
        return true;
      }
      if (!await this.#safePoint(record, 'before_model')) return false;
      if (record.state.needsReplan) return this.#plan(record);
      const budget = decisionBudget(record.state, this.#now());
      if (budget) throw new Error(budget.message);
      const decision = await this.#nextDecision(record);
      if (decision.type === 'query' || decision.type === 'inspect') {
        if (!await this.#safePoint(record, 'before_read')) return false;
        if (record.state.needsReplan) return this.#plan(record);
        const execution = await this.#invokeRead(record, decision);
        this.#recordTool(record, execution);
        if (execution.receipt.status === 'not_found') return this.#recoverStale(record);
        if (!await this.#verifyWorkflowNode(record, nodeId)) {
          throw new Error(`工作流节点 ${nodeId} 验收条件未满足`);
        }
        this.#transition(record, { type: 'WORKFLOW_NODE_COMPLETED', nodeId });
        return true;
      }
      if (decision.type === 'transact') {
        if (record.state.commitCount >= effectiveCommitLimit(record)) {
          throw new Error(`已达到最大提交次数 ${effectiveCommitLimit(record)}`);
        }
        const preview = await this.#tools.invoke({
          capability: 'preview_transaction', caller: 'model',
          toolCallId: decision.toolCallId,
          context: this.#toolContext(record),
          input: { commands: decision.commands, postconditions: workflowNode.completionCriteria },
        });
        this.#recordTool(record, preview);
        record.prepared = preview.prepared ?? null;
        record.progress.publish('validation', '增量修改预览完成');
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
        const committed = await this.#commitPrepared(record, preview.prepared);
        this.#recordTool(record, committed);
        record.prepared = null;
        if (isStale(committed)) return this.#recoverStale(record);
        if (committed.receipt.status !== 'succeeded'
          && committed.receipt.status !== 'already_satisfied') {
          if (!this.#recordValidationRepair(record)) return false;
          continue;
        }
        record.progress.publish('commit', '增量修改已提交');
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

  async #nextDecision(record: RunRecord): Promise<AgentDecision> {
    const call = async (modelName: string) => {
      this.#transition(record, { type: 'DECISION_RECORDED' });
      const decision = await this.#callModel(record, 'decision', modelName, (signal) => this.#decision.decide({
        plan: record.state.plan!,
        currentWorkflowNodeId: record.state.currentWorkflowNodeId!,
        revision: record.state.revision,
        pendingInstructions: [...record.state.activeInstructions],
        recentReceipts: [...record.state.recentReceipts],
        toolEvidence: [...record.toolEvidence],
        attempt: record.state.decisionCount + 1,
        modelName,
        signal,
        deadlineAt: record.state.limits.deadlineAt,
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
      decision = await call(record.modelProfile.decision);
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
      throw new Error('最终验收条件未满足');
    }
    return true;
  }

  async #recoverStale(record: RunRecord): Promise<boolean> {
    this.#transition(record, { type: 'RECOVERY_RECORDED', recovery: 'staleRecoveries' });
    const summary = await this.#application.summarize({ drawingId: record.state.drawingId, limit: 100 });
    this.#transition(record, { type: 'REPLAN_REQUIRED', revision: summary.revision });
    return this.#plan(record);
  }

  #recordValidationRepair(record: RunRecord): boolean {
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
    this.#audit(record, type, { receipt: structuredClone(execution.receipt) });
    if (execution.commit) {
      this.#enqueueAudit(record, () => this.#auditStore!.saveCommit(
        record.state.runId,
        execution.commit!,
      ));
    }
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
    role: 'planner' | 'decision',
    _modelName: string,
    call: (signal: AbortSignal) => Promise<T>,
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
      const result = await call(controller.signal);
      record.progress.publish('model_finished', role === 'planner' ? '规划完成' : '决策完成');
      return result;
    } finally {
      clearTimeout(timer);
      if (record.activeController === controller) record.activeController = null;
    }
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
    this.#discardPrepared(record);
    this.#tools.discardRun(record.state.runId);
    if (record.perceptionPreviewIds.size > 0) {
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
    record.progress.publish(type, title);
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

function effectiveCommitLimit(record: RunRecord): number {
  return record.commitBaseline + Math.min(
    record.state.limits.maxCommits,
    record.state.plan?.goal.riskPolicy.maxCommits ?? Infinity,
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
    case 'SELECT_TARGET': return ['planning', '正在选择下一观察目标'] as const;
    case 'ACQUIRE_EVIDENCE': return ['tool_started', '正在提取局部证据'] as const;
    case 'PROPOSE_PATCH': return ['model_started', '正在生成局部修改'] as const;
    case 'PREVIEW_AND_RENDER': return ['validation', '正在把局部修改渲染回原图'] as const;
    case 'COMPARE': return ['validation', '正在比较来源与当前图纸'] as const;
    case 'COMMIT_LOCAL_RESULT': return ['validation', '局部验证通过，正在提交'] as const;
  }
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
