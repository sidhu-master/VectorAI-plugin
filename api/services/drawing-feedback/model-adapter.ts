import {
  DrawingAgentProtocolError,
  parseDrawingToolCommands,
} from '../../../src/contracts/drawing-agent.js';
import {
  requestDrawingVisionCompletion,
  requestDrawingAgentCompletion,
  type DrawingAgentCompletionParams,
  type DrawingVisionCompletionParams,
} from '../ai-gateway.js';
import type { CvCropArtifact } from '../drawing-cv/crop-store.js';
import type { CvToolCapability } from '../drawing-cv/tool-registry.js';
import type { CvPrimitiveType } from '../drawing-cv/types.js';
import type {
  FeedbackAgentDecision,
  FeedbackDecisionInput,
} from './types.js';

const MAX_RECEIPTS = 8;
const MAX_REGIONS = 32;
const MAX_SLOTS = 32;
const MAX_DRAWING_ITEMS = 100;
const MAX_ARRAY_ITEMS = 32;
const MAX_OBJECT_KEYS = 40;
const MAX_STRING_LENGTH = 1_000;
const CAPABILITIES: CvToolCapability[] = [
  'inspect_source_overview',
  'inspect_source_crop',
  'create_observation_region',
  'cv_extract_evidence',
  'cv_read_evidence_page',
  'cv_fit_primitive',
  'compare_region',
];
const PRIMITIVE_TYPES: CvPrimitiveType[] = [
  'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline',
];

const FEEDBACK_SYSTEM_PROMPT = `你是 VectorAI 的二维工程图反馈 Agent。你要像维护代码一样，持续观察、拟合、修改、渲染并验证 Drawing IR。

只输出一个严格 JSON 对象，允许四种形状：
1. {"type":"call_tool","toolCallId":string,"capability":CvToolCapability,"input":object}
2. {"type":"transact","toolCallId":string,"slotIds":string[],"commands":DrawingCommand[],"confidence":0_to_1}
3. {"type":"transact_fit","toolCallId":string,"slotId":string,"evidenceHandle":string,"primitiveType":"point"|"line"|"ray"|"xline"|"circle"|"arc"|"ellipse"|"polyline"|"spline","confidence":0_to_1}
4. {"type":"finish","summary":string}

所有来源工具必须使用 user context 顶层的 sourceId；revision 只用于 compare_region 和 Drawing 事务，绝不能当作 sourceId。

CvToolCapability 只能是 inspect_source_overview、inspect_source_crop、create_observation_region、cv_extract_evidence、cv_read_evidence_page、cv_fit_primitive、compare_region。
工具 input 严格形状：
- inspect_source_overview: {"sourceId":string,"budget":{"maxPixels":positive_integer,"maxResults":positive_integer,"maxSamplesPerResult":positive_integer,"timeoutMs":positive_integer}}
- inspect_source_crop: {"sourceId":string,"regionId":string,"budget":budget}。先创建区域，再用此工具查看该区域画面；视觉裁剪只用于理解和选择目标，几何坐标仍以 CV 拟合为准。
- create_observation_region: {"sourceId":string,"regionId":string,"bounds":{"x":integer,"y":integer,"width":positive_integer,"height":positive_integer},"purpose":"inventory"|"geometry"|"topology"|"annotation"|"verification","targetSlotIds":string[],"parentRegionId"?:string,"resolutionLevel":non_negative_integer,"attempt":positive_integer}
- cv_extract_evidence: {"sourceId":string,"regionId":string,"budget":budget}
- cv_read_evidence_page: {"handle":string,"offset":non_negative_integer,"limit":1_to_1000}
- cv_fit_primitive: {"handle":string,"primitiveType":"point"|"line"|"ray"|"xline"|"circle"|"arc"|"ellipse"|"polyline"|"spline","budget":budget}
- compare_region: {"sourceId":string,"regionId":string,"revision":string}
工具调用必须遵守“创建区域 → inspect_source_crop 视觉查看同一区域 → cv_extract_evidence”的顺序。整页裁剪只用于判断版面和选择下一批重叠区域，不得直接在整页上提取明细。服务器硬上限：overview/crop 的 maxPixels 不超过 2000000；cv_extract_evidence/cv_fit_primitive 的 maxPixels 不超过 1000000；maxResults 不超过 16、maxSamplesPerResult 不超过 2048、timeoutMs 不超过 10000。超出值会被服务器自动钳制，不要依赖更高预算绕过分区。
观察区域应围绕完整图元，可重叠、嵌套或扩大。对同一批未处理 slot 必须按证据尺度从大到小：先提交主体外轮廓，再处理内部几何，最后才处理文字、尺寸和小孔；不得在大轮廓仍未处理时挑选小型闭合像素。触碰裁剪边缘的证据不能单独确认圆、椭圆等闭合图元，必须扩大重叠区域看到完整对象。
CV evidence 和 suggestedFits 只作为你的观察上下文，绝不会直接显示在画布上。每次 transact 必须且只能选择一个 slot，并只提出这个 slot 对应的一个局部对象；运行时会立即显示该单对象预览，验证后提交或退回，然后才会再次调用你决定下一个对象。禁止把多个 slot 或整批 CV 候选合并为一次事务。
当你已经调用 cv_fit_primitive 得到合适的 documentParameters 时，优先返回 transact_fit 引用该 evidenceHandle 和 primitiveType；控制器会从已审计的拟合回执组装一个显式 DrawingCommand，避免你重复抄写长坐标数组。transact_fit 仍是你的单对象绘制决定，不会自动应用其他 CV 候选。
收到 protocolFeedback 后禁止原样重复上一提案：类型不兼容时必须改用 slot.candidateTypes 中的类型，参数或结构无效时必须先调用匹配类型的 cv_fit_primitive，或改选另一个未暂缓 slot。对 polyline slot 只能使用 polyline 拟合返回的 documentParameters.vertices，不得用 circle 拟合替代主体复合轮廓。
坐标和图元参数应优先来自 CV evidence handle 的确定性拟合，不得凭空估计。cv_extract_evidence 会为明确类型的候选附带 suggestedFits；存在合适 suggestedFits 时应直接使用其中的 documentParameters，无需再次调用 cv_fit_primitive。只有需要尝试不同图元类型或重新拟合时才单独调用 cv_fit_primitive。拟合结果里的 sourceParameters 用于审计，创建 DrawingCommand 必须直接采用 documentParameters；documentFrame 已完成图片 Y-down 到 CAD Y-up 及默认 500 宽换算，不要再次翻转或缩放。不得输出原始 samples、rgba、base64 或像素正文。
修改必须通过 DrawingCommand 做局部增量；允许 create、update、retype、merge、split、delete 的后续修正。只有 required residual 为零时才能 finish。
DrawingCommand 必须使用完整命令包装，禁止直接输出 circle、line 等简写：
- 新建几何：{"type":"geometry.create","value":{"type":"circle","visible":true,"quality":{"status":"confirmed"|"candidate","confidence"?:0_to_1,"evidenceRefs":[]},"center":[x,y],"radius":positive_number}}；其他几何把 value 换成对应 point/line/ray/xline/arc/ellipse/polyline/spline 字段。
- 新建 polyline：{"type":"geometry.create","value":{"type":"polyline","visible":true,"quality":{"status":"candidate","confidence"?:0_to_1,"evidenceRefs":[]},"vertices":[{"point":[x1,y1]},{"point":[x2,y2]}],"closed":boolean}}。vertices 必须是对象数组，逐项保留 CV documentParameters.vertices 的 {"point":[x,y]} 结构，禁止包成字符串或单个对象。
- 修改几何：{"type":"geometry.update","id":string,"changes":object,"expected"?:object}
- 删除几何：{"type":"geometry.delete","id":string}
- 文字和尺寸使用 annotation.create/update/delete，且同样必须包含完整 type 包装。
retype 必须在同一事务中删除旧图元并新建正确类型。新建节点 ID 可省略，由运行时生成。
不得输出 Markdown、隐藏思考过程、模型名称、完整图纸或历史。`;

export type DrawingFeedbackCompletion = (
  input: DrawingAgentCompletionParams,
) => Promise<string>;

export interface DrawingFeedbackVisionOptions {
  readCrop(mediaHandle: string): Promise<CvCropArtifact>;
  complete?: (input: DrawingVisionCompletionParams) => Promise<string>;
}

export class DrawingFeedbackProtocolError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DrawingFeedbackProtocolError';
  }
}

export class DrawingFeedbackModelAdapter {
  constructor(
    private readonly complete: DrawingFeedbackCompletion = requestDrawingAgentCompletion,
    private readonly now: () => number = Date.now,
    private readonly vision?: DrawingFeedbackVisionOptions,
  ) {}

  async decide(input: FeedbackDecisionInput): Promise<FeedbackAgentDecision> {
    if (this.now() >= input.deadlineAt) throw new Error('feedback decision deadline exceeded');
    const userPrompt = JSON.stringify(projectContext(input));
    const requestedCrop = input.requestedCrops[0];
    const decisionController = new AbortController();
    let deadlineExpired = false;
    const forwardAbort = () => decisionController.abort(input.signal.reason);
    input.signal.addEventListener('abort', forwardAbort, { once: true });
    const deadlineTimer = setTimeout(() => {
      deadlineExpired = true;
      decisionController.abort(new Error('feedback decision deadline exceeded'));
    }, Math.max(1, input.deadlineAt - this.now()));
    let reply: string;
    try {
      if (requestedCrop && this.vision) {
        const artifact = await this.vision.readCrop(requestedCrop.mediaHandle);
        if (artifact.sourceId !== requestedCrop.sourceId
          || artifact.regionId !== requestedCrop.regionId) {
          throw new Error('FEEDBACK_CROP_SCOPE_MISMATCH');
        }
        reply = await (this.vision.complete ?? requestDrawingVisionCompletion)({
          modelName: input.modelName,
          systemPrompt: FEEDBACK_SYSTEM_PROMPT,
          userPrompt,
          image: Buffer.from(artifact.bytes).toString('base64'),
          mimeType: artifact.mimeType,
          signal: decisionController.signal,
        });
      } else {
        reply = await this.complete({
          role: 'decision',
          modelName: input.modelName,
          systemPrompt: FEEDBACK_SYSTEM_PROMPT,
          userPrompt,
          signal: decisionController.signal,
        });
      }
    } catch (error) {
      if (deadlineExpired && !input.signal.aborted) {
        throw new DrawingFeedbackProtocolError(
          'decision.timeout',
          '模型单步决策超时，请缩短输出并只返回一个动作',
        );
      }
      throw error;
    } finally {
      clearTimeout(deadlineTimer);
      input.signal.removeEventListener('abort', forwardAbort);
    }
    return parseFeedbackDecision(parseJsonReply(reply), input.unresolvedRequired);
  }
}

export function parseFeedbackDecision(
  value: unknown,
  unresolvedRequired: number,
): FeedbackAgentDecision {
  if (containsForbiddenKey(value)) {
    throw new DrawingFeedbackProtocolError('decision', '禁止返回原始 CV 或媒体数据');
  }
  const decision = object(value, 'decision');
  const type = string(decision.type, 'decision.type');
  switch (type) {
    case 'call_tool': {
      exact(decision, ['type', 'toolCallId', 'capability', 'input'], 'decision');
      const capability = string(decision.capability, 'decision.capability') as CvToolCapability;
      if (!CAPABILITIES.includes(capability)) {
        throw new DrawingFeedbackProtocolError('decision.capability', '不支持的 CV 工具能力');
      }
      return {
        type,
        toolCallId: string(decision.toolCallId, 'decision.toolCallId'),
        capability,
        input: object(decision.input, 'decision.input'),
      };
    }
    case 'transact': {
      exact(decision, ['type', 'toolCallId', 'slotIds', 'commands', 'confidence'], 'decision');
      const slotIds = stringArray(decision.slotIds, 'decision.slotIds');
      if (slotIds.length !== 1) {
        throw new DrawingFeedbackProtocolError('decision.slotIds', '每次事务必须且只能绑定一个 slot');
      }
      const confidence = finite(decision.confidence, 'decision.confidence');
      if (confidence < 0 || confidence > 1) {
        throw new DrawingFeedbackProtocolError('decision.confidence', '置信度必须在 0 到 1 之间');
      }
      try {
        const commands = parseDrawingToolCommands(decision.commands, 'decision.commands');
        const createdObjectCount = commands.filter((command) => (
          command.type === 'geometry.create' || command.type === 'annotation.create'
        )).length;
        if (createdObjectCount > 1) {
          throw new DrawingFeedbackProtocolError(
            'decision.commands',
            '每次事务最多只能创建一个 Drawing 对象',
          );
        }
        return {
          type,
          toolCallId: string(decision.toolCallId, 'decision.toolCallId'),
          slotIds,
          commands,
          confidence,
        };
      } catch (error) {
        if (error instanceof DrawingAgentProtocolError) {
          throw new DrawingFeedbackProtocolError(error.path, error.message);
        }
        throw error;
      }
    }
    case 'transact_fit': {
      exact(
        decision,
        ['type', 'toolCallId', 'slotId', 'evidenceHandle', 'primitiveType', 'confidence'],
        'decision',
      );
      const primitiveType = string(
        decision.primitiveType,
        'decision.primitiveType',
      ) as CvPrimitiveType;
      if (!PRIMITIVE_TYPES.includes(primitiveType)) {
        throw new DrawingFeedbackProtocolError(
          'decision.primitiveType',
          '不支持的拟合图元类型',
        );
      }
      const confidence = finite(decision.confidence, 'decision.confidence');
      if (confidence < 0 || confidence > 1) {
        throw new DrawingFeedbackProtocolError('decision.confidence', '置信度必须在 0 到 1 之间');
      }
      return {
        type,
        toolCallId: string(decision.toolCallId, 'decision.toolCallId'),
        slotId: string(decision.slotId, 'decision.slotId'),
        evidenceHandle: string(decision.evidenceHandle, 'decision.evidenceHandle'),
        primitiveType,
        confidence,
      };
    }
    case 'finish':
      exact(decision, ['type', 'summary'], 'decision');
      if (unresolvedRequired > 0) {
        throw new DrawingFeedbackProtocolError('decision.type', '仍有必需残差时不能完成');
      }
      return { type, summary: string(decision.summary, 'decision.summary') };
    default:
      throw new DrawingFeedbackProtocolError('decision.type', `不支持的决策 ${type}`);
  }
}

function projectContext(input: FeedbackDecisionInput): Record<string, unknown> {
  return {
    goal: truncate(input.goal),
    sourceId: input.sourceId,
    revision: input.revision,
    unresolvedRequired: input.unresolvedRequired,
    pendingInstructions: input.pendingInstructions.slice(-MAX_RECEIPTS).map(truncate),
    ...(input.protocolFeedback ? { protocolFeedback: truncate(input.protocolFeedback) } : {}),
    recentReceipts: input.recentReceipts.slice(-MAX_RECEIPTS).map(sanitizeBounded),
    regions: input.regions.slice(0, MAX_REGIONS).map((region) => ({
      id: region.id,
      sourceId: region.sourceId,
      bounds: { ...region.bounds },
      purpose: region.purpose,
      targetSlotIds: region.targetSlotIds.slice(0, MAX_ARRAY_ITEMS),
      ...(region.parentRegionId ? { parentRegionId: region.parentRegionId } : {}),
      resolutionLevel: region.resolutionLevel,
      attempt: region.attempt,
    })),
    slots: input.slots.slice(0, MAX_SLOTS).map((slot) => ({
      id: slot.id,
      sourceId: slot.sourceId,
      evidenceRefs: slot.evidenceRefs.slice(0, MAX_ARRAY_ITEMS),
      candidateTypes: slot.candidateTypes.slice(0, MAX_ARRAY_ITEMS),
      drawingEntityIds: slot.drawingEntityIds.slice(0, MAX_ARRAY_ITEMS),
      status: slot.status,
      revision: slot.revision,
      recentLineage: slot.lineage.slice(-8),
    })),
    drawingItems: input.drawingItems.slice(0, MAX_DRAWING_ITEMS).map((item) => ({
      id: item.id,
      type: item.type,
      summary: truncate(item.summary),
    })),
    requestedCrop: input.requestedCrops[0] ? { ...input.requestedCrops[0] } : null,
    residual: input.residual ? sanitizeBounded(input.residual) : null,
    droppedContext: {
      receipts: Math.max(0, input.recentReceipts.length - MAX_RECEIPTS),
      regions: Math.max(0, input.regions.length - MAX_REGIONS),
      slots: Math.max(0, input.slots.length - MAX_SLOTS),
      drawingItems: Math.max(0, input.drawingItems.length - MAX_DRAWING_ITEMS),
      crops: Math.max(0, input.requestedCrops.length - 1),
    },
  };
}

function sanitizeBounded(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return truncate(value);
  if (value === undefined) return undefined;
  if (depth >= 8) return '[depth-limit]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeBounded(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isForbiddenKey(key))
      .slice(0, MAX_OBJECT_KEYS)
      .map(([key, item]) => [key, sanitizeBounded(item, depth + 1)]));
  }
  return String(value);
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => (
    isForbiddenKey(key) || containsForbiddenKey(item)
  ));
}

function isForbiddenKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return normalized === 'samples'
    || normalized === 'rgba'
    || normalized === 'rawpixels'
    || normalized.endsWith('base64')
    || normalized === 'imagebytes';
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseJsonReply(reply: string): unknown {
  const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new DrawingFeedbackProtocolError('response.json', '模型响应中没有 JSON 对象');
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (error) {
    throw new DrawingFeedbackProtocolError(
      'response.json', error instanceof Error ? error.message : '非法 JSON',
    );
  }
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DrawingFeedbackProtocolError(path, '必须是对象');
  }
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new DrawingFeedbackProtocolError(path, '字段不符合严格协议');
  }
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DrawingFeedbackProtocolError(path, '必须是非空字符串');
  }
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw new DrawingFeedbackProtocolError(path, '必须是数组');
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DrawingFeedbackProtocolError(path, '必须是有限数字');
  }
  return value;
}

function truncate(value: string): string {
  return value.length <= MAX_STRING_LENGTH ? value : `${value.slice(0, MAX_STRING_LENGTH)}…`;
}
