import { describe, expect, it, vi } from 'vitest';

import type { TaskPlan } from '../../../src/core/agent.js';
import { createEmptyModel } from '../../../src/core/model.js';
import type { SpatialIntent } from '../../../src/core/types.js';
import type {
  DrawingPerceptionInput,
  DrawingPerceptionOutput,
} from '../drawing-perception/pipeline.js';
import type { ObservationPatchBatch } from '../drawing-perception/build-patches.js';
import { AgentRuntime, type DrawingPerceptionAdapter } from './runtime.js';
import type {
  AgentExecutorAdapter,
  AgentPlannerAdapter,
  ExecuteStageInput,
  PlanStageInput,
} from './types.js';

const modelProfile = {
  planner: 'planner-text',
  vision: 'doubao-seed-2.0-lite',
  executor: 'executor-text',
  repair: 'doubao-seed-2.1-turbo',
};

describe('AgentRuntime drawing perception', () => {
  it('keeps text tasks on the planner/executor path', async () => {
    const plan = oneStepPlan();
    const planner = vi.fn<AgentPlannerAdapter['plan']>(async () => plan);
    const executor = vi.fn<AgentExecutorAdapter['execute']>(async () => ({ objects: [] }));
    const drawing = { run: vi.fn<DrawingPerceptionAdapter['run']>() };
    const runtime = new AgentRuntime({
      planner: { plan: planner }, executor: { execute: executor }, drawingPipeline: drawing,
    });

    const state = await runtime.start({
      runId: 'run_text_legacy', goal: '创建点', model: createEmptyModel(), modelProfile,
    }).completion;

    expect(state.status).toBe('completed');
    expect(planner).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledOnce();
    expect(drawing.run).not.toHaveBeenCalled();
  });

  it('commits valid drawing batches, skips an invalid component, and emits named stages', async () => {
    const planner = vi.fn<AgentPlannerAdapter['plan']>(async () => ({
      task: 'reconstruct_drawing', summary: '重建图纸', steps: [],
    }));
    const executor = vi.fn<AgentExecutorAdapter['execute']>();
    const inputs: DrawingPerceptionInput[] = [];
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        inputs.push(input);
        yield stage(input.runId, 'asset_prepared');
        yield stage(input.runId, 'view_perceived');
        yield patch(input.runId, batch('component_point', {
          objects: [{ id: 'point_stable', type: 'point', params: { x: 1, y: 2 }, confidence: 0.9 }],
          confidence: 0.9,
        }, ['point_observation']));
        yield patch(input.runId, batch('component_invalid', {
          objects: [{ id: 'circle_invalid', type: 'circle', params: { center: [0, 0], radius: 0 } }],
          confidence: 0.8,
        }, ['invalid_observation']));
        yield patch(input.runId, batch('component_line', {
          objects: [{ id: 'line_stable', type: 'line', params: { start: [0, 0], end: [2, 0] }, confidence: 0.45 }],
          confidence: 0.45,
        }, ['line_observation']));
        yield stage(input.runId, 'completed');
      },
    };
    const runtime = new AgentRuntime({
      planner: { plan: planner }, executor: { execute: executor }, drawingPipeline: drawing,
    });

    const state = await runtime.start({
      runId: 'run_drawing_batches', goal: '重建图纸', model: createEmptyModel(), modelProfile,
      image: 'cG5n', mimeType: 'image/png',
    }).completion;

    expect(state.status).toBe('completed');
    expect(planner).toHaveBeenCalledOnce();
    expect(executor).not.toHaveBeenCalled();
    expect(inputs[0]).toMatchObject({ modelName: 'doubao-seed-2.0-lite', mimeType: 'image/png' });
    expect(state.history.commits).toHaveLength(2);
    expect(state.history.model.entities.map((entity) => entity.id)).toEqual([
      'point_stable', 'line_stable',
    ]);
    expect(state.history.model.entities[1].confidence).toBe(0.45);
    expect(state.history.commits[1].confidence).toBe(0.45);
    const events = runtime.getProgress('run_drawing_batches')!.events();
    expect(events.map((event) => event.title)).toEqual(expect.arrayContaining([
      expect.stringContaining('准备图纸'),
      expect.stringContaining('识别视图'),
    ]));
    expect(events).toContainEqual(expect.objectContaining({
      type: 'validation', detail: expect.stringContaining('component_invalid'),
    }));
  });

  it('analyzes combined input, reconstructs the baseline, then applies the requested modification', async () => {
    const order: string[] = [];
    const plan: TaskPlan = {
      task: 'modify_drawing', summary: '移动基准点',
      steps: [{ id: 1, action: 'modify_drawing', description: '移动基准点', status: 'pending' }],
    };
    const planner = vi.fn<AgentPlannerAdapter['plan']>(async () => {
      order.push('plan');
      return plan;
    });
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        order.push('perceive');
        yield patch(input.runId, batch('component_baseline', {
          objects: [{ id: 'point_baseline', type: 'point', params: { x: 1, y: 2 } }],
          confidence: 0.95,
        }, ['baseline_observation']));
      },
    };
    const executor = vi.fn<AgentExecutorAdapter['execute']>(async (input) => {
      order.push('modify');
      expect(input.model.entities).toContainEqual(expect.objectContaining({ id: 'point_baseline' }));
      return {
        operation: 'modify',
        objects: [{ id: 'point_baseline', type: 'point', params: { x: 9, y: 2 } }],
        confidence: 0.9,
      };
    });
    const runtime = new AgentRuntime({
      planner: { plan: planner }, executor: { execute: executor }, drawingPipeline: drawing,
    });

    const state = await runtime.start({
      runId: 'run_modify_drawing', goal: '把基准点移动到 x=9',
      model: createEmptyModel(), modelProfile, image: 'cG5n', mimeType: 'image/png',
    }).completion;

    expect(order).toEqual(['plan', 'perceive', 'modify']);
    expect(state.status).toBe('completed');
    expect(state.history.commits.map((commit) => commit.runId)).toEqual([
      'run_modify_drawing', 'run_modify_drawing',
    ]);
    expect(state.history.model.entities).toContainEqual(expect.objectContaining({
      id: 'point_baseline', x: 9, y: 2,
    }));
  });

  it('falls back to safe reconstruction when attachment intent planning fails', async () => {
    const planner = vi.fn<AgentPlannerAdapter['plan']>(async () => {
      throw new Error('intent service unavailable');
    });
    const executor = vi.fn<AgentExecutorAdapter['execute']>();
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        yield patch(input.runId, batch('component_fallback', {
          objects: [{ id: 'fallback_point', type: 'point', params: { x: 0, y: 0 } }],
        }, ['fallback_observation']));
      },
    };
    const runtime = new AgentRuntime({
      planner: { plan: planner }, executor: { execute: executor }, drawingPipeline: drawing,
    });

    const state = await runtime.start({
      runId: 'run_intent_fallback', goal: '分析并重建二维工程图',
      model: createEmptyModel(), modelProfile, image: 'cG5n', mimeType: 'image/png',
    }).completion;

    expect(state.status).toBe('completed');
    expect(state.history.model.entities).toContainEqual(expect.objectContaining({ id: 'fallback_point' }));
    expect(executor).not.toHaveBeenCalled();
    expect(runtime.getProgress('run_intent_fallback')?.events()).toContainEqual(expect.objectContaining({
      type: 'validation',
      title: '意图判断失败，已采用安全路径',
      detail: 'intent service unavailable',
    }));
  });

  it('repairs an empty modification plan instead of silently skipping the requested change', async () => {
    const planner = vi.fn<AgentPlannerAdapter['plan']>(async () => ({
      task: 'modify_drawing', summary: '移动点', steps: [],
    }));
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        yield patch(input.runId, batch('component_empty_plan', {
          objects: [{ id: 'empty_plan_point', type: 'point', params: { x: 0, y: 0 } }],
        }, ['empty_plan_observation']));
      },
    };
    const executor = vi.fn<AgentExecutorAdapter['execute']>(async () => ({
      operation: 'modify',
      objects: [{ id: 'empty_plan_point', type: 'point', params: { x: 2, y: 0 } }],
      confidence: 0.9,
    }));
    const runtime = new AgentRuntime({
      planner: { plan: planner }, executor: { execute: executor }, drawingPipeline: drawing,
    });

    const state = await runtime.start({
      runId: 'run_empty_modify_plan', goal: '移动点', model: createEmptyModel(), modelProfile,
      image: 'cG5n', mimeType: 'image/png',
    }).completion;

    expect(executor).toHaveBeenCalledOnce();
    expect(state.status).toBe('completed');
    expect(state.history.model.entities).toContainEqual(expect.objectContaining({
      id: 'empty_plan_point', x: 2,
    }));
  });

  it('executes a relative drawing modification once even when the planner repeats it across steps', async () => {
    const planner = vi.fn<AgentPlannerAdapter['plan']>(async () => ({
      task: 'modify_drawing', summary: '将圆孔半径扩大 10%',
      steps: [1, 2, 3, 4].map((id) => ({
        id, action: 'modify_drawing', description: '将圆孔半径扩大 10%', status: 'pending' as const,
      })),
    }));
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        yield patch(input.runId, batch('component_relative_change', {
          objects: [{ id: 'circle_relative', type: 'circle', params: { center: [0, 0], radius: 1 } }],
        }, ['relative_observation']));
      },
    };
    const executor = vi.fn<AgentExecutorAdapter['execute']>(async (input) => {
      const circle = input.model.entities.find((entity) => entity.id === 'circle_relative');
      if (!circle || circle.type !== 'circle') throw new Error('missing baseline circle');
      return {
        operation: 'modify',
        objects: [{
          id: circle.id, type: 'circle',
          params: { center: circle.center, radius: circle.radius * 1.1 },
        }],
        confidence: 0.95,
      };
    });
    const runtime = new AgentRuntime({
      planner: { plan: planner }, executor: { execute: executor }, drawingPipeline: drawing,
    });

    const state = await runtime.start({
      runId: 'run_relative_once', goal: '将圆孔半径扩大 10%', model: createEmptyModel(),
      modelProfile, image: 'cG5n', mimeType: 'image/png',
    }).completion;

    expect(executor).toHaveBeenCalledOnce();
    expect(state.history.model.entities).toContainEqual(expect.objectContaining({
      id: 'circle_relative', radius: 1.1,
    }));
  });

  it('pauses before drawing commits and resumes from the stored stable batches', async () => {
    const perceived = deferred<void>();
    const release = deferred<void>();
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        perceived.resolve();
        await release.promise;
        yield patch(input.runId, batch('component_pause', {
          objects: [{ id: 'pause_point', type: 'point', params: { x: 3, y: 4 } }],
          confidence: 0.9,
        }, ['pause_observation']));
      },
    };
    const runtime = runtimeWith(drawing);
    const handle = runtime.start({
      runId: 'run_drawing_pause', goal: '重建图纸', model: createEmptyModel(), modelProfile,
      image: 'cG5n', mimeType: 'image/png',
    });
    await perceived.promise;
    runtime.pause('run_drawing_pause');
    release.resolve();
    await waitUntil(() => runtime.getState('run_drawing_pause')?.status === 'paused');

    expect(runtime.getState('run_drawing_pause')?.history.commits).toEqual([]);
    runtime.resume('run_drawing_pause');
    const state = await handle.completion;
    expect(state.status).toBe('completed');
    expect(state.history.model.entities[0].id).toBe('pause_point');
  });

  it('aborts the drawing pipeline and lets it release assets when stopped', async () => {
    const started = deferred<void>();
    let released = false;
    const drawing: DrawingPerceptionAdapter = {
      run: async function* (input) {
        try {
          started.resolve();
          await new Promise<void>((_resolve, reject) => {
            input.signal.addEventListener('abort', () => reject(input.signal.reason), { once: true });
          });
          yield stage(input.runId, 'completed');
        } finally {
          released = true;
        }
      },
    };
    const runtime = runtimeWith(drawing);
    const handle = runtime.start({
      runId: 'run_drawing_stop', goal: '重建图纸', model: createEmptyModel(), modelProfile,
      image: 'cG5n', mimeType: 'image/png',
    });
    await started.promise;
    runtime.stop('run_drawing_stop');

    const state = await handle.completion;
    expect(state.status).toBe('stopped');
    expect(released).toBe(true);
    expect(state.history.commits).toEqual([]);
  });
});

function runtimeWith(drawingPipeline: DrawingPerceptionAdapter): AgentRuntime {
  return new AgentRuntime({
    planner: planner(async () => oneStepPlan()),
    executor: executor(async () => ({ objects: [] })),
    drawingPipeline,
  });
}

function stage(
  runId: string,
  stageName: Extract<DrawingPerceptionOutput, { kind: 'stage' }>['stage'],
): DrawingPerceptionOutput {
  return {
    kind: 'stage', runId, stage: stageName, timestamp: 1, durationMs: 10, detail: {},
  };
}

function patch(runId: string, value: ObservationPatchBatch): DrawingPerceptionOutput {
  return { kind: 'patch_batch', runId, stage: 'patch_ready', batch: value };
}

function batch(
  componentId: string,
  intent: SpatialIntent,
  observationIds: string[],
): ObservationPatchBatch {
  const confidence = intent.confidence ?? 1;
  return {
    componentId,
    intent,
    observationIds,
    confidence,
    lowConfidenceCount: intent.objects.filter((object) => (object.confidence ?? 1) < 0.6).length,
  };
}

function oneStepPlan(): TaskPlan {
  return {
    task: 'create_from_text', summary: '创建点',
    steps: [{ id: 1, action: 'create', description: '创建点', status: 'pending' }],
  };
}

function planner(fn: (input: PlanStageInput) => Promise<TaskPlan>): AgentPlannerAdapter {
  return { plan: fn };
}

function executor(fn: (input: ExecuteStageInput) => Promise<SpatialIntent>): AgentExecutorAdapter {
  return { execute: fn };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 50; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
}
