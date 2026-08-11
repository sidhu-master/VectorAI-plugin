import sharp from 'sharp';

import {
  requestDrawingImageEdit,
  type DrawingImageEditTransport,
} from '../ai-gateway.js';
import type {
  DrawingRegionImageEditInput,
  DrawingRegionImageEditProvider,
  DrawingRegionImageEditResult,
} from './types.js';

export class GatewayDrawingRegionImageEditProvider implements DrawingRegionImageEditProvider {
  readonly #modelName: string;
  readonly #request: DrawingImageEditTransport;

  constructor(input: { modelName: string; request?: DrawingImageEditTransport }) {
    if (!input.modelName.trim()) throw new Error('GENERATION_MODEL_MISSING');
    this.#modelName = input.modelName;
    this.#request = input.request ?? requestDrawingImageEdit;
  }

  async edit(input: DrawingRegionImageEditInput): Promise<DrawingRegionImageEditResult> {
    if (input.signal.aborted) throw input.signal.reason ?? new Error('GENERATION_ABORTED');
    if (!Number.isFinite(input.deadlineAt) || Date.now() >= input.deadlineAt) {
      throw new Error('GENERATION_DEADLINE_EXCEEDED');
    }
    if (!Number.isSafeInteger(input.seed) || input.seed < 0) throw new Error('GENERATION_SEED_INVALID');
    const response = await this.#request({ ...input, modelName: this.#modelName });
    if (input.signal.aborted) throw input.signal.reason ?? new Error('GENERATION_ABORTED');
    const png = decodeBase64(response.imageBase64);
    try {
      const metadata = await sharp(png).metadata();
      if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
        throw new Error('GENERATION_RESULT_INVALID');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'GENERATION_RESULT_INVALID') throw error;
      throw new Error('GENERATION_RESULT_INVALID');
    }
    if (!response.providerRequestId.trim()) throw new Error('GENERATION_REQUEST_ID_MISSING');
    return { png, providerRequestId: response.providerRequestId };
  }
}

function decodeBase64(value: string): Buffer {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('GENERATION_RESULT_INVALID');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.byteLength === 0) throw new Error('GENERATION_RESULT_INVALID');
  return bytes;
}
