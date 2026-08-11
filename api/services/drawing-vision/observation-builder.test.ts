import { describe, expect, it, vi } from 'vitest';

import {
  type DrawingDocument,
  type GeometryId,
  type RevisionId,
} from '../../../src/drawing/index.js';
import { renderGroundingSnapshot } from './grounding-renderer.js';
import { DrawingObservationBuilder } from './observation-builder.js';

describe('DrawingObservationBuilder', () => {
  it('builds revision-bound overview and selected detail views without a browser viewport', async () => {
    const builder = new DrawingObservationBuilder();
    const document = documentWithCircle();

    const observation = await builder.build({
      document,
      revision: 'revision_observation_1' as RevisionId,
      selectedIds: ['hand'],
    });

    expect(observation.revision).toBe('revision_observation_1');
    expect(observation.rendererVersion).toBe('scene-1.0');
    expect(observation.views.map((view) => view.purpose)).toEqual(['overview', 'target-detail']);
    expect(observation.views[0].worldBounds).toEqual(expect.objectContaining({
      minX: expect.any(Number), minY: expect.any(Number),
      maxX: expect.any(Number), maxY: expect.any(Number),
    }));
    expect(observation.views[0].worldBounds.minX).toBeLessThanOrEqual(80);
    expect(observation.views[0].worldBounds.maxX).toBeGreaterThanOrEqual(120);
    expect(observation.views[1].grounding.some((node) => node.nodeId === 'hand')).toBe(true);
    expect(observation.views[0].image.handle).toMatch(/^observation_/);
    expect(JSON.stringify(observation)).not.toContain('data:image');
    expect(builder.readImage(observation.views[0].image.handle)).toMatch(/^data:image\/png;base64,/);
  });

  it('reuses a deterministic cached render for the same revision and view spec', async () => {
    const render = vi.fn(renderGroundingSnapshot);
    const builder = new DrawingObservationBuilder({ renderSnapshot: render });
    const input = {
      document: documentWithCircle(),
      revision: 'revision_observation_cache' as RevisionId,
      selectedIds: ['hand'],
    };

    const first = await builder.build(input);
    const second = await builder.build(input);

    expect(second.views.map((view) => view.cacheKey)).toEqual(first.views.map((view) => view.cacheKey));
    expect(second.views.map((view) => view.image.handle)).toEqual(first.views.map((view) => view.image.handle));
    expect(render).toHaveBeenCalledTimes(2); // overview + target-detail, then cache hits
  });

  it('isolates preview observations from canonical cache entries at the same revision', async () => {
    const builder = new DrawingObservationBuilder();
    const canonical = documentWithCircle();
    const preview = structuredClone(canonical);
    preview.geometry.push({
      id: 'detail_line' as GeometryId,
      type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      start: [90, 90], end: [110, 110],
    });

    const before = await builder.build({
      document: canonical,
      revision: 'revision_shared' as RevisionId,
      cacheScope: 'canonical',
    });
    const after = await builder.build({
      document: preview,
      revision: 'revision_shared' as RevisionId,
      cacheScope: 'preview:preview_1',
    });

    expect(after.views[0].image.handle).not.toBe(before.views[0].image.handle);
    expect(after.vectorDigest.nodes).toHaveLength(before.vectorDigest.nodes.length + 1);
  });
});

function documentWithCircle(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_observation' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [{
      id: 'hand' as GeometryId,
      type: 'circle',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      center: [100, 100],
      radius: 20,
    }],
    annotations: [],
    relations: [],
    features: [],
  };
}
