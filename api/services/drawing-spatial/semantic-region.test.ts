import { describe, expect, it } from 'vitest';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import type { SemanticRegionProposal } from '../../../src/contracts/drawing-spatial-region.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import { RegionMediaStore } from './region-media-store.js';
import { buildSemanticRegion } from './semantic-region.js';

describe('buildSemanticRegion', () => {
  it('converts normalized image contours into Y-up world coordinates', async () => {
    const media = new RegionMediaStore({ maxItems: 2 });
    const region = await buildSemanticRegion({
      drawingId: 'drawing_region' as DrawingId,
      observation: observation(),
      proposal: proposal(),
      mediaStore: media,
    });

    expect(region.revision).toBe('revision_region');
    expect(region.worldContours[0]).toEqual([
      [10, 90], [40, 90], [40, 60], [10, 60],
    ]);
    expect(region.anchors[0].point).toEqual([25, 75]);
    expect(region.maskHandle).toMatch(/^region_mask_[a-f0-9]{24}$/);
  });

  it('stores a PNG behind a handle without serializing media bytes', async () => {
    const media = new RegionMediaStore({ maxItems: 2 });
    const region = await buildSemanticRegion({
      drawingId: 'drawing_region' as DrawingId,
      observation: observation(),
      proposal: proposal(),
      mediaStore: media,
    });

    const png = media.read(region.maskHandle);
    expect(png?.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(JSON.stringify(region)).not.toContain('base64');
    expect(JSON.stringify(region)).not.toContain('data:image');
  });

  it('rejects a proposal for a view outside the current observation', async () => {
    await expect(buildSemanticRegion({
      drawingId: 'drawing_region' as DrawingId,
      observation: observation(),
      proposal: { ...proposal(), sourceViewId: 'view_missing' },
      mediaStore: new RegionMediaStore(),
    })).rejects.toThrow('SEMANTIC_REGION_VIEW_MISSING:view_missing');
  });
});

function proposal(): SemanticRegionProposal {
  return {
    label: 'right arm',
    sourceViewId: 'view_overview',
    contours: [[[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]]],
    holes: [[[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.3]]],
    anchors: [{ id: 'shoulder', role: 'connection', point: [0.25, 0.25], confidence: 0.9 }],
    confidence: 0.92,
    evidenceRefs: ['view_overview'],
  };
}

function observation(): VisualObservation {
  return {
    drawingId: 'drawing_region' as DrawingId,
    revision: 'revision_region' as RevisionId,
    rendererVersion: 'scene-1.0',
    selectedIds: [],
    vectorDigest: {
      unit: 'mm', counts: { geometry: 0, annotation: 0, relation: 0, feature: 0 },
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, nodes: [],
    },
    views: [{
      id: 'view_overview', purpose: 'overview', cacheKey: 'region-view',
      image: { handle: 'observation_region', mimeType: 'image/png' },
      width: 100, height: 100,
      worldBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      worldToImage: [1, 0, 0, -1, 0, 100],
      grounding: [],
    }],
  };
}
