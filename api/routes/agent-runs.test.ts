import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { TaskPlan } from '../../src/core/agent';
import { AgentRuntime } from '../services/agent-runtime/runtime';
import type {
  AgentExecutorAdapter,
  AgentModelProfile,
  AgentPlannerAdapter,
  PlanStageInput,
} from '../services/agent-runtime/types';
import { createAgentRunsRouter } from './agent-runs';

const plan: TaskPlan = {
  task: 'create_from_text', summary: '检查模型',
  steps: [{ id: 1, action: 'verify_model', description: '检查模型', status: 'pending' }],
};

const routeModelDefaults: AgentModelProfile = {
  planner: 'default-planner',
  vision: 'doubao-seed-2.0-lite',
  executor: 'default-executor',
  repair: 'default-repair',
};

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('agent run routes', () => {
  it('returns 202 with a run id without waiting for planning', async () => {
    const runtime = runtimeWith({
      plan: () => new Promise<TaskPlan>(() => undefined),
    });
    const baseUrl = await startServer(runtime);
    const startedAt = Date.now();

    const response = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '检查模型' }),
    });

    expect(response.status).toBe(202);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(await response.json()).toMatchObject({ success: true, runId: expect.any(String) });
  });

  it('accepts combined text and image immediately and forwards both to planning', async () => {
    const planningInputs: PlanStageInput[] = [];
    const runtime = runtimeWith({
      plan: (input) => {
        planningInputs.push(input);
        return new Promise<TaskPlan>(() => undefined);
      },
    });
    const baseUrl = await startServer(runtime);
    const startedAt = Date.now();

    const response = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: '把左侧孔扩大到 20mm',
        image: 'cG5n',
        mimeType: 'image/png',
      }),
    });

    expect(response.status).toBe(202);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    await waitUntil(() => planningInputs.length === 1);
    expect(planningInputs[0]).toMatchObject({
      goal: '把左侧孔扩大到 20mm',
      image: 'cG5n',
      mimeType: 'image/png',
    });
  });

  it('streams accepted and later progress events over SSE', async () => {
    const runtime = runtimeWith({ plan: async () => plan });
    const baseUrl = await startServer(runtime);
    const startResponse = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '检查模型' }),
    });
    const { runId } = await startResponse.json() as { runId: string };

    const response = await fetch(`${baseUrl}/api/agent/runs/${runId}/events`);
    const reader = response.body!.getReader();
    const firstChunk = new TextDecoder().decode((await reader.read()).value);
    await reader.cancel();

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(firstChunk).toContain('"type":"accepted"');
  });

  it('validates control targets and instruction text', async () => {
    const runtime = runtimeWith({ plan: () => new Promise<TaskPlan>(() => undefined) });
    const baseUrl = await startServer(runtime);

    const missing = await fetch(`${baseUrl}/api/agent/runs/missing/pause`, { method: 'POST' });
    expect(missing.status).toBe(404);

    const startResponse = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '检查模型' }),
    });
    const { runId } = await startResponse.json() as { runId: string };
    const pause = await fetch(`${baseUrl}/api/agent/runs/${runId}/pause`, { method: 'POST' });
    expect(pause.status).toBe(202);
    const invalidPause = await fetch(`${baseUrl}/api/agent/runs/${runId}/pause`, { method: 'POST' });
    expect(invalidPause.status).toBe(409);

    const emptyInstruction = await fetch(`${baseUrl}/api/agent/runs/${runId}/instructions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction: '  ' }),
    });

    expect(emptyInstruction.status).toBe(400);
  });

  it('rejects an invalid initial spatial model', async () => {
    const runtime = runtimeWith({ plan: async () => plan });
    const baseUrl = await startServer(runtime);

    const response = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '检查模型', spatialModel: { protocol: 'invalid' } }),
    });

    expect(response.status).toBe(400);
  });

  it('merges valid text and vision model overrides into the run profile', async () => {
    const planningInputs: PlanStageInput[] = [];
    const runtime = runtimeWith({
      plan: async (input) => {
        planningInputs.push(input);
        return plan;
      },
    });
    const baseUrl = await startServer(runtime);

    const textResponse = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '检查文字', models: { planner: 'request-planner' } }),
    });
    const imageResponse = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: '检查图纸', image: 'cG5n', mimeType: 'image/png',
        models: { vision: 'request-vision' },
      }),
    });

    expect(textResponse.status).toBe(202);
    expect(imageResponse.status).toBe(202);
    await waitUntil(() => planningInputs.length === 2);
    expect(planningInputs.map((input) => input.modelName)).toEqual([
      'request-planner',
      'request-vision',
    ]);
  });

  it('uses server model defaults when the request has no overrides', async () => {
    let planningInput: PlanStageInput | undefined;
    const runtime = runtimeWith({
      plan: async (input) => {
        planningInput = input;
        return plan;
      },
    });
    const baseUrl = await startServer(runtime, {
      ...routeModelDefaults,
      planner: 'server-planner',
    });

    const response = await fetch(`${baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '检查模型' }),
    });

    expect(response.status).toBe(202);
    await waitUntil(() => planningInput !== undefined);
    expect(planningInput?.modelName).toBe('server-planner');
  });

  it('rejects empty or non-string model overrides', async () => {
    const runtime = runtimeWith({ plan: async () => plan });
    const baseUrl = await startServer(runtime);

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/agent/runs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: '检查模型', models: { vision: '   ' } }),
      }),
      fetch(`${baseUrl}/api/agent/runs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: '检查模型', models: { planner: 42 } }),
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([400, 400]);
  });
});

function runtimeWith(planner: AgentPlannerAdapter): AgentRuntime {
  const executor: AgentExecutorAdapter = { execute: async () => ({ objects: [] }) };
  return new AgentRuntime({ planner, executor });
}

async function startServer(
  runtime: AgentRuntime,
  modelDefaults: AgentModelProfile = routeModelDefaults,
): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api/agent/runs', createAgentRunsRouter(runtime, modelDefaults));
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test server address');
  return `http://127.0.0.1:${address.port}`;
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
}
