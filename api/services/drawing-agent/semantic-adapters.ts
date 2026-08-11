import {
  parseEditIntent,
  parseVisualFeatureGraph,
  type EditIntent,
  type VisualFeatureGraph,
} from '../../../src/contracts/drawing-spatial-agent.js';
import { parseDrawingToolCommands } from '../../../src/contracts/drawing-agent.js';
import type { GeometryNode } from '../../../src/drawing/index.js';
import type { DrawingPreviewDefect } from './types.js';
import {
  requestDrawingMultimodalCompletion,
  type DrawingMultimodalCompletionParams,
} from '../ai-gateway.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';

const FEATURE_SYSTEM_PROMPT = `你是 VectorAI 二维空间接地器。
根据服务器渲染视图、Drawing IR 摘要和 grounding 表，把用户语义映射为 VisualFeatureGraph。
只能引用输入中真实存在的 nodeId 和 view id，不得编造 nodeId，不得输出 DrawingCommand。
只输出严格 JSON：{features:[{id,label,nodeIds,bounds,confidence,evidenceRefs}],anchors:[{id,nodeId,role,point,confidence,evidenceRefs}],relations:[{type,from,to,confidence}]}`;

const INTENT_SYSTEM_PROMPT = `你是 VectorAI 二维编辑设计器。
根据已接地的 VisualFeatureGraph 设计任务级 EditIntent，禁止输出任何 DrawingCommand、commit 或完整文档。
operation 只能是 transform、deform、local-redraw；必须明确目标、锚点、保护对象、关系、置信度和视图证据。
transform 操作还必须输出 transform 参数。只输出严格 JSON。`;

const CANDIDATE_SYSTEM_PROMPT = `你是 VectorAI 二维局部几何生成器。
根据已接地的特征和 EditIntent，只生成目标区域内用于 deform/local-redraw 的完整 Drawing IR geometry 节点。
不得输出 DrawingCommand、事务、标注、关系或未授权区域。只输出严格 JSON：{"geometry":[GeometryNode,...]}`;

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
}

export interface DrawingFeatureGraphModelAdapter {
  resolve(input: SemanticCallInput): Promise<VisualFeatureGraph>;
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
      }),
      images: observationImages(input.observation, input.readImage),
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
      }),
      images: observationImages(input.observation, input.readImage),
      signal: input.signal,
    });
    input.onRawReply?.('design', reply);
    return parseEditIntent(parseJson(reply), {
      allowedNodeIds: observedNodeIds(input.observation),
      allowedFeatureIds: input.featureGraph.features.map((feature) => feature.id),
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
      }),
      images: observationImages(input.observation, input.readImage),
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
  } catch {
    throw new Error('SPATIAL_MODEL_JSON_INVALID');
  }
}

function parseCandidatePayload(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('CANDIDATE_PAYLOAD_INVALID');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== 'geometry' || !Array.isArray(record.geometry)) {
    throw new Error('CANDIDATE_PAYLOAD_INVALID');
  }
  if (record.geometry.length === 0) throw new Error('CANDIDATE_GEOMETRY_EMPTY');
  return record.geometry;
}

function assertDeadline(stage: string, deadlineAt: number, now: () => number): void {
  if (now() >= deadlineAt) throw new Error(`${stage} deadline exceeded`);
}
