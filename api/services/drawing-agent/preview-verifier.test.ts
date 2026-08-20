import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import type { DrawingDocument, RevisionId } from '../../../src/drawing/index.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  DrawingPreviewVerificationAdapter,
  type DrawingSpatialCompletion,
} from './preview-verifier.js';

describe('DrawingPreviewVerificationAdapter', () => {
  it('sends one aligned comparison sheet and parses typed defects', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        satisfied: false,
        reason: '修改后的轮廓没有满足指令',
        defects: [{
          code: 'goal-mismatch', message: '目标轮廓仍保持原来的位置',
          nodeIds: ['target_line'], repairHint: '根据右侧结果重新规划修改',
        }],
      });
    });
    const before = await png([0, 0, 0, 255]);
    const preview = await png([255, 255, 255, 255]);
    const media = new Map([['before_image', before], ['preview_image', preview]]);
    const adapter = new DrawingPreviewVerificationAdapter(complete);

    const result = await adapter.verify({
      goal: '把目标轮廓移动到上方；追加指令：其他部分保持不变',
      previewDocument: emptyDocument(),
      modelName: 'verification-model',
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
      beforeObservation: observation('before', 'overview', 'before_image'),
      previewObservation: observation('preview', 'user-viewport', 'preview_image'),
      deterministicDiagnostics: [{
        code: 'NEW_DANGLING_ENDPOINT', severity: 'warning',
        message: '候选修改产生了新的未连接端点', nodeIds: ['target_line'],
        facts: { points: [[1, 1]] },
      }],
      candidateContext: {
        previewHandle: 'preview_program_1', transactionDigest: 'sha256:program',
        tool: 'preview_spatial_program', summary: 'move one target',
        intent: 'move and reconnect explicit interfaces',
        targetNodeIds: ['target_line'], operationKinds: ['translate', 'set_endpoint'],
        preserveNodeIds: ['context_line'],
      },
      protocolFeedback: 'verification.defects: 通过时 defects 必须为空',
      readImage: (handle) => media.get(handle) ?? null,
    });

    expect(result).toEqual({
      satisfied: false,
      reason: '修改后的轮廓没有满足指令',
      defects: [{
        code: 'goal-mismatch', message: '目标轮廓仍保持原来的位置',
        nodeIds: ['target_line'], repairHint: '根据右侧结果重新规划修改',
      }],
    });
    expect(received?.images.map((image) => image.id)).toEqual(['comparison-sheet']);
    expect(received?.images[0]).toMatchObject({ width: 2, height: 1 });
    expect(received?.images[0].dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(received?.userPrompt).toContain('before | after');
    expect(received?.userPrompt).toContain('追加指令：其他部分保持不变');
    expect(received?.userPrompt).toContain('target_line');
    expect(received?.userPrompt).toContain('NEW_DANGLING_ENDPOINT');
    expect(received?.userPrompt).toContain('preview_program_1');
    expect(received?.userPrompt).toContain('move and reconnect explicit interfaces');
    expect(received?.userPrompt).toContain('translate');
    expect(received?.userPrompt).toContain('protocolCorrection');
    expect(received?.userPrompt).toContain('verification.defects');
    expect(received?.systemPrompt).toContain('只判断修改后是否满足用户当前有效指令');
    expect(received?.systemPrompt).toContain('不规划、不修改图纸、不决定权限');
    expect(received?.systemPrompt).toContain('候选声明不是视觉证据');
    expect(received?.systemPrompt).toContain('对象的左/右/前/后');
    expect(received?.systemPrompt).toContain('画面/屏幕的左/右/上/下');
    expect(received?.responseSchema).toMatchObject({
      name: 'drawing_preview_verification',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['satisfied', 'reason', 'defects'],
      },
    });
  });
});

async function png(rgba: [number, number, number, number]): Promise<string> {
  const buffer = await sharp(Buffer.from(rgba), {
    raw: { width: 1, height: 1, channels: 4 },
  }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function observation(
  id: string,
  purpose: 'overview' | 'user-viewport',
  handle: string,
): VisualObservation {
  return {
    drawingId: 'drawing_verify' as VisualObservation['drawingId'],
    revision: 'revision_verify' as RevisionId,
    rendererVersion: 'scene-1.0', selectedIds: [],
    vectorDigest: {
      unit: 'mm', counts: { geometry: 1, annotation: 0, relation: 0, feature: 0 },
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      nodes: [{ id: 'target_line', type: 'line', bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } }],
    },
    views: [{
      id: `view_${id}`, purpose, cacheKey: id,
      image: { handle, mimeType: 'image/png' }, width: 1, height: 1,
      worldBounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      worldToImage: [1, 0, 0, -1, 0, 1],
      grounding: [{
        label: 'G001', nodeId: 'target_line', type: 'line', rgb: [255, 0, 0],
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        worldBounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        normalized: { left: 0, top: 0, right: 1, bottom: 1 },
        selected: false, zOrder: 0, clipped: false,
      }],
    }],
  };
}

function emptyDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_verify' as DrawingDocument['id'], metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [], annotations: [], relations: [], features: [],
  };
}
