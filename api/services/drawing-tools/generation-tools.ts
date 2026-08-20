import { randomUUID } from 'node:crypto';

import sharp from 'sharp';

import type {
  AnnotationId,
  AnnotationNode,
  DrawingCommand,
  EvidenceId,
  GeometryNode,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import {
  CV_TOOL_BUDGETS,
  type DrawingCvToolRegistry,
} from '../drawing-cv/tool-registry.js';
import type { CvPrimitiveType } from '../drawing-cv/types.js';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service.js';
import type { DrawingRegionRedrawInput } from '../drawing-generation/types.js';
import {
  transformPoint,
  type AffineTransform,
} from '../drawing-render/rasterize-scene.js';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service.js';
import { buildVectorizationSteps } from '../drawing-vectorization/build-steps.js';
import type { DrawingModelTools } from './drawing-tools.js';
import { ModelToolExecutionError, ModelToolInputError } from './registry.js';
import type {
  ModelDrawingToolDefinition,
  ModelDrawingToolExecutionContext,
} from './types.js';

type ToolDefinition = ModelDrawingToolDefinition<unknown, unknown>;

interface GenerationCandidate {
  handle: string;
  runId: string;
  episodeId: string;
  drawingId: string;
  revision: RevisionId;
  kind: 'redraw' | 'vectorization' | 'fit' | 'annotations';
  output: unknown;
  vectorizationBatches?: Array<{
    batchIndex: number;
    commands: DrawingCommand[];
    evidenceRefs: EvidenceId[];
    confidence: number;
  }>;
  nextVectorizationBatchIndex?: number;
  pendingVectorizationBatchIndex?: number;
}

interface RedrawRegionToolInput {
  prompt: string;
  contours: Vec2[][];
  holes: Vec2[][];
  selectedIds?: string[];
  seed?: number;
  maxPixels?: number;
}

interface VectorizeImageToolInput {
  sourceId: string;
}

interface FitGeometryToolInput {
  evidenceHandle: string;
  primitiveType: CvPrimitiveType;
}

interface PreviewVectorizationBatchToolInput {
  candidateHandle: string;
  batchIndex: number;
}

interface RecomputeAnnotationsToolInput {
  geometry: GeometryNode[];
  existingAnnotations: AnnotationNode[];
  mode: 'propose' | 'reassociate' | 'remove-derived';
}

export class DrawingGenerationTools {
  readonly definitions: readonly ToolDefinition[];
  readonly #redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
  readonly #application?: Pick<
    DrawingApplication,
    'observeForAgent' | 'renderForVision'
  >;
  readonly #vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  readonly #cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
  readonly #drawingTools?: Pick<DrawingModelTools, 'previewCandidate'>;
  readonly #handleFactory: () => string;
  readonly #candidates = new Map<string, GenerationCandidate>();

  constructor(input: {
    redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
    application?: Pick<
      DrawingApplication,
      'observeForAgent' | 'renderForVision'
    >;
    vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
    cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
    drawingTools?: Pick<DrawingModelTools, 'previewCandidate'>;
    handleFactory?: () => string;
  } = {}) {
    this.#redraw = input.redraw;
    this.#application = input.application;
    this.#vectorization = input.vectorization;
    this.#cvTools = input.cvTools;
    this.#drawingTools = input.drawingTools;
    this.#handleFactory = input.handleFactory ?? (() => `generation_${randomUUID()}`);
    this.definitions = Object.freeze([
      ...(this.#cvTools ? this.#sourceCvTools() : []),
      ...(this.#redraw && this.#application ? [this.#redrawRegion()] : []),
      ...(this.#vectorization ? [this.#vectorizeImage()] : []),
      ...(this.#vectorization && this.#drawingTools ? [this.#previewVectorizationBatch()] : []),
      ...(this.#cvTools ? [this.#fitGeometry()] : []),
      this.#recomputeAnnotations(),
    ]);
  }

  #sourceCvTools(): ToolDefinition[] {
    return [
      this.#cvTool('inspect_source_overview', 'inspect_source_overview', parseSourceOverview),
      this.#cvTool('create_observation_region', 'create_observation_region', parseCvToolInput),
      this.#cvTool('inspect_source_crop', 'inspect_source_crop', parseSourceRegion),
      this.#cvTool('extract_cv_evidence', 'cv_extract_evidence', parseSourceRegion),
      this.#cvTool('read_cv_evidence', 'cv_read_evidence_page', parseCvToolInput),
    ];
  }

  #cvTool(
    name: string,
    capability: Parameters<DrawingCvToolRegistry['invoke']>[0]['capability'],
    parseInput: (value: unknown) => Record<string, unknown>,
  ): ToolDefinition {
    return define<Record<string, unknown>, unknown>(
      name, 'read', 15_000, parseInput,
      async ({ invocation, input, signal }) => {
        if (!this.#cvTools) throw new Error('CV_CAPABILITY_UNAVAILABLE');
        const budget = CV_TOOL_BUDGETS[capability as keyof typeof CV_TOOL_BUDGETS];
        const result = await this.#cvTools.invoke({
          toolCallId: `${invocation.toolCallId}:cv`,
          capability,
          runId: invocation.runId,
          input: budget ? { ...input, budget: structuredClone(budget) } : input,
          signal,
        });
        if (result.receipt.status !== 'succeeded') {
          throw new ModelToolExecutionError({
            code: result.receipt.errorCodes[0] ?? 'CV_TOOL_FAILED',
            retryable: result.receipt.retry.allowed,
            suggestedAction: result.receipt.retry.action === 'retry' ? 'retry' : 'replan',
          });
        }
        return {
          output: structuredClone(result.output),
          affectedNodeIds: result.receipt.slotIds,
        };
      },
    );
  }

  snapshot(): { candidateCount: number; commitCount: 0 } {
    return { candidateCount: this.#candidates.size, commitCount: 0 };
  }

  readCandidate(handle: string): GenerationCandidate | null {
    const candidate = this.#candidates.get(handle);
    return candidate ? structuredClone(candidate) : null;
  }

  advanceVectorizationBatch(input: {
    runId: string;
    candidateHandle: string;
    batchIndex: number;
  }): { nextBatchIndex: number; batchCount: number; completed: boolean } {
    const candidate = this.#candidates.get(input.candidateHandle);
    if (!candidate
      || candidate.kind !== 'vectorization'
      || candidate.runId !== input.runId
      || candidate.pendingVectorizationBatchIndex !== input.batchIndex) {
      throw new Error('VECTORIZATION_BATCH_COMMIT_MISMATCH');
    }
    const batchCount = candidate.vectorizationBatches?.length ?? 0;
    candidate.nextVectorizationBatchIndex = input.batchIndex + 1;
    candidate.pendingVectorizationBatchIndex = undefined;
    return {
      nextBatchIndex: candidate.nextVectorizationBatchIndex,
      batchCount,
      completed: candidate.nextVectorizationBatchIndex >= batchCount,
    };
  }

  discardRun(runId: string): number {
    let count = 0;
    for (const [handle, candidate] of this.#candidates) {
      if (candidate.runId !== runId) continue;
      this.#candidates.delete(handle);
      count += 1;
    }
    return count;
  }

  #redrawRegion(): ToolDefinition {
    return define<RedrawRegionToolInput, unknown>(
      'redraw_region', 'write', 120_000, parseRedrawRegion,
      async ({ invocation, input, signal }) => {
        if (!this.#redraw) throw new Error('GENERATION_CAPABILITY_UNAVAILABLE');
        if (!this.#application) throw new Error('DRAWING_RENDER_CAPABILITY_UNAVAILABLE');
        const targetBounds = polygonBounds(input.contours);
        const observation = await this.#application.observeForAgent({
          drawingId: invocation.drawingId,
          includeAnnotations: false,
          selectedIds: input.selectedIds ?? [],
          selectionIsTarget: true,
          targetBounds,
        });
        const view = observation.views.find((item) => item.purpose === 'target-detail')
          ?? observation.views.find((item) => item.purpose === 'overview')
          ?? observation.views[0];
        if (!view) throw new Error('GENERATION_VIEW_MISSING');
        const cleanRender = await this.#application.renderForVision({
          drawingId: invocation.drawingId,
          viewport: {
            scale: view.worldToImage[0],
            offsetX: view.worldToImage[4],
            offsetY: view.worldToImage[5],
            width: view.width,
            height: view.height,
          },
          maxDimension: Math.max(view.width, view.height),
          background: [255, 255, 255],
          strokeColor: [20, 20, 20],
        });
        const cropPng = pngFromDataUrl(cleanRender.imageDataUrl);
        if (!cropPng) throw new Error('GENERATION_MEDIA_MISSING');
        const maskPng = await renderWorldMask({
          contours: input.contours,
          holes: input.holes,
          width: view.width,
          height: view.height,
          worldToImage: view.worldToImage,
        });
        const protectedMaskPng = await sharp(maskPng).grayscale().negate().png().toBuffer();
        const viewPixels = view.width * view.height;
        const result = await this.#redraw.redraw({
          prompt: redrawPrompt(input.prompt),
          cropPng,
          maskPng,
          protectedMaskPng,
          cropPixelToWorld: invertAffine(view.worldToImage),
          authorizedContours: input.contours,
          authorizedHoles: input.holes,
          seed: input.seed ?? stableSeed(`${invocation.runId}:${invocation.toolCallId}`),
          maxPixels: Math.min(input.maxPixels ?? viewPixels, viewPixels, 4_000_000),
          signal,
          deadlineAt: Date.now() + 115_000,
        } satisfies DrawingRegionRedrawInput);
        const output = {
          kind: 'redraw' as const,
          providerRequestId: result.providerRequestId,
          generatedSource: result.generatedSource,
          pipelineVersion: result.pipelineVersion,
          geometry: structuredClone(result.geometry),
        };
        return this.#candidateResult(invocation, output, result.geometry.map((node) => node.id));
      },
    );
  }

  #vectorizeImage(): ToolDefinition {
    return define<VectorizeImageToolInput, unknown>(
      'vectorize_image', 'write', 120_000, parseVectorizeImage,
      async ({ invocation, input, signal }) => {
        if (!this.#vectorization) throw new Error('VECTORIZATION_CAPABILITY_UNAVAILABLE');
        const result = await this.#vectorization.vectorizeSource({
          sourceId: input.sourceId,
          signal,
        });
        if (result.chains.length === 0) {
          throw new ModelToolExecutionError({
            code: 'NO_VECTOR_CHAINS', retryable: true, suggestedAction: 'replan',
          });
        }
        const steps = buildVectorizationSteps(result);
        const geometry = steps.flatMap((step) => step.previewNodes);
        const output = {
          kind: 'vectorization' as const,
          sourceId: result.sourceId,
          pipelineVersion: result.pipelineVersion,
          width: result.width,
          height: result.height,
          analysisScale: result.analysisScale,
          medianLineWidthPx: result.medianLineWidthPx,
          inventory: {
            chainCount: result.chains.length,
            batchCount: steps.length,
            vectorNodeCount: geometry.length,
            geometryTypeCounts: countBy(geometry.map((node) => node.type)),
          },
          batches: steps.map((step) => ({
            batchIndex: step.batchIndex,
            chainCount: step.chainIds.length,
            nodeCount: step.previewNodes.length,
            geometryTypeCounts: countBy(step.previewNodes.map((node) => node.type)),
            bounds: structuredClone(step.bounds),
            confidence: step.confidence,
            validation: structuredClone(step.validation),
          })),
        };
        return this.#candidateResult(invocation, output, [], {
          vectorizationBatches: steps.map((step) => ({
            batchIndex: step.batchIndex,
            commands: structuredClone(step.commands),
            evidenceRefs: step.chains.map((chain) => (
              chain.slotObservation.evidence.handle as EvidenceId
            )),
            confidence: step.confidence,
          })),
          nextVectorizationBatchIndex: 0,
        });
      },
    );
  }

  #previewVectorizationBatch(): ToolDefinition {
    return define<PreviewVectorizationBatchToolInput, unknown>(
      'preview_vectorization_batch', 'write', 15_000, parsePreviewVectorizationBatch,
      async ({ invocation, input }) => {
        if (!this.#drawingTools) throw new Error('DRAWING_PREVIEW_CAPABILITY_UNAVAILABLE');
        const candidate = this.#candidates.get(input.candidateHandle);
        if (!candidate
          || candidate.kind !== 'vectorization'
          || candidate.runId !== invocation.runId
          || candidate.episodeId !== invocation.episodeId
          || candidate.drawingId !== invocation.drawingId) {
          throw new ModelToolExecutionError({
            code: 'VECTORIZATION_CANDIDATE_NOT_FOUND',
            retryable: true,
            suggestedAction: 'replan',
          });
        }
        const batches = candidate.vectorizationBatches ?? [];
        if (candidate.pendingVectorizationBatchIndex !== undefined
          || input.batchIndex !== candidate.nextVectorizationBatchIndex) {
          throw new ModelToolExecutionError({
            code: 'VECTORIZATION_BATCH_OUT_OF_ORDER',
            retryable: true,
            suggestedAction: 'replan',
          });
        }
        const batch = batches[input.batchIndex];
        if (!batch || batch.batchIndex !== input.batchIndex) {
          throw new ModelToolExecutionError({
            code: 'VECTORIZATION_BATCH_OUT_OF_ORDER',
            retryable: true,
            suggestedAction: 'replan',
          });
        }
        const preview = await this.#drawingTools.previewCandidate({
          runId: invocation.runId,
          episodeId: invocation.episodeId,
          drawingId: invocation.drawingId as never,
          revision: invocation.revision,
          summary: `源图矢量化批次 ${input.batchIndex + 1}/${batches.length}`,
          commands: batch.commands,
          evidenceRefs: batch.evidenceRefs,
          confidence: batch.confidence,
        });
        if (preview.status !== 'ready') {
          throw new ModelToolExecutionError({
            code: preview.status === 'already_satisfied'
              ? 'VECTORIZATION_BATCH_ALREADY_SATISFIED'
              : 'VECTORIZATION_BATCH_PREVIEW_REJECTED',
            retryable: true,
            suggestedAction: 'replan',
          });
        }
        candidate.pendingVectorizationBatchIndex = input.batchIndex;
        return {
          output: {
            kind: 'vectorization-batch' as const,
            sourceCandidateHandle: input.candidateHandle,
            batchIndex: input.batchIndex,
            batchCount: batches.length,
            previewHandle: preview.previewHandle,
            affectedNodeIds: preview.affectedNodeIds,
            previewDelta: structuredClone(preview.previewDelta),
            completeAfterCommit: input.batchIndex === batches.length - 1,
          },
          affectedNodeIds: preview.affectedNodeIds,
        };
      },
    );
  }

  #fitGeometry(): ToolDefinition {
    return define<FitGeometryToolInput, unknown>(
      'fit_geometry', 'write', 30_000, parseFitGeometry,
      async ({ invocation, input, signal }) => {
        if (!this.#cvTools) throw new Error('FIT_CAPABILITY_UNAVAILABLE');
        const result = await this.#cvTools.invoke({
          toolCallId: `${invocation.toolCallId}:cv-fit`,
          capability: 'cv_fit_primitive',
          runId: invocation.runId,
          input: {
            handle: input.evidenceHandle,
            primitiveType: input.primitiveType,
            budget: structuredClone(CV_TOOL_BUDGETS.cv_fit_primitive),
          },
          signal,
        });
        if (result.receipt.status !== 'succeeded' || result.output === undefined) {
          throw new Error(result.receipt.errorCodes[0] ?? 'FIT_FAILED');
        }
        const output = {
          kind: 'fit' as const,
          evidenceHandle: input.evidenceHandle,
          ...(structuredClone(result.output) as Record<string, unknown>),
        };
        return this.#candidateResult(invocation, output, []);
      },
    );
  }

  #recomputeAnnotations(): ToolDefinition {
    return define<RecomputeAnnotationsToolInput, unknown>(
      'recompute_annotations', 'write', 10_000, parseRecomputeAnnotations,
      async ({ invocation, input }) => {
        const proposals = input.mode === 'remove-derived'
          ? []
          : input.geometry.flatMap((node, index) => annotationProposal(node, index));
        const conflicts = input.existingAnnotations.flatMap((annotation) => {
          if (annotation.type !== 'dimension') return [];
          const missing = annotation.targets.filter((target) => (
            !input.geometry.some((node) => node.id === target.geometryId)
          ));
          return missing.length === 0 ? [] : [{
            annotationId: annotation.id,
            code: 'ANNOTATION_TARGET_MISSING',
            geometryIds: missing.map((target) => target.geometryId),
          }];
        });
        const output = {
          kind: 'annotations' as const,
          mode: input.mode,
          proposals,
          conflicts,
          existingAnnotationIds: input.existingAnnotations.map((annotation) => annotation.id),
        };
        return this.#candidateResult(
          invocation,
          output,
          unique([
            ...input.geometry.map((node) => node.id),
            ...input.existingAnnotations.map((annotation) => annotation.id),
          ]),
        );
      },
    );
  }

  #candidateResult(
    invocation: ModelDrawingToolExecutionContext<unknown>['invocation'],
    output: { kind: GenerationCandidate['kind'] } & Record<string, unknown>,
    affectedNodeIds: string[],
    internal: Pick<
      GenerationCandidate,
      'vectorizationBatches' | 'nextVectorizationBatchIndex' | 'pendingVectorizationBatchIndex'
    > = {},
  ) {
    const handle = this.#handleFactory();
    const candidate: GenerationCandidate = {
      handle,
      runId: invocation.runId,
      episodeId: invocation.episodeId,
      drawingId: invocation.drawingId,
      revision: invocation.revision,
      kind: output.kind,
      output: structuredClone(output),
      ...structuredClone(internal),
    };
    this.#candidates.set(handle, candidate);
    return {
      output: { candidateHandle: handle, ...output },
      affectedNodeIds,
    };
  }
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  values.forEach((value) => { counts[value] = (counts[value] ?? 0) + 1; });
  return counts;
}

function parsePreviewVectorizationBatch(value: unknown): PreviewVectorizationBatchToolInput {
  const input = strictRecord(value, ['candidateHandle', 'batchIndex']);
  return {
    candidateHandle: string(input.candidateHandle, 'candidateHandle'),
    batchIndex: integer(input.batchIndex, 'batchIndex', 0),
  };
}

function annotationProposal(node: GeometryNode, index: number): AnnotationNode[] {
  const id = `annotation_candidate_${node.id}_${index}` as AnnotationId;
  const common = {
    id,
    visible: true,
    quality: { status: 'candidate' as const, confidence: 0.7, evidenceRefs: [] },
  };
  switch (node.type) {
    case 'line': {
      const value = distance(node.start, node.end);
      return [{
        ...common,
        type: 'dimension',
        dimensionKind: 'aligned',
        associationStatus: 'resolved',
        targets: [
          { geometryId: node.id, anchor: { kind: 'start' } },
          { geometryId: node.id, anchor: { kind: 'end' } },
        ],
        computedValue: value,
        textPosition: midpoint(node.start, node.end),
        definitionPoints: [node.start, node.end],
      }];
    }
    case 'circle':
      return [{
        ...common,
        type: 'dimension', dimensionKind: 'diameter', associationStatus: 'resolved',
        targets: [{ geometryId: node.id, anchor: { kind: 'center' } }],
        computedValue: node.radius * 2,
        textPosition: [node.center[0] + node.radius, node.center[1]],
        definitionPoints: [node.center],
      }];
    case 'arc':
      return [{
        ...common,
        type: 'dimension', dimensionKind: 'radius', associationStatus: 'resolved',
        targets: [{ geometryId: node.id, anchor: { kind: 'center' } }],
        computedValue: node.radius,
        textPosition: [node.center[0] + node.radius, node.center[1]],
        definitionPoints: [node.center],
      }];
    default:
      return [];
  }
}

function parseRedrawRegion(value: unknown): RedrawRegionToolInput {
  const input = strictRecord(
    value,
    ['prompt', 'contours', 'holes'],
    ['selectedIds', 'seed', 'maxPixels'],
  );
  return {
    prompt: string(input.prompt, 'prompt'),
    contours: polygons(input.contours, 'contours', true),
    holes: polygons(input.holes, 'holes', false),
    ...(input.selectedIds === undefined
      ? {}
      : { selectedIds: strings(input.selectedIds, 'selectedIds') }),
    ...(input.seed === undefined ? {} : { seed: integer(input.seed, 'seed', 0) }),
    ...(input.maxPixels === undefined
      ? {}
      : { maxPixels: integer(input.maxPixels, 'maxPixels', 1) }),
  };
}

function parseCvToolInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ModelToolInputError('CV tool input must be an object');
  }
  return structuredClone(value as Record<string, unknown>);
}

function parseSourceOverview(value: unknown): Record<string, unknown> {
  const input = strictRecord(value, ['sourceId']);
  return { sourceId: string(input.sourceId, 'sourceId') };
}

function parseSourceRegion(value: unknown): Record<string, unknown> {
  const input = strictRecord(value, ['sourceId', 'regionId']);
  return {
    sourceId: string(input.sourceId, 'sourceId'),
    regionId: string(input.regionId, 'regionId'),
  };
}

function parseVectorizeImage(value: unknown): VectorizeImageToolInput {
  const input = strictRecord(value, ['sourceId']);
  return { sourceId: string(input.sourceId, 'sourceId') };
}

function parseFitGeometry(value: unknown): FitGeometryToolInput {
  const input = strictRecord(value, ['evidenceHandle', 'primitiveType']);
  return {
    evidenceHandle: string(input.evidenceHandle, 'evidenceHandle'),
    primitiveType: enumValue(input.primitiveType, [
      'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline',
    ], 'primitiveType'),
  };
}

function parseRecomputeAnnotations(value: unknown): RecomputeAnnotationsToolInput {
  const input = strictRecord(value, ['geometry', 'existingAnnotations', 'mode']);
  if (!Array.isArray(input.geometry) || !Array.isArray(input.existingAnnotations)) {
    invalid('geometry and existingAnnotations must be arrays');
  }
  return {
    geometry: input.geometry.map((item, index) => parseGeometry(item, `geometry[${index}]`)),
    existingAnnotations: input.existingAnnotations.map((item, index) => (
      parseAnnotation(item, `existingAnnotations[${index}]`)
    )),
    mode: enumValue(input.mode, ['propose', 'reassociate', 'remove-derived'], 'mode'),
  };
}

function parseGeometry(value: unknown, path: string): GeometryNode {
  const node = plainClone(value, path) as unknown as GeometryNode;
  if (!node.id || typeof node.type !== 'string' || typeof node.visible !== 'boolean' || !node.quality) {
    invalid(`${path} is not a geometry node`);
  }
  const supported = new Set(['point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline']);
  if (!supported.has(node.type)) invalid(`${path}.type is invalid`);
  return node;
}

function parseAnnotation(value: unknown, path: string): AnnotationNode {
  const node = plainClone(value, path) as unknown as AnnotationNode;
  if (!node.id || (node.type !== 'text' && node.type !== 'dimension') || !node.quality) {
    invalid(`${path} is not an annotation node`);
  }
  return node;
}

function define<I, O>(
  name: string,
  access: 'read' | 'write',
  timeoutMs: number,
  parseInput: (value: unknown) => I,
  execute: (context: ModelDrawingToolExecutionContext<I>) => Promise<{
    output: O; revisionAfter?: RevisionId; affectedNodeIds?: string[];
  }>,
): ModelDrawingToolDefinition<I, O> {
  return { name, version: '1.0.0', access, timeoutMs, parseInput, execute };
}

function strictRecord(value: unknown, required: string[], optional: string[] = []) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid('input must be an object');
  const result = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(result).find((key) => !allowed.has(key));
  if (unknown) invalid(`unsupported field ${unknown}`);
  const missing = required.find((key) => !(key in result));
  if (missing) invalid(`missing field ${missing}`);
  return result;
}

function plainClone(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(`${path} must be an object`);
  return structuredClone(value as Record<string, unknown>);
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${path} must be a string`);
  return value;
}

function polygons(value: unknown, path: string, required: boolean): Vec2[][] {
  if (!Array.isArray(value) || required && value.length === 0) invalid(`${path} must be an array`);
  return value.map((polygon, index) => {
    if (!Array.isArray(polygon) || polygon.length < 3) invalid(`${path}[${index}] must be a polygon`);
    return polygon.map((item, pointIndex) => point(item, `${path}[${index}][${pointIndex}]`));
  });
}

function strings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(`${path} must be an array`);
  return unique(value.map((item, index) => string(item, `${path}[${index}]`)));
}

function point(value: unknown, path: string): Vec2 {
  if (!Array.isArray(value) || value.length !== 2) invalid(`${path} must be a point`);
  return [finite(value[0], path), finite(value[1], path)];
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${path} must be finite`);
  return value;
}

function integer(value: unknown, path: string, minimum: number): number {
  const result = finite(value, path);
  if (!Number.isSafeInteger(result) || result < minimum) invalid(`${path} must be an integer >= ${minimum}`);
  return result;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(`${path} is invalid`);
  return value as T;
}

function invalid(message: string): never {
  throw new ModelToolInputError(message);
}

function midpoint(left: Vec2, right: Vec2): Vec2 {
  return [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(right[0] - left[0], right[1] - left[1]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function polygonBounds(contours: Vec2[][]) {
  const points = contours.flat();
  return {
    minX: Math.min(...points.map((item) => item[0])),
    minY: Math.min(...points.map((item) => item[1])),
    maxX: Math.max(...points.map((item) => item[0])),
    maxY: Math.max(...points.map((item) => item[1])),
  };
}

async function renderWorldMask(input: {
  contours: Vec2[][];
  holes: Vec2[][];
  width: number;
  height: number;
  worldToImage: AffineTransform;
}): Promise<Buffer> {
  const path = [...input.contours, ...input.holes]
    .map((polygon) => polygon.map((item, index) => {
      const [x, y] = transformPoint(input.worldToImage, item);
      return `${index === 0 ? 'M' : 'L'}${normalizedNumber(x)} ${normalizedNumber(y)}`;
    }).join(' ') + ' Z')
    .join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}"><rect width="100%" height="100%" fill="black"/><path d="${path}" fill="white" fill-rule="evenodd"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function pngFromDataUrl(value: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.byteLength > 0 ? bytes : null;
}

function invertAffine(transform: AffineTransform): AffineTransform {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('GENERATION_TRANSFORM_SINGULAR');
  }
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function redrawPrompt(prompt: string): string {
  return [
    prompt,
    '保持未被修改的二维几何、连接关系与轮廓连续性；仅当用户意图明确要求时才改变它们。',
    '输出白底黑线的干净二维线稿，不添加文字、水印、阴影或填充。',
  ].join('\n');
}

function stableSeed(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function normalizedNumber(value: number): number {
  const rounded = Math.round(value * 1_000_000_000) / 1_000_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
