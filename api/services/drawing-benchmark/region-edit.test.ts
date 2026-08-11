import { describe, expect, it } from 'vitest';

import { runCreativeRegionEditBenchmark } from './region-edit.js';

describe('creative region edit release benchmark', () => {
  it('proves hybrid protection, feedback preview v2, Drawing IR commit, replay and revert', async () => {
    await expect(runCreativeRegionEditBenchmark()).resolves.toMatchObject({
      passed: true,
      strategy: 'hybrid-edit',
      generatedDrawingIr: true,
      protectedGeometryUnchanged: true,
      firstPreviewValid: true,
      revisedPreviewValid: true,
      feedbackRetained: true,
      previewVersionCount: 2,
      replayExact: true,
      revertExact: true,
    });
  });
});
