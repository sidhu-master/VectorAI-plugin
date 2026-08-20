import { describe, expect, it } from 'vitest';

import type {
  CleanLineStrokePiece,
  PersistedCleanLineVectorizationResult,
} from './types.js';
import { buildVectorizationSteps } from './build-steps.js';

describe('buildVectorizationSteps', () => {
  it('maps source pixels to one final 500 mm y-up analytic transaction', () => {
    const result = fixture([piece({
      sampleRange: [0, 2],
      simplified: [[100, 100], [200, 200]],
      candidate: {
        type: 'line', parameters: { start: [100, 100], end: [200, 200] },
        fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
      },
    })]);

    const [step] = buildVectorizationSteps(result);

    expect(buildVectorizationSteps(result)).toHaveLength(1);
    expect(step).toMatchObject({
      kind: 'final', chainIds: [result.chains[0].id],
    });
    expect(step).not.toHaveProperty('removedNodeIds');
    expect(step.commands.map((command) => command.type)).toEqual(['geometry.create']);
    expect(step.previewNodes).toEqual([
      expect.objectContaining({
        type: 'line', start: [50, 350], end: [100, 300],
      }),
    ]);
  });

  it('creates an ordered two-piece CompoundPath without a transient draft', () => {
    const result = fixture([
      piece({
        id: 'piece_aaaaaaaaaaaaaaaaaaaa', sampleRange: [0, 2],
        simplified: [[100, 100], [200, 100]],
        bounds: { x: 100, y: 100, width: 100, height: 0.5 },
        candidate: {
          type: 'line', parameters: { start: [100, 100], end: [200, 100] },
          fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.98,
        },
      }),
      piece({
        id: 'piece_bbbbbbbbbbbbbbbbbbbb', sampleRange: [2, 4],
        simplified: [[200, 100], [200, 300]],
        bounds: { x: 200, y: 100, width: 0.5, height: 200 },
        candidate: {
          type: 'line', parameters: { start: [200, 100], end: [200, 300] },
          fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.97,
        },
      }),
    ], {
      samples: [[100, 100], [150, 100], [200, 100], [200, 200], [200, 300]],
      simplified: [[100, 100], [200, 100], [200, 300]],
      bounds: { x: 100, y: 100, width: 100, height: 200 },
    });

    const [step] = buildVectorizationSteps(result);
    const geometryCreates = step.commands.filter((command) => command.type === 'geometry.create');
    const relationCreates = step.commands.filter((command) => command.type === 'relation.create');
    const featureCreates = step.commands.filter((command) => command.type === 'feature.create');

    expect(buildVectorizationSteps(result)).toHaveLength(1);
    expect(step).not.toHaveProperty('removedNodeIds');
    expect(step.previewNodes.map((node) => node.type)).toEqual(['line', 'line']);
    expect(geometryCreates).toHaveLength(2);
    expect(relationCreates).toHaveLength(1);
    expect(featureCreates).toHaveLength(1);
    expect(featureCreates[0]).toMatchObject({
      type: 'feature.create',
      value: {
        semanticType: 'compound-path',
        geometryIds: step.previewNodes.map((node) => node.id),
        properties: {
          sourceChainId: result.chains[0].id,
          ordered: true,
          closed: false,
          sampleRanges: [[0, 2], [2, 4]],
        },
      },
    });
    expect(relationCreates[0]).toMatchObject({
      value: {
        plane: 'topology', kind: 'connected',
        nodeIds: step.previewNodes.map((node) => node.id),
      },
    });
  });

  it('extends two fitted lines to their analytic intersection without restoring a Polyline', () => {
    const result = fixture([
      piece({
        id: 'piece_aaaaaaaaaaaaaaaaaaaa', sampleRange: [0, 2],
        simplified: [[100, 100], [200, 110]],
        bounds: { x: 100, y: 100, width: 100, height: 10 },
        candidate: {
          type: 'line', parameters: { start: [100, 100], end: [190, 100] },
          fitErrorMean: 0.5, fitErrorP95: 1, fitErrorMax: 1, confidence: 0.9,
        },
      }),
      piece({
        id: 'piece_bbbbbbbbbbbbbbbbbbbb', sampleRange: [2, 4],
        simplified: [[200, 110], [200, 300]],
        bounds: { x: 200, y: 110, width: 0.5, height: 190 },
        candidate: {
          type: 'line', parameters: { start: [200, 120], end: [200, 300] },
          fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
        },
      }),
    ], {
      samples: [[100, 100], [150, 100], [200, 110], [200, 200], [200, 300]],
      simplified: [[100, 100], [200, 110], [200, 300]],
      bounds: { x: 100, y: 100, width: 100, height: 200 },
    });

    const [step] = buildVectorizationSteps(result);
    const [left, right] = step.previewNodes;

    expect(step.previewNodes.map((node) => node.type)).toEqual(['line', 'line']);
    expect(left).toMatchObject({ type: 'line', start: [50, 350], end: [100, 350] });
    expect(right).toMatchObject({ type: 'line', start: [100, 350] });
    expect(step.validation).toMatchObject({ junctionGapMaxPx: 0 });
    expect(step.commands.filter((command) => command.type === 'relation.create')).toHaveLength(1);
    expect(step.commands.find((command) => command.type === 'feature.create')).toMatchObject({
      value: {
        properties: {
          junctions: [{ atMemberIndex: 0, point: [100, 350], kind: 'corner' }],
        },
      },
    });
  });

  it('keeps a single fallback Polyline as final geometry', () => {
    const result = fixture([piece({ candidate: null })]);

    const steps = buildVectorizationSteps(result);

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: 'final', previewNodes: [{ type: 'polyline' }] });
  });

  it('rejects an implausibly large analytic candidate', () => {
    const result = fixture([piece({
      closed: true, wraps: true,
      simplified: [[100, 100], [200, 100], [200, 200], [100, 200]],
      candidate: {
        type: 'circle', parameters: { center: [150, 150], radius: 3_000 },
        fitErrorMean: 0.1, fitErrorP95: 0.2, fitErrorMax: 0.3, confidence: 0.99,
      },
    })], {
      closed: true,
      simplified: [[100, 100], [200, 100], [200, 200], [100, 200]],
    });

    expect(buildVectorizationSteps(result)).toHaveLength(1);
    expect(buildVectorizationSteps(result)[0].previewNodes).toEqual([
      expect.objectContaining({ type: 'polyline' }),
    ]);
  });

  it('packs independent final chains into 48-node transactions without splitting a chain', () => {
    const base = fixture([piece({ candidate: null })]);
    base.chains = Array.from({ length: 97 }, (_, index) => ({
      ...structuredClone(base.chains[0]),
      id: `chain_${String(index).padStart(20, '0')}`,
      evidence: {
        ...structuredClone(base.chains[0].evidence),
        handle: `evidence_${String(index).padStart(24, '0')}`,
      },
      bounds: { x: index, y: 0, width: 1, height: 1 },
    }));

    const steps = buildVectorizationSteps(base);

    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.previewNodes.length)).toEqual([48, 48, 1]);
    expect(steps.map((step) => step.chainIds.length)).toEqual([48, 48, 1]);
    expect(steps.flatMap((step) => step.chainIds)).toHaveLength(97);
  });

  it('keeps a multi-piece chain atomic even when it exceeds the normal batch size', () => {
    const result = fixture(Array.from({ length: 50 }, (_, index) => piece({
      id: `piece_${String(index).padStart(20, '0')}`,
      sampleRange: [index, index + 1],
      simplified: [[index, 100], [index + 1, 100]],
      bounds: { x: index, y: 100, width: 1, height: 0.5 },
      candidate: {
        type: 'line', parameters: { start: [index, 100], end: [index + 1, 100] },
        fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.95,
      },
    })), {
      samples: Array.from({ length: 51 }, (_, index) => [index, 100] as const),
      simplified: [[0, 100], [50, 100]],
      bounds: { x: 0, y: 100, width: 50, height: 0.5 },
    });

    const steps = buildVectorizationSteps(result);

    expect(steps).toHaveLength(1);
    expect(steps[0].previewNodes).toHaveLength(50);
    expect(steps[0].commands.filter((command) => command.type === 'feature.create'))
      .toHaveLength(1);
  });
});

function piece(overrides: Partial<CleanLineStrokePiece> = {}): CleanLineStrokePiece {
  return {
    id: 'piece_0123456789abcdef0123',
    sampleRange: [0, 2], wraps: false, closed: false,
    simplified: [[100, 100], [200, 200]],
    bounds: { x: 100, y: 100, width: 100, height: 100 },
    candidate: null,
    ...overrides,
  };
}

function fixture(
  pieces: CleanLineStrokePiece[],
  overrides: Partial<PersistedCleanLineVectorizationResult['chains'][number]> = {},
): PersistedCleanLineVectorizationResult {
  const samples = overrides.samples ?? [[100, 100], [150, 150], [200, 200]];
  const bounds = overrides.bounds ?? { x: 100, y: 100, width: 100, height: 100 };
  return {
    sourceId: 'source_steps', pipelineVersion: 'fixture-v2',
    width: 1_000, height: 800, analysisScale: 1, medianLineWidthPx: 4,
    chains: [{
      id: 'chain_0123456789abcdef0123', closed: false,
      samples, simplified: overrides.simplified ?? [[100, 100], [200, 200]], bounds,
      pieces,
      segmentation: {
        algorithmVersion: 'fixture-v2', drawingDiagonalPx: 1280.625,
        chainLengthPx: 200, fitTolerancePx: 2, nearWindowPx: 8,
        farWindowPx: 16, minimumSpanPx: 16, splitPenalty: 1.5, decisions: [],
      },
      evidence: {
        handle: 'evidence_aaaaaaaaaaaaaaaaaaaaaaaa', sourceId: 'source_steps',
        regionId: 'vector_chain_0123456789abcdef0123', kind: 'polyline-candidate',
        bounds, confidence: 0.9, touchesRegionEdge: false, sampleCount: samples.length,
      },
      ...overrides,
    }],
  };
}
