import { throwIfAborted } from './attachments.js';
import { associateDimensions } from './associate-dimensions.js';
import { DrawingAssetCache, type DrawingAssetReference } from './assets.js';
import {
  buildObservationCommandBatches,
  buildObservationPreviewNodes,
  stableDrawingNodeId,
  type DrawingCommandBatch,
} from './build-patches.js';
import { assembleContours } from './contour-assembler.js';
import {
  createCoverageRegion,
  createTargetedRefinementRegion,
  decideRegionRefinement,
  splitPerceptionRegion,
  type DrawingCoverageAssessment,
  type DrawingCoverageLedger,
  type DrawingCoverageRegion,
} from './coverage.js';
import type { DrawingObservationStore } from './observation-store.js';
import { numberGlobalContours, numberRegionObservations } from './numbering.js';
import {
  deduplicateAnnotationObservations,
  deduplicateGeometryObservations,
  planPerceptionRegions,
  projectGlobalContoursToRegion,
  stitchAnnotationObservation,
  stitchContourEvidence,
  stitchGeometryObservation,
  stitchGlobalContour,
  type PerceptionRegion,
} from './regions.js';
import { buildDrawingTopology } from './topology.js';
import type {
  AnnotationObservation,
  ContourEvidence,
  DrawingManifest,
  DrawingView,
  GeometryObservation,
  GlobalContour,
  NormalizedImageBounds,
} from './types.js';
import {
  DrawingVisionTools,
  type DrawingCoverageContext,
  type DrawingRegionalGeometryContext,
  type DrawingRegionalGeometryRead,
  type DrawingVisionToolInput,
  type SheetAnalysis,
} from './vision-tools.js';
import type { PerceptionPreviewDelta } from '../../../src/drawing/index.js';

export type DrawingPerceptionStage =
  | 'asset_prepared'
  | 'sheet_analyzed'
  | 'views_segmented'
  | 'global_contours_built'
  | 'coverage_assessed'
  | 'coverage_completed'
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

export interface DrawingPerceptionCommandOutput {
  kind: 'command_batch';
  runId: string;
  stage: 'patch_ready';
  batch: DrawingCommandBatch;
}

export interface DrawingPerceptionObservationOutput {
  kind: 'observation_delta';
  runId: string;
  delta: PerceptionPreviewDelta;
}

export type DrawingPerceptionOutput =
  | DrawingPerceptionStageReceipt
  | DrawingPerceptionCommandOutput
  | DrawingPerceptionObservationOutput;

export interface DrawingPerceptionInput {
  runId: string;
  sourceId?: string;
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
  detectGeometry(
    input: DrawingVisionToolInput,
    context?: DrawingRegionalGeometryContext,
  ): Promise<GeometryObservation[]>;
  extractAnnotations(input: DrawingVisionToolInput): Promise<AnnotationObservation[]>;
  detectGlobalContours?(input: DrawingVisionToolInput): Promise<GlobalContour[]>;
  detectContourEvidence?(
    input: DrawingVisionToolInput,
    contours: Array<Pick<GlobalContour, 'id' | 'geometryFamily' | 'imageBounds'>>,
  ): Promise<ContourEvidence[]>;
  detectRegionalGeometry?(
    input: DrawingVisionToolInput,
    contours: Array<Pick<GlobalContour, 'id' | 'geometryFamily' | 'imageBounds'>>,
  ): Promise<DrawingRegionalGeometryRead>;
  assessCoverage?(
    input: DrawingVisionToolInput,
    context: DrawingCoverageContext,
  ): Promise<DrawingCoverageAssessment>;
}

export interface DrawingPerceptionPipelineOptions {
  assets?: DrawingAssetCache;
  vision?: DrawingVisionToolset;
  observationStore?: DrawingObservationStore;
  maxConcurrentViews?: number;
  maxConcurrentRegions?: number;
  maxRefinementDepth?: number;
  maxRegionsPerView?: number;
  now?: () => number;
}

interface ViewPerception {
  view: DrawingView;
  geometry: GeometryObservation[];
  annotations: AnnotationObservation[];
  errors: ViewPerceptionError[];
  regionCount: number;
  globalContours: GlobalContour[];
  contourEvidence: ContourEvidence[];
  coverageRegions: DrawingCoverageRegion[];
  coverageComplete: boolean;
  coverageWarnings: string[];
  unresolvedContourIds: string[];
  adaptive: boolean;
  durationMs: number;
}

interface RegionPerception {
  region: DrawingCoverageRegion;
  geometry: GeometryObservation[];
  annotations: AnnotationObservation[];
  evidence: ContourEvidence[];
  assessment: DrawingCoverageAssessment | null;
  errors: ViewPerceptionError[];
}

interface PerceptionEmission {
  action: PerceptionPreviewDelta['action'];
  viewId: string;
  regionId?: string;
  stage: PerceptionPreviewDelta['source']['stage'];
  geometry?: GeometryObservation[];
  annotations?: AnnotationObservation[];
}

interface ViewPerceptionError {
  viewId: string;
  tool: 'detect_datums' | 'detect_geometry' | 'extract_annotations'
    | 'detect_global_contours' | 'detect_contour_evidence'
    | 'detect_regional_geometry' | 'assess_coverage';
  message: string;
}

export class DrawingPerceptionPipeline {
  private readonly assets: DrawingAssetCache;
  private readonly vision: DrawingVisionToolset;
  private readonly observationStore?: DrawingObservationStore;
  private readonly maxConcurrentViews: number;
  private readonly maxConcurrentRegions: number;
  private readonly maxRefinementDepth: number;
  private readonly maxRegionsPerView: number;
  private readonly now: () => number;

  constructor(options: DrawingPerceptionPipelineOptions = {}) {
    this.assets = options.assets ?? new DrawingAssetCache();
    this.vision = options.vision ?? new DrawingVisionTools();
    this.observationStore = options.observationStore;
    this.maxConcurrentViews = Math.max(1, Math.floor(options.maxConcurrentViews ?? 2));
    this.maxConcurrentRegions = Math.max(1, Math.floor(options.maxConcurrentRegions ?? 3));
    this.maxRefinementDepth = Math.max(0, Math.floor(options.maxRefinementDepth ?? 1));
    this.maxRegionsPerView = Math.max(1, Math.floor(options.maxRegionsPerView ?? 12));
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

      const sourceId = input.sourceId ?? `source_${input.runId}`;
      let deltaSequence = 0;
      const provisionalIds = new Set<string>();
      const outputQueue = new AsyncOutputQueue<DrawingPerceptionOutput>();
      const perceivedPromise = mapLimit(
        views,
        this.maxConcurrentViews,
        (view) => this.perceiveView(input, page, view, (emission) => {
          const geometry = (emission.geometry ?? []).map((observation) => (
            enrichObservation(observation, sourceId, input.runId)
          ));
          const annotations = (emission.annotations ?? []).map((observation) => (
            enrichObservation(observation, sourceId, input.runId)
          ));
          const preview = buildObservationPreviewNodes({
            geometry,
            annotations,
            annotationTransforms: {
              [emission.viewId]: imageToCadTransform(page.heightToWidthRatio),
            },
          });
          if (preview.nodes.length === 0) return;
          preview.nodes.forEach((node) => provisionalIds.add(node.id));
          const labelsByNodeId = Object.fromEntries(
            [...geometry, ...annotations].map((observation) => [
              stableDrawingNodeId(sourceId, observation.id),
              publicObservationLabel(observation),
            ]),
          );
          const delta: PerceptionPreviewDelta = {
            runId: input.runId,
            sequence: ++deltaSequence,
            action: emission.action,
            slotIds: [...geometry, ...annotations].map((item) => item.id),
            upserts: preview.nodes,
            removeIds: [],
            labelsByNodeId,
            source: {
              page: input.page,
              viewId: emission.viewId,
              ...(emission.regionId ? { regionId: emission.regionId } : {}),
              stage: emission.stage,
            },
          };
          outputQueue.push({ kind: 'observation_delta', runId: input.runId, delta });
        }),
      );
      void perceivedPromise.then(
        () => outputQueue.close(),
        (error: unknown) => outputQueue.fail(error),
      );
      for await (const output of outputQueue) yield output;
      const perceived = await perceivedPromise;
      const geometry = perceived.flatMap((result) => result.geometry)
        .map((observation) => enrichObservation(observation, sourceId, input.runId))
        .sort((first, second) => first.id.localeCompare(second.id));
      const annotations = perceived.flatMap((result) => result.annotations)
        .map((observation) => enrichObservation(observation, sourceId, input.runId))
        .sort((first, second) => first.id.localeCompare(second.id));
      const perceptionErrors = perceived.flatMap((result) => result.errors);
      const globalContours = perceived.flatMap((result) => result.globalContours);
      const contourEvidence = perceived.flatMap((result) => result.contourEvidence);
      const coverageLedger: DrawingCoverageLedger = {
        runId: input.runId,
        page: input.page,
        regions: perceived.flatMap((result) => result.coverageRegions),
        complete: perceived.every((result) => result.coverageComplete),
        warnings: perceived.flatMap((result) => result.coverageWarnings),
      };
      for (const result of perceived) {
        if (result.adaptive) {
          yield {
            kind: 'stage', runId: input.runId, stage: 'global_contours_built',
            timestamp: this.now(), durationMs: result.durationMs, viewId: result.view.id,
            detail: {
              contourCount: result.globalContours.length,
              unresolvedContourCount: result.unresolvedContourIds.length,
            },
          };
          yield {
            kind: 'stage', runId: input.runId, stage: 'coverage_assessed',
            timestamp: this.now(), durationMs: result.durationMs, viewId: result.view.id,
            detail: {
              regionCount: result.coverageRegions.length,
              refinedCount: result.coverageRegions.filter((region) => region.status === 'refine').length,
            },
          };
          yield {
            kind: 'stage', runId: input.runId, stage: 'coverage_completed',
            timestamp: this.now(), durationMs: result.durationMs, viewId: result.view.id,
            detail: {
              complete: result.coverageComplete,
              incompleteRegionCount: result.coverageRegions.filter(
                (region) => region.status === 'budget_exhausted' || region.status === 'failed',
              ).length,
              unresolvedContourCount: result.unresolvedContourIds.length,
            },
          };
        }
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
            coverageComplete: result.coverageComplete,
            globalContourCount: result.globalContours.length,
          },
        };
      }
      await Promise.all([
        this.save(input.runId, 'geometry', geometry),
        this.save(input.runId, 'annotations', annotations),
        this.save(input.runId, 'perception-errors', perceptionErrors),
        this.save(input.runId, 'global-contours', globalContours),
        this.save(input.runId, 'contour-evidence', contourEvidence),
        this.save(input.runId, 'coverage-ledger', coverageLedger),
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
      const resolved = buildObservationCommandBatches({
        geometry,
        annotations,
        associations,
        topology,
        annotationTransforms: Object.fromEntries(views.map((view) => [view.id, {
          ...imageToCadTransform(page.heightToWidthRatio),
        }])),
      });
      const { batches } = resolved;
      await this.save(input.runId, 'command-batches', batches);
      if (resolved.warnings.length > 0) await this.save(input.runId, 'resolver-warnings', resolved.warnings);
      yield this.receipt(input.runId, 'patches_built', patchStartedAt, {
        batchCount: batches.length,
        entityCount: batches.reduce((sum, batch) => sum + batch.commands.length, 0),
        lowConfidenceCount: batches.reduce((sum, batch) => sum + batch.lowConfidenceCount, 0),
        warningCount: resolved.warnings.length,
      });
      const finalNodeIds = new Set<string>(batches.flatMap((batch) => batch.commands.flatMap((command) => (
        command.type === 'geometry.create' || command.type === 'annotation.create'
          ? [command.value.id]
          : []
      ))));
      const rejectedPreviewIds = [...provisionalIds].filter((id) => !finalNodeIds.has(id));
      if (rejectedPreviewIds.length > 0) {
        yield {
          kind: 'observation_delta',
          runId: input.runId,
          delta: {
            runId: input.runId,
            sequence: ++deltaSequence,
            action: 'reject',
            slotIds: [],
            upserts: [],
            removeIds: rejectedPreviewIds,
            source: {
              page: input.page,
              viewId: 'page',
              stage: 'reconciliation',
            },
          },
        };
      }
      for (const batch of batches) {
        yield { kind: 'command_batch', runId: input.runId, stage: 'patch_ready', batch };
      }
      yield this.receipt(input.runId, 'completed', startedAt, {
        viewCount: views.length,
        batchCount: batches.length,
        coverageComplete: coverageLedger.complete,
        incompleteRegionCount: coverageLedger.regions.filter(
          (region) => region.status === 'budget_exhausted' || region.status === 'failed',
        ).length,
      });
    } finally {
      this.assets.releaseRun(input.runId);
    }
  }

  private async perceiveView(
    input: DrawingPerceptionInput,
    page: DrawingAssetReference,
    view: DrawingView,
    emit: (emission: PerceptionEmission) => void,
  ): Promise<ViewPerception> {
    this.assertActive(input);
    const startedAt = this.now();
    const pageRatio = page.heightToWidthRatio ?? 1;
    const adaptive = Boolean(
      this.vision.detectGlobalContours
      && (this.vision.detectRegionalGeometry || this.vision.detectContourEvidence)
      && this.vision.assessCoverage,
    );
    const regions = planPerceptionRegions(view, page).map((region) => createCoverageRegion(region));
    const datumRegion: PerceptionRegion = {
      id: `${view.id}_datums`, viewId: view.id, pageBounds: view.imageBounds,
    };
    const globalRegion: PerceptionRegion = {
      id: `${view.id}_global`, viewId: view.id, pageBounds: view.imageBounds,
    };
    const [rawDatumResult, rawGlobalResult] = await Promise.all([
      this.perceiveDatums(input, page.assetId, datumRegion, pageRatio),
      this.perceiveGlobalContours(input, page.assetId, globalRegion, pageRatio),
    ]);
    const numberedDatums = numberRegionObservations(
      input.page,
      view.id,
      datumRegion.id,
      rawDatumResult.geometry,
      [],
    );
    const datumResult = { ...rawDatumResult, geometry: numberedDatums.geometry };
    const numberedContours = numberGlobalContours(
      input.runId,
      input.page,
      view.id,
      rawGlobalResult.contours,
    );
    const globalResult = {
      contours: numberedContours.contours,
      errors: rawGlobalResult.errors,
    };
    if (datumResult.geometry.length > 0) {
      emit({
        action: 'observe', viewId: view.id, regionId: datumRegion.id,
        stage: 'outline', geometry: datumResult.geometry,
      });
    }
    const coarseContours = globalResult.contours.flatMap((contour): GeometryObservation[] => (
      contour.coarseParams ? [{
        id: `global_contour_${contour.id}`,
        viewId: contour.viewId,
        type: contour.geometryFamily,
        imageBounds: [...contour.imageBounds],
        measuredParams: structuredClone(contour.coarseParams),
        confidence: contour.confidence,
      }] : []
    ));
    if (coarseContours.length > 0) {
      emit({
        action: 'observe', viewId: view.id, regionId: globalRegion.id,
        stage: 'outline', geometry: coarseContours,
      });
    }

    const coverageRegions = [...regions];
    const regionResults: RegionPerception[] = [];
    let pending = [...regions];
    while (pending.length > 0) {
      pending.forEach((region) => {
        region.status = 'running';
        region.attempts += 1;
      });
      const waveResults = await mapLimit(
        pending,
        this.maxConcurrentRegions,
        (region) => this.perceiveRegion(
          input,
          page.assetId,
          region,
          pageRatio,
          globalResult.contours,
          numberedContours.idMap,
        ),
      );
      regionResults.push(...waveResults);
      const children: DrawingCoverageRegion[] = [];
      for (const result of waveResults) {
        if (result.geometry.length > 0) {
          emit({
            action: 'observe', viewId: view.id, regionId: result.region.id,
            stage: 'detail', geometry: result.geometry,
          });
        }
        if (result.annotations.length > 0) {
          emit({
            action: 'observe', viewId: view.id, regionId: result.region.id,
            stage: 'annotation', annotations: result.annotations,
          });
        }
        const region = result.region;
        region.geometryCount = result.geometry.length;
        region.annotationCount = result.annotations.length;
        region.assessment = result.assessment;
        const decision = adaptive ? decideRegionRefinement({
          region,
          viewBounds: view.imageBounds,
          assessment: result.assessment,
          geometry: result.geometry.filter((observation) => isAuthoritativeStandalone(
            observation,
            result,
            view.imageBounds,
            globalResult.contours,
          )),
          annotationCount: result.annotations.length,
          extractionErrorCount: result.errors.filter((error) => error.tool !== 'assess_coverage').length,
          currentRegionCount: coverageRegions.length,
          limits: { maxDepth: this.maxRefinementDepth, maxRegions: this.maxRegionsPerView },
        }) : { refine: false, budgetExhausted: false, reasons: [] };
        region.refinementReasons = decision.reasons;
        if (decision.refine) {
          region.status = 'refine';
          const split = result.assessment && result.assessment.unreadBounds.length > 0
            ? [createTargetedRefinementRegion({
                region,
                unreadBounds: result.assessment.unreadBounds,
              })]
            : splitPerceptionRegion({
                region,
                pageHeightToWidthRatio: pageRatio,
              });
          coverageRegions.push(...split);
          children.push(...split);
        } else if (decision.budgetExhausted) {
          region.status = 'budget_exhausted';
        } else {
          region.status = result.errors.length > 0 && !result.assessment ? 'failed' : 'complete';
        }
      }
      if (adaptive) {
        await this.save(input.runId, `coverage-${safeRecordSegment(view.id)}`, {
          runId: input.runId,
          page: input.page,
          regions: coverageRegions,
          complete: provisionalCoverageComplete(coverageRegions),
          warnings: [],
        } satisfies DrawingCoverageLedger);
      }
      pending = children;
    }

    this.assertActive(input);
    const contourEvidence = regionResults.flatMap((result) => result.evidence);
    const assembled = assembleContours({
      contours: globalResult.contours,
      evidence: contourEvidence,
    });
    if (assembled.geometry.length > 0) {
      emit({
        action: coarseContours.length > 0 ? 'refine' : 'observe',
        viewId: view.id,
        stage: 'outline',
        geometry: assembled.geometry,
      });
    }
    const standaloneGeometry = regionResults.flatMap((result) => (
      result.geometry.filter((observation) => isAuthoritativeStandalone(
        observation,
        result,
        view.imageBounds,
        globalResult.contours,
      ))
    ));
    const geometry = deduplicateGeometryObservations([
      ...datumResult.geometry,
      ...assembled.geometry,
      ...standaloneGeometry,
    ]);
    const annotations = deduplicateAnnotationObservations(
      regionResults.flatMap((result) => result.annotations),
    );
    const errors = [
      ...datumResult.errors,
      ...globalResult.errors,
      ...regionResults.flatMap((result) => result.errors),
    ];
    const coverageWarnings = [
      ...assembled.warnings,
      ...assembled.unresolvedContourIds.map((id) => `全局轮廓 ${id} 尚未参数化`),
      ...coverageRegions.filter((region) => region.status === 'budget_exhausted')
        .map((region) => `区域 ${region.id} 达到细化预算`),
    ];
    const coverageComplete = provisionalCoverageComplete(coverageRegions)
      && assembled.unresolvedContourIds.length === 0
      && !globalResult.errors.some((error) => error.tool === 'detect_global_contours');
    return {
      view,
      geometry,
      annotations,
      errors,
      regionCount: coverageRegions.length,
      globalContours: globalResult.contours,
      contourEvidence,
      coverageRegions,
      coverageComplete,
      coverageWarnings,
      unresolvedContourIds: assembled.unresolvedContourIds,
      adaptive,
      durationMs: Math.max(0, this.now() - startedAt),
    };
  }

  private async perceiveGlobalContours(
    input: DrawingPerceptionInput,
    pageAssetId: string,
    region: PerceptionRegion,
    pageRatio: number,
  ): Promise<{ contours: GlobalContour[]; errors: ViewPerceptionError[] }> {
    const detect = this.vision.detectGlobalContours?.bind(this.vision);
    if (!detect) return { contours: [], errors: [] };
    const attachment = await this.readRegion(input, pageAssetId, region);
    const result = await Promise.allSettled([
      this.retryViewTool(input, () => detect(this.visionInput(input, attachment, region.id))),
    ]);
    return {
      contours: settledArray<GlobalContour>(result[0])
        .map((contour) => stitchGlobalContour(contour, region, pageRatio)),
      errors: rejectedToolErrors(region.viewId, ['detect_global_contours'], result),
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
      region: createCoverageRegion(region),
      geometry: settledValue<GeometryObservation[]>(result[0], [])
        .map((observation) => stitchGeometryObservation(observation, region, pageRatio)),
      annotations: [],
      evidence: [],
      assessment: null,
      errors: rejectedToolErrors(region.viewId, ['detect_datums'], result),
    };
  }

  private async perceiveRegion(
    input: DrawingPerceptionInput,
    pageAssetId: string,
    region: DrawingCoverageRegion,
    pageRatio: number,
    globalContours: GlobalContour[],
    contourIdMap: Record<string, string>,
  ): Promise<RegionPerception> {
    const attachment = await this.readRegion(input, pageAssetId, region);
    const visionInput = this.visionInput(input, attachment, region.id);
    const projectedContours = projectGlobalContoursToRegion(globalContours, region);
    const combinedTool = this.vision.detectRegionalGeometry?.bind(this.vision);
    const evidenceTool = this.vision.detectContourEvidence?.bind(this.vision);
    let rawGeometry: GeometryObservation[];
    let rawAnnotations: AnnotationObservation[];
    let rawEvidence: ContourEvidence[];
    let errors: ViewPerceptionError[];
    if (combinedTool) {
      const results = await Promise.allSettled([
        this.retryViewTool<DrawingRegionalGeometryRead>(
          input,
          () => combinedTool(visionInput, projectedContours),
        ),
        this.retryViewTool<AnnotationObservation[]>(
          input,
          () => this.vision.extractAnnotations(visionInput),
        ),
      ] as const);
      const combined = results[0].status === 'fulfilled'
        ? results[0].value
        : { geometry: [], evidence: [] };
      rawGeometry = combined.geometry;
      rawEvidence = combined.evidence;
      rawAnnotations = results[1].status === 'fulfilled' ? results[1].value : [];
      errors = rejectedToolErrors(
        region.viewId,
        ['detect_regional_geometry', 'extract_annotations'],
        results,
      );
    } else {
      const tools: ViewPerceptionError['tool'][] = [
        'detect_geometry', 'extract_annotations',
        ...(evidenceTool ? ['detect_contour_evidence' as const] : []),
      ];
      const operations: Array<Promise<unknown>> = [
        this.retryViewTool(input, () => this.vision.detectGeometry(visionInput, {
          mode: 'regional_standalone',
          globalContours: projectedContours,
        })),
        this.retryViewTool(input, () => this.vision.extractAnnotations(visionInput)),
        ...(evidenceTool
          ? [this.retryViewTool(input, () => evidenceTool(visionInput, projectedContours))]
          : []),
      ];
      const results = await Promise.allSettled(operations);
      rawGeometry = settledArray<GeometryObservation>(results[0]);
      rawAnnotations = settledArray<AnnotationObservation>(results[1]);
      rawEvidence = evidenceTool ? settledArray<ContourEvidence>(results[2]) : [];
      errors = rejectedToolErrors(region.viewId, tools, results);
    }
    const assess = this.vision.assessCoverage?.bind(this.vision);
    const terminalRefinement = region.depth >= this.maxRefinementDepth;
    let assessment: DrawingCoverageAssessment | null = !assess
      ? { complete: true, confidence: 1, unreadBounds: [], reasons: [] }
      : terminalRefinement
        ? {
            complete: false,
            confidence: 0,
            unreadBounds: [],
            reasons: ['terminal_reread_unverified'],
          }
        : null;
    if (assess && !terminalRefinement) {
      try {
        assessment = await this.retryViewTool(input, () => assess(visionInput, {
          globalContours: projectedContours,
          contourEvidence: rawEvidence.flatMap((item) => item.globalContourId ? [{
            globalContourId: item.globalContourId,
            imageBounds: item.imageBounds,
          }] : []),
          standaloneGeometry: rawGeometry.map((item) => ({
            type: item.type, imageBounds: item.imageBounds,
          })),
          annotations: rawAnnotations.map((item) => ({
            kind: item.kind, imageBounds: item.imageBounds,
          })),
        }));
      } catch (error) {
        errors.push({
          viewId: region.viewId,
          tool: 'assess_coverage',
          message: safeErrorMessage(error),
        });
      }
    }
    const numbered = numberRegionObservations(
      input.page,
      region.viewId,
      region.id,
      rawGeometry.map((observation) => stitchGeometryObservation(observation, region, pageRatio)),
      rawAnnotations.map((observation) => stitchAnnotationObservation(observation, region)),
    );
    return {
      region,
      geometry: numbered.geometry,
      annotations: numbered.annotations,
      evidence: rawEvidence.map((item) => stitchContourEvidence({
        ...item,
        ...(item.globalContourId ? {
          globalContourId: contourIdMap[item.globalContourId] ?? item.globalContourId,
        } : {}),
      }, region)),
      assessment,
      errors,
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

function settledArray<T>(result: PromiseSettledResult<unknown>): T[] {
  return result.status === 'fulfilled' && Array.isArray(result.value)
    ? result.value as T[]
    : [];
}

function enrichObservation<T extends GeometryObservation | AnnotationObservation>(
  observation: T,
  sourceId: string,
  runId: string,
): T {
  return {
    ...observation,
    sourceId,
    evidenceRefs: observation.evidenceRefs?.length
      ? [...observation.evidenceRefs]
      : [`evidence_${runId}_${observation.id}`],
  };
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

function provisionalCoverageComplete(regions: DrawingCoverageRegion[]): boolean {
  return regions.every((region) => (
    region.status === 'complete' || region.status === 'refine'
  ));
}

function isAuthoritativeStandalone(
  observation: GeometryObservation,
  result: RegionPerception,
  viewBounds: NormalizedImageBounds,
  globalContours: GlobalContour[],
): boolean {
  if (touchesInternalCropEdge(observation.imageBounds, result.region.pageBounds, viewBounds)) {
    return false;
  }
  const contours = new Map(globalContours.map((contour) => [contour.id, contour]));
  const linkedToGlobalContour = result.evidence.some((evidence) => {
    const contour = evidence.globalContourId ? contours.get(evidence.globalContourId) : undefined;
    return contour
      && compatibleGeometry(observation.type, contour.geometryFamily)
      && overlapFraction(observation.imageBounds, evidence.imageBounds) >= 0.3;
  });
  if (linkedToGlobalContour) return false;

  return !globalContours.some((contour) => {
    if (!compatibleGeometry(observation.type, contour.geometryFamily)) return false;
    const overlap = overlapFraction(observation.imageBounds, contour.imageBounds);
    if (observation.type === contour.geometryFamily) return overlap >= 0.8;
    const observationArea = boundsArea(observation.imageBounds);
    const contourArea = boundsArea(contour.imageBounds);
    return observation.type === 'arc'
      && (contour.geometryFamily === 'circle' || contour.geometryFamily === 'ellipse')
      && overlap >= 0.5
      && observationArea >= contourArea * 0.25;
  });
}

function compatibleGeometry(
  observation: GeometryObservation['type'],
  contour: GlobalContour['geometryFamily'],
): boolean {
  return observation === contour
    || (observation === 'arc' && (contour === 'circle' || contour === 'ellipse'));
}

function touchesInternalCropEdge(
  observation: NormalizedImageBounds,
  region: NormalizedImageBounds,
  view: NormalizedImageBounds,
): boolean {
  const epsilon = 0.005;
  const observationRight = observation[0] + observation[2];
  const observationBottom = observation[1] + observation[3];
  const regionRight = region[0] + region[2];
  const regionBottom = region[1] + region[3];
  const viewRight = view[0] + view[2];
  const viewBottom = view[1] + view[3];
  return (region[0] > view[0] + epsilon && observation[0] <= region[0] + epsilon)
    || (regionRight < viewRight - epsilon && observationRight >= regionRight - epsilon)
    || (region[1] > view[1] + epsilon && observation[1] <= region[1] + epsilon)
    || (regionBottom < viewBottom - epsilon && observationBottom >= regionBottom - epsilon);
}

function overlapFraction(first: NormalizedImageBounds, second: NormalizedImageBounds): number {
  const left = Math.max(first[0], second[0]);
  const top = Math.max(first[1], second[1]);
  const right = Math.min(first[0] + first[2], second[0] + second[2]);
  const bottom = Math.min(first[1] + first[3], second[1] + second[3]);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  return boundsArea(first) > 0 ? intersection / boundsArea(first) : 0;
}

function boundsArea(bounds: NormalizedImageBounds): number {
  return bounds[2] * bounds[3];
}

function safeRecordSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return normalized || 'view';
}

function publicObservationLabel(
  observation: GeometryObservation | AnnotationObservation,
): string {
  const prefix = observation.id.includes('ctr_')
    ? 'CTR'
    : 'kind' in observation
      ? observation.kind === 'text' ? 'TXT' : 'DIM'
      : 'GEO';
  const match = observation.id.match(/(\d{4})$/);
  return `${prefix}-${match?.[1] ?? observation.id.slice(-4).toUpperCase()}`;
}

function imageToCadTransform(heightToWidthRatio: number | undefined) {
  const ratio = heightToWidthRatio ?? 1;
  return { scaleX: 1, scaleY: -ratio, offsetX: 0, offsetY: ratio };
}

class AsyncOutputQueue<T> implements AsyncIterableIterator<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<{
    resolve: (result: IteratorResult<T>) => void;
    reject: (error: unknown) => void;
  }> = [];
  private closed = false;
  private error: unknown;

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve({ done: false, value });
    else this.values.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter.resolve({ done: true, value: undefined });
  }

  fail(error: unknown): void {
    if (this.closed) return;
    this.error = error;
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  next(): Promise<IteratorResult<T>> {
    const value = this.values.shift();
    if (value !== undefined) return Promise.resolve({ done: false, value });
    if (this.error !== undefined) return Promise.reject(this.error);
    if (this.closed) return Promise.resolve({ done: true, value: undefined });
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this;
  }
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
