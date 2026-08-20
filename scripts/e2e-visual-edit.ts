/**
 * 端到端模拟:模拟用户"发送一条视觉改图指令"后,agent 完整走一遍真实代码路径。
 * 使用真实 DrawingApplication / DrawingToolRegistry / DrawingAgentRuntime / 提交链路,
 * 仅把"模型"替换为固定脚本(返回与真实 run 一致的合法计划与决策)。
 * 目的是验证:只要模型给出合理计划与决策,改动会真正提交并落在画布上。
 */
import {
  MemoryDrawingRepository,
  type DrawingDocument,
  type DrawingId,
  type IdFactory,
} from '../src/drawing';
import { DrawingApplication } from '../api/services/drawing-application/application';
import { DrawingToolRegistry } from '../api/services/drawing-agent/tool-registry';
import { DrawingAgentRuntime } from '../api/services/drawing-agent/runtime';
import type {
  DrawingAgentAuditEvent,
  DrawingAgentAuditManifest,
  DrawingAgentAuditStore,
} from '../api/services/drawing-agent/audit-types';
import type {
  DrawingAcceptanceModelAdapter,
  DrawingDecisionModelAdapter,
  DrawingPlannerModelAdapter,
} from '../api/services/drawing-agent/types';
import type {
  AgentDecision,
  DrawingAgentPlan,
} from '../src/contracts/drawing-agent';

/** 内存审计 store,验证模型原始返回写入审计 */
class MemoryAuditStore implements DrawingAgentAuditStore {
  events: DrawingAgentAuditEvent[] = [];
  manifest!: DrawingAgentAuditManifest;
  async startRun(manifest: DrawingAgentAuditManifest): Promise<void> { this.manifest = manifest; }
  async updateManifest(manifest: DrawingAgentAuditManifest): Promise<void> { this.manifest = manifest; }
  async saveCommit(): Promise<void> {}
  async readRun() {
    return { manifest: this.manifest, events: this.events, commits: [] };
  }
  async appendEvent(event: DrawingAgentAuditEvent): Promise<void> { this.events.push(event); }
}

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return {
    next: (kind: string) => {
      const next = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, next);
      return `${kind}_${next}`;
    },
  };
}

/** 一个人形:身体/下垂的右手在下方区域,头部在上方区域 */
function seededDocument(): DrawingDocument {
  const quality = { status: 'confirmed' as const, evidenceRefs: [] };
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_person' as DrawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      {
        id: 'node_head' as never, type: 'circle', visible: true, quality,
        center: [375, 80], radius: 30,
      },
      {
        id: 'node_body' as never, type: 'polyline', visible: true, quality, closed: false,
        vertices: [{ point: [370, 150] }, { point: [365, 260] }, { point: [350, 400] }],
      },
      {
        // 下垂的右手(下方区域 {150,450,300,550})
        id: 'node_hand_down' as never, type: 'polyline', visible: true, quality, closed: false,
        vertices: [{ point: [300, 300] }, { point: [260, 420] }, { point: [240, 500] }],
      },
      {
        // 上方区域 {300,50,450,280} 原有的图形(模拟"原来手的位置有图元")
        id: 'node_hand_region' as never, type: 'arc', visible: true, quality,
        center: [360, 200], radius: 20, startAngle: 0, endAngle: 180, counterClockwise: true,
      },
    ],
    annotations: [],
    relations: [],
    features: [],
  };
}

/** 与真实 run_1790a305 一致的合法计划(基于 min:1,不猜精确数量) */
function visualEditPlan(): DrawingAgentPlan {
  return {
    goal: {
      id: 'goal_modify_right_hand_01',
      objective: '将右手修改为向上打招呼的姿势',
      scope: { plane: 'geometry', bounds: { minX: 100, minY: 50, maxX: 450, maxY: 580 } },
      acceptanceCriteria: [
        { type: 'document.valid' },
        { type: 'selection.count', selector: { plane: 'geometry', bounds: { minX: 300, minY: 50, maxX: 450, maxY: 280 } }, min: 1 },
      ],
      riskPolicy: { candidateAllowed: true, maxCommits: 3 },
    },
    workflow: [
      {
        id: 'step1_locate_original_hand', capability: 'query_entities', dependsOn: [],
        completionCriteria: [{ type: 'selection.count', selector: { plane: 'geometry', bounds: { minX: 150, minY: 450, maxX: 300, maxY: 550 } }, min: 1 }],
        status: 'pending',
      },
      {
        id: 'step2_adjust_hand_pose', capability: 'edit_entities', dependsOn: ['step1_locate_original_hand'],
        completionCriteria: [{ type: 'selection.count', selector: { plane: 'geometry', bounds: { minX: 300, minY: 50, maxX: 450, maxY: 280 } }, min: 1 }],
        status: 'pending',
      },
      {
        id: 'step3_verify_goal', capability: 'verify_goal', dependsOn: ['step2_adjust_hand_pose'],
        completionCriteria: [{ type: 'document.valid' }, { type: 'selection.count', selector: { plane: 'geometry', bounds: { minX: 300, minY: 50, maxX: 450, maxY: 280 } }, min: 1 }],
        status: 'pending',
      },
    ],
    summary: '定位原图中的右手，调整其位置和顶点形状，将右手修改为向上举起打招呼的姿势',
  };
}

/** 与真实 run_1790a305 一致的决策:定位 → 新建"举起的手"折线(两轮,用于验证 replan 循环) */
function buildDecisions(): AgentDecision[] {
  const query: AgentDecision = {
    type: 'query', toolCallId: 'step1_query_01',
    selector: { plane: 'geometry', limit: 10, bounds: { minX: 150, minY: 450, maxX: 300, maxY: 550 } },
  };
  const edit: AgentDecision = {
    type: 'transact', toolCallId: 'step2_edit_01', confidence: 0.9,
    commands: [{
      type: 'geometry.create',
      value: {
        type: 'polyline', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        vertices: [
          { point: [320, 250] }, { point: [332, 205] }, { point: [342, 160] },
          { point: [348, 105] }, { point: [358, 85] }, { point: [368, 115] },
          { point: [362, 158] }, { point: [372, 102] }, { point: [382, 78] },
          { point: [392, 112] }, { point: [388, 152] }, { point: [378, 188] },
          { point: [362, 228] }, { point: [332, 262] },
        ],
        closed: false,
      },
    }],
  };
  // 第一轮:query + edit;验收不通过 → replan;第二轮:query + edit;验收通过
  return [query, edit, query, edit];
}

async function main() {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 100 });
  const initial = seededDocument();
  const created = await repository.create(initial);
  const workspace = {
    ...created,
    commits: await repository.listCommits(created.document.id),
  };

  const toolApplication = {
    summarize: application.summarize.bind(application),
    query: application.query.bind(application),
    inspect: application.inspect.bind(application),
    preview: application.preview.bind(application),
    execute: application.execute.bind(application),
    renderForVision: application.renderForVision.bind(application),
  };
  const tools = new DrawingToolRegistry({
    application: toolApplication,
    idFactory,
    handleFactory: (() => {
      let sequence = 0;
      return () => `preview_${++sequence}`;
    })(),
  });

  const decisions = buildDecisions();
  const planner: DrawingPlannerModelAdapter = {
    plan: async (input) => {
      const plan = visualEditPlan();
      input.onRawReply?.('planner', JSON.stringify(plan));
      return plan;
    },
  };
  const decision: DrawingDecisionModelAdapter = {
    decide: async (input) => {
      const next = decisions.shift();
      if (!next) return { type: 'finish', summary: '完成' };
      input.onRawReply?.('decision', JSON.stringify(next));
      return next;
    },
  };

  const auditStore = new MemoryAuditStore();
  let acceptanceCalls = 0;
  const acceptance: DrawingAcceptanceModelAdapter = {
    accept: async () => {
      acceptanceCalls += 1;
      return acceptanceCalls === 1
        ? { satisfied: false, reason: '手尚未抬起' }
        : { satisfied: true, reason: '手已抬起' };
    },
  };
  const runtime = new DrawingAgentRuntime({
    application: toolApplication,
    tools,
    planner,
    decision,
    auditStore,
    acceptance,
    now: () => 100,
    limits: { maxDecisions: 20, maxCommits: 3, maxConsecutiveReads: 8, wallClockMs: 60_000, maxPerceptionCommits: 128 },
  });

  const geometryBefore = initial.geometry.length;
  const run = runtime.start({
    runId: 'run_e2e_visual_edit',
    drawingId: workspace.document.id,
    baseRevision: workspace.revision,
    goal: '将图中人物的右手修改为向上打招呼的姿势',
    modelProfile: {
      planner: 'lite-model', decision: 'lite-model', repair: 'repair-model',
      reviewer: 'review-model',
    },
    viewport: { scale: 1, offsetX: 0, offsetY: 580, width: 500, height: 600 },
  });
  const final = await run.completion;

  const current = await application.open(workspace.document.id);
  const geometryAfter = current.document.geometry.length;
  const createdPolyline = (current.document.geometry as unknown[]).filter((node) => {
    const n = node as { type?: string; vertices?: { point: readonly [number, number] }[] };
    if (n.type !== 'polyline') return false;
    return (n.vertices ?? []).some((v) => v.point[0] >= 300 && v.point[0] <= 450 && v.point[1] >= 50 && v.point[1] <= 280);
  }) as { vertices: { point: readonly [number, number] }[] }[];

  console.log('=== 端到端视觉改图模拟结果 ===');
  console.log('run 状态:', final.status);
  console.log('提交次数 commitCount:', final.commitCount);
  console.log('图元数 before→after:', geometryBefore, '→', geometryAfter);
  console.log('上方区域(举手)新增折线数:', createdPolyline.length);
  console.log('新增折线顶点数:', createdPolyline[0]?.vertices.length ?? 0);

  const changed = final.status === 'completed' && geometryAfter > geometryBefore;
  const modelEvents = auditStore.events.filter((event) => event.type === 'model');
  console.log('审计中 model(原始返回)事件数:', modelEvents.length);
  console.log('视觉验收调用次数 acceptanceCalls:', acceptanceCalls, '(预期 2:一次不通过触发 replan,一次通过)');
  const plannerRaw = modelEvents.find((event) => event.type === 'model' && event.payload.role === 'planner');
  console.log('planner 原始返回已捕获:', Boolean(plannerRaw), plannerRaw ? String(plannerRaw.payload.reply).slice(0, 60) : '');
  console.log(changed ? '\n✅ 图纸确实发生了改变(举手的折线已落到画布)' : '\n❌ 图纸未改变');
  return changed && modelEvents.length > 0 && acceptanceCalls >= 2;
}

main().then((ok) => {
  process.exit(ok ? 0 : 1);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
