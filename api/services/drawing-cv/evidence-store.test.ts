import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FileCvEvidenceStore } from './evidence-store.js';

const temporaryDirectories: string[] = [];
const sourceId = 'source_81d16ea531aa2887ae1a4524';

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('FileCvEvidenceStore', () => {
  it('stores samples by content handle and returns bounded pages', async () => {
    const store = await createStore();
    const samples = Array.from({ length: 1_000 }, (_, index) => (
      [index % 100, Math.floor(index / 100)] as const
    ));

    const summary = await store.putEvidence({
      sourceId,
      regionId: 'region_head',
      kind: 'contour',
      bounds: { x: 10, y: 20, width: 100, height: 80 },
      confidence: 0.9,
      touchesRegionEdge: false,
      samples,
    });

    expect(summary.handle).toMatch(/^evidence_[a-f0-9]{24}$/);
    expect(summary.sampleCount).toBe(1_000);
    expect(JSON.stringify(summary)).not.toContain('samples');
    await expect(store.readSummary(summary.handle)).resolves.toEqual(summary);
    await expect(store.readSamples(summary.handle, { offset: 0, limit: 16 })).resolves.toEqual({
      items: samples.slice(0, 16),
      nextOffset: 16,
      total: 1_000,
    });
    await expect(store.readSamples(summary.handle, { offset: 992, limit: 16 })).resolves.toEqual({
      items: samples.slice(992),
      total: 1_000,
    });
  });

  it('uses the same handle for byte-identical evidence', async () => {
    const store = await createStore();
    const evidence = {
      sourceId,
      regionId: 'region_eye',
      kind: 'circle-candidate' as const,
      bounds: { x: 300, y: 250, width: 60, height: 60 },
      confidence: 0.95,
      touchesRegionEdge: false,
      samples: [[320, 280], [330, 270], [340, 280]] as const,
    };

    const first = await store.putEvidence(evidence);
    const second = await store.putEvidence(evidence);

    expect(second).toEqual(first);
  });

  it('rejects evidence outside immutable source bounds', async () => {
    const store = await createStore();

    await expect(store.putEvidence({
      sourceId,
      regionId: 'region_invalid',
      kind: 'edge',
      bounds: { x: 1_250, y: 100, width: 20, height: 30 },
      confidence: 0.8,
      touchesRegionEdge: true,
      samples: [[1_251, 101]],
    })).rejects.toThrow('CV_REGION_OUT_OF_BOUNDS');
  });

  it('rejects unbounded page requests', async () => {
    const store = await createStore();
    const summary = await store.putEvidence({
      sourceId,
      regionId: 'region_line',
      kind: 'line-candidate',
      bounds: { x: 10, y: 10, width: 100, height: 10 },
      confidence: 0.9,
      touchesRegionEdge: false,
      samples: [[10, 10], [110, 10]],
    });

    await expect(store.readSamples(summary.handle, { offset: 0, limit: 10_000 }))
      .rejects.toThrow('CV_PAGE_LIMIT_INVALID');
  });
});

async function createStore(): Promise<FileCvEvidenceStore> {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-cv-evidence-'));
  temporaryDirectories.push(rootDirectory);
  return new FileCvEvidenceStore({
    rootDirectory,
    resolveSourceSize: async (requestedSourceId) => {
      if (requestedSourceId !== sourceId) throw new Error('SOURCE_NOT_FOUND');
      return { width: 1_260, height: 1_748 };
    },
  });
}
