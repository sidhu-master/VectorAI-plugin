import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentDecision,
  DrawingAgentPlan,
  DrawingAgentRunView,
  HumanDecisionResponse,
} from '../../src/contracts/drawing-agent';
import {
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../src/drawing';
import { DrawingApplication } from '../services/drawing-application/application';
import { DrawingAgentRuntime } from '../services/drawing-agent/runtime';
import { DrawingToolRegistry } from '../services/drawing-agent/tool-registry';
import type {
  DrawingDecisionModelAdapter,
  DrawingPlannerInput,
  DrawingPlannerModelAdapter,
} from '../services/drawing-agent/types';
import { createAgentRunsRouter } from './agent-runs';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('drawing agent run routes', () => {
  it('returns 202 quickly and keeps incidental selection out of planner guidance', async () => {
    const planningInputs: DrawingPlannerInput[] = [];
    const planner: DrawingPlannerModelAdapter = {
      plan: vi.fn(async (input) => {
        planningInputs.push(input);
        return new Promise<DrawingAgentPlan>(() => undefined);
      }),
    };
    const context = await startServer({ planner });
    const startedAt = Date.now();

    const response = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody(context, {
        selectedIds: ['circle_1'], stableRules: ['单位使用 mm'],
      })),
    });

    expect(response.status).toBe(202);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(await response.json()).toMatchObject({ success: true, runId: expect.any(String) });
    await waitUntil(() => planningInputs.length === 1);
    expect(planningInputs[0]).toMatchObject({
      drawingId: context.workspace.document.id,
      revision: context.workspace.revision,
      objective: '创建圆',
      instruction: '稳定规则：单位使用 mm',
    });
    expect(planningInputs[0].instruction).not.toContain('circle_1');
    expect(JSON.stringify(planningInputs[0])).not.toContain('document');
    expect(JSON.stringify(planningInputs[0])).not.toContain('history');
  });

  it('rejects a revision owned by another drawing before starting a run', async () => {
    const context = await startServer();
    const second = await context.application.create();

    const response = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drawingId: context.workspace.document.id,
        baseRevision: second.revision,
        goal: '创建圆',
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'DRAWING_REVISION_MISMATCH' },
    });
  });

  it('stores a bounded attachment reference and still rejects legacy SpatialModel input', async () => {
    const context = await startServer();
    const start = vi.spyOn(context.runtime, 'start');
    const attachment = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...startBody(context, { goal: '分析图纸' }),
        attachment: { data: 'cG5n', mimeType: 'image/png', page: 1 },
      }),
    });
    const legacy = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...startBody(context), spatialModel: { entities: [] } }),
    });

    expect(attachment.status).toBe(202);
    expect(await attachment.json()).toMatchObject({ success: true, runId: expect.any(String) });
    expect(context.sourceArtifacts.put).toHaveBeenCalledWith({
      data: 'cG5n', mimeType: 'image/png', page: 1,
    });
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      attachmentPurpose: 'reference',
    }));
    expect(legacy.status).toBe(400);
    expect(await legacy.json()).toMatchObject({
      error: { code: 'LEGACY_SPATIAL_MODEL_FORBIDDEN' },
    });
  });

  it('forwards drawing-source only when the caller explicitly selects it', async () => {
    const context = await startServer();
    const start = vi.spyOn(context.runtime, 'start');

    const response = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...startBody(context, { goal: '' }),
        attachment: { data: 'cG5n', mimeType: 'image/png', page: 1 },
        attachmentPurpose: 'drawing-source',
      }),
    });

    expect(response.status).toBe(202);
    expect(start).toHaveBeenCalledWith(expect.objectContaining({
      attachmentPurpose: 'drawing-source',
    }));
  });

  it('replays accepted and later progress over SSE and closes on terminal state', async () => {
    const context = await startServer();
    const started = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody(context)),
    });
    const { runId } = await started.json() as { runId: string };

    const response = await fetch(`${context.baseUrl}/api/agent/runs/${runId}/events`);
    const contents = await response.text();

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(contents).toContain('"type":"accepted"');
    expect(contents).toContain('"type":"completed"');
  });

  it('returns only the shared public run projection', async () => {
    const context = await startServer();
    const started = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody(context)),
    });
    const { runId } = await started.json() as { runId: string };
    await waitUntil(() => context.runtime.getState(runId)?.status === 'completed');

    const response = await fetch(`${context.baseUrl}/api/agent/runs/${runId}`);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(body.run).toMatchObject({
      runId, drawingId: context.workspace.document.id,
      status: 'completed', goal: { id: 'goal_1' }, commitCount: 1,
    });
    expect(serialized).not.toContain('document');
    expect(serialized).not.toContain('history');
    expect(serialized).not.toContain('modelProfile');
    expect(serialized).not.toContain('recentReceipts');
  });

  it('validates controls and accepts instructions while a run is active', async () => {
    const planner: DrawingPlannerModelAdapter = {
      plan: vi.fn(async () => new Promise<DrawingAgentPlan>(() => undefined)),
    };
    const context = await startServer({ planner });
    const missing = await fetch(`${context.baseUrl}/api/agent/runs/missing/pause`, { method: 'POST' });
    expect(missing.status).toBe(404);

    const started = await fetch(`${context.baseUrl}/api/agent/runs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody(context)),
    });
    const { runId } = await started.json() as { runId: string };
    const instruction = await fetch(`${context.baseUrl}/api/agent/runs/${runId}/instructions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction: '半径改为 8' }),
    });
    const pause = await fetch(`${context.baseUrl}/api/agent/runs/${runId}/pause`, { method: 'POST' });
    const invalidPause = await fetch(`${context.baseUrl}/api/agent/runs/${runId}/pause`, { method: 'POST' });
    const stop = await fetch(`${context.baseUrl}/api/agent/runs/${runId}/stop`, { method: 'POST' });

    expect(instruction.status).toBe(202);
    expect(pause.status).toBe(202);
    expect(invalidPause.status).toBe(409);
    expect(stop.status).toBe(202);
  });

  it('validates and forwards a response only to the exact pending Human Decision', async () => {
    const context = await startServer();
    const runtime = context.runtime as unknown as {
      getState(runId: string): { status: string } | undefined;
      respondToDecision(runId: string, response: HumanDecisionResponse): Promise<unknown>;
    };
    const pending = agentRunViewFixture('waiting_for_user');
    pending.pendingDecision = {
      id: 'decision_1', episodeId: 'episode_1', revision: context.workspace.revision,
      kind: 'choose-option', question: '选择一个方案', reason: '存在两个有效候选',
      options: [{ id: 'first', label: '方案一' }, { id: 'second', label: '方案二' }],
      affectedResources: [], expiresWhenRevisionChanges: true,
    };
    Object.assign(runtime, { respondToDecision: vi.fn() });
    vi.spyOn(runtime, 'getState').mockReturnValue(pending as never);
    const respond = vi.spyOn(runtime, 'respondToDecision').mockResolvedValue({
      ...pending, status: 'running', pendingDecision: null,
    });

    const valid = await fetch(`${context.baseUrl}/api/agent/runs/run_1/decisions/decision_1/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedOptionId: 'first', additionalInstruction: '保留尺寸' }),
    });
    const stale = await fetch(`${context.baseUrl}/api/agent/runs/run_1/decisions/stale/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedOptionId: 'first' }),
    });

    expect(valid.status).toBe(202);
    expect(respond).toHaveBeenCalledWith('run_1', {
      requestId: 'decision_1', selectedOptionId: 'first',
      additionalInstruction: '保留尺寸', decidedAt: expect.any(Number),
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: 'HUMAN_DECISION_STALE' } });
  });
});

function agentRunViewFixture(status: DrawingAgentRunView['status']): DrawingAgentRunView {
  return {
    runId: 'run_1', drawingId: 'drawing_1' as never, revision: 'revision_1' as never,
    status, goal: null, workflow: [], currentWorkflowNodeId: null,
    commitCount: 0, analysisSummary: null, pendingInstructions: [],
    pendingDecision: null, error: null,
  };
}

async function startServer(input: {
  planner?: DrawingPlannerModelAdapter;
  decision?: DrawingDecisionModelAdapter;
} = {}) {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 10 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const workspace = await application.create();
  const tools = new DrawingToolRegistry({ application, idFactory });
  const planner = input.planner ?? { plan: async () => plan };
  const decisions: AgentDecision[] = [decision];
  const decisionAdapter = input.decision ?? {
    decide: async (): Promise<AgentDecision> => decisions.shift()
      ?? { type: 'finish', summary: '完成' },
  };
  const sourceReference = {
    sourceId: 'source_aaaaaaaaaaaaaaaaaaaaaaaa', sha256: 'a'.repeat(64),
    mimeType: 'image/png' as const, byteLength: 3, page: 1,
  };
  const sourceArtifacts = {
    put: vi.fn(async () => sourceReference),
    read: vi.fn(async () => ({ metadata: sourceReference, bytes: Buffer.from('png') })),
  };
  const perception = {
    async *run() {
      yield {
        kind: 'stage' as const, runId: 'run_attachment', stage: 'completed' as const,
        timestamp: 1, durationMs: 1, detail: { batchCount: 0 },
      };
    },
  };
  const runtime = new DrawingAgentRuntime({
    application, tools, planner, decision: decisionAdapter,
    sourceArtifacts, perception, visionModelName: 'vision-model',
  });
  const app = express();
  app.use(express.json());
  app.use('/api/agent/runs', createAgentRunsRouter(runtime, application, {
    planner: 'lite-model', decision: 'lite-model', repair: 'repair-model', reviewer: 'review-model',
  }, sourceArtifacts));
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    application, runtime, sourceArtifacts, workspace,
  };
}

const plan: DrawingAgentPlan = {
  goal: {
    id: 'goal_1', objective: '创建圆', scope: { plane: 'geometry', limit: 20 },
    acceptanceCriteria: [{ type: 'node.exists', nodeId: 'circle_1' }],
    riskPolicy: { candidateAllowed: true, maxCommits: 2 },
  },
  workflow: [{
    id: 'create', capability: 'edit_entities', dependsOn: [],
    completionCriteria: [{ type: 'node.exists', nodeId: 'circle_1' }], status: 'pending',
  }],
  summary: '创建圆',
};

const decision: AgentDecision = {
  type: 'transact', toolCallId: 'create_circle', confidence: 0.95,
  commands: [{
    type: 'geometry.create',
    value: {
      id: 'circle_1' as GeometryId,
      type: 'circle', visible: true,
      quality: { status: 'confirmed', confidence: 0.95, evidenceRefs: [] },
      center: [0, 0], radius: 5,
    },
  }],
};

function startBody(
  context: Awaited<ReturnType<typeof startServer>>,
  extra: Record<string, unknown> = {},
) {
  return {
    drawingId: context.workspace.document.id,
    baseRevision: context.workspace.revision,
    goal: '创建圆',
    ...extra,
  };
}

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('condition was not reached');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
