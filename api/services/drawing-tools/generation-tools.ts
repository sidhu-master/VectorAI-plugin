import { randomUUID } from 'node:crypto';

import type {
  AnnotationId,
  AnnotationNode,
  EvidenceId,
  GeometryId,
  GeometryNode,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import type { DrawingCvToolRegistry } from '../drawing-cv/tool-registry.js';
import type { CvPrimitiveType, CvToolBudget } from '../drawing-cv/types.js';
import type { DrawingRegionRedrawService } from '../drawing-generation/redraw-service.js';
import type { DrawingRegionRedrawInput } from '../drawing-generation/types.js';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service.js';
import { ModelToolInputError } from './registry.js';
import type {
  ModelDrawingToolDefinition,
  ModelDrawingToolExecutionContext,
} from './types.js';

type ToolDefinition = ModelDrawingToolDefinition<any, any>;

interface GenerationCandidate {
  handle: string;
  runId: string;
  episodeId: string;
  drawingId: string;
  revision: RevisionId;
  kind: 'redraw' | 'vectorization' | 'fit' | 'annotations';
  output: unknown;
}

interface RedrawRegionToolInput {
  prompt: string;
  cropPngBase64: string;
  maskPngBase64: string;
  protectedMaskPngBase64: string;
  cropPixelToWorld: readonly [number, number, number, number, number, number];
  contours: Vec2[][];
  holes: Vec2[][];
  seed: number;
  maxPixels: number;
}

interface VectorizeImageToolInput {
  sourceId: string;
  maxPixels: number;
}

interface FitGeometryToolInput {
  evidenceHandle: string;
  primitiveType: CvPrimitiveType;
  budget: CvToolBudget;
}

interface RecomputeAnnotationsToolInput {
  geometry: GeometryNode[];
  existingAnnotations: AnnotationNode[];
  mode: 'propose' | 'reassociate' | 'remove-derived';
}

export class DrawingGenerationTools {
  readonly definitions: readonly ToolDefinition[];
  readonly #redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
  readonly #vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  readonly #cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
  readonly #handleFactory: () => string;
  readonly #candidates = new Map<string, GenerationCandidate>();
  #fallbackProbe?: () => void;

  constructor(input: {
    redraw?: Pick<DrawingRegionRedrawService, 'redraw'>;
    vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
    cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
    handleFactory?: () => string;
  } = {}) {
    this.#redraw = input.redraw;
    this.#vectorization = input.vectorization;
    this.#cvTools = input.cvTools;
    this.#handleFactory = input.handleFactory ?? (() => `generation_${randomUUID()}`);
    this.definitions = Object.freeze([
      this.#redrawRegion(),
      this.#vectorizeImage(),
      this.#fitGeometry(),
      this.#recomputeAnnotations(),
    ]);
  }

  snapshot(): { candidateCount: number; commitCount: 0 } {
    return { candidateCount: this.#candidates.size, commitCount: 0 };
  }

  readCandidate(handle: string): GenerationCandidate | null {
    const candidate = this.#candidates.get(handle);
    return candidate ? structuredClone(candidate) : null;
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

  /** Test seam that proves generation failures never call a geometric fallback. */
  setFallbackProbeForTest(probe: () => void): void {
    this.#fallbackProbe = probe;
  }

  #redrawRegion(): ToolDefinition {
    return define<RedrawRegionToolInput, unknown>(
      'redraw_region', 'write', 120_000, parseRedrawRegion,
      async ({ invocation, input, signal }) => {
        if (!this.#redraw) throw new Error('GENERATION_CAPABILITY_UNAVAILABLE');
        const result = await this.#redraw.redraw({
          prompt: input.prompt,
          cropPng: Buffer.from(input.cropPngBase64, 'base64'),
          maskPng: Buffer.from(input.maskPngBase64, 'base64'),
          protectedMaskPng: Buffer.from(input.protectedMaskPngBase64, 'base64'),
          cropPixelToWorld: input.cropPixelToWorld,
          authorizedContours: input.contours,
          authorizedHoles: input.holes,
          seed: input.seed,
          maxPixels: input.maxPixels,
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
          maxPixels: input.maxPixels,
          signal,
        });
        const output = {
          kind: 'vectorization' as const,
          sourceId: result.sourceId,
          pipelineVersion: result.pipelineVersion,
          width: result.width,
          height: result.height,
          analysisScale: result.analysisScale,
          medianLineWidthPx: result.medianLineWidthPx,
          chains: structuredClone(result.chains),
        };
        return this.#candidateResult(invocation, output, []);
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
            budget: input.budget,
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
    };
    this.#candidates.set(handle, candidate);
    return {
      output: { candidateHandle: handle, ...output },
      affectedNodeIds,
    };
  }
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
  const input = strictRecord(value, [
    'prompt', 'cropPngBase64', 'maskPngBase64', 'protectedMaskPngBase64',
    'cropPixelToWorld', 'contours', 'holes', 'seed', 'maxPixels',
  ]);
  return {
    prompt: string(input.prompt, 'prompt'),
    cropPngBase64: base64(input.cropPngBase64, 'cropPngBase64'),
    maskPngBase64: base64(input.maskPngBase64, 'maskPngBase64'),
    protectedMaskPngBase64: base64(input.protectedMaskPngBase64, 'protectedMaskPngBase64'),
    cropPixelToWorld: affine(input.cropPixelToWorld),
    contours: polygons(input.contours, 'contours', true),
    holes: polygons(input.holes, 'holes', false),
    seed: integer(input.seed, 'seed', 0),
    maxPixels: integer(input.maxPixels, 'maxPixels', 1),
  };
}

function parseVectorizeImage(value: unknown): VectorizeImageToolInput {
  const input = strictRecord(value, ['sourceId', 'maxPixels']);
  return {
    sourceId: string(input.sourceId, 'sourceId'),
    maxPixels: integer(input.maxPixels, 'maxPixels', 1),
  };
}

function parseFitGeometry(value: unknown): FitGeometryToolInput {
  const input = strictRecord(value, ['evidenceHandle', 'primitiveType', 'budget']);
  const budget = strictRecord(input.budget, [
    'maxPixels', 'maxResults', 'maxSamplesPerResult', 'timeoutMs',
  ]);
  return {
    evidenceHandle: string(input.evidenceHandle, 'evidenceHandle'),
    primitiveType: enumValue(input.primitiveType, [
      'point', 'line', 'ray', 'xline', 'circle', 'arc', 'ellipse', 'polyline', 'spline',
    ], 'primitiveType'),
    budget: {
      maxPixels: integer(budget.maxPixels, 'budget.maxPixels', 1),
      maxResults: integer(budget.maxResults, 'budget.maxResults', 1),
      maxSamplesPerResult: integer(budget.maxSamplesPerResult, 'budget.maxSamplesPerResult', 1),
      timeoutMs: integer(budget.timeoutMs, 'budget.timeoutMs', 1),
    },
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

function base64(value: unknown, path: string): string {
  const result = string(value, path);
  const decoded = Buffer.from(result, 'base64');
  if (decoded.length === 0 || decoded.toString('base64').replace(/=+$/, '') !== result.replace(/=+$/, '')) {
    invalid(`${path} must be base64`);
  }
  return result;
}

function affine(value: unknown): readonly [number, number, number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 6) invalid('cropPixelToWorld must have 6 values');
  return value.map((item) => finite(item, 'cropPixelToWorld')) as unknown as readonly [
    number, number, number, number, number, number,
  ];
}

function polygons(value: unknown, path: string, required: boolean): Vec2[][] {
  if (!Array.isArray(value) || required && value.length === 0) invalid(`${path} must be an array`);
  return value.map((polygon, index) => {
    if (!Array.isArray(polygon) || polygon.length < 3) invalid(`${path}[${index}] must be a polygon`);
    return polygon.map((item, pointIndex) => point(item, `${path}[${index}][${pointIndex}]`));
  });
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
