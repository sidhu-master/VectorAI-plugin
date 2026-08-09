import { describe, expect, it } from 'vitest';

import type { PersistedCleanLineVectorizationResult } from './types.js';
import { buildVectorizationSteps } from './build-steps.js';

describe('buildVectorizationSteps', () => {
  it('maps source pixels to a 500 mm y-up polyline before promoting the same id to a line', () => {
    const result = fixture({
      closed: false,
      samples: [[100, 100], [150, 150], [200, 200]],
      simplified: [[100, 100], [200, 200]],
      bounds: { x: 100, y: 100, width: 100, height: 100 },
      candidate: {
        type: 'line', parameters: { start: [100, 100], end: [200, 200] },
        fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
      },
    });

    const [draft, promotion] = buildVectorizationSteps(result);
    const stableId = draft.previewNode.id;

    expect(draft).toMatchObject({ kind: 'draft', chainId: result.chains[0].id });
    expect(draft.previewNode).toMatchObject({
      id: stableId,
      type: 'polyline',
      closed: false,
      vertices: [{ point: [50, 350] }, { point: [100, 300] }],
    });
    expect(promotion.commands.map((command) => command.type)).toEqual([
      'geometry.delete', 'geometry.create',
    ]);
    expect(promotion.previewNode).toMatchObject({
      id: stableId, type: 'line', start: [50, 350], end: [100, 300],
    });
  });

  it('converts circle radius and keeps every draft before any promotion', () => {
    const first = fixture({
      closed: true,
      samples: [[100, 100], [200, 100], [200, 200], [100, 200]],
      simplified: [[100, 100], [200, 100], [200, 200], [100, 200]],
      bounds: { x: 100, y: 100, width: 100, height: 100 },
      candidate: {
        type: 'circle', parameters: { center: [150, 150], radius: 50 },
        fitErrorMean: 0.3, fitErrorP95: 0.7, fitErrorMax: 1, confidence: 0.94,
      },
    });
    first.chains.push({
      ...structuredClone(first.chains[0]),
      id: 'chain_abcdef0123456789abcd',
      closed: false,
      bounds: { x: 400, y: 400, width: 100, height: 2 },
      samples: [[400, 400], [500, 400]],
      simplified: [[400, 400], [500, 400]],
      candidate: null,
      evidence: { ...first.chains[0].evidence, handle: 'evidence_bbbbbbbbbbbbbbbbbbbbbbbb' },
    });

    const steps = buildVectorizationSteps(first);

    expect(steps.map((step) => step.kind)).toEqual(['draft', 'draft', 'promotion']);
    expect(steps[2].previewNode).toMatchObject({
      type: 'circle', center: [75, 325], radius: 25,
    });
  });

  it('keeps the polyline when a candidate circle is implausibly larger than its evidence', () => {
    const result = fixture({
      closed: true,
      samples: [[100, 100], [200, 100], [200, 200], [100, 200]],
      simplified: [[100, 100], [200, 100], [200, 200], [100, 200]],
      bounds: { x: 100, y: 100, width: 100, height: 100 },
      candidate: {
        type: 'circle', parameters: { center: [150, 150], radius: 3_000 },
        fitErrorMean: 0.1, fitErrorP95: 0.2, fitErrorMax: 0.3, confidence: 0.99,
      },
    });

    const steps = buildVectorizationSteps(result);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: 'draft', previewNode: { type: 'polyline' } });
  });
});

function fixture(
  chain: Omit<PersistedCleanLineVectorizationResult['chains'][number], 'id' | 'evidence'>,
): PersistedCleanLineVectorizationResult {
  return {
    sourceId: 'source_steps', pipelineVersion: 'fixture-v1',
    width: 1_000, height: 800, analysisScale: 1, medianLineWidthPx: 4,
    chains: [{
      id: 'chain_0123456789abcdef0123',
      ...chain,
      evidence: {
        handle: 'evidence_aaaaaaaaaaaaaaaaaaaaaaaa', sourceId: 'source_steps',
        regionId: 'vector_chain_0123456789abcdef0123', kind: 'polyline-candidate',
        bounds: { ...chain.bounds }, confidence: 0.9,
        touchesRegionEdge: false, sampleCount: chain.samples.length,
      },
    }],
  };
}
