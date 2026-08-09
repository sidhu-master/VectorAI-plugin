import {
  DrawingAgentProtocolError,
  parseDrawingToolCommands,
} from '../../../src/contracts/drawing-agent.js';
import {
  requestDrawingAgentCompletion,
  type DrawingAgentCompletionParams,
} from '../ai-gateway.js';
import type { CvToolCapability } from '../drawing-cv/tool-registry.js';
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
  'create_observation_region',
  'cv_extract_evidence',
  'cv_read_evidence_page',
  'cv_fit_primitive',
  'compare_region',
];

const FEEDBACK_SYSTEM_PROMPT = `你是 VectorAI 的二维工程图反馈 Agent。你要像维护代码一样，持续观察、拟合、修改、渲染并验证 Drawing IR。

只输出一个严格 JSON 对象，允许三种形状：
1. {"type":"call_tool","toolCallId":string,"capability":CvToolCapability,"input":object}
2. {"type":"transact","toolCallId":string,"slotIds":string[],"commands":DrawingCommand[],"confidence":0_to_1}
3. {"type":"finish","summary":string}

CvToolCapability 只能是 inspect_source_overview、create_observation_region、cv_extract_evidence、cv_read_evidence_page、cv_fit_primitive、compare_region。
观察区域应围绕完整图元，可重叠、嵌套或扩大；触碰裁剪边缘的证据不能单独确认圆、椭圆等闭合图元。
坐标和图元参数应优先来自 CV evidence handle 的确定性拟合，不得凭空估计。不得输出原始 samples、rgba、base64 或像素正文。
修改必须通过 DrawingCommand 做局部增量；允许 create、update、retype、merge、split、delete 的后续修正。只有 required residual 为零时才能 finish。
不得输出 Markdown、隐藏思考过程、模型名称、完整图纸或历史。`;

export type DrawingFeedbackCompletion = (
  input: DrawingAgentCompletionParams,
) => Promise<string>;

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
  ) {}

  async decide(input: FeedbackDecisionInput): Promise<FeedbackAgentDecision> {
    if (this.now() >= input.deadlineAt) throw new Error('feedback decision deadline exceeded');
    const reply = await this.complete({
      role: 'decision',
      modelName: input.modelName,
      systemPrompt: FEEDBACK_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(projectContext(input)),
      signal: input.signal,
    });
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
      if (slotIds.length === 0) {
        throw new DrawingFeedbackProtocolError('decision.slotIds', '事务必须绑定至少一个槽位');
      }
      const confidence = finite(decision.confidence, 'decision.confidence');
      if (confidence < 0 || confidence > 1) {
        throw new DrawingFeedbackProtocolError('decision.confidence', '置信度必须在 0 到 1 之间');
      }
      try {
        return {
          type,
          toolCallId: string(decision.toolCallId, 'decision.toolCallId'),
          slotIds,
          commands: parseDrawingToolCommands(decision.commands, 'decision.commands'),
          confidence,
        };
      } catch (error) {
        if (error instanceof DrawingAgentProtocolError) {
          throw new DrawingFeedbackProtocolError(error.path, error.message);
        }
        throw error;
      }
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
    revision: input.revision,
    unresolvedRequired: input.unresolvedRequired,
    pendingInstructions: input.pendingInstructions.slice(-MAX_RECEIPTS).map(truncate),
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
