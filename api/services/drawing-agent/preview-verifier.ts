import sharp from 'sharp';

import {
  requestDrawingMultimodalCompletion,
  type DrawingMultimodalCompletionParams,
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

const SYSTEM_PROMPT = `你是 VectorAI 二维图纸预览验收器。
你会收到同一世界坐标范围内的 before、preview、diff 三幅图，以及前后 grounding。
先检查目标是否达成，再检查伪影、断连、重复旧结构和无关区域变化。
只能引用输入中存在的 nodeId。只输出严格 JSON：
{"satisfied":boolean,"reason":string,"defects":[{"code":string,"message":string,"nodeIds":string[],"repairHint"?:string}]}`;

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
    const diff = await createDiffDataUrl(before, preview, beforeView.width, beforeView.height);
    const reply = await this.complete({
      role: 'verification',
      modelName: input.modelName,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        goal: input.goal,
        revision: input.beforeObservation.revision,
        before: viewMetadata(beforeView),
        preview: viewMetadata(previewView),
      }),
      images: [
        { id: 'before', dataUrl: before },
        { id: 'preview', dataUrl: preview },
        { id: 'diff', dataUrl: diff },
      ],
      signal: input.signal,
    });
    input.onRawReply?.('verification', reply);
    return parseResult(parseJson(reply), new Set([
      ...input.beforeObservation.vectorDigest.nodes.map((node) => node.id),
      ...input.previewObservation.vectorDigest.nodes.map((node) => node.id),
    ]));
  }
}

async function createDiffDataUrl(
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
  const diff = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const distance = Math.abs(before[offset] - preview[offset])
      + Math.abs(before[offset + 1] - preview[offset + 1])
      + Math.abs(before[offset + 2] - preview[offset + 2]);
    if (distance > 24) {
      diff[offset] = 255;
      diff[offset + 1] = 64;
      diff[offset + 2] = 64;
      diff[offset + 3] = 255;
    } else {
      diff[offset] = 16;
      diff[offset + 1] = 20;
      diff[offset + 2] = 24;
      diff[offset + 3] = 255;
    }
  }
  const png = await sharp(diff, { raw: { width, height, channels: 4 } }).png().toBuffer();
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
