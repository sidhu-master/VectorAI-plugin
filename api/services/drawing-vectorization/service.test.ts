import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FileCvEvidenceStore } from '../drawing-cv/evidence-store.js';
import type { CvSourceImage } from '../drawing-cv/types.js';
import { CleanLineVectorizationService } from './service.js';
import type { CleanLineVectorizationProvider } from './types.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('CleanLineVectorizationService', () => {
  it('persists complete source-space chains with stable evidence handles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vectorai-vectorization-service-'));
    directories.push(root);
    const source: CvSourceImage = {
      sourceId: 'source_service', mimeType: 'image/png',
      bytes: Uint8Array.from([1, 2, 3]), width: 100, height: 80,
    };
    const evidence = new FileCvEvidenceStore({
      rootDirectory: root,
      resolveSourceSize: async () => ({ width: source.width, height: source.height }),
    });
    const provider: CleanLineVectorizationProvider = {
      vectorize: async () => ({
        sourceId: source.sourceId, pipelineVersion: 'fixture-v1', width: 100, height: 80,
        analysisScale: 1, medianLineWidthPx: 4,
        chains: [{
          id: 'chain_0123456789abcdef0123', closed: false,
          samples: [[10, 20], [50, 20], [90, 20]],
          simplified: [[10, 20], [90, 20]],
          bounds: { x: 10, y: 20, width: 80, height: 0.5 },
          candidate: {
            type: 'line', parameters: { start: [10, 20], end: [90, 20] },
            fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
          },
        }],
      }),
      close: async () => undefined,
    };
    const service = new CleanLineVectorizationService({
      provider,
      sources: { read: async () => structuredClone(source) },
      evidence,
    });

    const first = await service.vectorizeSource({
      sourceId: source.sourceId, maxPixels: 100_000, signal: new AbortController().signal,
    });
    const second = await service.vectorizeSource({
      sourceId: source.sourceId, maxPixels: 100_000, signal: new AbortController().signal,
    });
    const page = await evidence.readSamples(first.chains[0].evidence.handle, {
      offset: 0, limit: 100,
    });

    expect(first.chains[0].evidence).toMatchObject({
      sourceId: source.sourceId, kind: 'line-candidate', sampleCount: 3,
    });
    expect(second.chains[0].evidence.handle).toBe(first.chains[0].evidence.handle);
    expect(page).toEqual({ items: [[10, 20], [50, 20], [90, 20]], total: 3 });
  });
});
