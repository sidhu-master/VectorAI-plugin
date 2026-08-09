import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileCvCropStore } from './crop-store.js';

let rootDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-crops-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

describe('FileCvCropStore', () => {
  it('stores a pixel-bounded PNG crop behind an audit-safe media handle', async () => {
    const sourceBytes = await sharp({
      create: { width: 200, height: 120, channels: 3, background: '#ffffff' },
    }).png().toBuffer();
    const store = new FileCvCropStore({ rootDirectory });

    const summary = await store.create({
      source: {
        sourceId: 'source_0123456789abcdef01234567', mimeType: 'image/png',
        bytes: sourceBytes, width: 200, height: 120,
      },
      regionId: 'region_center',
      bounds: { x: 20, y: 10, width: 160, height: 100 },
      maxPixels: 4_000,
    });
    const artifact = await store.read(summary.mediaHandle);

    expect(summary).toMatchObject({
      sourceId: 'source_0123456789abcdef01234567',
      regionId: 'region_center', mimeType: 'image/png',
      sourceBounds: { x: 20, y: 10, width: 160, height: 100 },
    });
    expect(summary.width * summary.height).toBeLessThanOrEqual(4_000);
    expect(artifact.bytes.byteLength).toBeGreaterThan(0);
    expect(JSON.stringify(summary)).not.toMatch(/base64|bytes|data:/i);
  });
});
