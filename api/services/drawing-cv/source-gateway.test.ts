import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import type { SourceArtifactStore } from '../source-artifacts/types.js';
import { StoredSourceCvGateway } from './source-gateway.js';

describe('StoredSourceCvGateway', () => {
  it('decodes and caches a stored raster source with authoritative dimensions', async () => {
    const bytes = await sharp({
      create: { width: 160, height: 120, channels: 3, background: 'white' },
    }).png().toBuffer();
    const read = vi.fn(async () => ({
      metadata: {
        sourceId: 'source_0123456789abcdef01234567',
        sha256: 'a'.repeat(64), mimeType: 'image/png' as const,
        byteLength: bytes.byteLength, page: 1,
      },
      bytes,
    }));
    const sourceArtifacts = { read } as unknown as SourceArtifactStore;
    const gateway = new StoredSourceCvGateway({ sourceArtifacts });

    const first = await gateway.read('source_0123456789abcdef01234567');
    const second = await gateway.read('source_0123456789abcdef01234567');

    expect(first).toMatchObject({ width: 160, height: 120, mimeType: 'image/png' });
    expect(second.bytes).toEqual(first.bytes);
    expect(read).toHaveBeenCalledTimes(1);
    expect(gateway.cachedSize(first.sourceId)).toEqual({ width: 160, height: 120 });
  });
});
