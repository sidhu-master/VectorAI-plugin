import {
  DrawingAgentProtocolError,
  parseAgentDecision,
  parseAgentPlan,
  type AgentDecision,
  type DrawingAgentPlan,
} from '../../../src/contracts/drawing-agent.js';
import {
  requestDrawingAgentCompletion,
  requestDrawingVisionCompletion,
  type DrawingAgentCompletionParams,
  type DrawingVisionCompletionParams,
} from '../ai-gateway.js';
import type {
  DrawingAcceptanceInput,
  DrawingAcceptanceModelAdapter,
  DrawingAcceptanceResult,
  DrawingDecisionInput,
  DrawingDecisionModelAdapter,
  DrawingModelRole,
  DrawingPlannerInput,
  DrawingPlannerModelAdapter,
  DrawingToolEvidence,
  DrawingToolReceipt,
  DrawingAgentModelProfile,
} from './types.js';

export type DrawingFeedbackEscalationReason =
  | 'repeated_non_improvement'
  | 'topology_type_ambiguity'
  | 'merge_split_retype_ambiguity'
  | 'topology_regression'
  | 'explicit_low_confidence';

export function selectDrawingFeedbackModel(
  profile: DrawingAgentModelProfile,
  escalationReason?: DrawingFeedbackEscalationReason,
): string {
  return escalationReason ? profile.repair : profile.decision;
}

const MAX_SUMMARY_ITEMS = 100;
const MAX_CONTEXT_ITEMS = 8;
const MAX_ARRAY_ITEMS = 32;
const MAX_OBJECT_KEYS = 32;
const MAX_STRING_LENGTH = 1_000;

const PLANNER_SYSTEM_PROMPT = `你是 VectorAI 的二维 Drawing IR 任务规划器。
你看到的是 Drawing IR 的有界摘要，不是图片、完整图纸或提交历史。请把用户目标拆成可审计、可回归的小步骤。

只输出一个 JSON 对象，严格符合：
{"goal":{"id":string,"objective":string,"scope":DrawingSelector,"acceptanceCriteria":DrawingAssertion[],"riskPolicy":{"candidateAllowed":boolean,"maxCommits":positive_integer}},"workflow":[{"id":string,"capability":string,"dependsOn":string[],"completionCriteria":DrawingAssertion[],"status":"pending"}],"summary":string}

DrawingSelector 可使用 plane、ids、types、qualityStatus、bounds、relationKind、limit。
DrawingAssertion 必须精确使用以下五种形状之一，不得添加额外字段：
{"type":"node.exists","nodeId":string}
{"type":"node.absent","nodeId":string}
{"type":"property.equals","nodeId":string,"path":string,"value":json_value}
{"type":"document.valid"}
{"type":"selection.count","selector":DrawingSelector,"equals":non_negative_integer}
{"type":"selection.count","selector":DrawingSelector,"min":non_negative_integer}
selection.count 的 equals 与 min 二选一：equals 表示精确条数，min 表示至少 N 条。对"区域定位/找某个对象"这类无法预先确定精确数量的节点，务必用 min（如 min:1，表示该区域至少有一条即通过），不要用 equals 猜测精确数量。
对新建且尚无稳定 ID 的图元，使用 selection.count 或 document.valid，不要在计划中虚构 nodeId。
工作流 capability 只能是 query_entities、inspect_entity、edit_entities、verify_goal；新建、修改、删除都使用 edit_entities。修改必须是局部增量。
已有对象只能引用摘要里出现的稳定 ID，不得编造待修改或待删除对象的 ID。新建图元可不提供 ID。
低置信度结果允许作为 candidate，但必须安排验证。不得输出 commit；提交由运行时在预览安全点后执行。
不得输出思考过程、Markdown、模型名称、SpatialModel 或 SpatialIntent。`;

const DECISION_SYSTEM_PROMPT = `你是 VectorAI Drawing Agent 的单步决策器。你只能输出一个决策，不得输出解释或思考过程。

允许的 JSON 形状只有：
1. {"type":"query","toolCallId":string,"selector":DrawingSelector}
2. {"type":"inspect","toolCallId":string,"nodeId":string}
3. {"type":"transact","toolCallId":string,"commands":DrawingCommand[],"confidence"?:0_to_1}
4. {"type":"finish","summary":string}

DrawingSelector 只允许 plane、ids、types、qualityStatus、bounds、relationKind、limit。
DrawingCommand 只允许：
- 新建：{"type":"geometry.create","value":GeometryNode}，或 annotation/relation/feature.create。value 可省略 id，运行时会生成稳定 ID。
- 修改：{"type":"geometry.update","id":string,"changes":object,"expected"?:object}，或其他 plane.update。
- 删除：{"type":"geometry.delete","id":string}，或其他 plane.delete。
所有新建节点都必须包含 visible:boolean 和 quality:{"status":"confirmed"|"candidate","confidence"?:0_to_1,"evidenceRefs":[]} 。
二维几何精确形状：
{"type":"geometry.create","value":{"type":"circle","visible":true,"quality":{"status":"confirmed","evidenceRefs":[]},"center":[x,y],"radius":positive_number}}
point 用 x,y；line 用 start,end；ray/xline 用 origin,direction；arc 用 center,radius,startAngle,endAngle,counterClockwise；ellipse 用 center,majorAxis,ratio,startParam?,endParam?；polyline 用 vertices:[{"point":[x,y],"bulge"?:number}],closed；spline 用 degree,controlPoints,knots,weights?,closed,periodic。
文字使用 annotation.create + type:text + content,position,height,rotation,alignment,verticalAlignment,maxWidth?。

修改和删除只可使用工具证据中出现的稳定 ID，不得猜测 ID。每次 transact 必须最小化改动并满足当前工作流节点的验收条件。
不得请求或输出 commit_transaction、previewHandle、完整图纸、SpatialModel 或 SpatialIntent。transact 会由运行时自动预览，提交由运行时在安全点执行。
如果证据不足，先 query 或 inspect；如果目标已由回执证明，才 finish。`;

export const DRAWING_AGENT_PROMPT_HASHES = Object.freeze({
  planner: createHash('sha256').update(PLANNER_SYSTEM_PROMPT).digest('hex'),
  decision: createHash('sha256').update(DECISION_SYSTEM_PROMPT).digest('hex'),
});

export type DrawingAgentCompletion = (input: DrawingAgentCompletionParams) => Promise<string>;
export type DrawingVisionCompletion = (input: DrawingVisionCompletionParams) => Promise<string>;

const DECISION_VISION_SYSTEM_PROMPT = `你是 VectorAI Drawing Agent 的单步决策器,并且能看到当前图纸的渲染图。
你只能输出一个决策 JSON,不得输出解释或思考过程。

你可以看到一幅"当前图纸"的图片,图中每个可见图元用不同颜色绘制,并用 grounding 映射给出 图片区域 ↔ nodeId 的对应关系。用户选中的图元会用红色高亮。

接地规则:
- 用户指令中的指代(如"右手""那个圆""选中的线")要通过图片上的区域定位,再用 grounding 里最近的 nodeId 确定具体对象。
- 若存在 selection(用户选中),指令默认作用域是这些选中节点;除非指令明确要求新建,否则不要改动选区之外的对象。
- 只能用 grounding 里出现的 nodeId 去修改/删除,禁止编造 ID。新建对象可不提供 ID。
- 修改肢体/形状时,先判断"这个部位由哪些节点/线段组成",再针对这些节点分别发出 geometry.update,不要只改单个端点;必要时可 update 多个节点。
- grounding 中每个节点的 normalized 字段是其相对整幅图的归一化坐标(0~1),请据此判断节点在整图中的位置与相对关系。
- 坐标一律使用图纸世界坐标,不要直接使用归一化坐标。

允许的 JSON 形状只有:
1. {"type":"query","toolCallId":string,"selector":DrawingSelector}
2. {"type":"inspect","toolCallId":string,"nodeId":string}
3. {"type":"transact","toolCallId":string,"commands":DrawingCommand[],"confidence"?:0_to_1}
4. {"type":"finish","summary":string}

DrawingSelector 只允许 plane、ids、types、qualityStatus、bounds、relationKind、limit。
DrawingCommand 只允许:
- 新建：{"type":"geometry.create","value":GeometryNode}，或 annotation/relation/feature.create。
- 修改：{"type":"geometry.update","id":string,"changes":object,"expected"?:object}，或其他 plane.update。
- 删除：{"type":"geometry.delete","id":string}，或其他 plane.delete。
所有新建节点都必须包含 visible:boolean 和 quality:{"status":"confirmed"|"candidate","confidence"?:0_to_1,"evidenceRefs":[]}。
二维几何精确形状：point 用 x,y；line 用 start,end；circle 用 center,radius；arc 用 center,radius,startAngle,endAngle,counterClockwise；ellipse 用 center,majorAxis,ratio,startParam?,endParam?；polyline 用 vertices:[{"point":[x,y],"bulge"?:number}],closed；spline 用 degree,controlPoints,knots,weights?,closed,periodic。文字用 annotation.create + type:text + content,position,height,rotation,alignment,verticalAlignment,maxWidth?。
修改和删除只可使用 grounding 中出现的稳定 ID，不得猜测 ID。每次 transact 必须最小化改动并满足当前工作流节点的验收条件。
不得请求或输出 commit_transaction、previewHandle、完整图纸。transact 会由运行时自动预览，提交由运行时在安全点执行。
如果证据不足，先 query 或 inspect；如果目标已由回执证明，才 finish。`;

export class DrawingPlannerAdapter implements DrawingPlannerModelAdapter {
  onRawReply?: (role: DrawingModelRole, reply: string) => void;

  constructor(
    private readonly complete: DrawingAgentCompletion = requestDrawingAgentCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async plan(input: DrawingPlannerInput): Promise<DrawingAgentPlan> {
    assertBeforeDeadline('planner', input.deadlineAt, this.now());
    const reply = await this.complete({
      role: 'planner',
      modelName: input.modelName,
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        objective: input.objective,
        ...(input.instruction ? { instruction: input.instruction } : {}),
        drawing: {
          id: input.drawingId,
          revision: input.revision,
          summary: {
            unit: input.summary.unit,
            counts: structuredClone(input.summary.counts),
            ...(input.summary.bounds ? { bounds: structuredClone(input.summary.bounds) } : {}),
            items: input.summary.items.slice(0, MAX_SUMMARY_ITEMS).map((item) => ({
              ...structuredClone(item),
              summary: truncate(item.summary),
            })),
            truncated: input.summary.truncated || input.summary.items.length > MAX_SUMMARY_ITEMS,
          },
        },
      }),
      signal: input.signal,
    });
    this.onRawReply?.('planner', reply);
    return parseAgentPlan(parseJsonReply(reply));
  }
}

export class DrawingDecisionAdapter implements DrawingDecisionModelAdapter {
  onRawReply?: (role: DrawingModelRole, reply: string) => void;

  constructor(
    private readonly complete: DrawingAgentCompletion = requestDrawingAgentCompletion,
    private readonly completeVision: DrawingVisionCompletion = requestDrawingVisionCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async decide(input: DrawingDecisionInput): Promise<AgentDecision> {
    assertBeforeDeadline('decision', input.deadlineAt, this.now());
    const currentNode = input.plan.workflow.find((node) => (
      node.id === input.currentWorkflowNodeId
    ));
    if (!currentNode) throw new Error(`Workflow node not found: ${input.currentWorkflowNodeId}`);
    const baseInput = {
      goal: boundedJson(input.plan.goal),
      currentWorkflowNode: boundedJson(currentNode),
      revision: input.revision,
      attempt: input.attempt,
      pendingInstructions: input.pendingInstructions.slice(-MAX_CONTEXT_ITEMS).map(truncate),
      recentReceipts: input.recentReceipts.slice(-MAX_CONTEXT_ITEMS).map(publicReceipt),
      toolEvidence: input.toolEvidence.slice(-MAX_CONTEXT_ITEMS).map(publicEvidence),
    };
    if (input.vision) {
      const { image, mimeType } = splitDataUrl(input.vision.snapshot.imageDataUrl);
      const reply = await this.completeVision({
        modelName: input.modelName,
        systemPrompt: DECISION_VISION_SYSTEM_PROMPT,
        userPrompt: JSON.stringify({
          ...baseInput,
          imageSize: { width: input.vision.snapshot.width, height: input.vision.snapshot.height },
          selection: input.vision.selection,
          visualGrounding: input.vision.snapshot.nodes,
        }),
        image,
        mimeType,
        signal: input.signal,
      });
      this.onRawReply?.('decision', reply);
      return parseAgentDecision(parseJsonReply(reply));
    }
    const reply = await this.complete({
      role: 'decision',
      modelName: input.modelName,
      systemPrompt: DECISION_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(baseInput),
      signal: input.signal,
    });
    this.onRawReply?.('decision', reply);
    return parseAgentDecision(parseJsonReply(reply));
  }
}

const ACCEPTANCE_SYSTEM_PROMPT = `你是 VectorAI Drawing Agent 的视觉验收器。
你会看到一幅"当前图纸"的渲染图。请判断：用户的目标是否已经在图中达成。
只输出一个 JSON：{"satisfied":boolean,"reason":string}。
- satisfied=true 表示图纸已经满足了目标。
- reason 用一句中文简要说明判断依据。
不要输出任何其它内容。`;

export class DrawingAcceptanceAdapter implements DrawingAcceptanceModelAdapter {
  onRawReply?: (role: DrawingModelRole, reply: string) => void;

  constructor(
    private readonly completeVision: DrawingVisionCompletion = requestDrawingVisionCompletion,
  ) {}

  async accept(input: DrawingAcceptanceInput): Promise<DrawingAcceptanceResult> {
    if (input.deadlineAt !== undefined && Date.now() > input.deadlineAt) {
      throw new Error('acceptance deadline exceeded');
    }
    const { image, mimeType } = splitDataUrl(input.image);
    const reply = await this.completeVision({
      modelName: input.modelName,
      systemPrompt: ACCEPTANCE_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        imageSize: { width: input.width, height: input.height },
      }),
      image,
      mimeType,
      signal: input.signal,
    });
    this.onRawReply?.('acceptance', reply);
    const parsed = parseJsonReply(reply) as { satisfied?: unknown; reason?: unknown };
    return {
      satisfied: parsed.satisfied === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  }
}

function publicReceipt(receipt: DrawingToolReceipt): unknown {
  return boundedJson(receipt);
}

function publicEvidence(evidence: DrawingToolEvidence): unknown {
  return {
    receipt: publicReceipt(evidence.receipt),
    ...(evidence.output === undefined ? {} : { output: boundedJson(evidence.output) }),
  };
}

function boundedJson(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return truncate(value);
  if (value === undefined) return undefined;
  if (depth >= 8) return '[depth-limit]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => boundedJson(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, item]) => [key, boundedJson(item, depth + 1)]),
    );
  }
  return String(value);
}

function truncate(value: string): string {
  return value.length <= MAX_STRING_LENGTH
    ? value
    : `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

function splitDataUrl(dataUrl: string): { image: string; mimeType: string } {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return { image: dataUrl, mimeType: 'image/png' };
  return { image: match[2], mimeType: match[1] };
}

function assertBeforeDeadline(role: string, deadlineAt: number, now: number): void {
  if (now >= deadlineAt) throw new Error(`${role} deadline exceeded`);
}

function parseJsonReply(reply: string): unknown {
  const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new DrawingAgentProtocolError('response.json', '模型响应中没有 JSON 对象');
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (error) {
    throw new DrawingAgentProtocolError(
      'response.json',
      error instanceof Error ? error.message : '模型返回了非法 JSON',
    );
  }
}
import { createHash } from 'node:crypto';
