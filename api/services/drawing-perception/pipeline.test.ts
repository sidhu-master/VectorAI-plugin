import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DrawingAssetCache, type DrawingImageCropper } from './assets.js';
import { FileDrawingObservationStore } from './observation-store.js';
import {
  DrawingPerceptionPipeline,
  type DrawingPerceptionOutput,
  type DrawingVisionToolset,
} from './pipeline.js';

let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'vectorai-perception-'));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('DrawingPerceptionPipeline', () => {
  it('orchestrates two views, parallelizes view tools, persists safe records, and releases media', async () => {
    let activeCalls = 0;
    let maxActiveCalls = 0;
    const duringCall = async <T>(value: T): Promise<T> => {
      activeCalls += 1;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      await Promise.resolve();
      activeCalls -= 1;
      return value;
    };
    const crop = vi.fn<DrawingImageCropper['crop']>(async ({ mimeType, image }) => ({ mimeType, image }));
    const assets = new DrawingAssetCache({
      preparer: { prepare: async ({ image, mimeType }) => ({ image, mimeType }) },
      cropper: { crop },
    });
    const vision: DrawingVisionToolset = {
      analyzeSheet: vi.fn<DrawingVisionToolset['analyzeSheet']>(
        async () => ({ unit: 'mm', scale: 1, warnings: [] }),
      ),
      segmentViews: vi.fn<DrawingVisionToolset['segmentViews']>(async () => [
        { id: 'view_primary', kind: 'primary', imageBounds: [0, 0, 0.5, 1], confidence: 0.95 },
        { id: 'view_detail', kind: 'detail', imageBounds: [0.5, 0, 0.5, 1], confidence: 0.88 },
      ]),
      detectDatums: vi.fn<DrawingVisionToolset['detectDatums']>(
        async ({ viewId }) => duringCall(viewId?.startsWith('view_primary') ? [{
        id: 'datum_axis', viewId, type: 'line', imageBounds: [0.1, 0.5, 0.8, 0.01],
        measuredParams: { start: [0.1, 0.5], end: [0.9, 0.5] }, confidence: 0.86,
      }] : []),
      ),
      detectGeometry: vi.fn<DrawingVisionToolset['detectGeometry']>(
        async ({ viewId }) => duringCall(viewId?.startsWith('view_primary') ? [{
        id: 'primary_circle', viewId, type: 'circle', imageBounds: [0.3, 0.3, 0.4, 0.4],
        measuredParams: { center: [0.5, 0.5], radius: 0.2 }, confidence: 0.91,
      }] : [{
        id: 'detail_circle', viewId, type: 'circle', imageBounds: [0.2, 0.2, 0.2, 0.2],
        measuredParams: { center: [0.3, 0.3], radius: 0.1 }, confidence: 0.55,
      }]),
      ),
      extractAnnotations: vi.fn<DrawingVisionToolset['extractAnnotations']>(
        async ({ viewId }) => duringCall(viewId?.startsWith('view_primary') ? [{
        id: 'diameter_40', viewId, kind: 'diameter', rawText: 'Ø40', value: 40, unit: 'mm',
        imageBounds: [0.42, 0.72, 0.16, 0.06], arrowheads: [[0.5, 0.7]], confidence: 0.82,
      }] : [{
        id: 'detail_note', viewId, kind: 'text', rawText: 'DETAIL A',
        imageBounds: [0.1, 0.8, 0.4, 0.08], arrowheads: [], confidence: 0.76,
      }]),
      ),
    };
    const pipeline = new DrawingPerceptionPipeline({
      assets,
      vision,
      observationStore: new FileDrawingObservationStore(rootDir),
      maxConcurrentViews: 2,
    });
    const controller = new AbortController();

    const outputs = await collect(pipeline.run({
      runId: 'run_two_views', page: 1, image: Buffer.from('drawing').toString('base64'),
      mimeType: 'image/png', modelName: 'doubao-seed-2.0-lite',
      signal: controller.signal, deadlineAt: Date.now() + 60_000,
    }));

    expect(outputs.filter(isStage).map((output) => output.stage)).toEqual([
      'asset_prepared', 'sheet_analyzed', 'views_segmented',
      'view_perceived', 'view_perceived', 'topology_built',
      'dimensions_associated', 'patches_built', 'completed',
    ]);
    expect(outputs.filter(isBatch).length).toBeGreaterThanOrEqual(4);
    expect(crop).toHaveBeenCalledTimes(2);
    expect(maxActiveCalls).toBeGreaterThanOrEqual(2);
    expect(assets.metadata('run_two_views')).toEqual([]);

    const geometry = JSON.parse(await readFile(
      join(rootDir, 'run_two_views', 'drawing', 'geometry.json'), 'utf8',
    ));
    const associations = JSON.parse(await readFile(
      join(rootDir, 'run_two_views', 'drawing', 'associations.json'), 'utf8',
    ));
    expect(geometry.map((item: { id: string }) => item.id)).toEqual([
      'view_detail_region_1__detail_circle',
      'view_primary_datums__datum_axis',
      'view_primary_region_1__primary_circle',
    ]);
    expect(associations).toMatchObject([{
      annotationId: 'view_primary_region_1__diameter_40', status: 'resolved',
      targets: [{ geometryObservationId: 'view_primary_region_1__primary_circle' }],
    }]);
    expect(JSON.stringify({ outputs, geometry, associations })).not.toMatch(
      /base64|prompt|token|"image":/i,
    );
  });

  it('releases run-scoped assets when cancelled', async () => {
    const assets = new DrawingAssetCache({
      preparer: { prepare: async ({ image, mimeType }) => ({ image, mimeType }) },
    });
    const controller = new AbortController();
    controller.abort(new Error('cancelled by user'));
    const pipeline = new DrawingPerceptionPipeline({ assets, vision: inertVision() });

    await expect(collect(pipeline.run({
      runId: 'run_cancelled', page: 1, image: 'eA==', mimeType: 'image/png',
      modelName: 'doubao-seed-2.0-lite', signal: controller.signal,
      deadlineAt: Date.now() + 60_000,
    }))).rejects.toThrow('cancelled by user');
    expect(assets.metadata('run_cancelled')).toEqual([]);
  });

  it('rejects media bodies in local observation records', async () => {
    const store = new FileDrawingObservationStore(rootDir);
    await expect(store.save('run_safe', 'geometry', [{ image: 'raw-media' }]))
      .rejects.toThrow(/media|敏感/i);
  });

  it('retries a failed view tool once and keeps valid geometry when OCR still fails', async () => {
    const assets = new DrawingAssetCache({
      preparer: { prepare: async ({ image, mimeType }) => ({ image, mimeType }) },
      cropper: { crop: async ({ image, mimeType }) => ({ image, mimeType }) },
    });
    const extractAnnotations = vi.fn<DrawingVisionToolset['extractAnnotations']>(async () => {
      throw new Error('malformed annotation JSON');
    });
    const vision: DrawingVisionToolset = {
      analyzeSheet: async () => ({ warnings: [] }),
      segmentViews: async () => [{
        id: 'view_1', kind: 'primary', imageBounds: [0, 0, 0.8, 0.8], confidence: 0.9,
      }],
      detectDatums: async () => [],
      detectGeometry: async ({ viewId }) => [{
        id: 'circle_safe', viewId: viewId!, type: 'circle', imageBounds: [0.2, 0.2, 0.2, 0.2],
        measuredParams: { center: [0.3, 0.3], radius: 0.1 }, confidence: 0.9,
      }],
      extractAnnotations,
    };
    const store = new FileDrawingObservationStore(rootDir);
    const pipeline = new DrawingPerceptionPipeline({ assets, vision, observationStore: store });

    const outputs = await collect(pipeline.run({
      runId: 'run_partial_view', page: 1, image: 'eA==', mimeType: 'image/png',
      modelName: 'doubao-seed-2.0-lite', signal: new AbortController().signal,
      deadlineAt: Date.now() + 60_000,
    }));

    expect(extractAnnotations).toHaveBeenCalledTimes(2);
    expect(outputs.some((output) => output.kind === 'command_batch'
      && output.batch.observationIds.some((id) => id.endsWith('__circle_safe')))).toBe(true);
    expect(outputs.at(-1)).toMatchObject({ kind: 'stage', stage: 'completed' });
    expect(await store.read('run_partial_view', 'perception-errors')).toEqual([{
      viewId: 'view_1', tool: 'extract_annotations', message: 'malformed annotation JSON',
    }]);
  });

  it('perceives a page-sized portrait view through three stitched regions', async () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(1200, 16);
    png.writeUInt32BE(1800, 20);
    const geometryCalls: string[] = [];
    const annotationCalls: string[] = [];
    let datumCalls = 0;
    const vision: DrawingVisionToolset = {
      analyzeSheet: async () => ({ warnings: [] }),
      segmentViews: async () => [{
        id: 'view_full', kind: 'primary', imageBounds: [0.02, 0.02, 0.96, 0.96], confidence: 0.95,
      }],
      detectDatums: async ({ viewId }) => {
        datumCalls += 1;
        return [{
          id: 'axis', viewId: viewId!, type: 'xline', imageBounds: [0.49, 0, 0.02, 1],
          measuredParams: { origin: [0.5, 0], direction: [0, 1] }, confidence: 0.9,
        }];
      },
      detectGeometry: async ({ viewId }) => {
        geometryCalls.push(viewId!);
        return [{
          id: 'circle', viewId: viewId!, type: 'circle', imageBounds: [0.4, 0.4, 0.2, 0.2],
          measuredParams: { center: [0.5, 0.5], radius: 0.1 }, confidence: 0.9,
        }];
      },
      extractAnnotations: async ({ viewId }) => {
        annotationCalls.push(viewId!);
        return [];
      },
    };
    const assets = new DrawingAssetCache({
      preparer: { prepare: async ({ image, mimeType }) => ({ image, mimeType }) },
      cropper: { crop: async () => ({ image: png.toString('base64'), mimeType: 'image/png' }) },
    });
    const store = new FileDrawingObservationStore(rootDir);
    const pipeline = new DrawingPerceptionPipeline({ assets, vision, observationStore: store });

    const outputs = await collect(pipeline.run({
      runId: 'run_regions', page: 1, image: png.toString('base64'), mimeType: 'image/png',
      modelName: 'doubao-seed-2.0-lite', signal: new AbortController().signal,
      deadlineAt: Date.now() + 60_000,
    }));

    expect(datumCalls).toBe(1);
    expect(geometryCalls.sort()).toEqual([
      'view_full_region_1', 'view_full_region_2', 'view_full_region_3',
    ]);
    expect(annotationCalls.sort()).toEqual(geometryCalls);
    const geometry = await store.read<Array<{
      id: string;
      viewId: string;
      measuredParams: { center?: [number, number] };
    }>>('run_regions', 'geometry');
    expect(geometry).toHaveLength(4);
    expect(geometry.every((item) => item.viewId === 'view_full')).toBe(true);
    expect(geometry.filter((item) => item.measuredParams.center)
      .map((item) => item.measuredParams.center![1])).toEqual(expect.arrayContaining([
      expect.any(Number),
    ]));
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'stage', stage: 'view_perceived', detail: expect.objectContaining({ regionCount: 3 }),
    }));
  });

  it('builds whole-view contours before refinement and never promotes crop arcs to geometry', async () => {
    const evidenceCalls: string[] = [];
    const detectGeometry = vi.fn(async () => []);
    const detectContourEvidence = vi.fn(async () => []);
    const vision = {
      analyzeSheet: async () => ({ warnings: [] }),
      segmentViews: async () => [{
        id: 'view_full', kind: 'primary', imageBounds: [0, 0, 1, 1], confidence: 0.95,
      }],
      detectDatums: async () => [],
      detectGlobalContours: async ({ viewId }: { viewId?: string }) => [{
        id: 'outer_circle', viewId: viewId!, geometryFamily: 'circle',
        imageBounds: [0.1, 0.1, 0.8, 0.8], closed: true, confidence: 0.94,
        coarseParams: { center: [0.5, 0.5], radius: 0.4 },
      }],
      detectGeometry,
      extractAnnotations: async () => [],
      detectContourEvidence,
      detectRegionalGeometry: async ({ viewId }: { viewId?: string }) => {
        evidenceCalls.push(viewId!);
        return {
          geometry: [{
            id: 'misread_fragment', viewId: viewId!, type: 'arc',
            imageBounds: [0, 0.1, 1, 0.8],
            measuredParams: {
              center: [0.5, 0.5], radius: 0.4, startAngle: 90, endAngle: 270,
              counterClockwise: true,
            },
            confidence: 0.82,
          }],
          evidence: [{
            id: 'outer_fragment', viewId: viewId!, globalContourId: 'view_full_global__outer_circle',
            imageBounds: [0, 0.1, 1, 0.8],
            samplePoints: [[0, 0.5], [0.5, 0.1], [1, 0.5]],
            confidence: 0.88, touchesCropEdge: true,
          }],
        };
      },
      assessCoverage: async ({ viewId }: { viewId?: string }) => ({
        complete: viewId !== 'view_full_region_1', confidence: 0.9,
        unreadBounds: viewId === 'view_full_region_1' ? [[0, 0, 1, 1]] : [],
        reasons: viewId === 'view_full_region_1' ? ['需要放大复核左侧轮廓'] : [],
      }),
    } as DrawingVisionToolset;
    const assets = new DrawingAssetCache({
      preparer: { prepare: async ({ image, mimeType }) => ({ image, mimeType }) },
      cropper: { crop: async ({ image, mimeType }) => ({ image, mimeType }) },
    });
    const store = new FileDrawingObservationStore(rootDir);
    const pipeline = new DrawingPerceptionPipeline({
      assets, vision, observationStore: store, maxRefinementDepth: 2,
    });

    const outputs = await collect(pipeline.run({
      runId: 'run_outline_first', page: 1, image: 'eA==', mimeType: 'image/png',
      modelName: 'doubao-seed-2.0-lite', signal: new AbortController().signal,
      deadlineAt: Date.now() + 60_000,
    }));

    const geometry = await store.read<Array<{ type: string; id: string }>>(
      'run_outline_first', 'geometry',
    );
    const ledger = await store.read<{
      complete: boolean;
      regions: Array<{ id: string; parentId?: string; status: string }>;
    }>('run_outline_first', 'coverage-ledger');
    expect(geometry).toEqual([expect.objectContaining({
      id: 'global_contour_view_full_global__outer_circle', type: 'circle',
    })]);
    expect(geometry.some((item) => item.type === 'arc')).toBe(false);
    expect(evidenceCalls).toEqual(expect.arrayContaining([
      'view_full_region_1',
      'view_full_region_1_focus_1',
    ]));
    expect(detectGeometry).not.toHaveBeenCalled();
    expect(detectContourEvidence).not.toHaveBeenCalled();
    expect(ledger.complete).toBe(true);
    expect(ledger.regions.filter((region) => region.parentId === 'view_full_region_1')).toHaveLength(1);
    expect(outputs.filter(isStage).map((output) => output.stage)).toEqual(expect.arrayContaining([
      'global_contours_built', 'coverage_assessed', 'coverage_completed',
    ]));
    expect(JSON.stringify(ledger)).not.toMatch(/doubao|seed|base64|prompt|token|"image":/i);
  });

  it('retains valid observations and reports budget exhaustion when coverage assessment fails', async () => {
    const assessCoverage = vi.fn(async () => {
      throw new Error('coverage response malformed');
    });
    const vision = {
      analyzeSheet: async () => ({ warnings: [] }),
      segmentViews: async () => [{
        id: 'view_detail', kind: 'detail', imageBounds: [0, 0, 0.5, 0.5], confidence: 0.9,
      }],
      detectDatums: async () => [],
      detectGlobalContours: async () => [],
      detectGeometry: async ({ viewId }: { viewId?: string }) => [{
        id: 'small_circle', viewId: viewId!, type: 'circle', imageBounds: [0.2, 0.2, 0.2, 0.2],
        measuredParams: { center: [0.3, 0.3], radius: 0.1 }, confidence: 0.9,
      }],
      extractAnnotations: async () => [],
      detectContourEvidence: async () => [],
      assessCoverage,
    } as DrawingVisionToolset;
    const assets = new DrawingAssetCache({
      preparer: { prepare: async ({ image, mimeType }) => ({ image, mimeType }) },
      cropper: { crop: async ({ image, mimeType }) => ({ image, mimeType }) },
    });
    const store = new FileDrawingObservationStore(rootDir);
    const pipeline = new DrawingPerceptionPipeline({
      assets, vision, observationStore: store, maxRefinementDepth: 1,
    });

    const outputs = await collect(pipeline.run({
      runId: 'run_exhausted', page: 1, image: 'eA==', mimeType: 'image/png',
      modelName: 'doubao-seed-2.0-lite', signal: new AbortController().signal,
      deadlineAt: Date.now() + 60_000,
    }));

    const geometry = await store.read<Array<{ id: string }>>('run_exhausted', 'geometry');
    const ledger = await store.read<{
      complete: boolean;
      regions: Array<{ status: string; refinementReasons: string[] }>;
    }>('run_exhausted', 'coverage-ledger');
    expect(assessCoverage).toHaveBeenCalledTimes(2);
    expect(geometry).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringContaining('small_circle') }),
    ]));
    expect(ledger.complete).toBe(false);
    expect(ledger.regions[0]).toMatchObject({
      status: 'refine',
      refinementReasons: expect.arrayContaining(['assessment_unavailable']),
    });
    expect(ledger.regions.slice(1)).toEqual([
      expect.objectContaining({
        status: 'budget_exhausted',
        refinementReasons: expect.arrayContaining(['model_incomplete', 'max_depth']),
      }),
      expect.objectContaining({
        status: 'budget_exhausted',
        refinementReasons: expect.arrayContaining(['model_incomplete', 'max_depth']),
      }),
    ]);
    expect(outputs.at(-1)).toMatchObject({
      kind: 'stage', stage: 'completed',
      detail: { coverageComplete: false, incompleteRegionCount: 2 },
    });
  });
});

async function collect(source: AsyncIterable<DrawingPerceptionOutput>): Promise<DrawingPerceptionOutput[]> {
  const outputs: DrawingPerceptionOutput[] = [];
  for await (const output of source) outputs.push(output);
  return outputs;
}

function isStage(output: DrawingPerceptionOutput): output is Extract<DrawingPerceptionOutput, { kind: 'stage' }> {
  return output.kind === 'stage';
}

function isBatch(output: DrawingPerceptionOutput): output is Extract<DrawingPerceptionOutput, { kind: 'command_batch' }> {
  return output.kind === 'command_batch';
}

function inertVision(): DrawingVisionToolset {
  return {
    analyzeSheet: async () => ({ warnings: [] }),
    segmentViews: async () => [],
    detectDatums: async () => [],
    detectGeometry: async () => [],
    extractAnnotations: async () => [],
  };
}
