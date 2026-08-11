import type {
  EvidenceId,
  GeometryId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';
import { pointInPolygonRegion } from '../drawing-spatial/polygon.js';
import { stableVectorNodeId } from '../drawing-vectorization/build-steps.js';
import type {
  PersistedCleanLineStrokeChain,
  PersistedCleanLineVectorizationResult,
} from '../drawing-vectorization/types.js';
import type { SourceArtifactStore } from '../source-artifacts/types.js';
import type {
  DrawingRegionImageEditProvider,
  DrawingRegionRedrawInput,
} from './types.js';

interface GeneratedVectorizationService {
  vectorizeSource(input: {
    sourceId: string;
    maxPixels: number;
    signal: AbortSignal;
  }): Promise<PersistedCleanLineVectorizationResult>;
}

export class DrawingRegionRedrawService {
  readonly #provider: DrawingRegionImageEditProvider;
  readonly #sourceArtifacts: SourceArtifactStore;
  readonly #vectorization: GeneratedVectorizationService;

  constructor(input: {
    provider: DrawingRegionImageEditProvider;
    sourceArtifacts: SourceArtifactStore;
    vectorization: GeneratedVectorizationService;
  }) {
    this.#provider = input.provider;
    this.#sourceArtifacts = input.sourceArtifacts;
    this.#vectorization = input.vectorization;
  }

  async redraw(input: DrawingRegionRedrawInput) {
    assertInput(input);
    const generated = await this.#provider.edit(input);
    if (input.signal.aborted) throw input.signal.reason ?? new Error('GENERATION_ABORTED');
    const generatedSource = await this.#sourceArtifacts.put({
      data: generated.png.toString('base64'), mimeType: 'image/png', page: 1,
    });
    input.onStage?.('generated');
    input.onStage?.('vectorizing');
    const vectorized = await this.#vectorization.vectorizeSource({
      sourceId: generatedSource.sourceId,
      maxPixels: input.maxPixels,
      signal: input.signal,
    });
    const geometry = projectGeneratedVectorization({
      result: vectorized,
      cropPixelToWorld: input.cropPixelToWorld,
      authorizedContours: input.authorizedContours,
      authorizedHoles: input.authorizedHoles,
    });
    if (geometry.length === 0) throw new Error('GENERATION_VECTORIZATION_EMPTY');
    return {
      generatedSource,
      providerRequestId: generated.providerRequestId,
      pipelineVersion: vectorized.pipelineVersion,
      geometry,
    };
  }
}

export function projectGeneratedVectorization(input: {
  result: PersistedCleanLineVectorizationResult;
  cropPixelToWorld: AffineTransform;
  authorizedContours: readonly (readonly Vec2[])[];
  authorizedHoles: readonly (readonly Vec2[])[];
}): GeometryNode[] {
  return input.result.chains.flatMap((chain) => projectChain(chain, input));
}

function projectChain(
  chain: PersistedCleanLineStrokeChain,
  input: Parameters<typeof projectGeneratedVectorization>[0],
): GeometryNode[] {
  const points = chain.simplified.map((point) => transformPoint(input.cropPixelToWorld, point));
  const inside = (point: Vec2) => pointInPolygonRegion(
    point, input.authorizedContours, input.authorizedHoles,
  );
  if (points.length < 2) return [];
  if (points.every(inside) && chain.candidate) {
    const analytic = analyticNode(chain, input.cropPixelToWorld, points);
    if (analytic) return [analytic];
  }
  return insideRuns(points, inside).map((run, index) => ({
    ...commonNode(chain, index),
    type: 'polyline' as const,
    vertices: run.map((point) => ({ point })),
    closed: chain.closed && run.length === points.length,
  }));
}

function analyticNode(
  chain: PersistedCleanLineStrokeChain,
  transform: AffineTransform,
  projectedPoints: Vec2[],
): GeometryNode | null {
  const candidate = chain.candidate;
  if (!candidate) return null;
  const parameters = candidate.parameters;
  const common = commonNode(chain);
  const scale = uniformScale(transform);
  switch (candidate.type) {
    case 'line': {
      const start = point(parameters.start);
      const end = point(parameters.end);
      return start && end
        ? { ...common, type: 'line', start: transformPoint(transform, start), end: transformPoint(transform, end) }
        : null;
    }
    case 'circle': {
      const center = point(parameters.center);
      return center && scale && positive(parameters.radius)
        ? { ...common, type: 'circle', center: transformPoint(transform, center), radius: round(parameters.radius * scale) }
        : null;
    }
    case 'arc': {
      const center = point(parameters.center);
      if (!center || !scale || !positive(parameters.radius) || projectedPoints.length < 2) return null;
      const worldCenter = transformPoint(transform, center);
      return {
        ...common, type: 'arc', center: worldCenter, radius: round(parameters.radius * scale),
        startAngle: angle(worldCenter, projectedPoints[0]),
        endAngle: angle(worldCenter, projectedPoints.at(-1)!),
        counterClockwise: determinant(transform) < 0
          ? !(parameters.counterClockwise === true)
          : parameters.counterClockwise !== false,
      };
    }
    case 'ellipse': {
      const center = point(parameters.center);
      const majorAxis = point(parameters.majorAxis);
      if (!center || !majorAxis || !positive(parameters.ratio)) return null;
      return {
        ...common, type: 'ellipse', center: transformPoint(transform, center),
        majorAxis: transformVector(transform, majorAxis), ratio: parameters.ratio,
      };
    }
  }
}

function commonNode(chain: PersistedCleanLineStrokeChain, suffix?: number) {
  const confidence = chain.candidate?.confidence ?? chain.evidence.confidence;
  const baseId = stableVectorNodeId(chain.evidence.sourceId, chain.id);
  return {
    id: `${baseId}${suffix === undefined ? '' : `_${suffix}`}` as GeometryId,
    visible: true,
    quality: {
      status: confidence < 0.6 ? 'candidate' as const : 'confirmed' as const,
      confidence,
      evidenceRefs: [chain.evidence.handle as EvidenceId],
    },
  };
}

function insideRuns(points: Vec2[], inside: (point: Vec2) => boolean): Vec2[][] {
  const runs: Vec2[][] = [];
  let active: Vec2[] = [];
  for (const item of points) {
    if (inside(item)) active.push(item);
    else if (active.length > 0) {
      if (active.length >= 2) runs.push(active);
      active = [];
    }
  }
  if (active.length >= 2) runs.push(active);
  return runs;
}

function assertInput(input: DrawingRegionRedrawInput): void {
  if (!input.prompt.trim()) throw new Error('GENERATION_PROMPT_EMPTY');
  if (!Number.isSafeInteger(input.maxPixels) || input.maxPixels < 1) {
    throw new Error('GENERATION_PIXEL_BUDGET_INVALID');
  }
  if (input.authorizedContours.length === 0) throw new Error('GENERATION_REGION_EMPTY');
}

function transformPoint(matrix: AffineTransform, value: Vec2): Vec2 {
  return [
    round(matrix[0] * value[0] + matrix[2] * value[1] + matrix[4]),
    round(matrix[1] * value[0] + matrix[3] * value[1] + matrix[5]),
  ];
}

function transformVector(matrix: AffineTransform, value: Vec2): Vec2 {
  return [round(matrix[0] * value[0] + matrix[2] * value[1]),
    round(matrix[1] * value[0] + matrix[3] * value[1])];
}

function uniformScale(matrix: AffineTransform): number | null {
  const left = Math.hypot(matrix[0], matrix[1]);
  const right = Math.hypot(matrix[2], matrix[3]);
  const dot = matrix[0] * matrix[2] + matrix[1] * matrix[3];
  return Math.abs(left - right) <= 1e-8 * Math.max(left, right, 1)
    && Math.abs(dot) <= 1e-8 * Math.max(left * right, 1)
    ? (left + right) / 2
    : null;
}

function determinant(matrix: AffineTransform): number {
  return matrix[0] * matrix[3] - matrix[1] * matrix[2];
}

function point(value: unknown): Vec2 | null {
  return Array.isArray(value) && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? value as unknown as Vec2
    : null;
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function angle(center: Vec2, value: Vec2): number {
  const degrees = Math.atan2(value[1] - center[1], value[0] - center[0]) * 180 / Math.PI;
  return round((degrees + 360) % 360);
}

function round(value: number): number {
  const result = Math.round(value * 1_000_000_000) / 1_000_000_000;
  return Object.is(result, -0) ? 0 : result;
}
