import {
  parseEditIntent,
  parseVisualFeatureGraph,
  DrawingSpatialProtocolError,
  type EditIntent,
  type VisualFeatureGraph,
} from '../../../src/contracts/drawing-spatial-agent.js';
import {
  parseSemanticRegionProposal,
  type SemanticRegionProposal,
} from '../../../src/contracts/drawing-spatial-region.js';
import { parseDrawingToolCommands } from '../../../src/contracts/drawing-agent.js';
import type { GeometryNode } from '../../../src/drawing/index.js';
import type { DrawingPreviewDefect } from './types.js';
import {
  requestDrawingMultimodalCompletion,
  type DrawingMultimodalCompletionParams,
} from '../ai-gateway.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  EDIT_INTENT_RESPONSE_SCHEMA,
  GEOMETRY_CANDIDATE_RESPONSE_SCHEMA,
  SEMANTIC_REGION_RESPONSE_SCHEMA,
  VISUAL_FEATURE_GRAPH_RESPONSE_SCHEMA,
} from './protocol-schemas.js';

const REGION_SYSTEM_PROMPT = `你是 VectorAI 二维语义区域选择器。
根据用户目标和服务器渲染视图，先选择目标在连续二维画面中的完整区域，不考虑现有图元边界，也不要输出任何 nodeId、图元列表或 DrawingCommand。
轮廓、洞和锚点坐标均使用相对所选视图宽高的 [x,y] 归一化坐标，两个分量必须在 0 到 1 之间。
区域必须覆盖语义部件的完整外形；需要排除的内部区域写入 holes。evidenceRefs 只能引用输入视图 id。
只输出严格 JSON：{"label":string,"sourceViewId":string,"contours":[[[number,number],...]],"holes":[[[number,number],...]],"anchors":[{"id":string,"role":string,"point":[number,number],"confidence":number}],"confidence":number,"evidenceRefs":string[]}。
若输入含 protocolFeedback，必须针对该错误纠正输出。`;

const FEATURE_SYSTEM_PROMPT = `你是 VectorAI 二维空间接地器。
根据服务器渲染视图、Drawing IR 摘要和 grounding 表，把用户语义映射为 VisualFeatureGraph。
只能引用输入中真实存在的 nodeId 和 view id，不得编造 nodeId，不得输出 DrawingCommand。
Vec2 必须是 [x,y] 数字数组，anchor 必须写 point:[x,y]，不能写 {x,y}。Bounds 必须是 {minX,minY,maxX,maxY}。
relations 的 from/to 可以引用本次 features/anchors 的 id 或输入中的 nodeId。
只输出严格 JSON：{"features":[{"id":string,"label":string,"nodeIds":string[],"bounds":{"minX":number,"minY":number,"maxX":number,"maxY":number},"confidence":number,"evidenceRefs":string[]}],"anchors":[{"id":string,"nodeId":string,"role":string,"point":[number,number],"confidence":number,"evidenceRefs":string[]}],"relations":[{"type":string,"from":string,"to":string,"confidence":number}]}
若输入含 protocolFeedback，必须针对该错误纠正输出。`;

const INTENT_SYSTEM_PROMPT = `你是 VectorAI 二维编辑设计器。
根据已接地的 VisualFeatureGraph 设计任务级 EditIntent，禁止输出任何 DrawingCommand、commit 或完整文档。
operation 只能是 transform、deform、local-redraw；必须明确目标、锚点、保护对象、关系、置信度和视图证据。
所有坐标必须是 [x,y] 数字数组，不能写 {x,y}。transform 操作还必须输出 transform 参数。
desiredRelations 的 from/to 可以引用 VisualFeatureGraph 中的 feature id、anchor id 或已观察到的 nodeId。
只输出严格 JSON：{"operation":"transform"|"deform"|"local-redraw","targetFeatureIds":string[],"targetNodeIds":string[],"anchors":[{"nodeId":string,"role":string,"point"?:[number,number]}],"preserveNodeIds":string[],"preserveRules":object[],"desiredRelations":object[],"transform"?:object,"confidence":number,"evidenceRefs":string[]}
若输入含 protocolFeedback，必须针对该错误纠正输出。`;

const CANDIDATE_SYSTEM_PROMPT = `你是 VectorAI 二维局部几何生成器。
根据已接地的特征和 EditIntent，只生成目标区域内用于 deform/local-redraw 的完整 Drawing IR geometry 节点。
不得输出 DrawingCommand、事务、标注、关系或未授权区域。所有点必须使用 [x,y] 数字数组。
每个 geometry 节点必须有稳定 id、type、visible、quality 及该类型的完整参数。
只输出严格 JSON：{"geometry":[GeometryNode,...]}。若输入含 protocolFeedback，必须针对该错误纠正输出。`;

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
}

export interface DrawingFeatureGraphModelAdapter {
  resolve(input: SemanticCallInput): Promise<VisualFeatureGraph>;
}

export interface DrawingSemanticRegionModelAdapter {
  propose(input: SemanticCallInput): Promise<SemanticRegionProposal>;
}

export interface DrawingEditIntentModelAdapter {
  design(input: SemanticCallInput & { featureGraph: VisualFeatureGraph }): Promise<EditIntent>;
}

export interface DrawingGeometryCandidateModelAdapter {
  design(input: SemanticCallInput & {
    featureGraph: VisualFeatureGraph;
    intent: EditIntent;
  }): Promise<GeometryNode[]>;
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

export class DrawingFeatureGraphAdapter {
  constructor(
    private readonly complete: DrawingSpatialCompletion = requestDrawingMultimodalCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async resolve(input: SemanticCallInput): Promise<VisualFeatureGraph> {
    assertDeadline('grounding', input.deadlineAt, this.now);
    const reply = await this.complete({
      role: 'grounding',
      modelName: input.modelName,
      systemPrompt: FEATURE_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.observation.revision,
        vectorDigest: input.observation.vectorDigest,
        views: observationMetadata(input.observation),
        repairFeedback: input.repairFeedback ?? [],
        ...(input.protocolFeedback ? { protocolFeedback: input.protocolFeedback } : {}),
      }),
      images: observationImages(input.observation, input.readImage),
      responseSchema: VISUAL_FEATURE_GRAPH_RESPONSE_SCHEMA,
      signal: input.signal,
    });
    input.onRawReply?.('grounding', reply);
    return parseVisualFeatureGraph(parseJson(reply), {
      allowedNodeIds: observedNodeIds(input.observation),
      allowedEvidenceRefs: input.observation.views.map((view) => view.id),
    });
  }
}

export class DrawingEditIntentAdapter {
  constructor(
    private readonly complete: DrawingSpatialCompletion = requestDrawingMultimodalCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async design(input: SemanticCallInput & {
    featureGraph: VisualFeatureGraph;
  }): Promise<EditIntent> {
    assertDeadline('design', input.deadlineAt, this.now);
    const reply = await this.complete({
      role: 'design',
      modelName: input.modelName,
      systemPrompt: INTENT_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.observation.revision,
        vectorDigest: input.observation.vectorDigest,
        featureGraph: input.featureGraph,
        views: observationMetadata(input.observation),
        repairFeedback: input.repairFeedback ?? [],
        ...(input.protocolFeedback ? { protocolFeedback: input.protocolFeedback } : {}),
      }),
      images: observationImages(input.observation, input.readImage),
      responseSchema: EDIT_INTENT_RESPONSE_SCHEMA,
      signal: input.signal,
    });
    input.onRawReply?.('design', reply);
    return parseEditIntent(parseJson(reply), {
      allowedNodeIds: observedNodeIds(input.observation),
      allowedFeatureIds: input.featureGraph.features.map((feature) => feature.id),
      allowedAnchorIds: input.featureGraph.anchors.map((anchor) => anchor.id),
      allowedEvidenceRefs: input.observation.views.map((view) => view.id),
    });
  }
}

export class DrawingGeometryCandidateAdapter implements DrawingGeometryCandidateModelAdapter {
  constructor(
    private readonly complete: DrawingSpatialCompletion = requestDrawingMultimodalCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async design(input: SemanticCallInput & {
    featureGraph: VisualFeatureGraph;
    intent: EditIntent;
  }): Promise<GeometryNode[]> {
    assertDeadline('design', input.deadlineAt, this.now);
    const reply = await this.complete({
      role: 'design',
      modelName: input.modelName,
      systemPrompt: CANDIDATE_SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.observation.revision,
        vectorDigest: input.observation.vectorDigest,
        featureGraph: input.featureGraph,
        intent: input.intent,
        views: observationMetadata(input.observation),
        repairFeedback: input.repairFeedback ?? [],
        ...(input.protocolFeedback ? { protocolFeedback: input.protocolFeedback } : {}),
      }),
      images: observationImages(input.observation, input.readImage),
      responseSchema: GEOMETRY_CANDIDATE_RESPONSE_SCHEMA,
      signal: input.signal,
    });
    input.onRawReply?.('design', reply);
    const payload = parseCandidatePayload(parseJson(reply));
    const commands = parseDrawingToolCommands(
      payload.map((value) => ({ type: 'geometry.create', value })),
      'candidate.geometry',
    );
    return commands.map((command) => {
      if (command.type !== 'geometry.create') throw new Error('CANDIDATE_GEOMETRY_INVALID');
      return command.value as GeometryNode;
    });
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

function observedNodeIds(observation: VisualObservation): string[] {
  return [...new Set([
    ...observation.vectorDigest.nodes.map((node) => node.id),
    ...observation.views.flatMap((view) => view.grounding.map((node) => node.nodeId)),
  ])];
}

function parseJson(reply: string): unknown {
  const trimmed = reply.trim();
  const source = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new DrawingSpatialProtocolError(
      'response.json',
      error instanceof Error ? error.message : '模型返回了非法 JSON',
    );
  }
}

function parseCandidatePayload(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DrawingSpatialProtocolError('candidate', '必须是对象');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'geometry' || !Array.isArray(record.geometry)) {
    throw new DrawingSpatialProtocolError('candidate', '只允许 geometry 数组');
  }
  if (record.geometry.length === 0) {
    throw new DrawingSpatialProtocolError('candidate.geometry', '不能为空');
  }
  return record.geometry;
}

function assertDeadline(stage: string, deadlineAt: number, now: () => number): void {
  if (now() >= deadlineAt) throw new Error(`${stage} deadline exceeded`);
}
