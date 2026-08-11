import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import type { DrawingDocument, RevisionId } from '../../../src/drawing/index.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import {
  DrawingPreviewVerificationAdapter,
  type DrawingSpatialCompletion,
} from './preview-verifier.js';

describe('DrawingPreviewVerificationAdapter', () => {
  it('sends aligned before, preview, and diff views and parses typed defects', async () => {
    let received: Parameters<DrawingSpatialCompletion>[0] | undefined;
    const complete: DrawingSpatialCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify({
        satisfied: false,
        reason: '手腕连接断开',
        defects: [{
          code: 'connectivity', message: '手腕端点未连接',
          nodeIds: ['raised_hand'], repairHint: '把起点吸附到 wrist anchor',
        }],
      });
    });
    const before = await png([0, 0, 0, 255]);
    const preview = await png([255, 255, 255, 255]);
    const media = new Map([['before_image', before], ['preview_image', preview]]);
    const adapter = new DrawingPreviewVerificationAdapter(complete);

    const result = await adapter.verify({
      goal: '把右手抬起来打招呼',
      previewDocument: emptyDocument(),
      modelName: 'verification-model',
      signal: new AbortController().signal,
      deadlineAt: Date.now() + 1_000,
      beforeObservation: observation('before', 'overview', 'before_image'),
      previewObservation: observation('preview', 'user-viewport', 'preview_image'),
      readImage: (handle) => media.get(handle) ?? null,
    });

    expect(result).toEqual({
      satisfied: false,
      reason: '手腕连接断开',
      defects: [{
        code: 'connectivity', message: '手腕端点未连接',
        nodeIds: ['raised_hand'], repairHint: '把起点吸附到 wrist anchor',
      }],
    });
    expect(received?.images.map((image) => image.id)).toEqual([
      'before', 'preview', 'diff',
    ]);
    expect(received?.images[2].dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(received?.userPrompt).toContain('raised_hand');
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
      nodes: [{ id: 'raised_hand', type: 'line', bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 } }],
    },
    views: [{
      id: `view_${id}`, purpose, cacheKey: id,
      image: { handle, mimeType: 'image/png' }, width: 1, height: 1,
      worldBounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      worldToImage: [1, 0, 0, -1, 0, 1],
      grounding: [{
        label: 'G001', nodeId: 'raised_hand', type: 'line', rgb: [255, 0, 0],
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
