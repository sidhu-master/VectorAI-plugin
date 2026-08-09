import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileCvEvidenceStore } from './evidence-store.js';
import {
  DrawingCvToolRegistry,
  type CvObservationRegion,
} from './tool-registry.js';
import type {
  CvEvidenceDraft,
  CvPrimitiveFit,
  CvSourceImage,
  DrawingCvProvider,
  SourcePixelRect,
} from './types.js';

let rootDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-cv-tools-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

describe('DrawingCvToolRegistry', () => {
  it('allows overlapping observation regions and keeps raw samples out of extraction output', async () => {
    const registry = createRegistry();
    const first = await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_a',
      bounds: { x: 0, y: 0, width: 80, height: 80 },
      purpose: 'geometry',
      targetSlotIds: ['slot_c1'],
      resolutionLevel: 1,
      attempt: 1,
    }));
    const second = await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_b',
      bounds: { x: 40, y: 20, width: 100, height: 80 },
      purpose: 'topology',
      targetSlotIds: ['slot_c1'],
      resolutionLevel: 1,
      attempt: 1,
    }));
    const extracted = await registry.invoke(invocation('cv_extract_evidence', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_a',
      budget: BUDGET,
    }));

    expect(first.receipt.status).toBe('succeeded');
    expect(second.receipt.status).toBe('succeeded');
    expect(overlaps(
      (first.output as CvObservationRegion).bounds,
      (second.output as CvObservationRegion).bounds,
    )).toBe(true);
    expect(JSON.stringify([first.output, second.output, extracted.output]))
      .not.toMatch(/samples|rgba|base64/);
    expect(extracted.receipt.evidenceHandles).toHaveLength(1);
    expect(extracted.output).toMatchObject({
      evidence: [expect.objectContaining({ kind: 'circle-candidate' })],
      suggestedFits: [{
        evidenceHandle: extracted.receipt.evidenceHandles[0],
        primitiveType: 'circle',
        documentParameters: { center: [100, 200], radius: 50 },
        documentFrame: { width: 500, height: 300 },
      }],
    });
  });

  it('provides a deterministic polyline suggestion for a generic contour', async () => {
    const regions = new Map<string, CvObservationRegion>();
    const registry = createRegistry({
      evidenceKind: 'contour',
      regions,
    });
    await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_contour',
      bounds: { x: 0, y: 0, width: 80, height: 80 },
      purpose: 'geometry', targetSlotIds: [], resolutionLevel: 1, attempt: 1,
    }));

    const extracted = await registry.invoke(invocation('cv_extract_evidence', {
      sourceId: SOURCE.sourceId, regionId: 'region_contour', budget: BUDGET,
    }));

    expect(extracted.output).toMatchObject({
      suggestedFits: [expect.objectContaining({ primitiveType: 'polyline' })],
    });
  });

  it('paginates evidence explicitly and fits from its server-side handle', async () => {
    const registry = createRegistry();
    await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_a',
      bounds: { x: 0, y: 0, width: 80, height: 80 },
      purpose: 'geometry',
      targetSlotIds: [],
      resolutionLevel: 1,
      attempt: 1,
    }));
    const extracted = await registry.invoke(invocation('cv_extract_evidence', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_a',
      budget: BUDGET,
    }));
    const [handle] = extracted.receipt.evidenceHandles;

    const page = await registry.invoke(invocation('cv_read_evidence_page', {
      handle,
      offset: 0,
      limit: 2,
    }));
    const fit = await registry.invoke(invocation('cv_fit_primitive', {
      handle,
      primitiveType: 'circle',
      budget: BUDGET,
    }));

    expect(page.output).toMatchObject({ total: 4, nextOffset: 2 });
    expect(fit.output).toMatchObject({
      primitiveType: 'circle',
      sampleCount: 4,
      sourceParameters: { center: [40, 40], radius: 20 },
      documentParameters: { center: [100, 200], radius: 50 },
      documentFrame: { width: 500, height: 300 },
    });
    expect(fit.receipt.evidenceHandles).toEqual([handle]);
  });

  it('deterministically downsamples oversized evidence to the fit budget', async () => {
    let fittedSamples: readonly (readonly [number, number])[] = [];
    const registry = createRegistry({
      sampleCount: 550,
      onFitSamples: (samples) => { fittedSamples = samples; },
    });
    await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_dense',
      bounds: { x: 0, y: 0, width: 200, height: 120 },
      purpose: 'geometry', targetSlotIds: [], resolutionLevel: 1, attempt: 1,
    }));
    const extracted = await registry.invoke(invocation('cv_extract_evidence', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_dense',
      budget: { ...BUDGET, maxSamplesPerResult: 500 },
    }));
    const fit = await registry.invoke(invocation('cv_fit_primitive', {
      handle: extracted.receipt.evidenceHandles[0],
      primitiveType: 'polyline',
      budget: { ...BUDGET, maxSamplesPerResult: 500 },
    }));

    expect(fit.receipt.status).toBe('succeeded');
    expect(fit.receipt.errorCodes).toEqual([]);
    expect(fittedSamples).toHaveLength(500);
    expect(fittedSamples[0]).toEqual([0, 0]);
    expect(fittedSamples.at(-1)).toEqual([149, 2]);
  });

  it('returns a bounded crop handle without exposing image bytes', async () => {
    const registry = createRegistry();
    await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_crop',
      bounds: { x: 20, y: 10, width: 100, height: 80 },
      purpose: 'inventory',
      targetSlotIds: [],
      resolutionLevel: 1,
      attempt: 1,
    }));

    const cropped = await registry.invoke(invocation('inspect_source_crop', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_crop',
      budget: BUDGET,
    }));

    expect(cropped.receipt).toMatchObject({
      status: 'succeeded', sourceId: SOURCE.sourceId, regionId: 'region_crop',
    });
    expect(cropped.output).toMatchObject({
      mediaHandle: 'crop_region_crop',
      sourceBounds: { x: 20, y: 10, width: 100, height: 80 },
    });
    expect(JSON.stringify(cropped.output)).not.toMatch(/base64|bytes|rgba/);
  });

  it('rejects invalid inputs but clamps oversized model budgets to server limits', async () => {
    const registry = createRegistry();
    await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_budgeted',
      bounds: { x: 0, y: 0, width: 200, height: 120 },
      purpose: 'geometry', targetSlotIds: [], resolutionLevel: 1, attempt: 1,
    }));
    const unknown = await registry.invoke(invocation('inspect_source_overview', {
      sourceId: SOURCE.sourceId,
      budget: BUDGET,
      imageBase64: 'forbidden',
    }));
    const invalid = await registry.invoke(invocation('create_observation_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_bad',
      bounds: { x: 190, y: 0, width: 20, height: 20 },
      purpose: 'geometry',
      targetSlotIds: [],
      resolutionLevel: 1,
      attempt: 1,
    }));
    const compare = await registry.invoke(invocation('compare_region', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_missing',
      revision: 'revision_1',
    }));
    const oversized = await registry.invoke(invocation('cv_extract_evidence', {
      sourceId: SOURCE.sourceId,
      regionId: 'region_budgeted',
      budget: {
        maxPixels: 3_000_000, maxResults: 500,
        maxSamplesPerResult: 9_000, timeoutMs: 30_000,
      },
    }));

    expect(unknown.receipt).toMatchObject({ status: 'rejected', errorCodes: ['INVALID_TOOL_INPUT'] });
    expect(invalid.receipt).toMatchObject({ status: 'rejected', errorCodes: ['CV_REGION_OUT_OF_BOUNDS'] });
    expect(compare.receipt).toMatchObject({
      status: 'failed',
      errorCodes: ['CV_CAPABILITY_UNAVAILABLE'],
      retry: { allowed: true, action: 'pause' },
    });
    expect(oversized.receipt).toMatchObject({
      status: 'succeeded', errorCodes: [],
      budget: {
        maxPixels: 1_000_000, maxResults: 16,
        maxSamplesPerResult: 2_048, timeoutMs: 10_000,
      },
    });
    expect(JSON.stringify([unknown.receipt, invalid.receipt, compare.receipt]))
      .not.toMatch(/forbidden|imageBase64/);
  });
});

const SOURCE: CvSourceImage = {
  sourceId: 'source_0123456789abcdef01234567',
  mimeType: 'image/png',
  bytes: new Uint8Array([1]),
  width: 200,
  height: 120,
};

const BUDGET = {
  maxPixels: 100_000,
  maxResults: 8,
  maxSamplesPerResult: 32,
  timeoutMs: 2_000,
};

function invocation(capability: Parameters<DrawingCvToolRegistry['invoke']>[0]['capability'], input: unknown) {
  return {
    toolCallId: `call_${capability}`,
    capability,
    runId: 'run_1',
    input,
    signal: new AbortController().signal,
  };
}

function createRegistry(options: {
  evidenceKind?: CvEvidenceDraft['kind'];
  regions?: Map<string, CvObservationRegion>;
  sampleCount?: number;
  onFitSamples?: (samples: readonly (readonly [number, number])[]) => void;
} = {}): DrawingCvToolRegistry {
  const regions = options.regions ?? new Map<string, CvObservationRegion>();
  const provider: DrawingCvProvider = {
    inspectOverview: async ({ source }) => ({
      width: source.width,
      height: source.height,
      componentCount: 1,
      foregroundBounds: { x: 20, y: 20, width: 60, height: 60 },
    }),
    extractEvidence: async ({ source, regionId, region }): Promise<CvEvidenceDraft[]> => [{
      sourceId: source.sourceId,
      regionId,
      kind: options.evidenceKind ?? 'circle-candidate',
      bounds: { ...region, width: Math.min(region.width, 60), height: Math.min(region.height, 60) },
      confidence: 0.9,
      touchesRegionEdge: false,
      samples: options.sampleCount === undefined
        ? [[20, 40], [40, 20], [60, 40], [40, 60]]
        : Array.from({ length: options.sampleCount }, (_, index) => (
          [index % SOURCE.width, Math.floor(index / SOURCE.width)] as const
        )),
    }],
    fitPrimitive: async ({ primitiveType, samples }): Promise<CvPrimitiveFit> => {
      options.onFitSamples?.(samples);
      return {
        primitiveType,
        parameters: { center: [40, 40], radius: 20 },
        bounds: { x: 20, y: 20, width: 40, height: 40 },
        sampleCount: samples.length,
        fitErrorP50: 0,
        fitErrorP95: 0,
        fitErrorMax: 0,
        outlierRatio: 0,
      };
    },
    close: async () => undefined,
  };
  return new DrawingCvToolRegistry({
    provider,
    evidenceStore: new FileCvEvidenceStore({
      rootDirectory,
      resolveSourceSize: async () => ({ width: 200, height: 120 }),
    }),
    sources: { read: async () => SOURCE },
    regions: {
      create: async (region) => {
        regions.set(region.id, structuredClone(region));
        return structuredClone(region);
      },
      read: async (regionId) => {
        const region = regions.get(regionId);
        if (!region) throw Object.assign(new Error('not found'), { code: 'CV_REGION_NOT_FOUND' });
        return structuredClone(region);
      },
    },
    crops: {
      create: async ({ source, regionId, bounds }) => ({
        mediaHandle: `crop_${regionId}`,
        sourceId: source.sourceId,
        regionId,
        mimeType: 'image/png',
        width: bounds.width,
        height: bounds.height,
        sourceBounds: { ...bounds },
      }),
    },
    now: (() => {
      let value = 100;
      return () => value += 5;
    })(),
  });
}

function overlaps(a: SourcePixelRect, b: SourcePixelRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}
