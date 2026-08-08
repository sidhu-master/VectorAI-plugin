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
        async ({ viewId }) => duringCall(viewId === 'view_primary' ? [{
        id: 'datum_axis', viewId, type: 'line', imageBounds: [0.1, 0.5, 0.8, 0.01],
        measuredParams: { start: [0.1, 0.5], end: [0.9, 0.5] }, confidence: 0.86,
      }] : []),
      ),
      detectGeometry: vi.fn<DrawingVisionToolset['detectGeometry']>(
        async ({ viewId }) => duringCall(viewId === 'view_primary' ? [{
        id: 'primary_circle', viewId, type: 'circle', imageBounds: [0.3, 0.3, 0.4, 0.4],
        measuredParams: { center: [0.5, 0.5], radius: 0.2 }, confidence: 0.91,
      }] : [{
        id: 'detail_circle', viewId, type: 'circle', imageBounds: [0.2, 0.2, 0.2, 0.2],
        measuredParams: { center: [0.3, 0.3], radius: 0.1 }, confidence: 0.55,
      }]),
      ),
      extractAnnotations: vi.fn<DrawingVisionToolset['extractAnnotations']>(
        async ({ viewId }) => duringCall(viewId === 'view_primary' ? [{
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
      'datum_axis', 'detail_circle', 'primary_circle',
    ]);
    expect(associations).toMatchObject([{
      annotationId: 'diameter_40', status: 'resolved',
      targets: [{ geometryObservationId: 'primary_circle' }],
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
        id: 'view_1', kind: 'primary', imageBounds: [0, 0, 1, 1], confidence: 0.9,
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
    expect(outputs.some((output) => output.kind === 'patch_batch'
      && output.batch.observationIds.includes('circle_safe'))).toBe(true);
    expect(outputs.at(-1)).toMatchObject({ kind: 'stage', stage: 'completed' });
    expect(await store.read('run_partial_view', 'perception-errors')).toEqual([{
      viewId: 'view_1', tool: 'extract_annotations', message: 'malformed annotation JSON',
    }]);
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

function isBatch(output: DrawingPerceptionOutput): output is Extract<DrawingPerceptionOutput, { kind: 'patch_batch' }> {
  return output.kind === 'patch_batch';
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
