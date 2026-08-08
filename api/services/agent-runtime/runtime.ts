import { commitPatch, createHistory } from '../../../src/core/history/history.js';
import { compileIntentToPatch } from '../../../src/core/patch/intent-to-patch.js';
import {
  buildRuntimeContext,
  createRuntimeContextLedger,
  recordReceipt,
} from '../../../src/core/runtime/context.js';
import type { SpatialToolReceipt } from '../../../src/core/runtime/receipts.js';
import {
  createAgentRunState,
  reduceAgentRun,
  type AgentRunState,
} from '../../../src/core/runtime/state-machine.js';
import { AgentRunRegistry, type AgentRunRecord } from './registry.js';
import { RunProgressChannel } from './progress.js';
import type { AuditStore } from '../audit/types.js';
import type {
  AgentExecutorAdapter,
  AgentAttachmentPreparer,
  AgentPlannerAdapter,
  StartAgentRunInput,
} from './types.js';

export interface AgentRuntimeOptions {
  planner: AgentPlannerAdapter;
  executor: AgentExecutorAdapter;
  registry?: AgentRunRegistry;
  now?: () => number;
  stageTimeoutMs?: number;
  auditStore?: AuditStore;
  attachmentPreparer?: AgentAttachmentPreparer;
}

export interface AgentRunHandle {
  runId: string;
  completion: Promise<AgentRunState>;
}

export class AgentRuntime {
  private readonly planner: AgentPlannerAdapter;
  private readonly executor: AgentExecutorAdapter;
  private readonly registry: AgentRunRegistry;
  private readonly now: () => number;
  private readonly stageTimeoutMs: number;
  private readonly auditStore?: AuditStore;
  private readonly attachmentPreparer: AgentAttachmentPreparer;
  private sequence = 0;

  constructor(options: AgentRuntimeOptions) {
    this.planner = options.planner;
    this.executor = options.executor;
    this.registry = options.registry ?? new AgentRunRegistry();
    this.now = options.now ?? Date.now;
    this.stageTimeoutMs = options.stageTimeoutMs ?? 120_000;
    this.auditStore = options.auditStore;
    this.attachmentPreparer = options.attachmentPreparer ?? {
      prepare: async ({ image, mimeType }) => ({ image, mimeType }),
    };
  }

  start(input: StartAgentRunInput): AgentRunHandle {
    const createdAt = this.now();
    let resolveCompletion!: (state: AgentRunState) => void;
    const completion = new Promise<AgentRunState>((resolve) => { resolveCompletion = resolve; });
    const progress = new RunProgressChannel(input.runId, createdAt, 25_000, this.now);
    const record: AgentRunRecord = {
      state: createAgentRunState({
        runId: input.runId,
        goal: input.goal,
        history: createHistory(input.model),
        context: createRuntimeContextLedger(input.goal, input.stableRules ?? []),
        createdAt,
      }),
      progress,
      activeController: null,
      completion,
      resolveCompletion,
      auditQueue: Promise.resolve(),
      referenceAttachment: input.image && input.mimeType
        ? { image: input.image, mimeType: input.mimeType }
        : undefined,
    };
    this.registry.add(input.runId, record);
    this.enqueueAudit(record, () => this.auditStore!.startRun({
      runId: input.runId,
      startedAt: createdAt,
      protocolVersion: input.model.version,
      goal: input.goal,
    }));
    progress.subscribe((event) => {
      this.enqueueAudit(record, () => this.auditStore!.appendEvent({
        id: event.id,
        runId: event.runId,
        type: event.type,
        timestamp: event.timestamp,
        payload: { title: event.title, detail: event.detail, elapsedMs: event.elapsedMs },
      }));
    });
    progress.publish('accepted', '任务已受理');
    void Promise.resolve().then(() => this.run(record));
    return { runId: input.runId, completion };
  }

  getState(runId: string): AgentRunState | undefined {
    return this.registry.get(runId)?.state;
  }

  getProgress(runId: string): RunProgressChannel | undefined {
    return this.registry.get(runId)?.progress;
  }

  async flushAudit(runId: string): Promise<void> {
    await this.registry.require(runId).auditQueue;
  }

  pause(runId: string): AgentRunState {
    const record = this.registry.require(runId);
    record.state = reduceAgentRun(record.state, { type: 'PAUSE_REQUESTED' }).state;
    return record.state;
  }

  resume(runId: string): AgentRunState {
    const record = this.registry.require(runId);
    record.state = reduceAgentRun(record.state, { type: 'RESUME' }).state;
    record.progress.publish('resumed', '任务已继续');
    void Promise.resolve().then(async () => {
      try {
        if (record.state.needsReplan && record.state.activeInstruction) await this.replan(record);
        await this.runSteps(record);
      } catch (error) {
        if (record.state.status === 'stopping' || isAbort(error)) this.finishStopped(record);
        else this.finishFailed(record, error);
      }
    });
    return record.state;
  }

  addInstruction(runId: string, instruction: string): AgentRunState {
    const record = this.registry.require(runId);
    record.state = reduceAgentRun(record.state, { type: 'INSTRUCTION_ADDED', instruction }).state;
    return record.state;
  }

  stop(runId: string): AgentRunState {
    const record = this.registry.require(runId);
    record.state = reduceAgentRun(record.state, { type: 'STOP_REQUESTED' }).state;
    record.activeController?.abort(new Error('Agent run stopped'));
    return record.state;
  }

  private async run(record: AgentRunRecord): Promise<void> {
    try {
      let attachment;
      if (record.referenceAttachment) {
        record.progress.publish('tool_started', '正在处理输入图纸');
        const attachmentStage = this.createStage(record);
        try {
          attachment = await this.attachmentPreparer.prepare({
            ...record.referenceAttachment,
            signal: attachmentStage.controller.signal,
          });
          record.referenceAttachment = attachment;
          record.progress.publish('tool_finished', '输入图纸处理完成');
        } catch (error) {
          record.referenceAttachment = undefined;
          throw error;
        } finally {
          attachmentStage.clear();
        }
        if (record.state.status === 'stopping') return this.finishStopped(record);
      }
      record.progress.publish('planning', '正在规划任务');
      const stage = this.createStage(record);
      let plan;
      try {
        plan = await this.planner.plan({
          goal: record.state.goal,
          model: record.state.history.model,
          image: attachment?.image,
          mimeType: attachment?.mimeType,
          signal: stage.controller.signal,
          deadlineAt: stage.deadlineAt,
        });
      } finally {
        stage.clear();
      }
      if (record.state.status === 'stopping') return this.finishStopped(record);
      record.state = reduceAgentRun(record.state, { type: 'PLAN_READY', plan }).state;
      record.state = reduceAgentRun(record.state, { type: 'SAFE_POINT' }).state;
      if (record.state.status === 'paused') {
        record.progress.publish('paused', '任务已暂停');
        return;
      }
      if (record.state.needsReplan && record.state.activeInstruction) await this.replan(record);
      await this.runSteps(record);
    } catch (error) {
      if (record.state.status === 'stopping' || isAbort(error)) this.finishStopped(record);
      else this.finishFailed(record, error);
    }
  }

  private async runSteps(record: AgentRunRecord): Promise<void> {
    while (record.state.status === 'running') {
      const step = record.state.plan?.steps[record.state.currentStepIndex];
      if (!step) {
        this.finishCompleted(record);
        return;
      }
      const stage = this.createStage(record);
      let previousErrors: string[] = [];
      let committed = false;

      try {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          if (isStopping(record)) return this.finishStopped(record);
          record.progress.publish('tool_started', `正在执行：${step.description}`);
          const built = buildRuntimeContext(record.state.context);
          record.state = { ...record.state, context: built.nextLedger };
          const intent = await this.executor.execute({
            goal: record.state.goal,
            plan: record.state.plan!,
            step,
            model: record.state.history.model,
            context: built.context,
            image: record.referenceAttachment?.image,
            mimeType: record.referenceAttachment?.mimeType,
            attempt,
            previousErrors,
            signal: stage.controller.signal,
            deadlineAt: stage.deadlineAt,
          });
          if (isStopping(record)) return this.finishStopped(record);

          const compiled = compileIntentToPatch(intent, record.state.history.model);
          if (compiled.errors.length > 0) {
            previousErrors = compiled.errors;
            record.progress.publish('validation', '输出验证失败', previousErrors.join('; '));
            continue;
          }
          const result = commitPatch(record.state.history, {
            id: this.nextId('commit'),
            runId: record.state.runId,
            stepId: String(step.id),
            source: 'AI',
            patch: compiled.patch,
            confidence: intent.confidence,
            timestamp: this.now(),
          });
          if ('errors' in result) {
            previousErrors = result.errors.map((item) => item.message);
            record.progress.publish('validation', '几何验证失败', previousErrors.join('; '));
            continue;
          }

          const receipt: SpatialToolReceipt = {
            toolCallId: this.nextId('tool'),
            toolName: step.action,
            status: 'success',
            summary: intent.description ?? step.description,
            durableFacts: {},
            transientSignals: { attempt },
            patch: compiled.patch,
            validation: { valid: true, errors: [] },
            needReplan: false,
          };
          record.state = {
            ...record.state,
            history: result.history,
            context: recordReceipt(record.state.context, receipt),
          };
          this.enqueueAudit(record, () => this.auditStore!.saveCommit(result.commit));
          record.progress.publish('commit', intent.description ?? step.description);
          record.state = reduceAgentRun(record.state, { type: 'STEP_COMPLETED' }).state;
          record.state = reduceAgentRun(record.state, { type: 'SAFE_POINT' }).state;
          committed = true;
          break;
        }
      } finally {
        stage.clear();
      }

      if (!committed) {
        record.state = reduceAgentRun(record.state, { type: 'PAUSE_REQUESTED' }).state;
        record.state = reduceAgentRun(record.state, { type: 'SAFE_POINT' }).state;
        record.progress.publish('paused', '验证连续失败，任务已暂停', previousErrors.join('; '));
        record.resolveCompletion(record.state);
        return;
      }
      if (record.state.status === 'paused') {
        record.progress.publish('paused', '任务已暂停');
        return;
      }
      if (record.state.needsReplan && record.state.activeInstruction) {
        await this.replan(record);
      }
      if (record.state.status === 'completed') {
        this.finishCompleted(record);
        return;
      }
    }
  }

  private finishStopped(record: AgentRunRecord): void {
    record.referenceAttachment = undefined;
    record.state = reduceAgentRun(record.state, { type: 'STOPPED' }).state;
    record.progress.publish('stopped', '任务已停止');
    this.enqueueAudit(record, () => this.auditStore!.finishRun(record.state.runId, record.state.history.model));
    record.resolveCompletion(record.state);
  }

  private async replan(record: AgentRunRecord): Promise<void> {
    record.progress.publish('planning', '正在根据新指令调整计划');
    const stage = this.createStage(record);
    try {
      const plan = await this.planner.plan({
        goal: record.state.goal,
        model: record.state.history.model,
        instruction: record.state.activeInstruction,
        image: record.referenceAttachment?.image,
        mimeType: record.referenceAttachment?.mimeType,
        signal: stage.controller.signal,
        deadlineAt: stage.deadlineAt,
      });
      record.state = {
        ...record.state,
        plan,
        currentStepIndex: 0,
        activeInstruction: undefined,
        needsReplan: false,
        status: 'running',
      };
    } finally {
      stage.clear();
    }
  }

  private createStage(record: AgentRunRecord): {
    controller: AbortController;
    deadlineAt: number;
    clear: () => void;
  } {
    const controller = new AbortController();
    const deadlineAt = this.now() + this.stageTimeoutMs;
    const timeout = setTimeout(() => {
      controller.abort(new Error('Stage deadline exceeded'));
    }, Math.max(0, deadlineAt - this.now()));
    timeout.unref?.();
    record.activeController = controller;
    return {
      controller,
      deadlineAt,
      clear: () => clearTimeout(timeout),
    };
  }

  private finishCompleted(record: AgentRunRecord): void {
    record.referenceAttachment = undefined;
    record.progress.publish('completed', '任务已完成');
    this.enqueueAudit(record, () => this.auditStore!.finishRun(record.state.runId, record.state.history.model));
    record.resolveCompletion(record.state);
  }

  private finishFailed(record: AgentRunRecord, error: unknown): void {
    record.referenceAttachment = undefined;
    record.state = { ...record.state, status: 'failed' };
    record.progress.publish('failed', '任务执行失败', error instanceof Error ? error.message : String(error));
    this.enqueueAudit(record, () => this.auditStore!.finishRun(record.state.runId, record.state.history.model));
    record.resolveCompletion(record.state);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  private enqueueAudit(record: AgentRunRecord, operation: () => Promise<void>): void {
    if (!this.auditStore) return;
    record.auditQueue = record.auditQueue.then(operation, operation).catch(() => undefined);
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message === 'Agent run stopped');
}

function isStopping(record: AgentRunRecord): boolean {
  return record.state.status === 'stopping';
}
