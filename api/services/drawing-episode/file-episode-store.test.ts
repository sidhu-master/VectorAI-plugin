import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FileEditEpisodeStore } from './file-episode-store.js';
import { episodeFixture } from './test-fixture.js';

describe('FileEditEpisodeStore', () => {
  it('persists atomically and recovers the latest monotonic versions after restart', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-episode-'));
    try {
      const store = new FileEditEpisodeStore({ rootDirectory });
      const first = episodeFixture();
      await store.create(first);
      const next = structuredClone(first);
      next.regionVersions.push({
        version: 2, regionId: 'region_2', maskHandle: 'mask_2', status: 'active', createdAt: 20,
      });
      next.regionVersions[0].status = 'superseded';
      next.updatedAt = 20;
      await store.save(next);

      const restarted = new FileEditEpisodeStore({ rootDirectory });
      expect(await restarted.read(first.runId)).toEqual(next);
      expect(JSON.parse(await readFile(
        join(rootDirectory, first.runId, 'episode.json'), 'utf8',
      ))).toEqual(next);
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });

  it('rejects cross-drawing changes, non-monotonic versions and feedback rewrites', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-episode-invalid-'));
    try {
      const store = new FileEditEpisodeStore({ rootDirectory });
      const first = episodeFixture();
      await store.create(first);
      const wrongDrawing = { ...structuredClone(first), drawingId: 'drawing_other' };
      await expect(store.save(wrongDrawing)).rejects.toThrow('EPISODE_SCOPE_MISMATCH');
      const rewritten = structuredClone(first);
      rewritten.feedbackTurns[0].text = 'rewritten';
      await expect(store.save(rewritten)).rejects.toThrow('EPISODE_FEEDBACK_IMMUTABLE');
      const skipped = structuredClone(first);
      skipped.previewVersions.push({
        version: 3, previewVersionId: 'preview_3', regionVersion: 1, selectionVersion: 1,
        status: 'active', strategy: 'geometric-edit', affectedNodeIds: [],
        diffSummary: 'skip', defectCodes: [], createdAt: 30,
      });
      await expect(store.save(skipped)).rejects.toThrow('EPISODE_VERSION_NON_MONOTONIC');
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  });
});
