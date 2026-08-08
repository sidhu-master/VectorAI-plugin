import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyModel } from '../../../src/core/model';
import type { TaskPlan } from '../../../src/core/agent';
import type { SpatialIntent, SpatialModel } from '../../../src/core/types';
import type { SpatialCommit } from '../../../src/core/history/types';
import { replayCommits } from '../audit/replay';
import type { AuditEvent, AuditRunManifest, AuditStore } from '../audit/types';
import { AgentRuntime } from './runtime';
import type { PlanStageInput } from './types';

const initialPlan: TaskPlan = {
  task: 'create_from_text', summary: '创建两个点',
  steps: [
    { id: 1, action: 'extract_outline', description: '创建第一个点', status: 'pending' },
    { id: 2, action: 'detect_features', description: '创建第二个点', status: 'pending' },
  ],
};

describe('AgentRuntime integration', () => {
  afterEach(() => vi.useRealTimers());

  it('records two guided commits and replays the exact final model', async () => {
    const firstStep = deferred<SpatialIntent>();
    const audit = new MemoryAuditStore();
    let executions = 0;
    const runtime = new AgentRuntime({
      planner: {
        plan: async (input: PlanStageInput) => input.instruction
          ? {
              task: 'create_from_text', summary: '按指令完成第二个点',
              steps: [{ id: 2, action: 'detect_features', description: '移动第二个点', status: 'pending' }],
            }
          : initialPlan,
      },
      executor: {
        execute: async () => {
          executions += 1;
          if (executions === 1) return firstStep.promise;
          return {
            objects: [{ type: 'point', params: { x: 20, y: 0 }, confidence: 0.92 }],
            description: '按追加指令创建第二个点', confidence: 0.92,
          };
        },
      },
      auditStore: audit,
      now: () => 1_000,
    });
    const initial = createEmptyModel();
    const handle = runtime.start({ runId: 'run_integration', goal: '创建两个点', model: initial });
    await waitUntil(() => runtime.getState('run_integration')?.status === 'running');
    runtime.addInstruction('run_integration', '第二个点放在 x=20');
    firstStep.resolve({
      objects: [{ type: 'point', params: { x: 0, y: 0 }, confidence: 0.95 }],
      description: '创建第一个点', confidence: 0.95,
    });

    const finalState = await handle.completion;
    await runtime.flushAudit('run_integration');

    expect(finalState.status).toBe('completed');
    expect(finalState.history.commits).toHaveLength(2);
    expect(audit.events.map((event) => event.type)).toEqual(expect.arrayContaining(['accepted', 'commit', 'completed']));
    expect(audit.commits).toHaveLength(2);
    expect(replayCommits(initial, audit.commits)).toEqual(finalState.history.model);
    expect(audit.finalModels).toEqual([finalState.history.model]);
  });

  it('keeps a 70-second silent model call visible at 0, 25, and 50 seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const runtime = new AgentRuntime({
      planner: {
        plan: (input) => new Promise<TaskPlan>((_resolve, reject) => {
          input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
        }),
      },
      executor: { execute: async () => ({ objects: [] }) },
      now: Date.now,
    });
    const handle = runtime.start({ runId: 'run_slow', goal: '分析复杂图纸', model: createEmptyModel() });
    const elapsed: number[] = [];
    runtime.getProgress('run_slow')?.subscribe((event) => elapsed.push(event.elapsedMs));
    await vi.advanceTimersByTimeAsync(70_000);

    expect(elapsed).toEqual(expect.arrayContaining([0, 25_000, 50_000]));
    runtime.stop('run_slow');
    await handle.completion;
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

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

  async startRun(manifest: AuditRunManifest): Promise<void> { this.manifests.push(manifest); }
  async appendEvent(event: AuditEvent): Promise<void> { this.events.push(event); }
  async saveCommit(commit: SpatialCommit): Promise<void> { this.commits.push(commit); }
  async finishRun(_runId: string, model: SpatialModel): Promise<void> { this.finalModels.push(model); }
  async readEvents(runId: string): Promise<AuditEvent[]> {
    return this.events.filter((event) => event.runId === runId);
  }
}
