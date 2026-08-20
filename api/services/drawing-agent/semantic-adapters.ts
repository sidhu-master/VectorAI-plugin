import {
  DrawingSpatialRegionProtocolError,
  parseSemanticRegionProposal,
  type SemanticRegion,
  type SemanticRegionProposal,
  type SpatialEditStrategy,
  type SpatialSelection,
  type TargetHint,
} from '../../../src/contracts/drawing-spatial-region.js';
import { parseDrawingToolCommands } from '../../../src/contracts/drawing-agent.js';
import type { GeometryNode } from '../../../src/drawing/index.js';
import {
  requestDrawingMultimodalCompletion,
  type DrawingMultimodalCompletionParams,
} from '../ai-gateway.js';
import type { EpisodeModelContext } from '../drawing-episode/types.js';
import type { SpatialEditDesign } from '../drawing-spatial/spatial-edit-compiler.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  SEMANTIC_REGION_RESPONSE_SCHEMA,
  SPATIAL_EDIT_DESIGN_RESPONSE_SCHEMA,
} from './protocol-schemas.js';
import type { DrawingPreviewDefect } from './types.js';

const REGION_SYSTEM_PROMPT = `你是 VectorAI 二维语义搜索包络定位器。
根据用户目标、targetHint 和服务器渲染视图，输出能够观察目标及其连接处的最小连续搜索包络，不考虑现有图元边界，也不要输出任何 nodeId、图元列表或 DrawingCommand。
搜索包络只用于读取局部上下文，不代表修改授权；包络内的对象不会因此被修改。服务器会把你提供的稀疏语义锚点映射到 Drawing IR 的全局拓扑并确定可写子图。
包络必须覆盖当前图中已经存在的目标源对象和必要连接边界，但不得为了“完整”而包含无关的大范围结构。如果目标是新增内容，则圈选允许新增内容出现的最小空域和连接边界。
先判断 operation：modify-existing 修改已有子图，add-new 在保留现有内容的前提下新增，replace-existing 用新内容替换已有子图。再选择 preferredEditMode：可由精确坐标变换表达时选 geometric-edit；需要自由形重绘时选 generative-redraw；两者都需要时选 hybrid-edit。不得依赖对象类别、固定动作或关键词模板判断。
锚点只允许使用四种通用 role：target-seed 表示当前图中已有目标子图内部的肯定点（可以放在闭合轮廓内部，不必贴在线条上），boundary 表示目标与保护结构在当前图中的拓扑接口（必须精确贴近连接点），required 表示修改后结果必须经过的未来位置（它不是当前图元，不会参与当前拓扑吸附），protected-seed 表示当前图中禁止进入的相邻结构。modify-existing 和 replace-existing 至少提供一个 target-seed；存在外部连接时必须给出 boundary，不能用包络边界代替拓扑接口。add-new 可以没有 target-seed，但应使用 required 或 boundary 表示连接要求。
轮廓、洞和锚点坐标均使用相对所选视图宽高的 [x,y] 归一化坐标，两个分量必须在 0 到 1 之间。
需要排除的内部区域写入 holes。evidenceRefs 只能引用输入视图 id。
只输出严格 JSON：{"label":string,"operation":"modify-existing"|"add-new"|"replace-existing","preferredEditMode":"geometric-edit"|"generative-redraw"|"hybrid-edit","sourceViewId":string,"contours":[[[number,number],...]],"holes":[[[number,number],...]],"anchors":[{"id":string,"role":"target-seed"|"boundary"|"required"|"protected-seed","point":[number,number],"confidence":number}],"confidence":number,"evidenceRefs":string[]}。
若输入含 protocolFeedback，必须针对该错误纠正输出。`;

const SPATIAL_DESIGN_SYSTEM_PROMPT = `你是 VectorAI 拓扑约束二维编辑设计器。
服务器已经根据语义锚点和 Drawing IR 显式拓扑解析出完整可写子图。你只能设计该子图的修改，不能重新选择 nodeId，不能输出 DrawingCommand、事务或完整文档。
默认且不可省略的约束是：非目标内容完全不变、保护片段完全不变、保持已有连接关系、不得产生新的悬空端点，并且除非用户明确要求，否则保持原图样式。用户不需要重复说明这些约束。
geometric-edit 优先输出 transform；服务器会把高层 transform 确定性编译为保持边界锚点的局部形变。只有 transform 无法表达目标，或局部生图服务不可用时，generative-redraw 或 hybrid-edit 才可输出 replacement。存在 targetGeometry 时，必须逐一返回同 id、同图元协议的完整 GeometryNode；targetGeometry 为空时，允许使用全新的唯一 id 新增 GeometryNode。两种情况都必须保持 boundaryAnchors 连通。
transform 只允许 translate、rotate、scale。所有坐标必须是 [x,y] 数字数组。evidenceRefs 只能引用输入视图 id。
Drawing IR 使用 X 轴向右、Y 轴向上的笛卡尔坐标。所有方向、旋转和尺度都必须根据输入坐标与用户目标计算，不能依赖对象类别、画面左右位置或预设动作模板。
只输出严格 JSON：transform 为 {"kind":"transform","transform":object,"confidence":number,"evidenceRefs":string[]}；替换为 {"kind":"replacement","geometry":GeometryNode[],"confidence":number,"evidenceRefs":string[]}。
若输入含 protocolFeedback，必须针对该错误纠正输出。`;

export type DrawingSpatialCompletion = (
  input: DrawingMultimodalCompletionParams,
) => Promise<string>;

export interface SemanticCallInput {
  goal: string;
  observation: VisualObservation;
  readImage: (handle: string) => string | null;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
  onRawReply?: (role: 'grounding' | 'design', reply: string) => void;
  repairFeedback?: DrawingPreviewDefect[];
  protocolFeedback?: string;
  episodeContext?: EpisodeModelContext;
  targetHint?: TargetHint;
}

export interface DrawingSemanticRegionModelAdapter {
  propose(input: SemanticCallInput): Promise<SemanticRegionProposal>;
}

export interface DrawingSpatialDesignModelAdapter {
  design(input: SemanticCallInput & {
    region: SemanticRegion;
    selection: SpatialSelection;
    strategy: SpatialEditStrategy;
    targetGeometry: GeometryNode[];
  }): Promise<SpatialEditDesign>;
}

export class DrawingSemanticRegionAdapter implements DrawingSemanticRegionModelAdapter {
  constructor(
    private readonly complete: DrawingSpatialCompletion = requestDrawingMultimodalCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async propose(input: SemanticCallInput): Promise<SemanticRegionProposal> {
    assertDeadline('grounding', input.deadlineAt, this.now);
    const reply = await this.complete({
      role: 'grounding',
      modelName: input.modelName,
      systemPrompt: REGION_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.observation.revision,
        document: {
          unit: input.observation.vectorDigest.unit,
          counts: input.observation.vectorDigest.counts,
          bounds: input.observation.vectorDigest.bounds,
        },
        ...(input.targetHint ? { targetHint: input.targetHint } : {}),
        views: regionObservationMetadata(input.observation),
        repairFeedback: input.repairFeedback ?? [],
        ...(input.episodeContext ? { episodeContext: input.episodeContext } : {}),
        ...(input.protocolFeedback ? { protocolFeedback: input.protocolFeedback } : {}),
      }),
      images: observationImages(input.observation, input.readImage),
      responseSchema: SEMANTIC_REGION_RESPONSE_SCHEMA,
      signal: input.signal,
    });
    input.onRawReply?.('grounding', reply);
    return parseSemanticRegionProposal(parseJson(reply), {
      allowedViewIds: input.observation.views.map((view) => view.id),
      allowedEvidenceRefs: input.observation.views.map((view) => view.id),
    });
  }
}

export class DrawingSpatialDesignAdapter implements DrawingSpatialDesignModelAdapter {
  constructor(
    private readonly complete: DrawingSpatialCompletion = requestDrawingMultimodalCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async design(input: SemanticCallInput & {
    region: SemanticRegion;
    selection: SpatialSelection;
    strategy: SpatialEditStrategy;
    targetGeometry: GeometryNode[];
  }): Promise<SpatialEditDesign> {
    assertDeadline('design', input.deadlineAt, this.now);
    const reply = await this.complete({
      role: 'design',
      modelName: input.modelName,
      systemPrompt: SPATIAL_DESIGN_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.observation.revision,
        region: {
          id: input.region.id,
          label: input.region.label,
          worldContours: input.region.worldContours,
          worldHoles: input.region.worldHoles,
          anchors: input.region.anchors,
          confidence: input.region.confidence,
        },
        selection: {
          wholeNodes: input.selection.wholeNodes,
          crossingNodes: input.selection.crossingNodes,
          boundaryAnchors: input.selection.boundaryAnchors,
          uncertainParts: input.selection.uncertainParts,
        },
        strategy: input.strategy,
        defaultInvariants: [
          'outside-region-unchanged',
          'protected-region-unchanged',
          'maintain-existing-connectivity',
          'no-new-dangling-endpoints',
          'preserve-style-unless-requested',
        ],
        targetGeometry: input.targetGeometry,
        views: observationMetadata(input.observation),
        repairFeedback: input.repairFeedback ?? [],
        ...(input.episodeContext ? { episodeContext: input.episodeContext } : {}),
        ...(input.protocolFeedback ? { protocolFeedback: input.protocolFeedback } : {}),
      }),
      images: observationImages(input.observation, input.readImage),
      responseSchema: SPATIAL_EDIT_DESIGN_RESPONSE_SCHEMA,
      signal: input.signal,
    });
    input.onRawReply?.('design', reply);
    return parseSpatialEditDesign(parseJson(reply), input);
  }
}

function observationImages(
  observation: VisualObservation,
  readImage: (handle: string) => string | null,
): DrawingMultimodalCompletionParams['images'] {
  return observation.views.map((view) => {
    const dataUrl = readImage(view.image.handle);
    if (!dataUrl) throw new Error(`OBSERVATION_IMAGE_MISSING:${view.image.handle}`);
    return { id: view.id, dataUrl };
  });
}

function observationMetadata(observation: VisualObservation): unknown[] {
  return observation.views.map((view) => ({
    id: view.id,
    purpose: view.purpose,
    imageHandle: view.image.handle,
    width: view.width,
    height: view.height,
    worldBounds: view.worldBounds,
    worldToImage: view.worldToImage,
    grounding: view.grounding,
  }));
}

function regionObservationMetadata(observation: VisualObservation): unknown[] {
  return observation.views.map((view) => ({
    id: view.id,
    purpose: view.purpose,
    imageHandle: view.image.handle,
    width: view.width,
    height: view.height,
    worldBounds: view.worldBounds,
    worldToImage: view.worldToImage,
  }));
}

function parseJson(reply: string): unknown {
  const trimmed = reply.trim();
  const source = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    return JSON.parse(source);
  } catch (error) {
    throw protocolError(
      'response.json',
      error instanceof Error ? error.message : '模型返回了非法 JSON',
    );
  }
}

function parseSpatialEditDesign(
  value: unknown,
  input: { observation: VisualObservation; targetGeometry: GeometryNode[] },
): SpatialEditDesign {
  const record = strictRecord(value, 'spatialDesign');
  const kind = record.kind;
  const confidence = finiteConfidence(record.confidence, 'spatialDesign.confidence');
  const evidenceRefs = stringList(record.evidenceRefs, 'spatialDesign.evidenceRefs');
  const allowedEvidence = new Set(input.observation.views.map((view) => view.id));
  const unknownEvidence = evidenceRefs.find((id) => !allowedEvidence.has(id));
  if (unknownEvidence) {
    throw protocolError('spatialDesign.evidenceRefs', `引用了未观察到的视图 ${unknownEvidence}`);
  }
  if (kind === 'transform') {
    exactKeys(record, ['kind', 'transform', 'confidence', 'evidenceRefs'], 'spatialDesign');
    return { kind, transform: parseSpatialTransform(record.transform), confidence, evidenceRefs };
  }
  if (kind === 'replacement') {
    exactKeys(record, ['kind', 'geometry', 'confidence', 'evidenceRefs'], 'spatialDesign');
    if (!Array.isArray(record.geometry) || record.geometry.length === 0) {
      throw protocolError('spatialDesign.geometry', '必须是非空数组');
    }
    const commands = parseDrawingToolCommands(
      record.geometry.map((geometry) => ({ type: 'geometry.create', value: geometry })),
      'spatialDesign.geometry',
    );
    const geometry = commands.map((command) => {
      if (command.type !== 'geometry.create') throw new Error('SPATIAL_DESIGN_GEOMETRY_INVALID');
      return command.value as GeometryNode;
    });
    const expectedIds = new Set(input.targetGeometry.map((node) => node.id));
    const receivedIds = new Set(geometry.map((node) => node.id));
    if (receivedIds.size !== geometry.length) {
      throw protocolError('spatialDesign.geometry', '新增 geometry id 必须唯一');
    }
    const replacementIdsMismatch = expectedIds.size !== receivedIds.size
      || [...expectedIds].some((id) => !receivedIds.has(id));
    if (expectedIds.size > 0 && replacementIdsMismatch) {
      throw protocolError('spatialDesign.geometry', 'replacement 必须逐一返回 targetGeometry 的原 id');
    }
    return { kind, geometry, confidence, evidenceRefs };
  }
  throw protocolError('spatialDesign.kind', '必须是 transform 或 replacement');
}

function parseSpatialTransform(
  value: unknown,
): Extract<SpatialEditDesign, { kind: 'transform' }>['transform'] {
  const transform = strictRecord(value, 'spatialDesign.transform');
  if (transform.kind === 'translate') {
    exactKeys(transform, ['kind', 'offset'], 'spatialDesign.transform');
    return { kind: 'translate', offset: vec2(transform.offset, 'spatialDesign.transform.offset') };
  }
  if (transform.kind === 'rotate') {
    exactKeys(transform, ['kind', 'center', 'angleDegrees'], 'spatialDesign.transform');
    return {
      kind: 'rotate', center: vec2(transform.center, 'spatialDesign.transform.center'),
      angleDegrees: finiteNumber(transform.angleDegrees, 'spatialDesign.transform.angleDegrees'),
    };
  }
  if (transform.kind === 'scale') {
    exactKeys(transform, ['kind', 'center', 'factor'], 'spatialDesign.transform');
    const factor = finiteNumber(transform.factor, 'spatialDesign.transform.factor');
    if (factor <= 0) throw protocolError('spatialDesign.transform.factor', '必须大于 0');
    return { kind: 'scale', center: vec2(transform.center, 'spatialDesign.transform.center'), factor };
  }
  throw protocolError('spatialDesign.transform.kind', '必须是 translate、rotate 或 scale');
}

function strictRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw protocolError(path, '必须是对象');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], path: string): void {
  const expected = new Set(keys);
  const unknown = Object.keys(value).find((key) => !expected.has(key));
  const missing = keys.find((key) => !(key in value));
  if (unknown) throw protocolError(`${path}.${unknown}`, '字段不受支持');
  if (missing) throw protocolError(`${path}.${missing}`, '字段缺失');
}

function vec2(value: unknown, path: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw protocolError(path, '必须是 [x,y] 数组');
  return [finiteNumber(value[0], `${path}[0]`), finiteNumber(value[1], `${path}[1]`)];
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw protocolError(path, '必须是有限数值');
  return value;
}

function finiteConfidence(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result < 0 || result > 1) throw protocolError(path, '必须在 0 到 1 之间');
  return result;
}

function stringList(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw protocolError(path, '必须是非空字符串数组');
  }
  return [...new Set(value)];
}

function protocolError(path: string, message: string): DrawingSpatialRegionProtocolError {
  return new DrawingSpatialRegionProtocolError(path, message);
}

function assertDeadline(stage: string, deadlineAt: number, now: () => number): void {
  if (now() >= deadlineAt) throw new Error(`${stage} deadline exceeded`);
}
