import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import type { DrawingId, GeometryId, GeometryNode, RevisionId } from '../../../src/drawing/index';
import type { PersistedCleanLineVectorizationResult } from '../drawing-vectorization/types';
import type { DrawingCvToolRegistry } from '../drawing-cv/tool-registry';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service';
import type { DrawingApplication } from '../drawing-application/application';
import { MODEL_DRAWING_TOOL_GUIDES } from './catalog';
import { DrawingGenerationTools } from './generation-tools';
import type { DrawingModelTools } from './drawing-tools';
import { ModelDrawingToolRegistry } from './registry';

const revision = 'revision_1' as RevisionId;

function setup(input: {
  redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
  vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
  application?: Pick<DrawingApplication, 'observeForAgent' | 'renderForVision'>;
  drawingTools?: Pick<DrawingModelTools, 'previewCandidate'>;
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
  it('publishes only generation capabilities that are actually executable', () => {
    const unavailable = new DrawingGenerationTools();
    const availableNames = unavailable.definitions.map((tool) => tool.name);

    expect(availableNames).toEqual(['recompute_annotations']);
    expect(availableNames).not.toContain('redraw_region');
    expect(availableNames).not.toContain('vectorize_image');
    expect(availableNames).not.toContain('fit_geometry');
    expect(availableNames).not.toContain('inspect_source_overview');
  });

  it('publishes exact Drawing Command and assertion syntax to the model', () => {
    const previewGuide = MODEL_DRAWING_TOOL_GUIDES.preview_transaction;
    const schema = JSON.stringify(previewGuide.inputSchema);

    expect(schema).toContain('geometry.update');
    expect(schema).toContain('geometry.create');
    expect(schema).toContain('annotation.delete');
    expect(schema).toContain('relation.update');
    expect(schema).toContain('feature.create');
    expect(schema).toContain('node.exists');
    expect(schema).toContain('document.valid');
    expect(schema).toContain('selection.count');
    expect(schema).not.toContain('update-node');
    expect(Buffer.byteLength(schema)).toBeLessThan(8_000);
    expect(previewGuide.description).toContain('line{start,end}');
    expect(previewGuide.description).toContain('polyline{vertices:');
    expect(previewGuide.description).toContain('closed}');
  });

  it('keeps server resource budgets out of the model-facing source tool contract', () => {
    const vectorizeSchema = MODEL_DRAWING_TOOL_GUIDES.vectorize_image.inputSchema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    const overviewSchema = MODEL_DRAWING_TOOL_GUIDES.inspect_source_overview.inputSchema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    const cropSchema = MODEL_DRAWING_TOOL_GUIDES.inspect_source_crop.inputSchema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    const evidenceSchema = MODEL_DRAWING_TOOL_GUIDES.extract_cv_evidence.inputSchema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    const fitSchema = MODEL_DRAWING_TOOL_GUIDES.fit_geometry.inputSchema as {
      required: string[];
      properties: Record<string, unknown>;
    };

    expect(vectorizeSchema.required).toEqual(['sourceId']);
    expect(Object.keys(vectorizeSchema.properties)).toEqual(['sourceId']);
    expect(overviewSchema.required).toEqual(['sourceId']);
    expect(Object.keys(overviewSchema.properties)).toEqual(['sourceId']);
    expect(cropSchema.required).toEqual(['sourceId', 'regionId']);
    expect(Object.keys(cropSchema.properties)).toEqual(['sourceId', 'regionId']);
    expect(evidenceSchema.required).toEqual(['sourceId', 'regionId']);
    expect(Object.keys(evidenceSchema.properties)).toEqual(['sourceId', 'regionId']);
    expect(fitSchema.required).toEqual(['evidenceHandle', 'primitiveType']);
    expect(Object.keys(fitSchema.properties)).toEqual(['evidenceHandle', 'primitiveType']);
  });

  it('returns redraw geometry as a candidate and never commits it', async () => {
    const rendered = await sharp({
      create: {
        width: 120, height: 120, channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    const observeForAgent = vi.fn(async () => ({
      drawingId: 'drawing_1' as DrawingId, revision, rendererVersion: 'scene-1.0' as const,
      selectedIds: ['arm'],
      vectorDigest: {
        unit: 'mm', counts: { geometry: 1, annotation: 0, relation: 0, feature: 0 },
        bounds: { minX: 0, minY: 0, maxX: 50, maxY: 50 }, nodes: [],
      },
      views: [{
        id: 'view_target', purpose: 'target-detail' as const, cacheKey: 'target',
        image: { handle: 'observation_target', mimeType: 'image/png' as const },
        width: 120, height: 120,
        worldBounds: { minX: -5, minY: -5, maxX: 55, maxY: 55 },
        worldToImage: [2, 0, 0, -2, 10, 110] as const,
        grounding: [],
      }],
    }));
    const renderForVision = vi.fn(async () => ({
      width: 120, height: 120,
      imageDataUrl: `data:image/png;base64,${rendered.toString('base64')}`,
      rendererVersion: 'scene-1.0' as const,
      worldToImage: [2, 0, 0, -2, 10, 110] as const,
      nodes: [],
    }));
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
    const { generation, invoke } = setup({
      redraw: { redraw },
      application: { observeForAgent, renderForVision },
    });

    const result = await invoke('redraw_region', {
      prompt: 'redraw this area with the requested shape',
      contours: [[[0, 0], [50, 0], [50, 50], [0, 50]]],
      holes: [],
      selectedIds: ['arm'],
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
    expect(observeForAgent).toHaveBeenCalledWith({
      drawingId: 'drawing_1', includeAnnotations: false,
      selectedIds: ['arm'], selectionIsTarget: true,
      targetBounds: { minX: 0, minY: 0, maxX: 50, maxY: 50 },
    });
    expect(redraw).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('redraw this area with the requested shape'),
      cropPng: rendered,
      maskPng: expect.any(Buffer),
      protectedMaskPng: expect.any(Buffer),
      cropPixelToWorld: [0.5, 0, 0, -0.5, -5, 55],
      authorizedContours: [[[0, 0], [50, 0], [50, 50], [0, 50]]],
      authorizedHoles: [],
      maxPixels: 14_400,
    }));
    expect(JSON.stringify(result.output)).not.toContain('PngBase64');
  });

  it('returns bounded vectorization batches and fitted primitives as model evidence', async () => {
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
    const previewCandidate = vi.fn(async () => ({
      status: 'ready' as const,
      previewHandle: 'preview_vector_batch_1',
      affectedNodeIds: ['node_vector_1'],
      candidate: false,
      validationValid: true,
      previewDelta: {
        upserts: [{
          id: 'node_vector_1' as GeometryId, type: 'line' as const, visible: true,
          quality: { status: 'confirmed' as const, evidenceRefs: ['evidence_1'] as never[] },
          start: [0, 0] as const, end: [10, 0] as const,
        } satisfies GeometryNode],
        removeIds: [],
      },
    }));
    const { generation, invoke } = setup({
      vectorization: { vectorizeSource },
      cvTools: { invoke: cvInvoke } as unknown as Pick<DrawingCvToolRegistry, 'invoke'>,
      drawingTools: { previewCandidate },
    });

    const vectorized = await invoke('vectorize_image', { sourceId: 'source_clean' });
    const vectorOutput = vectorized.output as {
      candidateHandle: string;
    };
    const batchPreview = await invoke('preview_vectorization_batch', {
      candidateHandle: vectorOutput.candidateHandle, batchIndex: 0,
    });
    const fitted = await invoke('fit_geometry', {
      evidenceHandle: 'evidence_circle', primitiveType: 'circle',
    });

    expect(vectorized.output).toMatchObject({
      candidateHandle: expect.stringMatching(/^generation_/),
      kind: 'vectorization', pipelineVersion: 'clean-v2',
      inventory: {
        chainCount: 1, batchCount: 1, vectorNodeCount: 1,
        geometryTypeCounts: { line: 1 },
      },
      batches: [{
        batchIndex: 0, chainCount: 1, nodeCount: 1,
        geometryTypeCounts: { line: 1 },
        confidence: 0.99,
      }],
    });
    expect(JSON.stringify(vectorized.output)).not.toContain('"samples"');
    expect(JSON.stringify(vectorized.output)).not.toContain('"simplified"');
    expect(JSON.stringify(vectorized.output)).not.toContain('"decisions"');
    expect(batchPreview.output).toMatchObject({
      kind: 'vectorization-batch',
      sourceCandidateHandle: vectorOutput.candidateHandle,
      batchIndex: 0,
      batchCount: 1,
      previewHandle: 'preview_vector_batch_1',
      completeAfterCommit: true,
      previewDelta: {
        upserts: [expect.objectContaining({ id: 'node_vector_1', type: 'line' })],
        removeIds: [],
      },
    });
    expect(previewCandidate).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run_generation',
      revision,
      commands: [expect.objectContaining({ type: 'geometry.create' })],
      evidenceRefs: ['evidence_1'],
    }));
    const prematureNextBatch = await invoke('preview_vectorization_batch', {
      candidateHandle: vectorOutput.candidateHandle, batchIndex: 1,
    });
    expect(prematureNextBatch.receipt).toMatchObject({
      status: 'rejected',
      error: { code: 'VECTORIZATION_BATCH_OUT_OF_ORDER', retryable: true },
    });
    expect(generation.advanceVectorizationBatch({
      runId: 'run_generation',
      candidateHandle: vectorOutput.candidateHandle,
      batchIndex: 0,
    })).toEqual({
      nextBatchIndex: 1, batchCount: 1, completed: true,
    });
    expect(fitted.output).toMatchObject({
      candidateHandle: expect.stringMatching(/^generation_/),
      kind: 'fit', primitiveType: 'circle', parameters: { center: [5, 5], radius: 4 },
    });
    expect(vectorizeSource).toHaveBeenCalledWith({
      sourceId: 'source_clean', signal: expect.any(AbortSignal),
    });
    expect(cvInvoke).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'cv_fit_primitive',
      input: {
        handle: 'evidence_circle', primitiveType: 'circle',
        budget: {
          maxPixels: 1_000_000, maxResults: 16,
          maxSamplesPerResult: 2_048, timeoutMs: 10_000,
        },
      },
    }));
    expect(generation.snapshot()).toEqual({ candidateCount: 2, commitCount: 0 });
  });

  it('rejects an empty vectorization result instead of publishing a false-success candidate', async () => {
    const vectorizeSource = vi.fn(async (): Promise<PersistedCleanLineVectorizationResult> => ({
      sourceId: 'source_empty', pipelineVersion: 'clean-v2', width: 100, height: 80,
      analysisScale: 1, medianLineWidthPx: 0, chains: [],
    }));
    const { generation, invoke } = setup({ vectorization: { vectorizeSource } });

    const result = await invoke('vectorize_image', { sourceId: 'source_empty' });

    expect(result.receipt).toMatchObject({
      status: 'rejected',
      error: { code: 'NO_VECTOR_CHAINS', retryable: true, suggestedAction: 'replan' },
    });
    expect(result.output).toBeUndefined();
    expect(generation.snapshot()).toEqual({ candidateCount: 0, commitCount: 0 });
  });

  it('exposes bounded source CV inspection as direct model tools', async () => {
    const cvInvoke = vi.fn(async (invocation: Parameters<DrawingCvToolRegistry['invoke']>[0]) => ({
      receipt: {
        schemaVersion: 1, toolCallId: invocation.toolCallId,
        capability: invocation.capability, capabilityVersion: '1.0.0' as const,
        runId: invocation.runId, inputDigest: 'digest', slotIds: [], evidenceHandles: [],
        durationMs: 2, status: 'succeeded' as const, errorCodes: [], retry: { allowed: false },
      },
      output: invocation.capability === 'inspect_source_overview'
        ? { width: 100, height: 80, componentCount: 4 }
        : { ok: true },
    }));
    const { invoke } = setup({
      cvTools: { invoke: cvInvoke } as unknown as Pick<DrawingCvToolRegistry, 'invoke'>,
    });

    const result = await invoke('inspect_source_overview', { sourceId: 'source_clean' });

    expect(result).toMatchObject({
      receipt: { status: 'succeeded', tool: 'inspect_source_overview' },
      output: { width: 100, height: 80, componentCount: 4 },
    });
    expect(cvInvoke).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'inspect_source_overview',
      input: {
        sourceId: 'source_clean',
        budget: {
          maxPixels: 2_000_000, maxResults: 256,
          maxSamplesPerResult: 2_048, timeoutMs: 10_000,
        },
      },
    }));
  });

  it('adds capability-specific budgets to model-selected crop and evidence scopes', async () => {
    const cvInvoke = vi.fn(async (invocation: Parameters<DrawingCvToolRegistry['invoke']>[0]) => ({
      receipt: {
        schemaVersion: 1, toolCallId: invocation.toolCallId,
        capability: invocation.capability, capabilityVersion: '1.0.0' as const,
        runId: invocation.runId, inputDigest: 'digest', slotIds: [], evidenceHandles: [],
        durationMs: 1, status: 'succeeded' as const, errorCodes: [], retry: { allowed: false },
      },
      output: { ok: true },
    }));
    const { invoke } = setup({
      cvTools: { invoke: cvInvoke } as unknown as Pick<DrawingCvToolRegistry, 'invoke'>,
    });

    await invoke('inspect_source_crop', { sourceId: 'source_clean', regionId: 'region_1' });
    await invoke('extract_cv_evidence', { sourceId: 'source_clean', regionId: 'region_1' });

    expect(cvInvoke).toHaveBeenNthCalledWith(1, expect.objectContaining({
      capability: 'inspect_source_crop',
      input: {
        sourceId: 'source_clean', regionId: 'region_1',
        budget: {
          maxPixels: 2_000_000, maxResults: 8,
          maxSamplesPerResult: 2_048, timeoutMs: 10_000,
        },
      },
    }));
    expect(cvInvoke).toHaveBeenNthCalledWith(2, expect.objectContaining({
      capability: 'cv_extract_evidence',
      input: {
        sourceId: 'source_clean', regionId: 'region_1',
        budget: {
          maxPixels: 1_000_000, maxResults: 16,
          maxSamplesPerResult: 2_048, timeoutMs: 10_000,
        },
      },
    }));
  });

  it('rejects model-supplied resource budgets before invoking CV', async () => {
    const cvInvoke = vi.fn();
    const { invoke } = setup({
      cvTools: { invoke: cvInvoke } as unknown as Pick<DrawingCvToolRegistry, 'invoke'>,
    });

    const result = await invoke('inspect_source_overview', {
      sourceId: 'source_clean', budget: { maxPixels: 4_096 },
    });

    expect(result.receipt).toMatchObject({
      status: 'rejected', error: { code: 'TOOL_INPUT_INVALID', retryable: true },
    });
    expect(cvInvoke).not.toHaveBeenCalled();
  });

  it('returns provider failure and never invokes an automatic geometric fallback', async () => {
    const redraw = vi.fn(async () => { throw new Error('IMAGE_MODEL_UNAVAILABLE'); });
    const fallbackTransform = vi.fn();
    const rendered = await sharp({
      create: {
        width: 20, height: 20, channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    const { generation, invoke } = setup({
      redraw: { redraw },
      application: {
        observeForAgent: vi.fn(async () => ({
          drawingId: 'drawing_1' as DrawingId, revision, rendererVersion: 'scene-1.0' as const,
          selectedIds: [],
          vectorDigest: {
            unit: 'mm', counts: { geometry: 0, annotation: 0, relation: 0, feature: 0 },
            bounds: null, nodes: [],
          },
          views: [{
            id: 'view_target', purpose: 'target-detail' as const, cacheKey: 'target',
            image: { handle: 'observation_target', mimeType: 'image/png' as const },
            width: 20, height: 20,
            worldBounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
            worldToImage: [1, 0, 0, -1, 0, 20] as const,
            grounding: [],
          }],
        })),
        renderForVision: vi.fn(async () => ({
          width: 20, height: 20,
          imageDataUrl: `data:image/png;base64,${rendered.toString('base64')}`,
          rendererVersion: 'scene-1.0' as const,
          worldToImage: [1, 0, 0, -1, 0, 20] as const,
          nodes: [],
        })),
      },
    });
    const result = await invoke('redraw_region', {
      prompt: 'redraw',
      contours: [[[0, 0], [20, 0], [20, 20], [0, 20]]],
      holes: [],
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
