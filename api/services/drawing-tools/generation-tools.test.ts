import { describe, expect, it, vi } from 'vitest';

import type { GeometryId, GeometryNode, RevisionId } from '../../../src/drawing/index';
import type { PersistedCleanLineVectorizationResult } from '../drawing-vectorization/types';
import type { DrawingCvToolRegistry } from '../drawing-cv/tool-registry';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service';
import { DrawingGenerationTools } from './generation-tools';
import { ModelDrawingToolRegistry } from './registry';

const revision = 'revision_1' as RevisionId;

function setup(input: {
  redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
  vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
} = {}) {
  const generation = new DrawingGenerationTools(input);
  const registry = new ModelDrawingToolRegistry({
    tools: generation.definitions,
    getCurrentRevision: async () => revision,
  });
  let call = 0;
  const invoke = (tool: string, toolInput: unknown) => registry.invoke({
    runId: 'run_generation', episodeId: 'episode_generation',
    drawingId: 'drawing_1' as never, revision,
    toolCallId: `call_${++call}`, tool, input: toolInput,
  });
  return { generation, invoke };
}

describe('DrawingGenerationTools', () => {
  it('returns redraw geometry as a candidate and never commits it', async () => {
    const redraw = vi.fn(async () => ({
      generatedSource: {
        sourceId: 'source_generated', sha256: 'a'.repeat(64),
        mimeType: 'image/png' as const, byteLength: 10, page: 1,
      },
      providerRequestId: 'provider_request_1',
      pipelineVersion: 'vector-v1',
      geometry: [{
        id: 'generated_line' as GeometryId, type: 'line' as const, visible: true,
        quality: { status: 'candidate', confidence: 0.84, evidenceRefs: [] },
        start: [0, 0] as const, end: [10, 10] as const,
      } satisfies GeometryNode],
    }));
    const { generation, invoke } = setup({ redraw: { redraw } });

    const result = await invoke('redraw_region', {
      prompt: 'redraw this area with the requested shape',
      cropPngBase64: Buffer.from('crop').toString('base64'),
      maskPngBase64: Buffer.from('mask').toString('base64'),
      protectedMaskPngBase64: Buffer.from('protected').toString('base64'),
      cropPixelToWorld: [1, 0, 0, -1, 0, 100],
      contours: [[[0, 0], [100, 0], [100, 100], [0, 100]]],
      holes: [], seed: 12, maxPixels: 100_000,
    });

    expect(result).toMatchObject({
      receipt: { status: 'succeeded', affectedNodeIds: ['generated_line'] },
      output: {
        candidateHandle: expect.stringMatching(/^generation_/),
        kind: 'redraw', providerRequestId: 'provider_request_1',
        geometry: [expect.objectContaining({ id: 'generated_line', type: 'line' })],
      },
    });
    expect(generation.snapshot()).toEqual({ candidateCount: 1, commitCount: 0 });
    expect(JSON.stringify(result.output)).not.toContain('cropPngBase64');
  });

  it('returns vectorization chains and fitted primitives as model evidence', async () => {
    const vectorizeSource = vi.fn(async (): Promise<PersistedCleanLineVectorizationResult> => ({
      sourceId: 'source_clean', pipelineVersion: 'clean-v2', width: 100, height: 80,
      analysisScale: 1, medianLineWidthPx: 2,
      chains: [{
        id: 'chain_1', closed: false,
        samples: [[0, 0] as const, [10, 0] as const],
        simplified: [[0, 0] as const, [10, 0] as const],
        bounds: { x: 0, y: 0, width: 10, height: 1 },
        pieces: [{
          id: 'piece_1', sampleRange: [0, 1] as [number, number], wraps: false, closed: false,
          simplified: [[0, 0] as const, [10, 0] as const], bounds: { x: 0, y: 0, width: 10, height: 1 },
          candidate: {
            type: 'line', parameters: { start: [0, 0], end: [10, 0] },
            fitErrorMean: 0, fitErrorP95: 0, fitErrorMax: 0, confidence: 0.99,
          },
        }],
        segmentation: {
          algorithmVersion: 'fixture', drawingDiagonalPx: 1, chainLengthPx: 10,
          fitTolerancePx: 1, nearWindowPx: 1, farWindowPx: 2,
          minimumSpanPx: 1, splitPenalty: 1, decisions: [],
        },
        evidence: {
          handle: 'evidence_1', sourceId: 'source_clean', regionId: 'vector_chain_1',
          kind: 'line-candidate' as const,
          bounds: { x: 0, y: 0, width: 10, height: 1 }, confidence: 0.99,
          touchesRegionEdge: false, sampleCount: 2,
        },
      }],
    }));
    const cvInvoke = vi.fn(async () => ({
      receipt: { status: 'succeeded', errorCodes: [] },
      output: {
        primitiveType: 'circle', parameters: { center: [5, 5], radius: 4 },
        bounds: { x: 1, y: 1, width: 8, height: 8 },
        sampleCount: 64, fitErrorP50: 0.1, fitErrorP95: 0.2, fitErrorMax: 0.3,
        outlierRatio: 0,
      },
    }));
    const { generation, invoke } = setup({
      vectorization: { vectorizeSource },
      cvTools: { invoke: cvInvoke } as unknown as Pick<DrawingCvToolRegistry, 'invoke'>,
    });

    const vectorized = await invoke('vectorize_image', {
      sourceId: 'source_clean', maxPixels: 100_000,
    });
    const fitted = await invoke('fit_geometry', {
      evidenceHandle: 'evidence_circle', primitiveType: 'circle',
      budget: { maxPixels: 100_000, maxResults: 2, maxSamplesPerResult: 512, timeoutMs: 5_000 },
    });

    expect(vectorized.output).toMatchObject({
      candidateHandle: expect.stringMatching(/^generation_/),
      kind: 'vectorization', pipelineVersion: 'clean-v2',
      chains: [expect.objectContaining({
        id: 'chain_1', evidence: expect.objectContaining({ handle: 'evidence_1' }),
      })],
    });
    expect(fitted.output).toMatchObject({
      candidateHandle: expect.stringMatching(/^generation_/),
      kind: 'fit', primitiveType: 'circle', parameters: { center: [5, 5], radius: 4 },
    });
    expect(generation.snapshot()).toEqual({ candidateCount: 2, commitCount: 0 });
  });

  it('returns provider failure and never invokes an automatic geometric fallback', async () => {
    const redraw = vi.fn(async () => { throw new Error('IMAGE_MODEL_UNAVAILABLE'); });
    const fallbackTransform = vi.fn();
    const { generation, invoke } = setup({ redraw: { redraw } });
    generation.setFallbackProbeForTest(fallbackTransform);

    const result = await invoke('redraw_region', {
      prompt: 'redraw',
      cropPngBase64: Buffer.from('crop').toString('base64'),
      maskPngBase64: Buffer.from('mask').toString('base64'),
      protectedMaskPngBase64: Buffer.from('protected').toString('base64'),
      cropPixelToWorld: [1, 0, 0, -1, 0, 100],
      contours: [[[0, 0], [100, 0], [100, 100], [0, 100]]],
      holes: [], seed: 12, maxPixels: 100_000,
    });

    expect(result.receipt).toMatchObject({
      status: 'failed', error: { code: 'TOOL_EXECUTION_FAILED', retryable: true },
    });
    expect(fallbackTransform).not.toHaveBeenCalled();
    expect(generation.snapshot()).toEqual({ candidateCount: 0, commitCount: 0 });
  });

  it('recomputes annotation proposals without mutating the drawing', async () => {
    const { generation, invoke } = setup();

    const result = await invoke('recompute_annotations', {
      geometry: [{
        id: 'line_1', type: 'line', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, start: [0, 0], end: [10, 0],
      }],
      existingAnnotations: [],
      mode: 'propose',
    });

    expect(result.output).toMatchObject({
      candidateHandle: expect.stringMatching(/^generation_/),
      kind: 'annotations',
      proposals: [expect.objectContaining({
        type: 'dimension', dimensionKind: 'aligned', computedValue: 10,
      })],
    });
    expect(generation.snapshot()).toEqual({ candidateCount: 1, commitCount: 0 });
  });
});
