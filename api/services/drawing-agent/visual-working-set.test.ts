import { describe, expect, it } from 'vitest';

import type { ModelLoopObservation } from './model-loop-adapter';
import { pendingSourceCropHandle, selectVisualWorkingSet } from './visual-working-set';

describe('selectVisualWorkingSet', () => {
  it('sends only the newest highest-value drawing observation', () => {
    const result = selectVisualWorkingSet({
      observations: [
        observation('overview-old', 'overview'),
        observation('focus-old', 'target-detail'),
        observation('preview-old', 'preview'),
        observation('preview-new', 'preview'),
      ],
      sourceBootstrapPending: false,
    });

    expect(result.sourceImage).toBeUndefined();
    expect(result.observations.map((item) => item.id)).toEqual(['preview-new']);
  });

  it('uses the source alone for bootstrap and never combines it with a drawing image', () => {
    const sourceImage = {
      id: 'source_1', imageDataUrl: 'data:image/png;base64,AAAA', width: 100, height: 80,
    };
    const result = selectVisualWorkingSet({
      sourceImage,
      observations: [observation('overview', 'overview')],
      sourceBootstrapPending: true,
    });

    expect(result.sourceImage).toEqual(sourceImage);
    expect(result.observations).toEqual([]);
  });

  it('falls back to one source image when no drawing observation exists', () => {
    const sourceImage = {
      id: 'source_1', imageDataUrl: 'data:image/png;base64,AAAA', width: 100, height: 80,
    };
    expect(selectVisualWorkingSet({
      sourceImage, observations: [], sourceBootstrapPending: false,
    })).toEqual({ sourceImage, observations: [] });
  });
});

describe('pendingSourceCropHandle', () => {
  it('returns only the newest successful undelivered source crop', () => {
    const results = [
      cropResult('crop_old', 'succeeded'),
      cropResult('crop_failed', 'failed'),
      cropResult('crop_new', 'succeeded'),
    ];

    expect(pendingSourceCropHandle(results, new Set(['crop_old']))).toBe('crop_new');
    expect(pendingSourceCropHandle(results, new Set(['crop_old', 'crop_new']))).toBeUndefined();
  });
});

function observation(
  id: string,
  purpose: ModelLoopObservation['purpose'],
): ModelLoopObservation {
  return {
    id, purpose, imageDataUrl: `data:image/png;base64,${id}`,
    width: 10, height: 10,
    worldBounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    worldToImage: [1, 0, 0, -1, 0, 10], grounding: [],
  };
}

function cropResult(handle: string, status: 'succeeded' | 'failed') {
  return {
    schemaVersion: 1 as const,
    receipt: {
      schemaVersion: 1 as const,
      runId: 'run_1', episodeId: 'episode_1', drawingId: 'drawing_1' as never,
      toolCallId: `call_${handle}`, tool: 'inspect_source_crop', toolVersion: '1.0.0',
      access: 'read' as const, status,
      revisionBefore: 'revision_1' as never, revisionAfter: 'revision_1' as never,
      affectedNodeIds: [], inputDigest: 'sha256:input', durationMs: 1,
    },
    ...(status === 'succeeded' ? { output: { mediaHandle: handle } } : {}),
  };
}
