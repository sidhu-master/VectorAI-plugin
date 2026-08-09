import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { DrawingAgentProtocolError, type AgentDecision, type DrawingAgentPlan } from '../../../src/contracts/drawing-agent';
import {
  type DrawingTransaction,
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
  type PerceptionPreviewDelta,
} from '../../../src/drawing';
import { DrawingApplication } from '../drawing-application/application';
import { DrawingToolRegistry } from './tool-registry';
import { DrawingAgentRuntime } from './runtime';
import { FileDrawingAgentAuditStore } from './file-audit-store';
import type { DrawingAgentAuditStore } from './audit-types';
import type { DrawingPerceptionOutput } from '../drawing-perception/pipeline';
import type {
  DrawingFeedbackOutput,
  DrawingFeedbackRunInput,
} from '../drawing-feedback/loop-controller';
import type { SourceArtifactStore } from '../source-artifacts/types';
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
  auditStore?: DrawingAgentAuditStore;
  perceptionOutputs?: DrawingPerceptionOutput[];
  perceptionModels?: string[];
  perceptionService?: { run(input: {
    signal: AbortSignal;
    modelName: string;
  }): AsyncIterable<DrawingPerceptionOutput> };
  feedbackLoop?: { run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> };
  stageTimeoutMs?: number;
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
    auditStore: input.auditStore,
    sourceArtifacts: input.perceptionOutputs || input.perceptionService || input.feedbackLoop
      ? sourceStore() : undefined,
    perception: input.perceptionService ?? (input.perceptionOutputs
      ? perception(input.perceptionOutputs, input.perceptionModels)
      : undefined),
    stageTimeoutMs: input.stageTimeoutMs,
    visionModelName: 'vision-model',
    visionRepairModelName: 'repair-vision-model',
    feedbackLoop: input.feedbackLoop,
  });
  return { application, decision, order, planner, runtime, tools, workspace };
}

describe('DrawingAgentRuntime', () => {
  it('uses the feedback loop as the only source-backed reconstruction path when configured', async () => {
    let feedbackCalls = 0;
    let perceptionCalls = 0;
    const feedbackLoop = {
      async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
        feedbackCalls += 1;
        yield { kind: 'state', stage: 'OBSERVE', iteration: 0 };
        yield {
          kind: 'completed', revision: input.revision,
          unresolvedRequired: 0, summary: '来源反馈已收敛',
        };
      },
    };
    const perceptionService = {
      async *run(): AsyncIterable<DrawingPerceptionOutput> {
        perceptionCalls += 1;
        yield { kind: 'stage', runId: 'run_1', stage: 'completed', timestamp: 1, durationMs: 1, detail: {} };
      },
    };
    const { runtime, workspace } = await setup({ feedbackLoop, perceptionService });

    const final = await runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(feedbackCalls).toBe(1);
    expect(perceptionCalls).toBe(0);
    expect(final.analysisSummary).toBe('来源反馈已收敛');
  });

  it('publishes clean-line vectorization stages as visible progress', async () => {
    const feedbackLoop = {
      async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
        yield { kind: 'state', stage: 'VECTORIZE_SOURCE', iteration: 0 };
        yield { kind: 'state', stage: 'DRAW_VECTOR_DRAFT', iteration: 0 };
        yield { kind: 'state', stage: 'PROMOTE_PRIMITIVE', iteration: 0 };
        yield {
          kind: 'completed', revision: input.revision,
          unresolvedRequired: 0, summary: '矢量化完成',
        };
      },
    };
    const { runtime, workspace } = await setup({ feedbackLoop });
    const handle = runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    });
    const events: import('./progress').AgentProgressEvent[] = [];
    runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

    const final = await handle.completion;

    expect(final.status).toBe('completed');
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool_started', title: '正在提取图纸中心线' }),
      expect.objectContaining({ type: 'tool_started', title: '正在逐条绘制矢量底稿' }),
      expect.objectContaining({ type: 'validation', title: '正在提升为规范图元' }),
    ]));
  });

  it('streams one model proposal and removes it when its local patch is committed', async () => {
    const feedbackLoop = {
      async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
        yield { kind: 'state', stage: 'SELECT_TARGET', iteration: 1 };
        yield {
          kind: 'proposal', regionId: 'region_head', slotId: 'slot_head',
          nodes: [{
            id: 'feedback_preview_slot_head' as GeometryId,
            type: 'circle', visible: true, center: [55, 65], radius: 35,
            quality: { status: 'candidate', confidence: 0.91, evidenceRefs: [] },
          }],
          labelsByNodeId: { feedback_preview_slot_head: '模型提案 1' },
        };
        yield {
          kind: 'commit', revision: input.revision, slotIds: ['slot_head'],
          execution: {
            receipt: {
              toolCallId: 'commit_head', capability: 'commit_transaction', version: '1.0.0',
              access: 'write', revisionBefore: input.revision,
              revisionAfter: input.revision, inputDigest: 'in',
              affectedNodeIds: [], status: 'already_satisfied',
              outcome: { kind: 'commit', committed: false },
              durationMs: 1, retry: { allowed: false },
            },
          },
        };
        yield {
          kind: 'completed', revision: input.revision,
          unresolvedRequired: 0, summary: '来源反馈已收敛',
        };
      },
    };
    const { runtime, workspace } = await setup({ feedbackLoop });
    const handle = runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    });
    const events: import('./progress').AgentProgressEvent[] = [];
    runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

    await handle.completion;

    const deltas = events
      .filter((event) => event.type === 'perception_delta')
      .map((event) => event.perceptionDelta);
    expect(deltas).toEqual([
      expect.objectContaining({
        action: 'observe', slotIds: ['slot_head'],
        upserts: [expect.objectContaining({ id: 'feedback_preview_slot_head' })],
      }),
      expect.objectContaining({
        action: 'promote', slotIds: ['slot_head'],
        removeIds: ['feedback_preview_slot_head'],
      }),
    ]);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'model_started', title: '正在选择下一观察目标',
    }));
    expect(events.filter((event) => event.type === 'planning')).toEqual([]);
  });

  it('keeps a rejected proposal visible in red through terminal failure', async () => {
    const feedbackLoop = {
      async *run(): AsyncIterable<DrawingFeedbackOutput> {
        yield {
          kind: 'proposal', slotId: 'slot_rejected',
          nodes: [{
            id: 'feedback_preview_slot_rejected' as GeometryId,
            type: 'circle', visible: true, center: [50, 50], radius: 20,
            quality: { status: 'candidate', confidence: 0.95, evidenceRefs: [] },
          }],
          labelsByNodeId: { feedback_preview_slot_rejected: '模型提案 1' },
        };
        yield { kind: 'correction', action: 'reject', slotIds: ['slot_rejected'] };
        yield { kind: 'failed', code: 'NO_CONVERGENCE', message: '局部未收敛' };
      },
    };
    const { runtime, workspace } = await setup({ feedbackLoop });
    const handle = runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    });
    const events: import('./progress').AgentProgressEvent[] = [];
    runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

    await handle.completion;

    const deltas = events
      .filter((event) => event.type === 'perception_delta')
      .map((event) => event.perceptionDelta);
    expect(deltas).toEqual([
      expect.objectContaining({
        action: 'observe', removeIds: [],
        upserts: [expect.objectContaining({
          id: 'feedback_preview_slot_rejected',
          quality: expect.objectContaining({ confidence: 0.95 }),
        })],
      }),
      expect.objectContaining({
        action: 'reject', removeIds: [],
        upserts: [expect.objectContaining({
          id: 'feedback_preview_slot_rejected',
          quality: expect.objectContaining({ status: 'candidate', confidence: 0.59 }),
        })],
        source: expect.objectContaining({ stage: 'reconciliation' }),
      }),
    ]);
  });

  it('atomically replaces an older rejected preview when the next slot is proposed', async () => {
    const proposal = (slotId: string, x: number): Extract<DrawingFeedbackOutput, { kind: 'proposal' }> => ({
      kind: 'proposal', slotId,
      nodes: [{
        id: `feedback_preview_${slotId}` as GeometryId,
        type: 'circle', visible: true, center: [x, 50], radius: 10,
        quality: { status: 'candidate', confidence: 0.9, evidenceRefs: [] },
      }],
      labelsByNodeId: { [`feedback_preview_${slotId}`]: '模型提案 1' },
    });
    const feedbackLoop = {
      async *run(): AsyncIterable<DrawingFeedbackOutput> {
        yield proposal('slot_first', 20);
        yield { kind: 'correction', action: 'reject', slotIds: ['slot_first'] };
        yield proposal('slot_second', 80);
        yield { kind: 'failed', code: 'STOP_AFTER_PREVIEW', message: '测试结束' };
      },
    };
    const { runtime, workspace } = await setup({ feedbackLoop });
    const handle = runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    });
    const events: import('./progress').AgentProgressEvent[] = [];
    runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

    await handle.completion;

    const observeDeltas = events
      .filter((event) => event.type === 'perception_delta'
        && event.perceptionDelta?.action === 'observe')
      .map((event) => event.perceptionDelta!);
    expect(observeDeltas[1]).toMatchObject({
      upserts: [expect.objectContaining({ id: 'feedback_preview_slot_second' })],
      removeIds: ['feedback_preview_slot_first'],
    });
  });

  it('surfaces feedback model protocol repair as visible task progress', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-protocol-retry-audit-'));
    try {
      const feedbackLoop = {
        async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
          yield {
            kind: 'protocol_retry', attempt: 1, maxAttempts: 3,
            message: 'decision.commands[0]: polyline vertices invalid',
          };
          yield {
            kind: 'completed', revision: input.revision,
            unresolvedRequired: 0, summary: '已恢复',
          };
        },
      };
      const auditStore = new FileDrawingAgentAuditStore({ rootDirectory });
      const { runtime, workspace } = await setup({ feedbackLoop, auditStore });
      const handle = runtime.start({
        ...startInput(workspace), goal: '', source: sourceReference(),
      });
      const events: import('./progress').AgentProgressEvent[] = [];
      runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

      await handle.completion;
      await runtime.flushAudit(handle.runId);

      expect(events).toContainEqual(expect.objectContaining({
        type: 'validation', title: '正在修正模型输出格式（1/3）',
      }));
      const audit = await auditStore.readRun(handle.runId);
      expect(audit.events).toContainEqual(expect.objectContaining({
        type: 'decision',
        payload: expect.objectContaining({
          event: 'FEEDBACK_PROTOCOL_RETRY',
          message: 'decision.commands[0]: polyline vertices invalid',
        }),
      }));
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });

  it('audits feedback decisions and surfaces controller rejection reasons', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-feedback-decision-audit-'));
    try {
      const feedbackLoop = {
        async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
          yield {
            kind: 'decision',
            decision: {
              type: 'transact', toolCallId: 'one_slot',
              slotIds: ['slot_1'], commandTypes: ['geometry.create'], confidence: 0.9,
            },
          };
          yield {
            kind: 'controller_feedback',
            message: '事务图元类型 circle 与 slot 证据候选 polyline 不兼容',
          };
          yield {
            kind: 'completed', revision: input.revision,
            unresolvedRequired: 0, summary: '已恢复',
          };
        },
      };
      const auditStore = new FileDrawingAgentAuditStore({ rootDirectory });
      const { runtime, workspace } = await setup({ feedbackLoop, auditStore });
      const handle = runtime.start({
        ...startInput(workspace), goal: '', source: sourceReference(),
      });
      const events: import('./progress').AgentProgressEvent[] = [];
      runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

      await handle.completion;
      await runtime.flushAudit(handle.runId);

      expect(events).toContainEqual(expect.objectContaining({
        type: 'validation',
        title: '正在调整下一步提案',
        detail: '事务图元类型 circle 与 slot 证据候选 polyline 不兼容',
      }));
      const audit = await auditStore.readRun(handle.runId);
      expect(audit.events).toContainEqual(expect.objectContaining({
        type: 'decision',
        payload: expect.objectContaining({ type: 'transact', slotIds: ['slot_1'] }),
      }));
      expect(audit.events).toContainEqual(expect.objectContaining({
        type: 'validation',
        payload: expect.objectContaining({
          event: 'FEEDBACK_CONTROLLER_REJECTION',
          message: '事务图元类型 circle 与 slot 证据候选 polyline 不兼容',
        }),
      }));
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });

  it('continues the feedback run after one repeatedly invalid slot is deferred', async () => {
    const feedbackLoop = {
      async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
        yield { kind: 'slot_paused', slotId: 'slot_dominant', reason: 'non_improving' };
        yield {
          kind: 'completed', revision: input.revision,
          unresolvedRequired: 0, summary: '已继续其他对象',
        };
      },
    };
    const { runtime, workspace } = await setup({ feedbackLoop });
    const handle = runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    });
    const events: import('./progress').AgentProgressEvent[] = [];
    runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

    await handle.completion;

    expect(runtime.getState(handle.runId)).toMatchObject({ status: 'completed' });
    expect(events).toContainEqual(expect.objectContaining({
      type: 'validation', title: '一个对象已暂缓，继续处理其他对象',
    }));
  });

  it('forwards and audits a perception delta before the perception pass completes', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-progressive-audit-'));
    try {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const auditStore = new FileDrawingAgentAuditStore({ rootDirectory });
      const perceptionService = {
        async *run(): AsyncIterable<DrawingPerceptionOutput> {
          yield { kind: 'observation_delta', runId: 'run_1', delta: previewDelta() };
          await gate;
          yield perceptionBatch('circle_from_image');
          yield {
            kind: 'stage', runId: 'run_1', stage: 'completed', timestamp: 100,
            durationMs: 2, detail: { batchCount: 1 },
          };
        },
      };
      const { runtime, workspace } = await setup({ auditStore, perceptionService });
      const handle = runtime.start({
        ...startInput(workspace), goal: '', source: sourceReference(),
      });
      const events: import('./progress').AgentProgressEvent[] = [];
      runtime.getProgress(handle.runId)!.subscribe((event) => events.push(event));

      await waitUntil(() => events.some((event) => event.type === 'perception_delta'));
      expect(events.find((event) => event.type === 'perception_delta')).toMatchObject({
        perceptionDelta: { sequence: 1, action: 'observe' },
      });
      expect(runtime.getState(handle.runId)?.status).not.toBe('completed');

      release();
      await handle.completion;
      await runtime.flushAudit(handle.runId);
      const audit = await auditStore.readRun(handle.runId);
      expect(audit.events).toContainEqual(expect.objectContaining({
        type: 'perception',
        payload: expect.objectContaining({
          stage: 'observation_delta', sequence: 1, action: 'observe',
          entities: [{
            id: 'circle_from_image', type: 'circle', confidence: 0.8, evidenceRefs: [],
          }],
        }),
      }));
      expect(JSON.stringify(audit.events)).not.toMatch(/vision-model|repair-vision-model/);
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });
  it('analyzes a source without planning or committing when the input is analysis-only', async () => {
    const { application, planner, runtime, workspace } = await setup({
      perceptionOutputs: perceptionSequence([]),
    });

    const final = await runtime.start({
      ...startInput(workspace), goal: '分析这张图纸的结构', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(final.commitCount).toBe(0);
    expect(final.analysisSummary).toContain('0 个图元');
    expect(planner.plan).not.toHaveBeenCalled();
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([]);
  });

  it('keeps valid reconstruction results while reporting incomplete perception coverage', async () => {
    const coverage: DrawingPerceptionOutput = {
      kind: 'stage', runId: 'run_1', stage: 'coverage_completed', timestamp: 100,
      durationMs: 10, viewId: 'view_1', detail: {
        complete: false, incompleteRegionCount: 1, unresolvedContourCount: 1,
      },
    };
    const { runtime, workspace } = await setup({
      perceptionOutputs: perceptionSequence([coverage, perceptionBatch('verified_circle')]),
    });

    const final = await runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(final.analysisSummary).toContain('1 个区域尚未完整读取');
    expect(final.analysisSummary).toContain('1 个全局轮廓尚未参数化');
    expect(final.commitCount).toBe(1);
  });

  it('uses the run deadline for the multi-call perception pipeline instead of one model timeout', async () => {
    const perceptionService = {
      async *run(input: { signal: AbortSignal }): AsyncIterable<DrawingPerceptionOutput> {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 20);
          input.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(input.signal.reason);
          }, { once: true });
        });
        yield {
          kind: 'stage', runId: 'run_1', stage: 'completed', timestamp: 100,
          durationMs: 20, detail: { coverageComplete: true },
        };
      },
    };
    const { runtime, workspace } = await setup({
      perceptionService,
      stageTimeoutMs: 5,
      limits: { wallClockMs: 1_000 },
    });

    const final = await runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
  });

  it('reconstructs DrawingCommand batches through preview and commit without a text planner', async () => {
    const batch = perceptionBatch('circle_from_image');
    const { application, planner, runtime, workspace } = await setup({
      perceptionOutputs: perceptionSequence([batch]),
    });

    const final = await runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(final.commitCount).toBe(1);
    expect(planner.plan).not.toHaveBeenCalled();
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([
      expect.objectContaining({ id: 'circle_from_image', type: 'circle', radius: 5 }),
    ]);
  });

  it('retries perception with the repair profile only after a low-confidence result', async () => {
    const perceptionModels: string[] = [];
    const { runtime, workspace } = await setup({
      perceptionOutputs: perceptionSequence([perceptionBatch('candidate_circle', 0.4)]),
      perceptionModels,
    });

    const final = await runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(final.recovery.lowConfidenceEscalations).toBe(1);
    expect(perceptionModels).toEqual(['vision-model', 'repair-vision-model']);
  });

  it('plans a combined modification against the revision created by reconstruction', async () => {
    const plannerInputs: DrawingPlannerInput[] = [];
    const planner: DrawingPlannerModelAdapter = {
      plan: vi.fn(async (input) => {
        plannerInputs.push(input);
        return createPlan('circle_after_image');
      }),
    };
    const { runtime, workspace } = await setup({
      planner,
      decisions: [createDecision('circle_after_image', 0.9)],
      perceptionOutputs: perceptionSequence([perceptionBatch('circle_from_image')]),
    });

    const final = await runtime.start({
      ...startInput(workspace),
      goal: '先分析图纸，然后添加一个圆',
      source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(final.commitCount).toBe(2);
    expect(plannerInputs[0]).toMatchObject({ objective: '添加一个圆' });
    expect(plannerInputs[0].revision).not.toBe(workspace.revision);
  });

  it('keeps reconstruction component commits separate from the text-agent commit budget', async () => {
    const batches = Array.from({ length: 10 }, (_, index) => perceptionBatch(`circle_${index}`));
    const { runtime, workspace } = await setup({
      perceptionOutputs: perceptionSequence(batches),
    });

    const final = await runtime.start({
      ...startInput(workspace), goal: '', source: sourceReference(),
    }).completion;

    expect(final.status).toBe('completed');
    expect(final.commitCount).toBe(10);
  });

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
    expect((await application.open(workspace.document.id)).commits[0].actor).toEqual({
      type: 'AI', id: 'run_1',
    });
  });

  it('owns read-step completion and final verification without extra model decisions', async () => {
    const plan: DrawingAgentPlan = {
      goal: {
        id: 'goal_bounded_create', objective: '创建一个圆',
        scope: { plane: 'geometry', types: ['circle'] },
        acceptanceCriteria: [{
          type: 'selection.count', selector: { plane: 'geometry', types: ['circle'] }, equals: 1,
        }],
        riskPolicy: { candidateAllowed: true, maxCommits: 1 },
      },
      workflow: [{
        id: 'query', capability: 'query_entities', dependsOn: [],
        completionCriteria: [{
          type: 'selection.count', selector: { plane: 'geometry', types: ['circle'] }, equals: 0,
        }],
        status: 'pending',
      }, {
        id: 'edit', capability: 'edit_entities', dependsOn: ['query'],
        completionCriteria: [{ type: 'node.exists', nodeId: 'circle_1' }], status: 'pending',
      }, {
        id: 'verify', capability: 'verify_goal', dependsOn: ['edit'],
        completionCriteria: [{
          type: 'selection.count', selector: { plane: 'geometry', types: ['circle'] }, equals: 1,
        }],
        status: 'pending',
      }],
      summary: '查询、创建并验证圆',
    };
    const decision: DrawingDecisionModelAdapter = {
      decide: vi.fn(async (input): Promise<AgentDecision> => (
        input.currentWorkflowNodeId === 'query'
          ? { type: 'query', toolCallId: 'query_1', selector: { plane: 'geometry', types: ['circle'] } }
          : createDecision('circle_1', 0.9)
      )),
    };
    const { runtime, workspace } = await setup({ plan, decision });

    const final = await runtime.start(startInput(workspace)).completion;

    expect(final.status).toBe('completed');
    expect(decision.decide).toHaveBeenCalledTimes(2);
    expect(final.plan?.workflow).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'query', status: 'completed' }),
      expect.objectContaining({ id: 'verify', status: 'completed' }),
    ]));
  });

  it('rejects a write decision inside a read-only workflow node before preview', async () => {
    const plan = createPlan('circle_1');
    plan.workflow[0].capability = 'query_entities';
    const decision: DrawingDecisionModelAdapter = {
      decide: vi.fn(async () => createDecision('circle_1', 0.9)),
    };
    const { application, order, runtime, workspace } = await setup({ plan, decision });

    const final = await runtime.start(startInput(workspace)).completion;

    expect(final.status).toBe('failed');
    expect(final.error).toContain('query_entities');
    expect(order).toEqual([]);
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([]);
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
    const plan = createPlan('circle_1');
    plan.goal.acceptanceCriteria = [{ type: 'document.valid' }];
    plan.workflow = Array.from({ length: 4 }, (_, index) => ({
      id: `query_${index + 1}`,
      capability: 'query_entities' as const,
      dependsOn: index === 0 ? [] : [`query_${index}`],
      completionCriteria: [],
      status: 'pending' as const,
    }));
    const decision: DrawingDecisionModelAdapter = {
      decide: vi.fn(async (): Promise<AgentDecision> => ({
        type: 'query' as const, toolCallId: `query_${Math.random()}`,
        selector: { plane: 'geometry', limit: 10 },
      })),
    };
    const { runtime, workspace } = await setup({
      decision, plan,
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

  it('persists plans, decisions, receipts and cloned repository commits for replay', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-runtime-audit-'));
    try {
      const auditStore = new FileDrawingAgentAuditStore({ rootDirectory });
      const { application, runtime, workspace } = await setup({ auditStore });

      const handle = runtime.start(startInput(workspace));
      const final = await handle.completion;
      await runtime.flushAudit(handle.runId);
      const audit = await auditStore.readRun(handle.runId);
      const repositoryCommits = (await application.open(workspace.document.id)).commits;

      expect(final.status).toBe('completed');
      expect(audit.manifest.goalSpec?.id).toBe('goal_1');
      expect(audit.manifest.modelProfile).toEqual({
        planner: 'lite-model', decision: 'lite-model', repair: 'repair-model',
      });
      expect(audit.events.map((event) => event.type)).toEqual(expect.arrayContaining([
        'plan', 'decision', 'preview', 'commit', 'validation', 'state',
      ]));
      expect(audit.commits.map((commit) => commit.id)).toEqual(
        repositoryCommits.map((commit) => commit.id),
      );
      expect(JSON.stringify(runtime.getProgress(handle.runId)!.events())).not.toContain('lite-model');
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });

  it('persists the synthetic perception plan without source bytes', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-perception-audit-'));
    try {
      const auditStore = new FileDrawingAgentAuditStore({ rootDirectory });
      const { runtime, workspace } = await setup({
        auditStore,
        perceptionOutputs: perceptionSequence([]),
      });

      const handle = runtime.start({
        ...startInput(workspace), goal: '分析图纸', source: sourceReference(),
      });
      await handle.completion;
      await runtime.flushAudit(handle.runId);
      const audit = await auditStore.readRun(handle.runId);

      expect(audit.manifest.goalSpec?.id).toContain('perception');
      expect(audit.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'plan' }),
        expect.objectContaining({ type: 'perception' }),
      ]));
      expect(JSON.stringify(audit)).not.toContain(Buffer.from('png').toString('base64'));
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });

  it('persists recovery context and terminal errors in state audit events', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-runtime-failure-audit-'));
    try {
      const auditStore = new FileDrawingAgentAuditStore({ rootDirectory });
      const planner: DrawingPlannerModelAdapter = {
        plan: vi.fn(async () => {
          throw new DrawingAgentProtocolError(
            'plan.goal.acceptanceCriteria[0].selector',
            '未知字段',
          );
        }),
      };
      const { runtime, workspace } = await setup({ auditStore, planner });

      const handle = runtime.start(startInput(workspace));
      const final = await handle.completion;
      await runtime.flushAudit(handle.runId);
      const audit = await auditStore.readRun(handle.runId);

      expect(final.status).toBe('failed');
      expect(audit.events).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'state',
          payload: expect.objectContaining({
            event: 'RECOVERY_RECORDED', recovery: 'schemaCorrections',
          }),
        }),
        expect.objectContaining({
          type: 'state',
          payload: expect.objectContaining({
            event: 'FAILED', error: final.error,
          }),
        }),
      ]));
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
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

function sourceReference() {
  return {
    sourceId: 'source_aaaaaaaaaaaaaaaaaaaaaaaa',
    sha256: 'a'.repeat(64),
    mimeType: 'image/png' as const,
    byteLength: 3,
    page: 1,
  };
}

function sourceStore(): SourceArtifactStore {
  return {
    put: vi.fn(async () => sourceReference()),
    read: vi.fn(async () => ({
      metadata: sourceReference(),
      bytes: Buffer.from('png'),
    })),
  };
}

function perception(outputs: DrawingPerceptionOutput[], models: string[] = []) {
  return {
    async *run(input: { modelName: string }) {
      models.push(input.modelName);
      for (const output of outputs) yield structuredClone(output);
    },
  };
}

function perceptionSequence(
  outputs: DrawingPerceptionOutput[],
): DrawingPerceptionOutput[] {
  return [
    {
      kind: 'stage', runId: 'run_1', stage: 'asset_prepared', timestamp: 100,
      durationMs: 1, detail: { byteLength: 3 },
    },
    ...outputs,
    {
      kind: 'stage', runId: 'run_1', stage: 'completed', timestamp: 100,
      durationMs: 2, detail: { batchCount: outputs.length },
    },
  ];
}

function perceptionBatch(id: string, confidence = 0.9): DrawingPerceptionOutput {
  return {
    kind: 'command_batch', runId: 'run_1', stage: 'patch_ready',
    batch: {
      componentId: `component_${id}`,
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
      postconditions: [{ type: 'node.exists', nodeId: id }],
      observationIds: ['observation_1'],
      evidenceRefs: [],
      confidence,
      lowConfidenceCount: confidence < 0.6 ? 1 : 0,
    },
  };
}

function previewDelta(): PerceptionPreviewDelta {
  return {
    runId: 'run_1', sequence: 1, action: 'observe', slotIds: ['GEO-0001'], removeIds: [],
    upserts: [{
      id: 'circle_from_image' as GeometryId,
      type: 'circle', visible: true, center: [0, 0], radius: 5,
      quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
    }],
    source: { page: 1, viewId: 'view_1', stage: 'detail' },
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('condition was not reached');
}
