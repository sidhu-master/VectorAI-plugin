import sharp from 'sharp';

import {
  requestDrawingMultimodalCompletion,
  type DrawingMultimodalCompletionParams,
  type DrawingResponseSchema,
} from '../ai-gateway.js';
import type { VisualObservationView } from '../drawing-vision/observation-types.js';
import type {
  DrawingPreviewDefect,
  DrawingPreviewVerificationInput,
  DrawingPreviewVerificationModelAdapter,
  DrawingPreviewVerificationResult,
} from './types.js';

export type DrawingSpatialCompletion = (
  input: DrawingMultimodalCompletionParams,
) => Promise<string>;

const SYSTEM_PROMPT = `你是独立的二维图纸修改复核者。
你会收到一张横向对照图，左侧是修改前，右侧是修改后。
你只判断修改后是否满足用户当前有效指令；不规划、不修改图纸、不决定权限，也不决定系统是否允许提交。
deterministicDiagnostics 是程序计算的辅助事实。只在这些事实影响用户指令是否达成时引用它们，不要把诊断代码当成修改授权或固定规则。
candidateContext 只用于绑定正在验收的候选和理解主模型声明的修改范围；候选声明不是视觉证据，必须以修改前后对照图和用户指令为准。
语义方位必须按用户使用的参照系复核：“对象的左/右/前/后”属于对象自身坐标，“画面/屏幕的左/右/上/下”属于观察画面；面向观察者时两套左右通常呈镜像关系，不得因为候选声明选了某一侧就放弃独立判断。
若 satisfied=true，defects 必须是空数组；可接受的诊断只能写入 reason，不能再列为 defect。
只能引用输入中存在的 nodeId。只输出严格 JSON：
{"satisfied":boolean,"reason":string,"defects":[{"code":string,"message":string,"nodeIds":string[],"repairHint"?:string}]}`;

export const PREVIEW_VERIFICATION_SCHEMA: DrawingResponseSchema = {
  name: 'drawing_preview_verification',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['satisfied', 'reason', 'defects'],
    properties: {
      satisfied: { type: 'boolean' },
      reason: { type: 'string', minLength: 1 },
      defects: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'message', 'nodeIds'],
          properties: {
            code: { type: 'string', minLength: 1 },
            message: { type: 'string', minLength: 1 },
            nodeIds: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
            },
            repairHint: { type: 'string', minLength: 1 },
          },
        },
      },
    },
  },
};

export class DrawingPreviewVerificationAdapter implements DrawingPreviewVerificationModelAdapter {
  constructor(
    private readonly complete: DrawingSpatialCompletion = requestDrawingMultimodalCompletion,
    private readonly now: () => number = Date.now,
  ) {}

  async verify(input: DrawingPreviewVerificationInput): Promise<DrawingPreviewVerificationResult> {
    if (this.now() >= input.deadlineAt) throw new Error('verification deadline exceeded');
    if (!input.beforeObservation || !input.previewObservation || !input.readImage) {
      throw new Error('PREVIEW_OBSERVATION_REQUIRED');
    }
    const beforeView = input.beforeObservation.views.find((view) => view.purpose === 'overview')
      ?? input.beforeObservation.views[0];
    const previewView = input.previewObservation.views.find((view) => view.purpose === 'user-viewport')
      ?? input.previewObservation.views.find((view) => view.purpose === 'overview')
      ?? input.previewObservation.views[0];
    if (!beforeView || !previewView) throw new Error('PREVIEW_VERIFICATION_VIEW_MISSING');
    const before = requiredImage(input.readImage, beforeView.image.handle);
    const preview = requiredImage(input.readImage, previewView.image.handle);
    const comparison = await createComparisonSheet(
      before, preview, beforeView.width, beforeView.height,
    );
    const reply = await this.complete({
      role: 'verification',
      modelName: input.modelName,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.beforeObservation.revision,
        before: viewMetadata(beforeView),
        after: viewMetadata(previewView),
        comparisonLayout: 'before | after',
        ...(input.candidateContext
          ? { candidateContext: input.candidateContext }
          : {}),
        deterministicDiagnostics: input.deterministicDiagnostics ?? [],
        ...(input.protocolFeedback ? {
          protocolCorrection: {
            rejectedReason: input.protocolFeedback,
            instruction: '重新验收同一候选并修正 JSON；satisfied=true 时 defects 必须为空。',
          },
        } : {}),
      }),
      images: [{
        id: 'comparison-sheet',
        dataUrl: comparison,
        width: beforeView.width * 2,
        height: beforeView.height,
      }],
      signal: input.signal,
      responseSchema: PREVIEW_VERIFICATION_SCHEMA,
    });
    input.onRawReply?.('verification', reply);
    return parseResult(parseJson(reply), new Set([
      ...input.beforeObservation.vectorDigest.nodes.map((node) => node.id),
      ...input.previewObservation.vectorDigest.nodes.map((node) => node.id),
    ]));
  }
}

async function createComparisonSheet(
  beforeDataUrl: string,
  previewDataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  const [before, preview] = await Promise.all([
    sharp(dataUrlBuffer(beforeDataUrl)).resize(width, height, { fit: 'fill' })
      .ensureAlpha().raw().toBuffer(),
    sharp(dataUrlBuffer(previewDataUrl)).resize(width, height, { fit: 'fill' })
      .ensureAlpha().raw().toBuffer(),
  ]);
  const sheet = Buffer.alloc(width * 2 * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * width * 4;
    const rowStart = y * width * 2 * 4;
    before.copy(sheet, rowStart, sourceStart, sourceStart + width * 4);
    preview.copy(sheet, rowStart + width * 4, sourceStart, sourceStart + width * 4);
  }
  const png = await sharp(sheet, {
    raw: { width: width * 2, height, channels: 4 },
  }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

function viewMetadata(view: VisualObservationView): unknown {
  return {
    id: view.id,
    purpose: view.purpose,
    width: view.width,
    height: view.height,
    worldBounds: view.worldBounds,
    worldToImage: view.worldToImage,
    grounding: view.grounding,
  };
}

function requiredImage(read: (handle: string) => string | null, handle: string): string {
  const image = read(handle);
  if (!image) throw new Error(`OBSERVATION_IMAGE_MISSING:${handle}`);
  return image;
}

function dataUrlBuffer(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('OBSERVATION_IMAGE_DATA_URL_INVALID');
  return Buffer.from(match[1], 'base64');
}

function parseResult(value: unknown, allowedNodeIds: Set<string>): DrawingPreviewVerificationResult {
  const result = object(value, 'verification');
  exact(result, ['satisfied', 'reason', 'defects'], 'verification');
  if (typeof result.satisfied !== 'boolean') fail('verification.satisfied', '必须是布尔值');
  const defects = array(result.defects, 'verification.defects').map((item, index) => (
    parseDefect(item, `verification.defects[${index}]`, allowedNodeIds)
  ));
  if (result.satisfied && defects.length > 0) {
    fail('verification.defects', '通过的预览不能同时包含缺陷');
  }
  return {
    satisfied: result.satisfied,
    reason: string(result.reason, 'verification.reason'),
    defects,
  };
}

function parseDefect(
  value: unknown,
  path: string,
  allowedNodeIds: Set<string>,
): DrawingPreviewDefect {
  const defect = object(value, path);
  exact(defect, ['code', 'message', 'nodeIds', 'repairHint'], path, ['repairHint']);
  const nodeIds = array(defect.nodeIds, `${path}.nodeIds`).map((item, index) => {
    const id = string(item, `${path}.nodeIds[${index}]`);
    if (!allowedNodeIds.has(id)) fail(`${path}.nodeIds[${index}]`, '引用了未观察到的节点');
    return id;
  });
  return {
    code: string(defect.code, `${path}.code`),
    message: string(defect.message, `${path}.message`),
    nodeIds,
    ...(defect.repairHint === undefined
      ? {}
      : { repairHint: string(defect.repairHint, `${path}.repairHint`) }),
  };
}

function parseJson(reply: string): unknown {
  const trimmed = reply.trim();
  const source = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    return JSON.parse(source);
  } catch {
    throw new Error('PREVIEW_VERIFICATION_JSON_INVALID');
  }
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '必须是对象');
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, '必须是数组');
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, '必须是非空字符串');
  return value;
}

function exact(
  value: Record<string, unknown>,
  keys: string[],
  path: string,
  optional: string[] = [],
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, '不允许的字段');
  }
  for (const key of keys) {
    if (!optional.includes(key) && !(key in value)) fail(`${path}.${key}`, '缺少字段');
  }
}

function fail(path: string, message: string): never {
  const error = new Error(`${path}: ${message}`) as Error & { path: string };
  error.path = path;
  throw error;
}
