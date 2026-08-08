import { describe, expect, it, vi } from 'vitest';

import { DrawingAgentProtocolError, type AgentDecision, type DrawingAgentPlan } from '../../../src/contracts/drawing-agent';
import {
  type DrawingTransaction,
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing';
import { DrawingApplication } from '../drawing-application/application';
import { DrawingToolRegistry } from './tool-registry';
import { DrawingAgentRuntime } from './runtime';
import type {
  DrawingDecisionInput,
  DrawingDecisionModelAdapter,
  DrawingPlannerInput,
  DrawingPlannerModelAdapter,
} from './types';

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

async function setup(input: {
  plan?: DrawingAgentPlan;
  decisions?: AgentDecision[];
  planner?: DrawingPlannerModelAdapter;
  decision?: DrawingDecisionModelAdapter;
  limits?: Partial<{ maxDecisions: number; maxCommits: number; maxConsecutiveReads: number; wallClockMs: number }>;
  wrapTools?: (input: {
    tools: DrawingToolRegistry;
    application: DrawingApplication;
    workspace: Awaited<ReturnType<DrawingApplication['create']>>;
  }) => Pick<DrawingToolRegistry, 'invoke' | 'discardPrepared' | 'discardRun'>;
} = {}) {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const workspace = await application.create();
  const order: string[] = [];
  const toolApplication = {
    summarize: application.summarize.bind(application),
    query: application.query.bind(application),
    inspect: application.inspect.bind(application),
    preview: async (call: Parameters<DrawingApplication['preview']>[0]) => {
      order.push('preview');
      return application.preview(call);
    },
    execute: async (call: Parameters<DrawingApplication['execute']>[0]) => {
      order.push('commit');
      return application.execute(call);
    },
  };
  const tools = new DrawingToolRegistry({
    application: toolApplication,
    idFactory,
    handleFactory: (() => {
      let sequence = 0;
      return () => `preview_${++sequence}`;
    })(),
  });
  const decisions = [...(input.decisions ?? [createDecision('circle_1', 0.9)])];
  const planner = input.planner ?? {
    plan: vi.fn(async () => structuredClone(input.plan ?? createPlan('circle_1'))),
  };
  const decision: DrawingDecisionModelAdapter = input.decision ?? {
    decide: vi.fn(async (): Promise<AgentDecision> => {
      const next = decisions.shift();
      if (!next) return { type: 'finish' as const, summary: '完成' };
      return structuredClone(next);
    }),
  };
  const runtime = new DrawingAgentRuntime({
    application: toolApplication,
    tools: input.wrapTools?.({ tools, application, workspace }) ?? tools,
    planner,
    decision,
    idFactory,
    now: () => 100,
    limits: input.limits,
  });
  return { application, decision, order, planner, runtime, tools, workspace };
}

describe('DrawingAgentRuntime', () => {
  it('creates through Preview then Commit and verifies the goal', async () => {
    const { application, order, runtime, workspace } = await setup();

    const handle = runtime.start(startInput(workspace));
    const final = await handle.completion;

    expect(final.status).toBe('completed');
    expect(order).toEqual(['preview', 'commit', 'preview']);
    expect(final.recentReceipts.map((receipt) => receipt.capability)).toEqual([
      'preview_transaction', 'commit_transaction', 'verify_goal',
    ]);
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_1', type: 'circle' }),
    ]);
  });

  it('completes an already-satisfied transaction without adding a commit', async () => {
    const { application, order, runtime, workspace } = await setup();
    const seeded = await application.execute({
      drawingId: workspace.document.id,
      transaction: circleTransaction(workspace.revision, 'circle_1'),
    });
    if (seeded.status !== 'committed') throw new Error('expected seed commit');
    const current = await application.open(workspace.document.id);

    const final = await runtime.start(startInput(current)).completion;

    expect(final.status).toBe('completed');
    expect(final.commitCount).toBe(0);
    expect(order).toEqual(['preview', 'preview']);
    expect((await application.open(workspace.document.id)).commits).toHaveLength(1);
  });

  it('runs update and delete as separate incremental commits', async () => {
    const plan: DrawingAgentPlan = {
      goal: {
        id: 'goal_update_delete', objective: '修改后删除圆', scope: { ids: ['circle_1'] },
        acceptanceCriteria: [{ type: 'node.absent', nodeId: 'circle_1' }],
        riskPolicy: { candidateAllowed: true, maxCommits: 3 },
      },
      workflow: [{
        id: 'update', capability: 'edit_entities', dependsOn: [],
        completionCriteria: [{
          type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 10,
        }],
        status: 'pending',
      }, {
        id: 'delete', capability: 'edit_entities', dependsOn: ['update'],
        completionCriteria: [{ type: 'node.absent', nodeId: 'circle_1' }],
        status: 'pending',
      }],
      summary: '修改后删除圆',
    };
    const decisions: AgentDecision[] = [{
      type: 'transact', toolCallId: 'update_circle', confidence: 0.95,
      commands: [{ type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: 10 } }],
    }, {
      type: 'transact', toolCallId: 'delete_circle', confidence: 0.95,
      commands: [{ type: 'geometry.delete', id: 'circle_1' as GeometryId }],
    }];
    const { application, runtime, workspace } = await setup({ plan, decisions });
    const seeded = await application.execute({
      drawingId: workspace.document.id,
      transaction: circleTransaction(workspace.revision, 'circle_1'),
    });
    if (seeded.status !== 'committed') throw new Error('expected seed commit');
    const current = await application.open(workspace.document.id);

    const final = await runtime.start({ ...startInput(current), goal: '修改后删除圆' }).completion;

    expect(final.status).toBe('completed');
    expect(final.commitCount).toBe(2);
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([]);
  });

  it('repairs a rejected transaction at most through the bounded validation path', async () => {
    const invalid = createDecision('circle_1', 0.9);
    if (
      invalid.type !== 'transact'
      || invalid.commands[0].type !== 'geometry.create'
      || invalid.commands[0].value.type !== 'circle'
    ) {
      throw new Error('expected create decision');
    }
    invalid.commands[0].value.radius = -5;
    const { runtime, workspace } = await setup({
      decisions: [invalid, createDecision('circle_1', 0.9)],
    });

    const final = await runtime.start(startInput(workspace)).completion;

    expect(final.status).toBe('completed');
    expect(final.recovery.validationRepairs).toBe(1);
    expect(final.commitCount).toBe(1);
  });

  it('pauses after Preview and does not Commit until resumed', async () => {
    const { order, runtime, workspace } = await setup();
    const handle = runtime.start(startInput(workspace));
    const progress = runtime.getProgress(handle.runId)!;
    progress.subscribe((event) => {
      if (event.type === 'validation') runtime.pause(handle.runId);
    });

    await waitFor(() => runtime.getState(handle.runId)?.status === 'paused');
    expect(order).toEqual(['preview']);

    runtime.resume(handle.runId);
    const final = await handle.completion;
    expect(final.status).toBe('completed');
    expect(order).toEqual(['preview', 'commit', 'preview']);
  });

  it('stops from paused without committing the prepared transaction', async () => {
    const { application, order, runtime, workspace } = await setup();
    const handle = runtime.start(startInput(workspace));
    runtime.getProgress(handle.runId)!.subscribe((event) => {
      if (event.type === 'validation') runtime.pause(handle.runId);
    });
    await waitFor(() => runtime.getState(handle.runId)?.status === 'paused');

    const stopped = runtime.stop(handle.runId);
    const final = await handle.completion;

    expect(stopped.status).toBe('stopped');
    expect(final.status).toBe('stopped');
    expect(order).toEqual(['preview']);
    expect((await application.open(workspace.document.id)).commits).toEqual([]);
  });

  it('merges an instruction at the preview safe point and replans without committing stale work', async () => {
    const plans: DrawingPlannerInput[] = [];
    const planner: DrawingPlannerModelAdapter = {
      plan: vi.fn(async (input) => {
        plans.push(input);
        return createPlan(plans.length === 1 ? 'circle_old' : 'circle_new');
      }),
    };
    const decisions = [createDecision('circle_old', 0.9), createDecision('circle_new', 0.9)];
    const { application, runtime, workspace } = await setup({ planner, decisions });
    let instructed = false;
    const handle = runtime.start(startInput(workspace));
    runtime.getProgress(handle.runId)!.subscribe((event) => {
      if (!instructed && event.type === 'validation') {
        instructed = true;
        runtime.addInstruction(handle.runId, '改为新圆，不要提交旧方案');
      }
    });

    const final = await handle.completion;

    expect(final.status).toBe('completed');
    expect(plans).toHaveLength(2);
    expect(plans[1].instruction).toContain('改为新圆');
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_new' }),
    ]);
  });

  it('uses the repair model once for a low-confidence proposal', async () => {
    const calls: DrawingDecisionInput[] = [];
    const decision: DrawingDecisionModelAdapter = {
      decide: vi.fn(async (input) => {
        calls.push(input);
        return createDecision('circle_1', input.modelName === 'repair-model' ? 0.95 : 0.4);
      }),
    };
    const { runtime, workspace } = await setup({ decision });

    const final = await runtime.start({
      ...startInput(workspace),
      modelProfile: { planner: 'lite-model', decision: 'lite-model', repair: 'repair-model' },
    }).completion;

    expect(final.status).toBe('completed');
    expect(calls.map((call) => call.modelName)).toEqual(['lite-model', 'repair-model']);
    expect(final.recovery.lowConfidenceEscalations).toBe(1);
  });

  it('corrects one invalid planner schema and then continues', async () => {
    const calls: DrawingPlannerInput[] = [];
    const planner: DrawingPlannerModelAdapter = {
      plan: vi.fn(async (input) => {
        calls.push(input);
        if (calls.length === 1) throw new DrawingAgentProtocolError('plan.goal', 'invalid');
        return createPlan('circle_1');
      }),
    };
    const { runtime, workspace } = await setup({ planner });

    const final = await runtime.start(startInput(workspace)).completion;

    expect(final.status).toBe('completed');
    expect(calls).toHaveLength(2);
    expect(calls[1].instruction).toContain('输出不符合');
    expect(final.recovery.schemaCorrections).toBe(1);
  });

  it('refreshes the revision and replans after a stale commit', async () => {
    const plannerInputs: DrawingPlannerInput[] = [];
    const planner: DrawingPlannerModelAdapter = {
      plan: vi.fn(async (input) => {
        plannerInputs.push(input);
        return createPlan(plannerInputs.length === 1 ? 'circle_stale' : 'circle_replanned');
      }),
    };
    const { application, runtime, workspace } = await setup({
      planner,
      decisions: [createDecision('circle_stale', 0.9), createDecision('circle_replanned', 0.9)],
      wrapTools: ({ tools, application: drawingApplication, workspace: current }) => {
        let changed = false;
        return {
          invoke: async (call) => {
            if (call.capability === 'commit_transaction' && !changed) {
              changed = true;
              await drawingApplication.execute({
                drawingId: current.document.id,
                transaction: circleTransaction(call.context.revision, 'circle_external'),
              });
            }
            return tools.invoke(call);
          },
          discardPrepared: tools.discardPrepared.bind(tools),
          discardRun: tools.discardRun.bind(tools),
        };
      },
    });

    const final = await runtime.start(startInput(workspace)).completion;

    expect(final.status).toBe('completed');
    expect(final.recovery.staleRecoveries).toBe(1);
    expect(plannerInputs).toHaveLength(2);
    expect(plannerInputs[1].revision).not.toBe(plannerInputs[0].revision);
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_external' }),
      expect.objectContaining({ id: 'circle_replanned' }),
    ]);
  });

  it('fails a bounded read loop and preserves any prior commits', async () => {
    const decision: DrawingDecisionModelAdapter = {
      decide: vi.fn(async (): Promise<AgentDecision> => ({
        type: 'query' as const, toolCallId: `query_${Math.random()}`,
        selector: { plane: 'geometry', limit: 10 },
      })),
    };
    const { runtime, workspace } = await setup({
      decision,
      limits: { maxConsecutiveReads: 2, maxDecisions: 10 },
    });

    const final = await runtime.start(startInput(workspace)).completion;

    expect(final.status).toBe('failed');
    expect(final.error).toContain('最大连续读取次数');
    expect(final.decisionCount).toBeLessThanOrEqual(3);
  });

  it('publishes accepted synchronously and never exposes a model name in progress', async () => {
    const { runtime, workspace } = await setup();
    const handle = runtime.start(startInput(workspace));
    const progress = runtime.getProgress(handle.runId)!;

    expect(progress.events()[0]).toMatchObject({ type: 'accepted', elapsedMs: 0 });
    await handle.completion;
    expect(JSON.stringify(progress.events())).not.toContain('lite-model');
    expect(JSON.stringify(progress.events())).not.toContain('repair-model');
  });
});

function startInput(workspace: Awaited<ReturnType<DrawingApplication['create']>>) {
  return {
    runId: 'run_1', drawingId: workspace.document.id, baseRevision: workspace.revision,
    goal: '创建一个圆',
    modelProfile: { planner: 'lite-model', decision: 'lite-model', repair: 'repair-model' },
  };
}

function createPlan(id: string): DrawingAgentPlan {
  return {
    goal: {
      id: 'goal_1', objective: '创建一个圆', scope: { plane: 'geometry', limit: 20 },
      acceptanceCriteria: [{ type: 'node.exists', nodeId: id }],
      riskPolicy: { candidateAllowed: true, maxCommits: 2 },
    },
    workflow: [{
      id: 'create', capability: 'edit_entities', dependsOn: [],
      completionCriteria: [{ type: 'node.exists', nodeId: id }], status: 'pending',
    }],
    summary: '创建圆',
  };
}

function createDecision(id: string, confidence: number): AgentDecision {
  return {
    type: 'transact', toolCallId: `create_${id}`, confidence,
    commands: [{
      type: 'geometry.create',
      value: {
        id: id as GeometryId,
        type: 'circle', visible: true,
        quality: {
          status: confidence < 0.6 ? 'candidate' : 'confirmed',
          confidence, evidenceRefs: [],
        },
        center: [0, 0], radius: 5,
      },
    }],
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function circleTransaction(revision: string, id: string): DrawingTransaction {
  const decision = createDecision(id, 1);
  if (decision.type !== 'transact') throw new Error('expected transaction decision');
  return {
    id: `tx_${id}`, baseRevision: revision as DrawingTransaction['baseRevision'],
    actor: { type: 'user', id: 'external' },
    commands: decision.commands,
    preconditions: [], postconditions: [], evidenceRefs: [],
  };
}
