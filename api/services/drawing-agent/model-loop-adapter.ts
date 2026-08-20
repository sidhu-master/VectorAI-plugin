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
  type DrawingModelCallTelemetry,
  type DrawingResponseSchema,
} from '../ai-gateway.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';
import type {
  ModelDrawingToolDefinition,
  ModelToolResult,
} from '../drawing-tools/types.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';
import type { GroundingNode } from '../drawing-vision/grounding-renderer.js';
import { selectVisualWorkingSet } from './visual-working-set.js';
import type { DrawingSpatialGlobalMap } from '../drawing-spatial/context-index.js';
import type { RevisionContextProjection } from './context-ledger.js';
import type { ModelDecisionContext } from './model-decision-context.js';
import type { PreviewReviewEvidence } from './types.js';

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

export interface ModelLoopCurrentPreview {
  previewHandle: string;
  transactionDigest: string;
  affectedNodeIds: string[];
}

export interface ModelLoopActionInput {
  objective: string;
  drawingId: DrawingId;
  revision: RevisionId;
  episodeId: string;
  drawingSummary: DrawingDocumentSummary;
  spatialContext?: {
    globalMap: DrawingSpatialGlobalMap;
    workingSet: unknown;
    evidenceLedger: RevisionContextProjection;
    worldModelSlice?: unknown;
    actionFacts?: unknown[];
    connectedCarrierFacts?: unknown[];
  };
  decisionContext?: ModelDecisionContext;
  /** Private projection map. It is used to compact observations and is never exposed verbatim. */
  nodeAliases?: Record<string, string>;
  toolCatalog: Array<Pick<
    ModelDrawingToolDefinition,
    'name' | 'version' | 'access' | 'timeoutMs' | 'description' | 'inputSchema'
  >>;
  source?: {
    sourceId: string;
    mimeType: string;
    byteLength: number;
    page?: number;
  };
  sourceImage?: {
    id: string;
    imageDataUrl: string;
    width: number;
    height: number;
  };
  recentToolResults: ModelToolResult[];
  recentDiagnostics: Array<Pick<DrawingDiagnostic, 'code' | 'severity' | 'nodeIds'> & {
    message?: string;
    action?: string;
    facts?: Record<string, unknown>;
  }>;
  decisions: ModelLoopDecisionContext[];
  appendedInstructions: string[];
  stableRules?: string[];
  /** Exact candidate identity used to expose explicit restart/revise choices to the model. */
  currentPreview?: ModelLoopCurrentPreview;
  /** @deprecated Runtime migration field; never projected as the model's edit base. */
  currentPreviewHandle?: string;
  currentPreviewReview?: PreviewReviewEvidence;
  candidateBudget?: { attempt: number; max: number };
  observations: ModelLoopObservation[];
  modelName: string;
  attempt: number;
  protocolFeedback?: string;
  signal: AbortSignal;
  deadlineAt: number;
  onRawReply?: (reply: string) => void;
  onModelTelemetry?: (telemetry: DrawingModelCallTelemetry) => void;
}

export interface ModelLoopCompletionInput {
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  images: Array<{ id: string; dataUrl: string }>;
  signal: AbortSignal;
  responseSchema?: DrawingResponseSchema;
  onTelemetry?: (telemetry: DrawingModelCallTelemetry) => void;
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
- Drawing IR 使用笛卡尔世界坐标：X 正方向在屏幕上向右，Y 正方向在屏幕上始终向上；图像坐标 X 向右、Y 向下。视觉选点优先写成 observation 的归一化 SpatialPointRef，由后端绑定该 observation 并确定性换算；不要手算 worldToImage 的逆矩阵。精确既有点优先使用 node_anchor，已有世界事实可使用 frameId=document 的 world 引用。
- 语义方位必须绑定明确坐标框架（例如 document、observation 或由证据建立的 object-local frame）。“对象的左/右/前/后”属于 object-local frame，“画面/屏幕的左/右/上/下”属于 observation frame，不得混用。面向观察者时 object-local 左右与画面左右呈镜像关系；必须先用视觉与 Grounding 建立对象朝向，无法区分且会实质改变结果时再追加证据或请求用户决定。不得根据对象类别或示例规则猜测方位。
- 当前 revision 的既有节点可能以 g1、g2 等短别名出现；调用工具或更新/删除既有节点时直接使用别名，后端会按 revision 解析。创建新节点时必须生成不与 g<number> 混淆的稳定新 ID。
- 对目标、目的点、接口和保留范围已经明确的编辑，SpatialEditProgram / preview_spatial_program 是默认快速入口。你只需外化简洁的可审计动作契约：targets、operations、preserveNodeRefs、postconditions；它不是隐藏思维链。模型负责语义选择，后端负责坐标解析、平移、端点设置、路径创建、删除和 Drawing Command 编译。未被 operations 引用的节点保持不变；不要为了表达“其他内容不变”把全图节点逐个枚举进 preserveNodeRefs，只列确有必要单独核验的关键节点。
- translate 是完整 Node 的刚性平移，不能保持该 Node 的外部固定接口。若一个闭合主体需要移动、接触它的开放连接线必须继续连接固定环境，优先选择 preview_connected_transform，让代码只搬运主体侧端点并保持相反端点不动；相对方向任务优先给 delta（+X 向右、+Y 视觉向上），不要把图像 Y 向下坐标手算成绝对 targetCenter。若该能力不适用，再用完整事务重建连接。这个选择只基于通用几何与接口事实，不基于对象类别。
- drawing.connectedCarrierFacts 是代码预先计算的通用能力索引：每行表示一个闭合 carrier 已接触多少开放连接线。若视觉目标对应其中一个 carrier，直接把该行 carrierNodeRef 交给 preview_connected_transform；不要枚举或平移连接线，也不要把全图节点列入 preserveNodeRefs。模型只选择目标 carrier 和位移，端点与固定锚点由代码计算。
- 首轮上下文提供 grounded overview 与代码计算的轻量 globalMap；只有用户明确选择了目标，或先前工具已经建立活跃工作集时，才内联局部 bounded World Model，避免把全图精确拓扑重复塞入每轮。worldModelSlice 出现时，其 primitiveRows 是当前 revision 的精确 Drawing IR 图元表，字段顺序由 primitiveColumns 与 primitiveParameterSchemas 定义；contactRows 是代码计算的端点到曲线接触事实。视觉与 grounding 已足以定位目标时直接生成 Preview；确需更多精确结构时再调用 build_world_slice，只有语义仍有歧义才 ground/propose。工具返回候选而非授权。
- 只有目标确有歧义、语义目标与现有图元边界不一致、存在重叠候选或需要补充连接证据时，才建立局部 World Model Slice，并按需用 ground_semantic_entities 明确 supports、excludedSupports 与 interfaceRefs。不得通过包围区域相交自动选中或授权其中全部图元；区域只提供观察证据，最终目标必须落到精确 Node、SourceSpan、HalfEdge、Face 或 Interface 引用。
- ground_semantic_entities.sliceHandle 必须逐字使用本次 episode 中一次成功的 build_world_slice 输出的 sliceHandle。world:*、sha256:* 和 evidenceRefs 都不是 sliceHandle；如果尚无工具生成的 sliceHandle，必须先调用 build_world_slice。每次重试都必须使用新的 toolCallId。
- Warning、低置信度和拓扑不确定性是可供你判断的事实，不会自动阻止编辑。你可以继续查询、修改候选、接受风险或放弃。
- 只有确实缺少用户权限、事实或主观选择时，才 request-human-decision；普通几何警告不得打断用户。
- 所有写入必须先产生 Preview；提交只能引用当前 revision 上有效的 Preview handle。
- vectorize_image 只负责一次性建立源图的有界矢量批次清单；不要逐条读取原始采样点，也不要对每个图元单独调用 fit_geometry。拿到 candidateHandle 后，按 batchIndex 顺序调用 preview_vectorization_batch，观察并提交每一批，直到 completeAfterCommit=true。源图证据跨 Drawing revision 有效，提交后不得为同一 sourceId 重复调用 vectorize_image。
- 每轮上下文的 editBaseOptions 是本轮写入基线的权威契约。无当前 Preview 时优先 taskDrivenProgram；存在 Preview 时可用 continueWithTaskProgram 在当前候选上追加通用空间操作，用 revise_preview 按 reviseCurrentPreview 写底层 corrections，或用 startFromCanonical 舍弃候选并完整重做。Runtime 不替你选择。
- editBaseOptions 中 baseRevision=$current 是运行时绑定令牌；逐字输出该短令牌，不要复制长 revision。Runtime 会在执行前绑定到本轮实际正式版本并记录审计。
- 当前存在 Preview 时，继续使用 preview_spatial_program 必须逐字携带 continueWithTaskProgram.replacesPreviewHandle；舍弃候选重做必须逐字携带 startFromCanonical.replacesPreviewHandle；底层修订必须携带 reviseCurrentPreview 的 handle/digest。不得隐式假设写入基线。
- revise_preview.corrections 使用底层 Drawing Commands；其可选 postconditions 只接受 DrawingAssertion（node.exists、node.absent、property.equals、document.valid、selection.count），不接受 SpatialEditProgram 的 anchor_at、anchors_coincident、nodes_unchanged 或 path_closed。没有合适 DrawingAssertion 时直接省略 postconditions，由候选诊断和独立复核检查空间结果。
- 所有 Preview 工具都会返回画布增量和由候选 Drawing IR 后端渲染的 Preview；下一轮 observations 中 purpose=preview 的图片就是当前候选，不必为了看到候选再调用工具。运行时会把同视口的修改前/修改后画面拼成一张图，交给独立检查者只复核当前有效用户指令是否满足，并把具体 Preview handle 与精简动作契约一并绑定。复核结论通过 currentPreviewReview 返回给你，仅是判断上下文：它不编辑图纸、不授予权限、不清除 Preview，也不阻止你提交当前 Preview。你应结合图纸事实与复核意见自行决定继续修改或提交。evaluate_preview 仅用于需要额外确定性诊断的情况。
- candidateBudget 表示本轮候选已使用次数与上限。复核未通过时优先根据缺陷选择继续当前候选或从 canonical 完整重做；不要用等价操作重复生成没有改善的候选。达到上限后 Runtime 会保留正式图纸并结束本轮，等待用户重试或补充指令。
- 当前 Active Tool Contracts 是可替换的能力而不是对象类别到工具的硬编码路由。根据当前事实、目标和工具明示前置条件选择最小充分能力；任何图元类型、语义对象或示例动作都不得强制某个工具。Action Proposal 只是候选，你仍可组合工具、直接生成完整 Drawing Transaction 或自由重绘。
- Commit 后只有在目标仍有视觉或语义不确定性时才继续观察；纯结构验收可以基于新 revision 的确定事实 finish。
- 标注是次要派生信息，不得限制几何编辑。约束或用户锁定内容需要授权时，使用通用 Human Decision。
- 不要输出隐藏思维链、Markdown、模型名称、固定 workflow、SpatialModel、SpatialIntent 或后端替代策略。
- 不要假设具体样例、对象种类、方位或动作规则；根据本轮证据作通用二维空间判断。
- 同一 revision 内不要重复已经成功且没有产生新问题的读取工具；每次工具调用必须使用全新的 toolCallId。
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

export function modelLoopActionSchema(
  tools: ModelLoopActionInput['toolCatalog'],
): DrawingResponseSchema {
  const branches = MODEL_LOOP_ACTION_SCHEMA.schema.oneOf as Record<string, unknown>[];
  const definitions: Record<string, unknown> = {};
  const toolBranches = tools.map((tool) => {
    const inputSchema = structuredClone(tool.inputSchema ?? {
      type: 'object', additionalProperties: false,
    });
    const localDefinitions = schemaDefinitions(inputSchema);
    for (const [name, definition] of Object.entries(localDefinitions)) {
      const existing = definitions[name];
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(definition)) {
        throw new Error(`MODEL_SCHEMA_DEFINITION_CONFLICT:${name}`);
      }
      definitions[name] = definition;
    }
    delete inputSchema.$defs;
    return {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'toolCallId', 'tool', 'input'],
      properties: {
        type: { const: 'tool' },
        toolCallId: { type: 'string', minLength: 1 },
        tool: { const: tool.name },
        input: inputSchema,
      },
    };
  });
  return {
    name: MODEL_LOOP_ACTION_SCHEMA.name,
    schema: {
      oneOf: [
        ...toolBranches,
        ...structuredClone(branches.slice(1)),
      ],
      ...(Object.keys(definitions).length === 0 ? {} : { $defs: definitions }),
    },
  };
}

function schemaDefinitions(schema: Record<string, unknown>): Record<string, unknown> {
  const value = schema.$defs;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

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
    const visual = selectVisualWorkingSet({
      ...(input.sourceImage ? { sourceImage: input.sourceImage } : {}),
      observations: input.observations,
      sourceBootstrapPending: Boolean(input.sourceImage),
    });
    const images = [
      ...(visual.sourceImage ? [{
        id: visual.sourceImage.id,
        dataUrl: visual.sourceImage.imageDataUrl,
        width: visual.sourceImage.width,
        height: visual.sourceImage.height,
      }] : []),
      ...visual.observations.map((observation) => ({
        id: observation.id,
        dataUrl: observation.imageDataUrl,
        width: observation.width,
        height: observation.height,
      })),
    ];
    const reply = await this.#complete({
      modelName: input.modelName,
      systemPrompt: MODEL_LOOP_SYSTEM_PROMPT,
      userPrompt: JSON.stringify(publicContext({
        ...input,
        observations: visual.observations,
      })),
      images,
      signal: input.signal,
      responseSchema: modelLoopActionSchema(input.toolCatalog),
      ...(input.onModelTelemetry ? { onTelemetry: input.onModelTelemetry } : {}),
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
    ...(input.onTelemetry ? { onTelemetry: input.onTelemetry } : {}),
  });
}

function publicContext(input: ModelLoopActionInput): Record<string, unknown> {
  return {
    objective: truncate(input.objective),
    coordinateContract: globalCoordinateContract(),
    editBaseOptions: editBaseOptions(input),
    drawing: input.spatialContext ? {
      id: input.drawingId,
      revision: input.revision,
      globalMap: bounded(input.spatialContext.globalMap),
      workingSet: bounded(input.spatialContext.workingSet),
      ...(input.spatialContext.worldModelSlice === undefined
        ? {}
        : { worldModelSlice: bounded(input.spatialContext.worldModelSlice) }),
      ...(input.spatialContext.actionFacts === undefined
        ? {}
        : { actionFacts: bounded(input.spatialContext.actionFacts) }),
      ...(input.spatialContext.connectedCarrierFacts === undefined
        ? {}
        : { connectedCarrierFacts: bounded(input.spatialContext.connectedCarrierFacts) }),
    } : {
      id: input.drawingId,
      revision: input.revision,
      summary: bounded(input.drawingSummary),
    },
    episodeId: input.episodeId,
    attempt: input.attempt,
    toolCatalog: input.toolCatalog.map((tool) => ({
      name: tool.name,
      version: tool.version,
      access: tool.access,
      timeoutMs: tool.timeoutMs,
      ...(tool.description ? { description: tool.description } : {}),
    })),
    ...(input.source ? { source: bounded(input.source) } : {}),
    ...(input.sourceImage ? {
      sourceImage: {
        id: input.sourceImage.id,
        width: input.sourceImage.width,
        height: input.sourceImage.height,
        coordinateSpace: 'source-pixel',
      },
    } : {}),
    ...(input.spatialContext ? {
      evidenceLedger: bounded(input.spatialContext.evidenceLedger),
    } : {
      recentToolResults: input.recentToolResults.slice(-MAX_CONTEXT_RESULTS).map((result) => ({
        receipt: bounded(result.receipt),
        ...(result.output === undefined ? {} : { output: projectToolOutput(result.output) }),
      })),
    }),
    recentDiagnostics: input.recentDiagnostics.slice(-MAX_CONTEXT_DIAGNOSTICS).map(bounded),
    decisions: input.decisions.slice(-MAX_CONTEXT_DECISIONS).map((decision) => ({
      request: bounded(decision.request),
      ...(decision.response ? { response: bounded(decision.response) } : {}),
      grants: decision.grants.map(bounded),
    })),
    appendedInstructions: input.appendedInstructions
      .slice(-MAX_CONTEXT_INSTRUCTIONS).map(truncate),
    ...(input.stableRules?.length ? {
      stableRules: input.stableRules.slice(-MAX_CONTEXT_INSTRUCTIONS).map(truncate),
    } : {}),
    ...(input.decisionContext ? { decisionContext: bounded(input.decisionContext) } : {}),
    ...(input.currentPreviewReview
      ? { currentPreviewReview: bounded(input.currentPreviewReview) }
      : {}),
    ...(input.candidateBudget ? { candidateBudget: bounded(input.candidateBudget) } : {}),
    observationIndex: input.observations.map((observation) => ({
      id: observation.id,
      purpose: observation.purpose,
      width: observation.width,
      height: observation.height,
      worldBounds: observation.worldBounds,
      worldToImage: observation.worldToImage,
      coordinateContract: observationCoordinateContract(observation.worldToImage),
      groundingColumns: [
        'alias', 'visualLabel', 'type', 'rgb', 'normalizedLTRB', 'selected', 'clipped',
      ],
      groundingRows: observation.grounding.slice(0, 64).map((node) => ([
        input.nodeAliases?.[node.nodeId] ?? node.nodeId,
        node.label,
        node.type,
        node.rgb,
        [node.normalized.left, node.normalized.top, node.normalized.right, node.normalized.bottom],
        node.selected,
        node.clipped,
      ])),
    })),
    ...(input.protocolFeedback ? { protocolFeedback: truncate(input.protocolFeedback) } : {}),
  };
}

function editBaseOptions(input: ModelLoopActionInput): Record<string, unknown> {
  const current = input.currentPreview;
  return {
    ...(!current ? {
      taskDrivenProgram: {
        tool: 'preview_spatial_program',
        baseRevision: '$current',
        effect: 'create-current-preview',
      },
    } : {
      continueWithTaskProgram: {
        tool: 'preview_spatial_program',
        baseRevision: '$current',
        replacesPreviewHandle: current.previewHandle,
        effect: 'preserve-current-preview-and-append-program',
      },
    }),
    startFromCanonical: {
      tool: 'preview_transaction',
      baseRevision: '$current',
      ...(current ? { replacesPreviewHandle: current.previewHandle } : {}),
      effect: current
        ? 'discard-current-preview-and-replace'
        : 'create-current-preview',
    },
    ...(current ? {
      reviseCurrentPreview: {
        tool: 'revise_preview',
        basePreviewHandle: current.previewHandle,
        baseTransactionDigest: current.transactionDigest,
        affectedNodeIds: current.affectedNodeIds,
        postconditionContract: 'DrawingAssertion only; omit SpatialEditProgram anchor conditions',
        effect: 'preserve-current-preview-and-apply-corrections',
      },
    } : {}),
  };
}

function globalCoordinateContract(): Record<string, unknown> {
  return {
    worldSpace: {
      name: 'drawing-cartesian',
      xPositive: 'visual-right',
      yPositive: 'visual-up',
      units: 'drawing.unitSystem',
    },
    imageSpace: {
      name: 'image-pixel',
      xPositive: 'visual-right',
      yPositive: 'visual-down',
      units: 'pixel',
    },
    conversion: {
      authoritativeTransform: 'observationIndex[].worldToImage',
      resolvedBy: 'backend',
      preferredPointReference: 'observation-normalized',
      modelRule: '视觉选点使用 observationId + normalized；不要手算仿射逆矩阵，也不要把图像像素直接写入世界坐标。',
    },
    pointReferences: {
      visualPoint: { kind: 'observation', normalizedRange: [0, 1] },
      exactGeometryPoint: { kind: 'node_anchor' },
      documentPoint: { kind: 'world', frameId: 'document' },
    },
    semanticDirections: {
      ownedDirections: 'object-local',
      screenDirections: 'observation',
      frontFacingLateralRelation: 'mirrored',
    },
  };
}

function projectToolOutput(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bounded(value);
  const source = value as Record<string, unknown>;
  return bounded(Object.fromEntries(Object.entries(source).filter(([key]) => (
    key !== 'observation' && key !== 'views'
  ))));
}

function observationCoordinateContract(
  worldToImage: AffineTransform,
): Record<string, unknown> {
  return {
    worldSpace: {
      name: 'drawing-cartesian',
      xPositive: 'visual-right',
      yPositive: 'visual-up',
      units: 'drawing.unitSystem',
    },
    imageSpace: {
      name: 'image-pixel',
      xPositive: 'visual-right',
      yPositive: 'visual-down',
      units: 'pixel',
    },
    transform: {
      notation: '[m0,m1,m2,m3,m4,m5]',
      worldToImage,
    },
    resolution: {
      owner: 'backend',
      pointReference: 'observationId + normalized [u,v]',
    },
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
    const recovered = recoverOneTrailingDelimiter(source);
    if (recovered !== null) return recovered;
    throw new DrawingAgentProtocolError('response.json', '模型返回的内容不是合法 JSON');
  }
}

function recoverOneTrailingDelimiter(source: string): unknown | null {
  if (!/[}\]]\s*$/.test(source)) return null;
  try {
    return JSON.parse(source.replace(/[}\]]\s*$/, ''));
  } catch {
    return null;
  }
}
