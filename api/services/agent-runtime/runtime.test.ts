import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyModel } from '../../../src/core/model';
import type { SpatialIntent } from '../../../src/core/types';
import type { TaskPlan } from '../../../src/core/agent';
import type { SpatialCommit } from '../../../src/core/history/types';
import type { SpatialModel } from '../../../src/core/types';
import type {
  AuditEvent,
  AuditRunManifest,
  AuditStore,
} from '../audit/types';
import { AgentRuntime } from './runtime';
import type {
  AgentExecutorAdapter,
  AgentPlannerAdapter,
  ExecuteStageInput,
  PlanStageInput,
} from './types';

const oneStepPlan: TaskPlan = {
  task: 'create_from_text',
  summary: '创建点',
  steps: [{ id: 1, action: 'extract_outline', description: '创建点', status: 'pending' }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function planner(fn: (input: PlanStageInput) => Promise<TaskPlan>): AgentPlannerAdapter {
  return { plan: fn };
}

function executor(fn: (input: ExecuteStageInput) => Promise<SpatialIntent>): AgentExecutorAdapter {
  return { execute: fn };
}

describe('AgentRuntime', () => {
  afterEach(() => vi.useRealTimers());
  it('returns an accepted run before planning resolves', async () => {
    const pendingPlan = deferred<TaskPlan>();
    const runtime = new AgentRuntime({
      planner: planner(() => pendingPlan.promise),
      executor: executor(async () => ({ objects: [] })),
      now: () => 1_000,
    });

    const handle = runtime.start({ runId: 'run_1', goal: '检查模型', model: createEmptyModel() });

    expect(runtime.getState('run_1')?.status).toBe('planning');
    expect(runtime.getProgress('run_1')?.latestEvent()?.type).toBe('accepted');
    pendingPlan.resolve(oneStepPlan);
    expect((await handle.completion).status).toBe('completed');
  });

  it('automatically commits a valid step patch and emits commit progress', async () => {
    const runtime = new AgentRuntime({
      planner: planner(async () => oneStepPlan),
      executor: executor(async () => ({
        objects: [{ type: 'point', params: { x: 1, y: 2 } }],
        description: '创建一个点',
        confidence: 0.9,
      })),
      now: () => 2_000,
    });
    const eventTypes: string[] = [];
    const handle = runtime.start({ runId: 'run_2', goal: '创建点', model: createEmptyModel() });
    runtime.getProgress('run_2')?.subscribe((event) => eventTypes.push(event.type));

    const state = await handle.completion;

    expect(state.status).toBe('completed');
    expect(state.history.model.entities).toHaveLength(1);
    expect(state.history.model.entities[0]).toMatchObject({
      type: 'point', visible: true, x: 1, y: 2,
    });
    expect(state.history.commits).toHaveLength(1);
    expect(eventTypes).toContain('commit');
  });

  it('uses one stage deadline while retrying invalid model output twice', async () => {
    const deadlines: number[] = [];
    let attempts = 0;
    const runtime = new AgentRuntime({
      planner: planner(async () => oneStepPlan),
      executor: executor(async (input) => {
        deadlines.push(input.deadlineAt);
        attempts += 1;
        return attempts < 3
          ? { objects: [{ type: 'circle', params: { center: [0, 0], radius: 0 } }] }
          : { objects: [{ type: 'circle', params: { center: [0, 0], radius: 5 } }] };
      }),
      now: () => 10_000,
      stageTimeoutMs: 60_000,
    });

    const state = await runtime.start({ runId: 'run_3', goal: '创建圆', model: createEmptyModel() }).completion;

    expect(state.status).toBe('completed');
    expect(attempts).toBe(3);
    expect(new Set(deadlines).size).toBe(1);
  });

  it('pauses after a third invalid result without committing', async () => {
    const runtime = new AgentRuntime({
      planner: planner(async () => oneStepPlan),
      executor: executor(async () => ({
        objects: [{ type: 'circle', params: { center: [0, 0], radius: 0 } }],
      })),
      now: () => 1_000,
    });

    const state = await runtime.start({ runId: 'run_4', goal: '创建圆', model: createEmptyModel() }).completion;

    expect(state.status).toBe('paused');
    expect(state.history.commits).toEqual([]);
  });

  it('aborts the active executor and commits no partial result when stopped', async () => {
    const executionStarted = deferred<void>();
    const runtime = new AgentRuntime({
      planner: planner(async () => oneStepPlan),
      executor: executor((input) => new Promise<SpatialIntent>((_resolve, reject) => {
        executionStarted.resolve();
        input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
      })),
      now: () => 1_000,
    });
    const handle = runtime.start({ runId: 'run_5', goal: '创建点', model: createEmptyModel() });
    await executionStarted.promise;

    runtime.stop('run_5');
    const state = await handle.completion;

    expect(state.status).toBe('stopped');
    expect(state.history.commits).toEqual([]);
  });

  it('replans remaining work once with guidance consumed at a safe point', async () => {
    const firstExecution = deferred<SpatialIntent>();
    const planningInputs: PlanStageInput[] = [];
    const twoStepPlan: TaskPlan = {
      ...oneStepPlan,
      steps: [
        oneStepPlan.steps[0],
        { id: 2, action: 'detect_features', description: '创建第二个点', status: 'pending' },
      ],
    };
    const runtime = new AgentRuntime({
      planner: planner(async (input) => {
        planningInputs.push(input);
        return input.instruction ? oneStepPlan : twoStepPlan;
      }),
      executor: executor(async (input) => {
        if (input.step.id === 1 && planningInputs.length === 1) return firstExecution.promise;
        return { objects: [] };
      }),
      now: () => 1_000,
    });
    const handle = runtime.start({ runId: 'run_6', goal: '创建两个点', model: createEmptyModel() });
    await waitUntil(() => runtime.getState('run_6')?.status === 'running');
    runtime.addInstruction('run_6', '第二个点改成圆');
    firstExecution.resolve({ objects: [] });

    const state = await handle.completion;

    expect(state.status).toBe('completed');
    expect(planningInputs).toHaveLength(2);
    expect(planningInputs[1].instruction).toBe('第二个点改成圆');
  });

  it('aborts a stage when its shared deadline expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const executionStarted = deferred<void>();
    const runtime = new AgentRuntime({
      planner: planner(async () => oneStepPlan),
      executor: executor((input) => new Promise<SpatialIntent>((_resolve, reject) => {
        executionStarted.resolve();
        input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
      })),
      now: Date.now,
      stageTimeoutMs: 100,
    });
    const handle = runtime.start({ runId: 'run_7', goal: '等待超时', model: createEmptyModel() });
    await vi.advanceTimersByTimeAsync(0);
    await executionStarted.promise;

    await vi.advanceTimersByTimeAsync(101);
    const state = await handle.completion;

    expect(state.status).toBe('failed');
    expect(state.history.commits).toEqual([]);
  });

  it('enqueues run events, commits, and final model into the audit store', async () => {
    const audit = new MemoryAuditStore();
    const runtime = new AgentRuntime({
      planner: planner(async () => oneStepPlan),
      executor: executor(async () => ({
        objects: [{ type: 'point', params: { x: 1, y: 2 } }],
      })),
      auditStore: audit,
      now: () => 1_000,
    });

    await runtime.start({ runId: 'run_8', goal: '创建点', model: createEmptyModel() }).completion;
    await runtime.flushAudit('run_8');

    expect(audit.manifests).toHaveLength(1);
    expect(audit.commits).toHaveLength(1);
    expect(audit.finalModels).toHaveLength(1);
    expect(audit.events.map((event) => event.type)).toContain('commit');
  });
});

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
}

class MemoryAuditStore implements AuditStore {
  manifests: AuditRunManifest[] = [];
  events: AuditEvent[] = [];
  commits: SpatialCommit[] = [];
  finalModels: SpatialModel[] = [];

  async startRun(manifest: AuditRunManifest): Promise<void> {
    this.manifests.push(manifest);
  }

  async appendEvent(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async saveCommit(commit: SpatialCommit): Promise<void> {
    this.commits.push(commit);
  }

  async finishRun(_runId: string, model: SpatialModel): Promise<void> {
    this.finalModels.push(model);
  }

  async readEvents(runId: string): Promise<AuditEvent[]> {
    return this.events.filter((event) => event.runId === runId);
  }
}
