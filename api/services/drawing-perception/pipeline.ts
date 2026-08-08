import { throwIfAborted } from '../agent-runtime/attachments.js';
import { associateDimensions } from './associate-dimensions.js';
import { DrawingAssetCache, type DrawingAssetReference } from './assets.js';
import {
  buildObservationPatchBatches,
  type ObservationPatchBatch,
} from './build-patches.js';
import type { DrawingObservationStore } from './observation-store.js';
import {
  deduplicateAnnotationObservations,
  deduplicateGeometryObservations,
  planPerceptionRegions,
  stitchAnnotationObservation,
  stitchGeometryObservation,
  type PerceptionRegion,
} from './regions.js';
import { buildDrawingTopology } from './topology.js';
import type {
  AnnotationObservation,
  DrawingManifest,
  DrawingView,
  GeometryObservation,
} from './types.js';
import {
  DrawingVisionTools,
  type DrawingVisionToolInput,
  type SheetAnalysis,
} from './vision-tools.js';

export type DrawingPerceptionStage =
  | 'asset_prepared'
  | 'sheet_analyzed'
  | 'views_segmented'
  | 'view_perceived'
  | 'topology_built'
  | 'dimensions_associated'
  | 'patches_built'
  | 'completed';

export interface DrawingPerceptionStageReceipt {
  kind: 'stage';
  runId: string;
  stage: DrawingPerceptionStage;
  timestamp: number;
  durationMs: number;
  viewId?: string;
  detail: Record<string, unknown>;
}

export interface DrawingPerceptionPatchOutput {
  kind: 'patch_batch';
  runId: string;
  stage: 'patch_ready';
  batch: ObservationPatchBatch;
}

export type DrawingPerceptionOutput =
  | DrawingPerceptionStageReceipt
  | DrawingPerceptionPatchOutput;

export interface DrawingPerceptionInput {
  runId: string;
  page: number;
  image: string;
  mimeType: string;
  modelName: string;
  signal: AbortSignal;
  deadlineAt: number;
}

export interface DrawingVisionToolset {
  analyzeSheet(input: DrawingVisionToolInput): Promise<SheetAnalysis>;
  segmentViews(input: DrawingVisionToolInput): Promise<DrawingView[]>;
  detectDatums(input: DrawingVisionToolInput): Promise<GeometryObservation[]>;
  detectGeometry(input: DrawingVisionToolInput): Promise<GeometryObservation[]>;
  extractAnnotations(input: DrawingVisionToolInput): Promise<AnnotationObservation[]>;
}

export interface DrawingPerceptionPipelineOptions {
  assets?: DrawingAssetCache;
  vision?: DrawingVisionToolset;
  observationStore?: DrawingObservationStore;
  maxConcurrentViews?: number;
  maxConcurrentRegions?: number;
  now?: () => number;
}

interface ViewPerception {
  view: DrawingView;
  geometry: GeometryObservation[];
  annotations: AnnotationObservation[];
  errors: ViewPerceptionError[];
  regionCount: number;
  durationMs: number;
}

interface RegionPerception {
  geometry: GeometryObservation[];
  annotations: AnnotationObservation[];
  errors: ViewPerceptionError[];
}

interface ViewPerceptionError {
  viewId: string;
  tool: 'detect_datums' | 'detect_geometry' | 'extract_annotations';
  message: string;
}

export class DrawingPerceptionPipeline {
  private readonly assets: DrawingAssetCache;
  private readonly vision: DrawingVisionToolset;
  private readonly observationStore?: DrawingObservationStore;
  private readonly maxConcurrentViews: number;
  private readonly maxConcurrentRegions: number;
  private readonly now: () => number;

  constructor(options: DrawingPerceptionPipelineOptions = {}) {
    this.assets = options.assets ?? new DrawingAssetCache();
    this.vision = options.vision ?? new DrawingVisionTools();
    this.observationStore = options.observationStore;
    this.maxConcurrentViews = Math.max(1, Math.floor(options.maxConcurrentViews ?? 2));
    this.maxConcurrentRegions = Math.max(1, Math.floor(options.maxConcurrentRegions ?? 3));
    this.now = options.now ?? Date.now;
  }

  async *run(input: DrawingPerceptionInput): AsyncGenerator<DrawingPerceptionOutput> {
    const startedAt = this.now();
    try {
      this.assertActive(input);
      const assetStartedAt = this.now();
      const page = await this.assets.putPage({
        runId: input.runId,
        page: input.page,
        image: input.image,
        mimeType: input.mimeType,
        signal: input.signal,
      });
      yield this.receipt(input.runId, 'asset_prepared', assetStartedAt, {
        page: input.page,
        assetId: page.assetId,
        sha256: page.sha256,
        byteLength: page.byteLength,
      });

      this.assertActive(input);
      const pageAttachment = await this.assets.read(input.runId, page.assetId);
      const analysisStartedAt = this.now();
      const visionInput = this.visionInput(input, pageAttachment, undefined);
      const [analysis, views] = await Promise.all([
        this.vision.analyzeSheet(visionInput),
        this.vision.segmentViews(visionInput),
      ]);
      yield this.receipt(input.runId, 'sheet_analyzed', analysisStartedAt, {
        unit: analysis.unit,
        scale: analysis.scale,
        warningCount: analysis.warnings.length,
      });
      yield this.receipt(input.runId, 'views_segmented', analysisStartedAt, {
        viewCount: views.length,
        viewIds: views.map((view) => view.id),
      });

      const manifest: DrawingManifest = {
        runId: input.runId,
        page: input.page,
        ...(analysis.unit ? { unit: analysis.unit } : {}),
        ...(analysis.scale === undefined ? {} : { scale: analysis.scale }),
        views: structuredClone(views),
        warnings: [...analysis.warnings],
      };
      await this.save(input.runId, 'manifest', manifest);

      const perceived = await mapLimit(
        views,
        this.maxConcurrentViews,
        (view) => this.perceiveView(input, page, view),
      );
      const geometry = perceived.flatMap((result) => result.geometry)
        .sort((first, second) => first.id.localeCompare(second.id));
      const annotations = perceived.flatMap((result) => result.annotations)
        .sort((first, second) => first.id.localeCompare(second.id));
      const perceptionErrors = perceived.flatMap((result) => result.errors);
      for (const result of perceived) {
        yield {
          kind: 'stage',
          runId: input.runId,
          stage: 'view_perceived',
          timestamp: this.now(),
          durationMs: result.durationMs,
          viewId: result.view.id,
          detail: {
            geometryCount: result.geometry.length,
            annotationCount: result.annotations.length,
            errorCount: result.errors.length,
            failedTools: result.errors.map((error) => error.tool),
            regionCount: result.regionCount,
          },
        };
      }
      await Promise.all([
        this.save(input.runId, 'geometry', geometry),
        this.save(input.runId, 'annotations', annotations),
        this.save(input.runId, 'perception-errors', perceptionErrors),
      ]);

      this.assertActive(input);
      const topologyStartedAt = this.now();
      const topology = buildDrawingTopology(geometry);
      await this.save(input.runId, 'topology', topology);
      yield this.receipt(input.runId, 'topology_built', topologyStartedAt, {
        componentCount: topology.components.length,
        closedComponentCount: topology.components.filter((component) => component.closed).length,
      });

      const associationStartedAt = this.now();
      const associations = associateDimensions({ geometry, annotations });
      await this.save(input.runId, 'associations', associations);
      yield this.receipt(input.runId, 'dimensions_associated', associationStartedAt, {
        associationCount: associations.length,
        resolvedCount: associations.filter((item) => item.status === 'resolved').length,
        ambiguousCount: associations.filter((item) => item.status === 'ambiguous').length,
        conflictCount: associations.filter((item) => item.status === 'conflict').length,
      });

      const patchStartedAt = this.now();
      const batches = buildObservationPatchBatches({
        geometry,
        annotations,
        associations,
        topology,
        annotationTransforms: Object.fromEntries(views.map((view) => [view.id, {
          scaleX: 1,
          scaleY: page.heightToWidthRatio ?? 1,
          offsetX: 0,
          offsetY: 0,
        }])),
      });
      await this.save(input.runId, 'patch-batches', batches);
      yield this.receipt(input.runId, 'patches_built', patchStartedAt, {
        batchCount: batches.length,
        entityCount: batches.reduce((sum, batch) => sum + batch.intent.objects.length, 0),
        lowConfidenceCount: batches.reduce((sum, batch) => sum + batch.lowConfidenceCount, 0),
      });
      for (const batch of batches) {
        yield { kind: 'patch_batch', runId: input.runId, stage: 'patch_ready', batch };
      }
      yield this.receipt(input.runId, 'completed', startedAt, {
        viewCount: views.length,
        batchCount: batches.length,
      });
    } finally {
      this.assets.releaseRun(input.runId);
    }
  }

  private async perceiveView(
    input: DrawingPerceptionInput,
    page: DrawingAssetReference,
    view: DrawingView,
  ): Promise<ViewPerception> {
    this.assertActive(input);
    const startedAt = this.now();
    const pageRatio = page.heightToWidthRatio ?? 1;
    const regions = planPerceptionRegions(view, page);
    const datumRegion: PerceptionRegion = {
      id: `${view.id}_datums`, viewId: view.id, pageBounds: view.imageBounds,
    };
    const [datumResult, regionResults] = await Promise.all([
      this.perceiveDatums(input, page.assetId, datumRegion, pageRatio),
      mapLimit(
        regions,
        this.maxConcurrentRegions,
        (region) => this.perceiveRegion(input, page.assetId, region, pageRatio),
      ),
    ]);
    this.assertActive(input);
    const geometry = deduplicateGeometryObservations([
      ...datumResult.geometry,
      ...regionResults.flatMap((result) => result.geometry),
    ]);
    const annotations = deduplicateAnnotationObservations(
      regionResults.flatMap((result) => result.annotations),
    );
    return {
      view,
      geometry,
      annotations,
      errors: [...datumResult.errors, ...regionResults.flatMap((result) => result.errors)],
      regionCount: regions.length,
      durationMs: Math.max(0, this.now() - startedAt),
    };
  }

  private async perceiveDatums(
    input: DrawingPerceptionInput,
    pageAssetId: string,
    region: PerceptionRegion,
    pageRatio: number,
  ): Promise<RegionPerception> {
    const attachment = await this.readRegion(input, pageAssetId, region);
    const visionInput = this.visionInput(input, attachment, region.id);
    const result = await Promise.allSettled([
      this.retryViewTool(input, () => this.vision.detectDatums(visionInput)),
    ]);
    return {
      geometry: settledValue<GeometryObservation[]>(result[0], [])
        .map((observation) => stitchGeometryObservation(observation, region, pageRatio)),
      annotations: [],
      errors: rejectedToolErrors(region.viewId, ['detect_datums'], result),
    };
  }

  private async perceiveRegion(
    input: DrawingPerceptionInput,
    pageAssetId: string,
    region: PerceptionRegion,
    pageRatio: number,
  ): Promise<RegionPerception> {
    const attachment = await this.readRegion(input, pageAssetId, region);
    const visionInput = this.visionInput(input, attachment, region.id);
    const results = await Promise.allSettled([
      this.retryViewTool(input, () => this.vision.detectGeometry(visionInput)),
      this.retryViewTool(input, () => this.vision.extractAnnotations(visionInput)),
    ]);
    return {
      geometry: settledValue<GeometryObservation[]>(results[0], [])
        .map((observation) => stitchGeometryObservation(observation, region, pageRatio)),
      annotations: settledValue<AnnotationObservation[]>(results[1], [])
        .map((observation) => stitchAnnotationObservation(observation, region)),
      errors: rejectedToolErrors(
        region.viewId,
        ['detect_geometry', 'extract_annotations'],
        results,
      ),
    };
  }

  private async readRegion(
    input: DrawingPerceptionInput,
    pageAssetId: string,
    region: PerceptionRegion,
  ): Promise<{ image: string; mimeType: string }> {
    const crop = await this.assets.crop({
      runId: input.runId,
      assetId: pageAssetId,
      bounds: region.pageBounds,
      signal: input.signal,
    });
    return this.assets.read(input.runId, crop.assetId);
  }

  private async retryViewTool<T>(
    input: DrawingPerceptionInput,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch {
      this.assertActive(input);
      return operation();
    }
  }

  private visionInput(
    input: DrawingPerceptionInput,
    attachment: { image: string; mimeType: string },
    viewId: string | undefined,
  ): DrawingVisionToolInput {
    return {
      runId: input.runId,
      page: input.page,
      ...(viewId ? { viewId } : {}),
      modelName: input.modelName,
      image: attachment.image,
      mimeType: attachment.mimeType,
      signal: input.signal,
      deadlineAt: input.deadlineAt,
    };
  }

  private receipt(
    runId: string,
    stage: DrawingPerceptionStage,
    startedAt: number,
    detail: Record<string, unknown>,
  ): DrawingPerceptionStageReceipt {
    return {
      kind: 'stage',
      runId,
      stage,
      timestamp: this.now(),
      durationMs: Math.max(0, this.now() - startedAt),
      detail,
    };
  }

  private assertActive(input: DrawingPerceptionInput): void {
    throwIfAborted(input.signal);
    if (this.now() >= input.deadlineAt) throw new Error('Drawing perception deadline exceeded');
  }

  private async save(runId: string, name: string, value: unknown): Promise<void> {
    await this.observationStore?.save(runId, name, value);
  }
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function safeErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function rejectedToolErrors(
  viewId: string,
  tools: ViewPerceptionError['tool'][],
  results: PromiseSettledResult<unknown>[],
): ViewPerceptionError[] {
  return results.flatMap((result, index): ViewPerceptionError[] => result.status === 'rejected'
    ? [{ viewId, tool: tools[index], message: safeErrorMessage(result.reason) }]
    : []);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
