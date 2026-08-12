import {
  DrawingAgentProtocolError,
  parseDrawingAgentAction,
  type DrawingAgentAction,
  type HumanDecisionRequest,
  type HumanDecisionResponse,
  type PermissionGrant,
} from '../../../src/contracts/drawing-agent.js';
import type {
  Bounds2D,
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { DrawingDocumentSummary } from '../../../src/contracts/drawing-application.js';
import {
  requestDrawingMultimodalCompletion,
  type DrawingResponseSchema,
} from '../ai-gateway.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';
import type {
  ModelDrawingToolDefinition,
  ModelToolResult,
} from '../drawing-tools/types.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';
import type { GroundingNode } from '../drawing-vision/grounding-renderer.js';

export interface ModelLoopObservation {
  id: string;
  purpose: 'overview' | 'target-detail' | 'user-viewport' | 'preview' | 'diff';
  imageDataUrl: string;
  width: number;
  height: number;
  worldBounds: Bounds2D;
  worldToImage: AffineTransform;
  grounding: GroundingNode[];
}

export interface ModelLoopDecisionContext {
  request: HumanDecisionRequest;
  response?: HumanDecisionResponse;
  grants: PermissionGrant[];
}

export interface ModelLoopActionInput {
  objective: string;
  drawingId: DrawingId;
  revision: RevisionId;
  episodeId: string;
  drawingSummary: DrawingDocumentSummary;
  toolCatalog: Array<Pick<
    ModelDrawingToolDefinition,
    'name' | 'version' | 'access' | 'timeoutMs'
  >>;
  recentToolResults: ModelToolResult[];
  recentDiagnostics: Array<Pick<DrawingDiagnostic, 'code' | 'severity' | 'nodeIds'> & {
    message?: string;
    action?: string;
  }>;
  decisions: ModelLoopDecisionContext[];
  appendedInstructions: string[];
  currentPreviewHandle?: string;
  observations: ModelLoopObservation[];
  modelName: string;
  attempt: number;
  protocolFeedback?: string;
  signal: AbortSignal;
  deadlineAt: number;
  onRawReply?: (reply: string) => void;
}

export interface ModelLoopCompletionInput {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  images: Array<{ id: string; dataUrl: string }>;
  signal: AbortSignal;
  responseSchema?: DrawingResponseSchema;
}

export type ModelLoopCompletion = (input: ModelLoopCompletionInput) => Promise<string>;

export interface DrawingAgentActionModel {
  next(input: ModelLoopActionInput): Promise<DrawingAgentAction>;
}

const MAX_CONTEXT_RESULTS = 12;
const MAX_CONTEXT_DIAGNOSTICS = 24;
const MAX_CONTEXT_DECISIONS = 8;
const MAX_CONTEXT_INSTRUCTIONS = 12;
const MAX_STRING = 2_000;

export const MODEL_LOOP_SYSTEM_PROMPT = `你是 VectorAI 的二维空间 Agent。你直接理解视觉图像与 Drawing IR，并通过工具像维护代码一样检查、修改和验证图纸。

模型拥有完整编辑能力：可以查询、测量、追踪拓扑、拆分、重绘、矢量化，并可在一个自由 Drawing Transaction 中新增、更新或删除 geometry、annotation、relation、feature 四个 plane 的任意合法节点。后端工具只提供事实、候选、诊断、事务与审计，不替你决定目标部位、编辑策略或几何结果。

每一轮只能输出一个严格 JSON 动作：
1. {"type":"tool","toolCallId":string,"tool":DrawingToolName,"input":object}
2. {"type":"request-human-decision","request":{"kind":HumanDecisionKind,"question":string,"reason":string,"options":array,"recommendedOptionId"?:string,"affectedResources":array,"previewHandle"?:string}}
3. {"type":"commit","previewHandle":string,"summary":string,"confidence"?:0_to_1}
4. {"type":"finish","summary":string}

工作原则：
- 先用视觉、向量、拓扑和测量工具建立足够证据，再预览事务；工具返回候选而非授权。
- Warning、低置信度和拓扑不确定性是可供你判断的事实，不会自动阻止编辑。你可以继续查询、修改候选、接受风险或放弃。
- 只有确实缺少用户权限、事实或主观选择时，才 request-human-decision；普通几何警告不得打断用户。
- 所有写入必须先产生 Preview；提交只能引用当前 revision 上有效的 Preview handle。
- 标注是次要派生信息，不得限制几何编辑。约束或用户锁定内容需要授权时，使用通用 Human Decision。
- 不要输出隐藏思维链、Markdown、模型名称、固定 workflow、SpatialModel、SpatialIntent 或后端替代策略。
- 不要假设具体样例、对象种类、方位或动作规则；根据本轮证据作通用二维空间判断。
- 如果上一轮有 protocolFeedback，只修正明确的协议问题，不要让后端替你改写语义。`;

export const MODEL_LOOP_ACTION_SCHEMA: DrawingResponseSchema = {
  name: 'drawing_agent_next_action',
  schema: {
    oneOf: [
      {
        type: 'object', additionalProperties: false,
        required: ['type', 'toolCallId', 'tool', 'input'],
        properties: {
          type: { const: 'tool' },
          toolCallId: { type: 'string', minLength: 1 },
          tool: { type: 'string' },
          input: {},
        },
      },
      {
        type: 'object', additionalProperties: false,
        required: ['type', 'request'],
        properties: {
          type: { const: 'request-human-decision' },
          request: {
            type: 'object', additionalProperties: false,
            required: ['kind', 'question', 'reason', 'options', 'affectedResources'],
            properties: {
              kind: {
                type: 'string',
                enum: [
                  'grant-permission', 'choose-option', 'confirm-intent',
                  'provide-context', 'accept-risk',
                ],
              },
              question: { type: 'string', minLength: 1 },
              reason: { type: 'string', minLength: 1 },
              options: { type: 'array', minItems: 1, items: { type: 'object' } },
              recommendedOptionId: { type: 'string', minLength: 1 },
              affectedResources: { type: 'array', items: { type: 'object' } },
              previewHandle: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      {
        type: 'object', additionalProperties: false,
        required: ['type', 'previewHandle', 'summary'],
        properties: {
          type: { const: 'commit' },
          previewHandle: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      {
        type: 'object', additionalProperties: false,
        required: ['type', 'summary'],
        properties: {
          type: { const: 'finish' },
          summary: { type: 'string', minLength: 1 },
        },
      },
    ],
  },
};

export class ModelLoopActionAdapter implements DrawingAgentActionModel {
  readonly #complete: ModelLoopCompletion;
  readonly #now: () => number;

  constructor(
    complete: ModelLoopCompletion = defaultCompletion,
    now: () => number = Date.now,
  ) {
    this.#complete = complete;
    this.#now = now;
  }

  async next(input: ModelLoopActionInput): Promise<DrawingAgentAction> {
    if (this.#now() >= input.deadlineAt) throw new Error('model loop deadline exceeded');
    const images = input.observations.map((observation) => ({
      id: observation.id,
      dataUrl: observation.imageDataUrl,
    }));
    const reply = await this.#complete({
      modelName: input.modelName,
      systemPrompt: MODEL_LOOP_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(publicContext(input)),
      images,
      signal: input.signal,
      responseSchema: MODEL_LOOP_ACTION_SCHEMA,
    });
    input.onRawReply?.(reply);
    return parseDrawingAgentAction(parseJsonReply(reply));
  }
}

async function defaultCompletion(input: ModelLoopCompletionInput): Promise<string> {
  return requestDrawingMultimodalCompletion({
    role: 'design',
    modelName: input.modelName,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    images: input.images,
    signal: input.signal,
    responseSchema: input.responseSchema,
  });
}

function publicContext(input: ModelLoopActionInput): Record<string, unknown> {
  return {
    objective: truncate(input.objective),
    drawing: {
      id: input.drawingId,
      revision: input.revision,
      summary: bounded(input.drawingSummary),
    },
    episodeId: input.episodeId,
    attempt: input.attempt,
    toolCatalog: input.toolCatalog.map((tool) => ({ ...tool })),
    recentToolResults: input.recentToolResults.slice(-MAX_CONTEXT_RESULTS).map((result) => ({
      receipt: bounded(result.receipt),
      ...(result.output === undefined ? {} : { output: bounded(result.output) }),
    })),
    recentDiagnostics: input.recentDiagnostics.slice(-MAX_CONTEXT_DIAGNOSTICS).map(bounded),
    decisions: input.decisions.slice(-MAX_CONTEXT_DECISIONS).map((decision) => ({
      request: bounded(decision.request),
      ...(decision.response ? { response: bounded(decision.response) } : {}),
      grants: decision.grants.map(bounded),
    })),
    appendedInstructions: input.appendedInstructions
      .slice(-MAX_CONTEXT_INSTRUCTIONS).map(truncate),
    ...(input.currentPreviewHandle ? { currentPreviewHandle: input.currentPreviewHandle } : {}),
    observationIndex: input.observations.map((observation) => ({
      id: observation.id,
      purpose: observation.purpose,
      width: observation.width,
      height: observation.height,
      worldBounds: observation.worldBounds,
      worldToImage: observation.worldToImage,
      grounding: bounded(observation.grounding),
    })),
    ...(input.protocolFeedback ? { protocolFeedback: truncate(input.protocolFeedback) } : {}),
  };
}

function bounded(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return truncate(value);
  if (value === undefined) return undefined;
  if (depth >= 8) return '[bounded]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => bounded(item, depth + 1));
  if (typeof value !== 'object') return String(value);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .slice(0, 100)
    .filter(([key]) => !/reasoning|thought|chain.?of.?thought|modelname/i.test(key))
    .map(([key, item]) => [key, bounded(item, depth + 1)]));
}

function truncate(value: string): string {
  return value.length <= MAX_STRING ? value : `${value.slice(0, MAX_STRING)}…`;
}

function parseJsonReply(reply: string): unknown {
  const trimmed = reply.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const source = match?.[1] ?? trimmed;
  try {
    return JSON.parse(source);
  } catch {
    throw new DrawingAgentProtocolError('response.json', '模型返回的内容不是合法 JSON');
  }
}
