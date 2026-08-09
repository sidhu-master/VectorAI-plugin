import { createHash } from 'node:crypto';

import type {
  DrawingCommand,
  EvidenceId,
  GeometryId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type { SlotObservationInput } from '../drawing-feedback/types.js';
import type {
  CleanLinePrimitiveCandidate,
  PersistedCleanLineStrokeChain,
  PersistedCleanLineVectorizationResult,
} from './types.js';

const PAGE_WIDTH_MM = 500;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface DrawingVectorizationStep {
  kind: 'draft' | 'promotion';
  chainId: string;
  slotObservation: SlotObservationInput;
  previewNode: GeometryNode;
  commands: DrawingCommand[];
  bounds: PersistedCleanLineStrokeChain['bounds'];
  confidence: number;
  validation: {
    pipelineVersion: string;
    fitErrorP95?: number;
    thresholdPx: number;
    accepted: true;
  };
}

export function buildVectorizationSteps(
  result: PersistedCleanLineVectorizationResult,
): DrawingVectorizationStep[] {
  const thresholdPx = Math.max(1.5, result.medianLineWidthPx * 0.5);
  const ordered = [...result.chains].sort((left, right) => (
    right.bounds.width * right.bounds.height - left.bounds.width * left.bounds.height
    || left.bounds.y - right.bounds.y
    || left.bounds.x - right.bounds.x
    || left.id.localeCompare(right.id)
  ));
  const drafts = ordered.flatMap((chain): DrawingVectorizationStep[] => {
    const node = polylineNode(result, chain);
    if (!node) return [];
    return [{
      kind: 'draft',
      chainId: chain.id,
      slotObservation: slotObservation(result.sourceId, chain, false),
      previewNode: node,
      commands: [{ type: 'geometry.create', value: node }],
      bounds: { ...chain.bounds },
      confidence: chain.evidence.confidence,
      validation: {
        pipelineVersion: result.pipelineVersion,
        thresholdPx,
        accepted: true,
      },
    }];
  });
  const draftIds = new Set(drafts.map((step) => step.chainId));
  const promotions = ordered.flatMap((chain): DrawingVectorizationStep[] => {
    if (!draftIds.has(chain.id) || !validCandidate(chain, thresholdPx)) return [];
    const node = candidateNode(result, chain, chain.candidate!);
    if (!node) return [];
    return [{
      kind: 'promotion',
      chainId: chain.id,
      slotObservation: slotObservation(result.sourceId, chain, true),
      previewNode: node,
      commands: [
        { type: 'geometry.delete', id: node.id },
        { type: 'geometry.create', value: node },
      ],
      bounds: { ...chain.bounds },
      confidence: chain.candidate!.confidence,
      validation: {
        pipelineVersion: result.pipelineVersion,
        fitErrorP95: chain.candidate!.fitErrorP95,
        thresholdPx,
        accepted: true,
      },
    }];
  });
  return [...drafts, ...promotions];
}

function polylineNode(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
): Extract<GeometryNode, { type: 'polyline' }> | null {
  const points = chain.simplified.slice(0, 256).map((point) => sourcePoint(result, point));
  const minimum = chain.closed ? 3 : 2;
  if (points.length < minimum) return null;
  return {
    ...commonNode(result.sourceId, chain, chain.evidence.confidence),
    type: 'polyline',
    vertices: points.map((point) => ({ point })),
    closed: chain.closed,
  };
}

function candidateNode(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
  candidate: CleanLinePrimitiveCandidate,
): GeometryNode | null {
  const common = commonNode(result.sourceId, chain, candidate.confidence);
  const parameters = candidate.parameters;
  switch (candidate.type) {
    case 'line':
      return sourcePointValue(parameters.start, result) && sourcePointValue(parameters.end, result)
        ? {
            ...common, type: 'line',
            start: sourcePoint(result, parameters.start as Vec2),
            end: sourcePoint(result, parameters.end as Vec2),
          }
        : null;
    case 'circle':
      return sourcePointValue(parameters.center, result) && positive(parameters.radius)
        ? {
            ...common, type: 'circle',
            center: sourcePoint(result, parameters.center as Vec2),
            radius: round(parameters.radius * scale(result)),
          }
        : null;
    case 'arc':
      return sourcePointValue(parameters.center, result) && positive(parameters.radius)
        && finite(parameters.startAngle) && finite(parameters.endAngle)
        ? {
            ...common, type: 'arc',
            center: sourcePoint(result, parameters.center as Vec2),
            radius: round(parameters.radius * scale(result)),
            startAngle: normalizeDegrees(-parameters.startAngle),
            endAngle: normalizeDegrees(-parameters.endAngle),
            counterClockwise: typeof parameters.counterClockwise === 'boolean'
              ? !parameters.counterClockwise
              : true,
          }
        : null;
    case 'ellipse':
      return sourcePointValue(parameters.center, result) && vectorValue(parameters.majorAxis)
        && positive(parameters.ratio)
        ? {
            ...common, type: 'ellipse',
            center: sourcePoint(result, parameters.center as Vec2),
            majorAxis: sourceVector(result, parameters.majorAxis as Vec2),
            ratio: parameters.ratio,
          }
        : null;
  }
}

function validCandidate(chain: PersistedCleanLineStrokeChain, thresholdPx: number): boolean {
  const candidate = chain.candidate;
  if (!candidate || !finite(candidate.fitErrorP95) || candidate.fitErrorP95 > thresholdPx
    || !finite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    return false;
  }
  const diagonal = Math.hypot(chain.bounds.width, chain.bounds.height);
  switch (candidate.type) {
    case 'line':
      return !chain.closed
        && pointValue(candidate.parameters.start) && pointValue(candidate.parameters.end);
    case 'circle':
      return chain.closed && pointValue(candidate.parameters.center)
        && plausibleRadius(candidate.parameters.radius, diagonal);
    case 'arc':
      return !chain.closed && pointValue(candidate.parameters.center)
        && plausibleRadius(candidate.parameters.radius, diagonal)
        && finite(candidate.parameters.sweepDegrees)
        && candidate.parameters.sweepDegrees >= 5 && candidate.parameters.sweepDegrees <= 330;
    case 'ellipse':
      return chain.closed && pointValue(candidate.parameters.center)
        && vectorValue(candidate.parameters.majorAxis)
        && positive(candidate.parameters.ratio) && candidate.parameters.ratio <= 1;
  }
}

function slotObservation(
  sourceId: string,
  chain: PersistedCleanLineStrokeChain,
  includeCandidate: boolean,
): SlotObservationInput {
  const candidates: SlotObservationInput['candidateTypes'] = [
    { type: 'polyline', score: chain.evidence.confidence },
  ];
  if (includeCandidate && chain.candidate) {
    candidates.unshift({ type: chain.candidate.type, score: chain.candidate.confidence });
  }
  return {
    sourceId,
    evidence: {
      handle: chain.evidence.handle,
      kind: chain.evidence.kind,
      bounds: { ...chain.evidence.bounds },
      confidence: chain.evidence.confidence,
      touchesRegionEdge: chain.evidence.touchesRegionEdge,
    },
    candidateTypes: candidates,
  };
}

function commonNode(
  sourceId: string,
  chain: PersistedCleanLineStrokeChain,
  confidence: number,
) {
  return {
    id: stableVectorNodeId(sourceId, chain.id) as GeometryId,
    visible: true,
    quality: {
      status: confidence < LOW_CONFIDENCE_THRESHOLD ? 'candidate' as const : 'confirmed' as const,
      confidence,
      evidenceRefs: [chain.evidence.handle as EvidenceId],
    },
  };
}

export function stableVectorNodeId(sourceId: string, chainId: string): string {
  return `node_vec_${createHash('sha256')
    .update(`${sourceId}\0${chainId}`)
    .digest('hex')
    .slice(0, 20)}`;
}

function sourcePoint(result: Pick<PersistedCleanLineVectorizationResult, 'width' | 'height'>, point: Vec2): Vec2 {
  const factor = scale(result);
  return [round(point[0] * factor), round((result.height - point[1]) * factor)];
}

function sourceVector(result: Pick<PersistedCleanLineVectorizationResult, 'width'>, vector: Vec2): Vec2 {
  const factor = scale(result);
  return [round(vector[0] * factor), round(-vector[1] * factor)];
}

function scale(result: Pick<PersistedCleanLineVectorizationResult, 'width'>): number {
  return PAGE_WIDTH_MM / result.width;
}

function sourcePointValue(
  value: unknown,
  result: Pick<PersistedCleanLineVectorizationResult, 'width' | 'height'>,
): boolean {
  return pointValue(value)
    && value[0] >= 0 && value[0] <= result.width
    && value[1] >= 0 && value[1] <= result.height;
}

function pointValue(value: unknown): value is Vec2 {
  return Array.isArray(value) && value.length === 2 && value.every(finite);
}

function vectorValue(value: unknown): value is Vec2 {
  return pointValue(value) && Math.hypot(value[0], value[1]) > 0;
}

function plausibleRadius(value: unknown, diagonal: number): value is number {
  return positive(value) && diagonal > 0 && value <= diagonal * 4;
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeDegrees(value: number): number {
  return round((value % 360 + 360) % 360);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
