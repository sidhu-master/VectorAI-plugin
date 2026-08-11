import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import { GatewayDrawingRegionImageEditProvider } from './gateway-provider.js';

async function png(width = 16, height = 12): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();
}

describe('GatewayDrawingRegionImageEditProvider', () => {
  it('forwards only the scoped crop, masks, prompt, seed and deadline to a replaceable transport', async () => {
    const output = await png();
    const request = vi.fn(async () => ({
      imageBase64: output.toString('base64'), providerRequestId: 'provider_request_1',
    }));
    const provider = new GatewayDrawingRegionImageEditProvider({
      modelName: 'server-configured-image-model', request,
    });
    const controller = new AbortController();
    const cropPng = await png();
    const maskPng = await png();
    const protectedMaskPng = await png();
    const deadlineAt = Date.now() + 10_000;

    const result = await provider.edit({
      prompt: '只在蒙版内添加卷发', cropPng, maskPng, protectedMaskPng,
      seed: 17, signal: controller.signal, deadlineAt,
    });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      modelName: 'server-configured-image-model', prompt: '只在蒙版内添加卷发',
      cropPng, maskPng, protectedMaskPng, seed: 17,
      signal: controller.signal, deadlineAt,
    }));
    expect(result).toEqual({ png: output, providerRequestId: 'provider_request_1' });
  });

  it('rejects expired calls and invalid provider bytes without manufacturing a result', async () => {
    const request = vi.fn(async () => ({
      imageBase64: Buffer.from('not-an-image').toString('base64'),
      providerRequestId: 'provider_request_bad',
    }));
    const provider = new GatewayDrawingRegionImageEditProvider({ modelName: 'image-model', request });
    const base = {
      prompt: '重绘', cropPng: await png(), maskPng: await png(),
      protectedMaskPng: await png(), seed: 1, signal: new AbortController().signal,
    };

    await expect(provider.edit({ ...base, deadlineAt: Date.now() - 1 }))
      .rejects.toThrow('GENERATION_DEADLINE_EXCEEDED');
    await expect(provider.edit({ ...base, deadlineAt: Date.now() + 10_000 }))
      .rejects.toThrow('GENERATION_RESULT_INVALID');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
