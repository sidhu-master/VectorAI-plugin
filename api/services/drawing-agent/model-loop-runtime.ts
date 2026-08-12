import { createHash, randomUUID } from 'node:crypto';

import {
  DrawingAgentProtocolError,
  type DrawingAgentAction,
  type HumanDecisionDraft,
  type HumanDecisionRequest,
  type HumanDecisionResponse,
  type PermissionGrant,
  type PerceptionPreviewDelta,
} from '../../../src/contracts/drawing-agent.js';
import type {
  DrawingDocument,
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';
import type { DrawingModelTools } from '../drawing-tools/drawing-tools.js';
import type { ModelDrawingToolRegistry } from '../drawing-tools/registry.js';
import type { ModelToolResult } from '../drawing-tools/types.js';
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
import {
  checkModelLedDrawingAgentBudget,
  createModelLedDrawingAgentState,
  reduceModelLedDrawingAgentState,
  type ModelLedDrawingAgentEvent,
  type ModelLedDrawingAgentLimits,
  type ModelLedDrawingAgentState,
} from './state.js';
import type { StartDrawingAgentRunInput } from './types.js';

interface ModelLedRuntimeLimits extends Omit<ModelLedDrawingAgentLimits, 'deadlineAt'> {
  wallClockMs: number;
}

export interface ModelLedDrawingAgentRuntimeOptions {
  application: DrawingApplication;
  registry: ModelDrawingToolRegistry;
  drawingTools: DrawingModelTools;
  model: DrawingAgentActionModel;
  interactions: HumanInteractionStore;
  interactionPolicy?: HumanInteractionPolicy;
  protections?: (document: DrawingDocument) => HumanInteractionProtection[];
  auditStore?: DrawingAgentAuditStore;
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
  previewSequence: number;
  auditSequence: number;
  auditQueue: Promise<void>;
}

const DEFAULT_LIMITS: ModelLedRuntimeLimits = {
  maxActions: 36,
  maxToolCalls: 28,
  maxConsecutiveReads: 12,
  maxCommits: 3,
  maxProtocolCorrections: 2,
  wallClockMs: 8 * 60_000,
};

const TERMINAL = new Set<ModelLedDrawingAgentState['status']>([
  'completed', 'failed', 'stopped',
]);

export class ModelLedDrawingAgentRuntime {
  readonly #application: DrawingApplication;
  readonly #registry: ModelDrawingToolRegistry;
  readonly #drawingTools: DrawingModelTools;
  readonly #model: DrawingAgentActionModel;
  readonly #interactions: HumanInteractionStore;
  readonly #interactionPolicy: HumanInteractionPolicy;
  readonly #protections: (document: DrawingDocument) => HumanInteractionProtection[];
  readonly #auditStore?: DrawingAgentAuditStore;
  readonly #limits: ModelLedRuntimeLimits;
  readonly #now: () => number;
  readonly #runs = new Map<string, RunRecord>();

  constructor(options: ModelLedDrawingAgentRuntimeOptions) {
    this.#application = options.application;
    this.#registry = options.registry;
    this.#drawingTools = options.drawingTools;
    this.#model = options.model;
    this.#interactions = options.interactions;
    this.#interactionPolicy = options.interactionPolicy ?? new HumanInteractionPolicy();
    this.#protections = options.protections ?? (() => []);
    this.#auditStore = options.auditStore;
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
      previewSequence: 0,
      auditSequence: 0,
      auditQueue: Promise.resolve(),
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
    const currentRevision = (await this.#application.open(record.state.drawingId)).revision;
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
        if (record.state.pendingInstructions.length > 0) {
          this.#transition(record, { type: 'INSTRUCTIONS_ACTIVATED' });
        }
        const action = await this.#nextAction(record);
        if (!action) return;
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
        this.#transition(record, { type: 'COMPLETED', summary: action.summary });
        this.#finish(record, 'completed', action.summary);
        return;
      }
    } catch (error) {
      if (record.controller?.signal.aborted) return;
      this.#fail(record, error instanceof Error ? error.message : String(error));
    } finally {
      record.controller = null;
      record.driving = false;
    }
  }

  async #nextAction(record: RunRecord): Promise<DrawingAgentAction | null> {
    const controller = new AbortController();
    record.controller = controller;
    const summary = await this.#application.summarize({
      drawingId: record.state.drawingId,
      limit: 100,
    });
    if (summary.revision !== record.state.revision) {
      record.state = { ...record.state, revision: summary.revision, currentPreviewHandle: null };
    }
    const observations = observationsFromToolResults(
      record.state.recentToolResults,
      (handle) => this.#application.readObservationImage(handle),
    );
    record.progress.publish('model_started', '正在根据当前图纸决定下一步');
    try {
      const action = await this.#model.next({
        objective: record.state.objective,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        episodeId: record.state.episodeId,
        drawingSummary: summary.summary,
        toolCatalog: this.#registry.catalog(),
        recentToolResults: record.state.recentToolResults,
        recentDiagnostics: record.state.recentDiagnostics,
        decisions: record.state.decisions,
        appendedInstructions: record.state.activeInstructions,
        ...(record.state.currentPreviewHandle
          ? { currentPreviewHandle: record.state.currentPreviewHandle }
          : {}),
        observations,
        modelName: modelForAttempt(record),
        attempt: record.state.protocolCorrectionCount + 1,
        ...(record.protocolFeedback ? { protocolFeedback: record.protocolFeedback } : {}),
        signal: controller.signal,
        deadlineAt: record.state.limits.deadlineAt,
        onRawReply: (reply) => this.#audit(record, 'model', {
          role: 'drawing-action', reply: safeModelReply(reply),
        }),
      });
      record.protocolFeedback = undefined;
      record.progress.publish('model_finished', '已确定下一步');
      return action;
    } catch (error) {
      if (controller.signal.aborted) return null;
      if (error instanceof DrawingAgentProtocolError) {
        this.#transition(record, { type: 'PROTOCOL_CORRECTION_RECORDED' });
        record.protocolFeedback = error.message;
        record.progress.publish('validation', '正在修正动作协议', error.message);
        return this.#nextAction(record);
      }
      throw error;
    }
  }

  async #executeTool(
    record: RunRecord,
    action: Extract<DrawingAgentAction, { type: 'tool' }>,
  ): Promise<void> {
    const presentation = toolPresentation(action.tool);
    record.progress.publish('tool_started', presentation.started);
    const result = await this.#registry.invoke({
      runId: record.state.runId,
      episodeId: record.state.episodeId,
      drawingId: record.state.drawingId,
      revision: record.state.revision,
      toolCallId: action.toolCallId,
      tool: action.tool,
      input: action.input,
    });
    this.#transition(record, { type: 'MODEL_TOOL_RECORDED', result });
    this.#audit(record, 'tool_call', { receipt: result.receipt });
    if (result.receipt.status !== 'succeeded') {
      record.progress.publish('tool_finished', presentation.failed, result.receipt.error?.code);
      return;
    }
    const output = asRecord(result.output);
    if (output?.previewHandle && typeof output.previewHandle === 'string') {
      const candidate = this.#drawingTools.readCandidate({
        runId: record.state.runId,
        episodeId: record.state.episodeId,
        drawingId: record.state.drawingId,
        revision: record.state.revision,
        previewHandle: output.previewHandle,
      });
      if (candidate) {
        this.#transition(record, {
          type: 'PREVIEW_READY',
          previewHandle: candidate.previewHandle,
          candidateDigest: digestDrawingTransaction(candidate.transaction),
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
  }

  async #commit(
    record: RunRecord,
    action: Extract<DrawingAgentAction, { type: 'commit' }>,
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
    const workspace = await this.#application.open(record.state.drawingId);
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
        diagnosticAcknowledgements: record.state.recentDiagnostics.map((item) => item.code),
      },
    });
    this.#transition(record, { type: 'MODEL_TOOL_RECORDED', result });
    this.#audit(record, 'tool_call', { receipt: result.receipt });
    if (result.receipt.status !== 'succeeded') {
      record.progress.publish('tool_finished', '提交未成功', result.receipt.error?.code);
      return true;
    }
    const output = asRecord(result.output);
    if (output?.status === 'committed') {
      this.#transition(record, {
        type: 'COMMIT_RECORDED', revision: result.receipt.revisionAfter,
      });
      const current = await this.#application.open(record.state.drawingId);
      const commit = current.commits.at(-1);
      if (commit) this.#enqueueAudit(record, () => this.#auditStore!.saveCommit(record.state.runId, commit));
      this.#audit(record, 'commit', {
        commitId: output.commitId,
        revision: result.receipt.revisionAfter,
        summary: action.summary,
      });
      record.progress.publish('committed', '增量修改已提交', undefined, undefined, {
        overlay: { kind: 'clear' },
      });
    }
    return true;
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

  #recordSyntheticResult(record: RunRecord, tool: string, code: string): void {
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
        error: { code, retryable: true, suggestedAction: 'replan' },
      },
    };
    this.#transition(record, { type: 'MODEL_TOOL_RECORDED', result });
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
    this.#drawingTools.discardRun(record.state.runId);
    record.progress.publish(type, title, detail, undefined, { overlay: { kind: 'clear' } });
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

function modelForAttempt(record: RunRecord): string {
  return record.state.protocolCorrectionCount >= 2
    ? record.input.modelProfile.repair
    : record.input.modelProfile.decision;
}

function actionTitle(action: DrawingAgentAction): string {
  if (action.type === 'tool') return toolPresentation(action.tool).started;
  if (action.type === 'commit') return '正在决定是否提交当前候选';
  if (action.type === 'request-human-decision') return '正在请求用户决定';
  return '正在完成任务';
}

function actionKind(action: DrawingAgentAction): 'model' | 'tool' | 'preview' | 'decision' | 'commit' {
  if (action.type === 'tool') return action.tool === 'preview_transaction' ? 'preview' : 'tool';
  if (action.type === 'request-human-decision') return 'decision';
  if (action.type === 'commit') return 'commit';
  return 'model';
}

function toolPresentation(tool: string): { started: string; finished: string; failed: string } {
  const titles: Record<string, [string, string]> = {
    render_drawing: ['正在观察图纸', '图纸观察已更新'],
    query_nodes: ['正在查询图元', '图元查询完成'],
    inspect_nodes: ['正在检查图元结构', '图元结构已读取'],
    measure_geometry: ['正在测量几何关系', '几何测量完成'],
    build_topology: ['正在建立全图拓扑', '全图拓扑已建立'],
    trace_paths: ['正在沿连接路径追踪', '路径候选已找到'],
    find_interfaces: ['正在检查连接接口', '连接接口已读取'],
    inspect_fragment: ['正在检查局部曲线', '局部曲线已读取'],
    materialize_split: ['正在生成拆分候选', '拆分候选已生成'],
    preview_transaction: ['正在生成增量预览', '增量预览已生成'],
    evaluate_preview: ['正在检查当前预览', '预览诊断已完成'],
    redraw_region: ['正在重绘局部形状', '局部重绘候选已生成'],
    vectorize_image: ['正在转换为可编辑图形', '矢量候选已生成'],
    fit_geometry: ['正在拟合解析图元', '几何拟合候选已生成'],
    recompute_annotations: ['正在重算派生标注', '标注候选已生成'],
  };
  const [started, finished] = titles[tool] ?? ['正在调用图纸工具', '图纸工具已完成'];
  return { started, finished, failed: `${finished}失败` };
}

function progressType(tool: string) {
  if (tool === 'trace_paths' || tool === 'build_topology') return 'topology_resolved' as const;
  if (tool === 'render_drawing' || tool === 'query_nodes' || tool === 'inspect_nodes') {
    return 'region_overlay' as const;
  }
  if (tool === 'materialize_split') return 'split_materialized' as const;
  if (tool === 'preview_transaction') return 'previewing' as const;
  if (tool === 'evaluate_preview') return 'verifying' as const;
  if (tool === 'redraw_region') return 'generating' as const;
  if (tool === 'vectorize_image' || tool === 'fit_geometry') return 'vectorizing' as const;
  return 'tool_finished' as const;
}

function toolOverlay(tool: string, result: ModelToolResult) {
  const output = asRecord(result.output);
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
  if (tool === 'preview_transaction' && typeof output?.previewHandle === 'string') {
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

function previewDelta(
  record: RunRecord,
  tool: string,
  output: Record<string, unknown> | null,
): PerceptionPreviewDelta | undefined {
  if (tool !== 'evaluate_preview') return undefined;
  const raw = asRecord(output?.previewDelta);
  if (!raw || !Array.isArray(raw.upserts) || !Array.isArray(raw.removeIds)) return undefined;
  const upserts = raw.upserts.filter((node): node is PerceptionPreviewDelta['upserts'][number] => {
    const value = asRecord(node);
    return typeof value?.id === 'string' && typeof value.type === 'string';
  });
  const previewHandle = typeof output?.previewHandle === 'string'
    ? output.previewHandle
    : record.state.currentPreviewHandle ?? 'preview';
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
      page: 1,
      viewId: previewHandle,
      stage: 'edit-preview',
    },
  };
}

function observationsFromToolResults(
  results: ModelToolResult[],
  readImage: (handle: string) => string | null,
): ModelLoopObservation[] {
  const observations = new Map<string, ModelLoopObservation>();
  for (const result of results) {
    const output = asRecord(result.output);
    const observation = output?.observation ? asRecord(output.observation) : output;
    if (!observation || !Array.isArray(observation.views)) continue;
    for (const rawView of observation.views) {
      const view = asRecord(rawView);
      const image = asRecord(view?.image);
      if (!view || !image || !isString(image.handle)
        || !isString(view.id) || !isString(view.purpose)
        || !isFiniteNumber(view.width) || !isFiniteNumber(view.height)
        || !Array.isArray(view.worldToImage)) continue;
      const imageDataUrl = readImage(image.handle);
      if (!imageDataUrl) continue;
      observations.set(view.id, {
        id: view.id,
        purpose: previewPurpose(view.purpose, Boolean(output?.previewHandle)),
        imageDataUrl,
        width: view.width,
        height: view.height,
        worldBounds: view.worldBounds as ModelLoopObservation['worldBounds'],
        worldToImage: view.worldToImage as unknown as ModelLoopObservation['worldToImage'],
        grounding: Array.isArray(view.grounding)
          ? view.grounding as ModelLoopObservation['grounding']
          : [],
      });
    }
  }
  return [...observations.values()].slice(-6);
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
> & { message?: string; action?: string }> {
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
