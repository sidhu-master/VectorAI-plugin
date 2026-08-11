import { describe, expect, it } from 'vitest';

import { buildEpisodeModelContext } from './context-builder.js';
import { episodeFixture } from './test-fixture.js';

describe('buildEpisodeModelContext', () => {
  it('keeps the active spatial state and bounds rejected preview history', () => {
    const episode = episodeFixture();
    for (let version = 2; version <= 10; version += 1) {
      episode.previewVersions.push({
        version, previewVersionId: `preview_${version}`, regionVersion: 1,
        selectionVersion: 1, strategy: 'geometric-edit', status: 'rejected',
        affectedNodeIds: [`node_${version}`], diffSummary: `rejected ${version}`,
        defectCodes: ['visual'], createdAt: version * 10,
      });
    }
    episode.previewVersions.push({
      version: 11, previewVersionId: 'preview_11', regionVersion: 1,
      selectionVersion: 1, strategy: 'geometric-edit', status: 'active',
      affectedNodeIds: ['arm'], diffSummary: 'latest', defectCodes: [], createdAt: 110,
    });

    const context = buildEpisodeModelContext(episode);

    expect(context.originalGoal).toBe(episode.originalGoal);
    expect(context.latestFeedback?.text).toBe('手臂再抬高一点');
    expect(context.activeRegion?.regionId).toBe('region_1');
    expect(context.activeSelection?.selectionVersionId).toBe('selection_1');
    expect(context.activePreview?.previewVersionId).toBe('preview_11');
    expect(context.rejectedSummary).toHaveLength(6);
    expect(context.rejectedSummary[0].previewVersionId).toBe('preview_5');
  });
});
