import {
  DrawingSpatialRegionProtocolError,
  parseSemanticRegionProposal,
  type SemanticRegion,
  type SemanticRegionProposal,
  type SpatialEditStrategy,
  type SpatialSelection,
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

const REGION_SYSTEM_PROMPT = `你是 VectorAI 二维语义区域选择器。
根据用户目标和服务器渲染视图，先选择目标在连续二维画面中的完整区域，不考虑现有图元边界，也不要输出任何 nodeId、图元列表或 DrawingCommand。
区域必须圈选当前图中已经存在、即将被修改的源对象；如果目标是新增外观，则圈选允许新增内容出现的完整空域和连接边界，不能把区域缩成已有图元的包围盒。
轮廓、洞和锚点坐标均使用相对所选视图宽高的 [x,y] 归一化坐标，两个分量必须在 0 到 1 之间。
区域必须覆盖语义部件的完整外形；需要排除的内部区域写入 holes。evidenceRefs 只能引用输入视图 id。
只输出严格 JSON：{"label":string,"sourceViewId":string,"contours":[[[number,number],...]],"holes":[[[number,number],...]],"anchors":[{"id":string,"role":string,"point":[number,number],"confidence":number}],"confidence":number,"evidenceRefs":string[]}。
若输入含 protocolFeedback，必须针对该错误纠正输出。`;

const SPATIAL_DESIGN_SYSTEM_PROMPT = `你是 VectorAI Region-First 二维编辑设计器。
目标区域已经先在连续画面中选定，并由服务器解析成目标图元或局部片段。你只能设计该区域的修改，不能重新选择 nodeId，不能输出 DrawingCommand、事务或完整文档。
默认且不可省略的约束是：区域外内容完全不变、保护片段完全不变、保持已有连接关系、不得产生新的悬空端点，并且除非用户明确要求，否则保持原图样式。用户不需要重复说明这些约束。
geometric-edit 优先输出 transform；服务器会把高层 transform 确定性编译为保持边界锚点的局部形变。只有 transform 无法表达目标，或局部生图服务不可用时，generative-redraw 或 hybrid-edit 才可输出 replacement。存在 targetGeometry 时，必须逐一返回同 id、同图元协议的完整 GeometryNode；targetGeometry 为空时，允许使用全新的唯一 id 新增 GeometryNode。两种情况都必须保持 boundaryAnchors 连通。
transform 只允许 translate、rotate、scale。所有坐标必须是 [x,y] 数字数组。evidenceRefs 只能引用输入视图 id。
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
