import { DrawingAgentProtocolError, type AgentDecision } from '../../../src/contracts/drawing-agent.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import { RunProgressChannel } from '../agent-runtime/progress.js';
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
}

type RuntimeApplication = Pick<DrawingApplication, 'summarize'>;

interface RuntimeTools {
  invoke(input: DrawingToolInvocation): Promise<DrawingToolExecution>;
  discardPrepared(handle: string): boolean;
  discardRun(runId: string): number;
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
}

const DEFAULT_LIMITS: RuntimeLimitsInput = {
  maxDecisions: 40,
  maxCommits: 8,
  maxConsecutiveReads: 8,
  wallClockMs: 240_000,
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
      if (record.state.needsReplan || !record.state.plan || record.state.status === 'planning') {
        if (!await this.#plan(record)) return;
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
    const baseInstruction = record.state.activeInstructions.join('\n');
    let plan;
    try {
      plan = await this.#callModel(record, 'planner', record.modelProfile.planner, (signal) => (
        this.#planner.plan({
          objective: record.state.objective,
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
          objective: record.state.objective,
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
    this.#transition(record, { type: 'PLAN_READY', plan });
    this.#audit(record, 'plan', { plan: structuredClone(plan) });
    this.#enqueueAudit(record, async () => {
      const run = await this.#auditStore!.readRun(record.state.runId);
      await this.#auditStore!.updateManifest({
        ...run.manifest,
        goalSpec: structuredClone(plan.goal),
      });
    });
    if (record.state.status === 'paused') {
      record.progress.publish('paused', '任务已暂停');
      return false;
    }
    return true;
  }

  async #runWorkflowNode(record: RunRecord, nodeId: string): Promise<boolean> {
    while (record.state.status === 'running' && record.state.currentWorkflowNodeId === nodeId) {
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
        continue;
      }
      if (decision.type === 'transact') {
        if (record.state.commitCount >= effectiveCommitLimit(record.state)) {
          throw new Error(`已达到最大提交次数 ${effectiveCommitLimit(record.state)}`);
        }
        const node = record.state.plan?.workflow.find((item) => item.id === nodeId);
        const preview = await this.#tools.invoke({
          capability: 'preview_transaction', caller: 'model',
          toolCallId: decision.toolCallId,
          context: this.#toolContext(record),
          input: { commands: decision.commands, postconditions: node?.completionCriteria ?? [] },
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
      actor: { type: 'AI', id: 'drawing-agent' },
      ...(record.state.plan?.goal.id ? { goalId: record.state.plan.goal.id } : {}),
    };
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

function decisionBudget(state: DrawingAgentState, now: number) {
  const budget = checkDrawingAgentBudget(state, now);
  return budget?.code === 'MAX_COMMITS' ? null : budget;
}

function effectiveCommitLimit(state: DrawingAgentState): number {
  return Math.min(state.limits.maxCommits, state.plan?.goal.riskPolicy.maxCommits ?? Infinity);
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
