import { describe, expect, it, vi } from 'vitest';

import { DrawingAssetCache, type DrawingImageCropper } from './assets.js';
import type { AgentAttachmentPreparer } from '../agent-runtime/types.js';

describe('DrawingAssetCache', () => {
  it('prepares a PDF page once and reuses repeated crop bytes', async () => {
    const prepare = vi.fn<AgentAttachmentPreparer['prepare']>(async ({ signal }) => {
      expect(signal.aborted).toBe(false);
      return { image: Buffer.from('page-png').toString('base64'), mimeType: 'image/png' };
    });
    const crop = vi.fn<DrawingImageCropper['crop']>(async ({ signal }) => {
      expect(signal.aborted).toBe(false);
      return { image: Buffer.from('crop-png').toString('base64'), mimeType: 'image/png' };
    });
    const cache = new DrawingAssetCache({ preparer: { prepare }, cropper: { crop } });
    const signal = new AbortController().signal;

    const firstPage = await cache.putPage({
      runId: 'run_1', page: 1, image: 'cGRm', mimeType: 'application/pdf', signal,
    });
    const secondPage = await cache.putPage({
      runId: 'run_1', page: 1, image: 'cGRm', mimeType: 'application/pdf', signal,
    });
    const firstCrop = await cache.crop({
      runId: 'run_1', assetId: firstPage.assetId, bounds: [0.1, 0.2, 0.3, 0.4], signal,
    });
    const secondCrop = await cache.crop({
      runId: 'run_1', assetId: firstPage.assetId, bounds: [0.1, 0.2, 0.3, 0.4], signal,
    });

    expect(firstPage).toEqual(secondPage);
    expect(firstCrop).toEqual(secondCrop);
    expect(prepare).toHaveBeenCalledOnce();
    expect(crop).toHaveBeenCalledOnce();
    await expect(cache.read('run_1', firstCrop.assetId)).resolves.toEqual({
      image: Buffer.from('crop-png').toString('base64'), mimeType: 'image/png',
    });
  });

  it.each([
    [-0.1, 0, 0.2, 0.2],
    [0.9, 0, 0.2, 0.2],
    [0, 0, 0, 0.2],
  ])('rejects invalid or out-of-bounds crops %#', async (...bounds) => {
    const cache = new DrawingAssetCache();
    const signal = new AbortController().signal;
    const page = await cache.putPage({
      runId: 'run_1', page: 1, image: 'cG5n', mimeType: 'image/png', signal,
    });

    await expect(cache.crop({
      runId: 'run_1', assetId: page.assetId,
      bounds: bounds as [number, number, number, number], signal,
    })).rejects.toThrow(/bounds/);
  });

  it('releases every page and crop for a terminal run', async () => {
    const cache = new DrawingAssetCache({
      cropper: { crop: async () => ({ image: 'Y3JvcA==', mimeType: 'image/png' }) },
    });
    const signal = new AbortController().signal;
    const page = await cache.putPage({
      runId: 'run_release', page: 1, image: 'cG5n', mimeType: 'image/png', signal,
    });
    const crop = await cache.crop({
      runId: 'run_release', assetId: page.assetId, bounds: [0, 0, 0.5, 0.5], signal,
    });

    expect(cache.releaseRun('run_release')).toBe(2);
    await expect(cache.read('run_release', page.assetId)).rejects.toThrow(/不存在/);
    await expect(cache.read('run_release', crop.assetId)).rejects.toThrow(/不存在/);
    expect(cache.metadata('run_release')).toEqual([]);
  });

  it('returns serializable metadata without media bytes', async () => {
    const cache = new DrawingAssetCache();
    const page = await cache.putPage({
      runId: 'run_meta', page: 1, image: 'c2Vuc2l0aXZlLWJ5dGVz', mimeType: 'image/png',
      signal: new AbortController().signal,
    });

    expect(cache.metadata('run_meta')).toEqual([page]);
    const serialized = JSON.stringify(cache.metadata('run_meta'));
    expect(serialized).not.toContain('c2Vuc2l0aXZlLWJ5dGVz');
    expect(serialized).not.toContain('"image":');
    expect(serialized).not.toContain('"base64":');
  });

  it('enforces byte/count limits and propagates cancellation', async () => {
    const aborted = new AbortController();
    aborted.abort(new Error('cancelled'));
    const cache = new DrawingAssetCache({ maxBytes: 4, maxAssets: 1 });

    await expect(cache.putPage({
      runId: 'run_abort', page: 1, image: 'cG5n', mimeType: 'image/png', signal: aborted.signal,
    })).rejects.toThrow(/cancelled/);
    await cache.putPage({
      runId: 'run_limits', page: 1, image: 'MTIzNA==', mimeType: 'image/png',
      signal: new AbortController().signal,
    });
    await expect(cache.putPage({
      runId: 'run_limits', page: 2, image: 'NQ==', mimeType: 'image/png',
      signal: new AbortController().signal,
    })).rejects.toThrow(/limit/);
  });
});
