import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import type { TaskPlan } from '../../src/core/agent';
import { AgentRuntime } from '../services/agent-runtime/runtime';
import type { AgentExecutorAdapter, AgentPlannerAdapter } from '../services/agent-runtime/types';
import { createAgentRunsRouter } from './agent-runs';

const plan: TaskPlan = {
  task: 'create_from_text', summary: '检查模型',
  steps: [{ id: 1, action: 'verify_model', description: '检查模型', status: 'pending' }],
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
});

function runtimeWith(planner: AgentPlannerAdapter): AgentRuntime {
  const executor: AgentExecutorAdapter = { execute: async () => ({ objects: [] }) };
  return new AgentRuntime({ planner, executor });
}

async function startServer(runtime: AgentRuntime): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api/agent/runs', createAgentRunsRouter(runtime));
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test server address');
  return `http://127.0.0.1:${address.port}`;
}
