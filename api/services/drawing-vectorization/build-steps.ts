import { createHash } from 'node:crypto';

import type {
  DrawingCommand,
  EvidenceId,
  FeatureId,
  GeometryId,
  GeometryNode,
  RelationId,
  SemanticFeature,
  TopologyRelation,
  Vec2,
} from '../../../src/drawing/index.js';
import type { SlotObservationInput } from '../drawing-feedback/types.js';
import type {
  CleanLinePrimitiveCandidate,
  CleanLineStrokePiece,
  PersistedCleanLineStrokeChain,
  PersistedCleanLineVectorizationResult,
} from './types.js';

const PAGE_WIDTH_MM = 500;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const DEFAULT_BATCH_NODE_LIMIT = 48;

interface DrawingVectorizationChainResult {
  chainId: string;
  slotObservation: SlotObservationInput;
  nodeIds: GeometryId[];
  confidence: number;
  validation: DrawingVectorizationStep['validation'];
}

export interface DrawingVectorizationStep {
  kind: 'final';
  batchIndex: number;
  chainIds: string[];
  chains: DrawingVectorizationChainResult[];
  previewNodes: GeometryNode[];
  commands: DrawingCommand[];
  bounds: PersistedCleanLineStrokeChain['bounds'];
  confidence: number;
  validation: {
    pipelineVersion: string;
    fitErrorP95: number[];
    thresholdPx: number;
    junctionGapMaxPx: number;
    accepted: true;
  };
}

export function buildVectorizationSteps(
  result: PersistedCleanLineVectorizationResult,
  options: { maxNodesPerBatch?: number } = {},
): DrawingVectorizationStep[] {
  const maxNodesPerBatch = options.maxNodesPerBatch ?? DEFAULT_BATCH_NODE_LIMIT;
  if (!Number.isInteger(maxNodesPerBatch) || maxNodesPerBatch < 1) {
    throw new Error('VECTORIZATION_BATCH_NODE_LIMIT_INVALID');
  }
  const ordered = [...result.chains].sort((left, right) => (
    right.bounds.width * right.bounds.height - left.bounds.width * left.bounds.height
    || left.bounds.y - right.bounds.y
    || left.bounds.x - right.bounds.x
    || left.id.localeCompare(right.id)
  ));
  const units = ordered.flatMap((chain): DrawingVectorizationUnit[] => {
    const unit = finalChainUnit(result, chain);
    return unit ? [unit] : [];
  });
  return packUnits(units, maxNodesPerBatch).map((batch, batchIndex) => ({
    kind: 'final',
    batchIndex,
    chainIds: batch.flatMap((unit) => unit.chains.map((chain) => chain.chainId)),
    chains: batch.flatMap((unit) => unit.chains.map((chain) => structuredClone(chain))),
    previewNodes: batch.flatMap((unit) => unit.previewNodes.map((node) => structuredClone(node))),
    commands: batch.flatMap((unit) => unit.commands.map((command) => structuredClone(command))),
    bounds: unionBounds(batch.map((unit) => unit.bounds)),
    confidence: average(batch.map((unit) => unit.confidence)),
    validation: {
      pipelineVersion: result.pipelineVersion,
      fitErrorP95: batch.flatMap((unit) => unit.validation.fitErrorP95),
      thresholdPx: Math.max(...batch.map((unit) => unit.validation.thresholdPx)),
      junctionGapMaxPx: Math.max(...batch.map((unit) => unit.validation.junctionGapMaxPx)),
      accepted: true,
    },
  }));
}

type DrawingVectorizationUnit = Omit<DrawingVectorizationStep, 'kind' | 'batchIndex' | 'chainIds'>;

function finalChainUnit(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
): DrawingVectorizationUnit | null {
  const pieceNodes = needsPromotion(chain)
    ? chain.pieces.flatMap((piece, index): GeometryNode[] => {
        const node = pieceNode(result, chain, piece, index);
        return node ? [node] : [];
      })
    : [];
  const completePieceSet = pieceNodes.length === chain.pieces.length && pieceNodes.length > 0;
  const resolved = completePieceSet && pieceNodes.length > 1
    ? resolveCompoundJunctions(result, chain, pieceNodes)
    : completePieceSet
      ? { nodes: pieceNodes, junctions: [] }
      : null;
  const usePieceNodes = resolved !== null;
  const fallback = usePieceNodes ? null : chainPolylineNode(result, chain);
  const nodes = resolved?.nodes ?? (fallback ? [fallback] : []);
  if (nodes.length === 0) return null;
  const relations = nodes.length > 1
    ? compoundRelations(result.sourceId, chain, nodes)
    : [];
  const feature = nodes.length > 1
    ? compoundFeature(result, chain, nodes, relations, resolved?.junctions ?? [])
    : null;
  const confidence = average(nodes.map((node) => (
    node.quality.confidence ?? chain.evidence.confidence
  )));
  const validation = {
    pipelineVersion: result.pipelineVersion,
    fitErrorP95: usePieceNodes
      ? chain.pieces.flatMap((piece) => piece.candidate ? [piece.candidate.fitErrorP95] : [])
      : [],
    thresholdPx: chain.segmentation.fitTolerancePx,
    junctionGapMaxPx: maximumJunctionGapPx(result, chain, nodes),
    accepted: true as const,
  };
  return {
    chains: [{
      chainId: chain.id,
      slotObservation: slotObservation(result.sourceId, chain, usePieceNodes),
      nodeIds: nodes.map((node) => node.id),
      confidence,
      validation: structuredClone(validation),
    }],
    previewNodes: nodes,
    commands: [
      ...nodes.map((node): DrawingCommand => ({ type: 'geometry.create', value: node })),
      ...relations.map((relation): DrawingCommand => ({ type: 'relation.create', value: relation })),
      ...(feature ? [{ type: 'feature.create', value: feature } as DrawingCommand] : []),
    ],
    bounds: { ...chain.bounds },
    confidence,
    validation,
  };
}

function packUnits(
  units: DrawingVectorizationUnit[],
  maxNodesPerBatch: number,
): DrawingVectorizationUnit[][] {
  const batches: DrawingVectorizationUnit[][] = [];
  let current: DrawingVectorizationUnit[] = [];
  let currentNodeCount = 0;
  for (const unit of units) {
    const nodeCount = unit.previewNodes.length;
    if (current.length > 0 && currentNodeCount + nodeCount > maxNodesPerBatch) {
      batches.push(current);
      current = [];
      currentNodeCount = 0;
    }
    current.push(unit);
    currentNodeCount += nodeCount;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function unionBounds(
  bounds: PersistedCleanLineStrokeChain['bounds'][],
): PersistedCleanLineStrokeChain['bounds'] {
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function needsPromotion(chain: PersistedCleanLineStrokeChain): boolean {
  return chain.pieces.length > 1 || (
    chain.pieces.length === 1
    && validCandidate(chain.pieces[0], chain.segmentation.fitTolerancePx)
  );
}

function chainPolylineNode(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
): Extract<GeometryNode, { type: 'polyline' }> | null {
  const points = chain.simplified.slice(0, 256).map((point) => sourcePoint(result, point));
  const minimum = chain.closed ? 3 : 2;
  if (points.length < minimum) return null;
  return {
    ...commonNode(
      stableVectorNodeId(result.sourceId, chain.id),
      chain,
      chain.evidence.confidence,
    ),
    type: 'polyline',
    vertices: points.map((point) => ({ point })),
    closed: chain.closed,
  };
}

function pieceNode(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
  piece: CleanLineStrokePiece,
  index: number,
): GeometryNode | null {
  const id = chain.pieces.length === 1
    ? stableVectorNodeId(result.sourceId, chain.id)
    : stableVectorPieceNodeId(result.sourceId, chain.id, piece.id, index);
  if (validCandidate(piece, chain.segmentation.fitTolerancePx)) {
    const node = candidateNode(result, chain, piece, piece.candidate!, id);
    if (node) return node;
  }
  const points = piece.simplified.slice(0, 256).map((point) => sourcePoint(result, point));
  const minimum = piece.closed ? 3 : 2;
  if (points.length < minimum) return null;
  return {
    ...commonNode(id, chain, chain.evidence.confidence),
    type: 'polyline',
    vertices: points.map((point) => ({ point })),
    closed: piece.closed,
  };
}

function candidateNode(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
  piece: CleanLineStrokePiece,
  candidate: CleanLinePrimitiveCandidate,
  id: string,
): GeometryNode | null {
  const common = commonNode(id, chain, candidate.confidence);
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

function validCandidate(piece: CleanLineStrokePiece, thresholdPx: number): boolean {
  const candidate = piece.candidate;
  if (!candidate || !finite(candidate.fitErrorP95) || candidate.fitErrorP95 > thresholdPx
    || !finite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    return false;
  }
  const diagonal = Math.hypot(piece.bounds.width, piece.bounds.height);
  switch (candidate.type) {
    case 'line':
      return !piece.closed
        && pointValue(candidate.parameters.start) && pointValue(candidate.parameters.end)
        && distanceBetween(candidate.parameters.start, candidate.parameters.end) > 0;
    case 'circle':
      return piece.closed && pointValue(candidate.parameters.center)
        && plausibleRadius(candidate.parameters.radius, diagonal);
    case 'arc':
      return !piece.closed && pointValue(candidate.parameters.center)
        && plausibleRadius(candidate.parameters.radius, diagonal)
        && finite(candidate.parameters.sweepDegrees)
        && candidate.parameters.sweepDegrees >= 5 && candidate.parameters.sweepDegrees <= 330;
    case 'ellipse':
      return piece.closed && pointValue(candidate.parameters.center)
        && vectorValue(candidate.parameters.majorAxis)
        && positive(candidate.parameters.ratio) && candidate.parameters.ratio <= 1;
  }
}

function compoundRelations(
  sourceId: string,
  chain: PersistedCleanLineStrokeChain,
  nodes: GeometryNode[],
): TopologyRelation[] {
  const pairCount = chain.closed ? nodes.length : nodes.length - 1;
  return Array.from({ length: pairCount }, (_, index) => {
    const left = nodes[index];
    const right = nodes[(index + 1) % nodes.length];
    return {
      id: stableVectorRelationId(sourceId, chain.id, index) as RelationId,
      type: 'topology', plane: 'topology', kind: 'connected',
      nodeIds: [left.id, right.id], visible: true,
      quality: {
        status: 'confirmed', confidence: Math.min(
          left.quality.confidence ?? 1,
          right.quality.confidence ?? 1,
        ),
        evidenceRefs: [chain.evidence.handle as EvidenceId],
      },
    };
  });
}

function compoundFeature(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
  nodes: GeometryNode[],
  relations: TopologyRelation[],
  junctions: CompoundJunction[],
): SemanticFeature {
  return {
    id: stableVectorFeatureId(result.sourceId, chain.id) as FeatureId,
    type: 'feature', semanticType: 'compound-path', visible: true,
    geometryIds: nodes.map((node) => node.id), annotationIds: [],
    relationIds: relations.map((relation) => relation.id),
    properties: {
      sourceChainId: chain.id,
      ordered: true,
      closed: chain.closed,
      sampleRanges: chain.pieces.map((piece) => [...piece.sampleRange]),
      wraps: chain.pieces.map((piece) => piece.wraps),
      junctions,
      algorithmVersion: chain.segmentation.algorithmVersion,
    },
    quality: {
      status: nodes.some((node) => node.quality.status === 'candidate') ? 'candidate' : 'confirmed',
      confidence: average(nodes.map((node) => node.quality.confidence ?? chain.evidence.confidence)),
      evidenceRefs: [chain.evidence.handle as EvidenceId],
    },
  };
}

interface CompoundJunction {
  atMemberIndex: number;
  point: Vec2;
  kind: 'corner';
}

interface ResolvedCompoundPath {
  nodes: GeometryNode[];
  junctions: CompoundJunction[];
}

/**
 * Fitters describe each primitive independently. This stage is the CAD-style
 * trim/extend operation that turns adjacent supporting curves into one exact
 * compound path without sacrificing an accepted analytic primitive.
 */
function resolveCompoundJunctions(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
  nodes: GeometryNode[],
): ResolvedCompoundPath | null {
  const resolved = nodes.map((node) => structuredClone(node));
  const junctions: CompoundJunction[] = [];
  const pairCount = chain.closed ? resolved.length : resolved.length - 1;
  for (let index = 0; index < pairCount; index += 1) {
    const rightIndex = (index + 1) % resolved.length;
    const canonical = sourcePoint(result, canonicalJunction(chain, index));
    const point = resolveJunctionPoint(resolved[index], resolved[rightIndex], canonical);
    if (!point) return null;
    const left = withGeometryPort(resolved[index], 'end', point);
    const right = withGeometryPort(resolved[rightIndex], 'start', point);
    if (!left || !right) return null;
    resolved[index] = left;
    resolved[rightIndex] = right;
    junctions.push({ atMemberIndex: index, point, kind: 'corner' });
  }
  const maximumGap = maximumJunctionGapPx(result, chain, resolved);
  return maximumGap <= 0.001 ? { nodes: resolved, junctions } : null;
}

function maximumJunctionGapPx(
  result: PersistedCleanLineVectorizationResult,
  chain: PersistedCleanLineStrokeChain,
  nodes: GeometryNode[],
): number {
  if (nodes.length < 2) return 0;
  const pairCount = chain.closed ? nodes.length : nodes.length - 1;
  return round(Math.max(...Array.from({ length: pairCount }, (_, index) => {
    const left = geometryPorts(nodes[index]);
    const right = geometryPorts(nodes[(index + 1) % nodes.length]);
    const worldGap = distanceBetween(left.end, right.start);
    return worldGap / scale(result);
  })));
}

function geometryPorts(node: GeometryNode): { start: Vec2; end: Vec2 } {
  switch (node.type) {
    case 'point': return { start: [node.x, node.y], end: [node.x, node.y] };
    case 'line': return { start: node.start, end: node.end };
    case 'ray':
    case 'xline': return { start: node.origin, end: node.origin };
    case 'circle': return { start: node.center, end: node.center };
    case 'arc': return {
      start: polar(node.center, node.radius, node.startAngle),
      end: polar(node.center, node.radius, node.endAngle),
    };
    case 'ellipse': return { start: node.center, end: node.center };
    case 'polyline': return {
      start: node.vertices[0].point,
      end: node.vertices.at(-1)!.point,
    };
    case 'spline': return {
      start: node.controlPoints[0],
      end: node.controlPoints.at(-1)!,
    };
  }
}

type JunctionSupport =
  | { kind: 'line'; origin: Vec2; direction: Vec2 }
  | { kind: 'circle'; center: Vec2; radius: number };

function resolveJunctionPoint(left: GeometryNode, right: GeometryNode, canonical: Vec2): Vec2 | null {
  const leftSupport = junctionSupport(left, 'end');
  const rightSupport = junctionSupport(right, 'start');
  if (!leftSupport || !rightSupport) return null;
  // Intersections are computed on infinite supporting curves. In particular,
  // two finite line segments may miss while their fitted lines meet cleanly.
  const candidates = supportIntersections(leftSupport, rightSupport);
  if (candidates.length === 0) {
    const ports = { left: geometryPorts(left).end, right: geometryPorts(right).start };
    return distanceBetween(ports.left, ports.right) <= 1e-5
      ? roundPoint([(ports.left[0] + ports.right[0]) / 2, (ports.left[1] + ports.right[1]) / 2])
      : null;
  }
  return roundPoint(candidates.reduce((closest, point) => (
    distanceBetween(point, canonical) < distanceBetween(closest, canonical) ? point : closest
  )));
}

function junctionSupport(
  node: GeometryNode,
  port: 'start' | 'end',
): JunctionSupport | null {
  switch (node.type) {
    case 'line':
      return lineSupport(node.start, node.end);
    case 'arc':
    case 'circle':
      return { kind: 'circle', center: node.center, radius: node.radius };
    case 'polyline': {
      if (node.vertices.length < 2) return null;
      const boundary = port === 'start'
        ? node.vertices.slice(0, 2)
        : node.vertices.slice(-2);
      return lineSupport(boundary[0].point, boundary[1].point);
    }
    case 'spline': {
      if (node.controlPoints.length < 2) return null;
      const boundary = port === 'start'
        ? node.controlPoints.slice(0, 2)
        : node.controlPoints.slice(-2);
      return lineSupport(boundary[0], boundary[1]);
    }
    case 'point':
    case 'ray':
    case 'xline':
    case 'ellipse':
      return null;
  }
}

function lineSupport(start: Vec2, end: Vec2): JunctionSupport | null {
  const direction: Vec2 = [end[0] - start[0], end[1] - start[1]];
  return Math.hypot(direction[0], direction[1]) > 1e-9
    ? { kind: 'line', origin: start, direction }
    : null;
}

function supportIntersections(left: JunctionSupport, right: JunctionSupport): Vec2[] {
  if (left.kind === 'line' && right.kind === 'line') {
    return lineLineIntersection(left, right);
  }
  if (left.kind === 'line' && right.kind === 'circle') {
    return lineCircleIntersections(left, right);
  }
  if (left.kind === 'circle' && right.kind === 'line') {
    return lineCircleIntersections(right, left);
  }
  if (left.kind === 'circle' && right.kind === 'circle') {
    return circleCircleIntersections(left, right);
  }
  return [];
}

function lineLineIntersection(
  left: Extract<JunctionSupport, { kind: 'line' }>,
  right: Extract<JunctionSupport, { kind: 'line' }>,
): Vec2[] {
  const denominator = cross(left.direction, right.direction);
  const scaleProduct = Math.hypot(...left.direction) * Math.hypot(...right.direction);
  if (Math.abs(denominator) <= Number.EPSILON * scaleProduct * 64) return [];
  const delta: Vec2 = [
    right.origin[0] - left.origin[0],
    right.origin[1] - left.origin[1],
  ];
  const parameter = cross(delta, right.direction) / denominator;
  return [[
    left.origin[0] + parameter * left.direction[0],
    left.origin[1] + parameter * left.direction[1],
  ]];
}

function lineCircleIntersections(
  line: Extract<JunctionSupport, { kind: 'line' }>,
  circle: Extract<JunctionSupport, { kind: 'circle' }>,
): Vec2[] {
  const offset: Vec2 = [
    line.origin[0] - circle.center[0],
    line.origin[1] - circle.center[1],
  ];
  const a = dot(line.direction, line.direction);
  const b = 2 * dot(offset, line.direction);
  const c = dot(offset, offset) - circle.radius * circle.radius;
  const discriminant = b * b - 4 * a * c;
  const tolerance = Number.EPSILON * Math.max(b * b, Math.abs(4 * a * c), 1) * 64;
  if (discriminant < -tolerance) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const parameters = root <= tolerance
    ? [-b / (2 * a)]
    : [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  return parameters.map((parameter): Vec2 => [
    line.origin[0] + parameter * line.direction[0],
    line.origin[1] + parameter * line.direction[1],
  ]);
}

function circleCircleIntersections(
  left: Extract<JunctionSupport, { kind: 'circle' }>,
  right: Extract<JunctionSupport, { kind: 'circle' }>,
): Vec2[] {
  const delta: Vec2 = [
    right.center[0] - left.center[0],
    right.center[1] - left.center[1],
  ];
  const centerDistance = Math.hypot(delta[0], delta[1]);
  const tolerance = Number.EPSILON * Math.max(
    centerDistance, left.radius, right.radius, 1,
  ) * 64;
  if (centerDistance <= tolerance
    || centerDistance > left.radius + right.radius + tolerance
    || centerDistance < Math.abs(left.radius - right.radius) - tolerance) {
    return [];
  }
  const along = (
    left.radius * left.radius - right.radius * right.radius
    + centerDistance * centerDistance
  ) / (2 * centerDistance);
  const height = Math.sqrt(Math.max(0, left.radius * left.radius - along * along));
  const unit: Vec2 = [delta[0] / centerDistance, delta[1] / centerDistance];
  const base: Vec2 = [
    left.center[0] + along * unit[0],
    left.center[1] + along * unit[1],
  ];
  if (height <= tolerance) return [base];
  const perpendicular: Vec2 = [-unit[1] * height, unit[0] * height];
  return [
    [base[0] + perpendicular[0], base[1] + perpendicular[1]],
    [base[0] - perpendicular[0], base[1] - perpendicular[1]],
  ];
}

function withGeometryPort(
  node: GeometryNode,
  port: 'start' | 'end',
  point: Vec2,
): GeometryNode | null {
  switch (node.type) {
    case 'line':
      return port === 'start' ? { ...node, start: point } : { ...node, end: point };
    case 'arc': {
      const angle = normalizeDegrees(Math.atan2(
        point[1] - node.center[1], point[0] - node.center[0],
      ) * 180 / Math.PI);
      return port === 'start' ? { ...node, startAngle: angle } : { ...node, endAngle: angle };
    }
    case 'polyline': {
      const vertices = node.vertices.map((vertex) => ({ ...vertex }));
      const index = port === 'start' ? 0 : vertices.length - 1;
      vertices[index] = { ...vertices[index], point };
      return { ...node, vertices };
    }
    case 'spline': {
      const controlPoints = [...node.controlPoints];
      controlPoints[port === 'start' ? 0 : controlPoints.length - 1] = point;
      return { ...node, controlPoints };
    }
    case 'point':
    case 'ray':
    case 'xline':
    case 'circle':
    case 'ellipse':
      return null;
  }
}

function dot(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function cross(left: Vec2, right: Vec2): number {
  return left[0] * right[1] - left[1] * right[0];
}

function roundPoint(point: Vec2): Vec2 {
  return [round(point[0]), round(point[1])];
}

function canonicalJunction(chain: PersistedCleanLineStrokeChain, memberIndex: number): Vec2 {
  const left = chain.pieces[memberIndex];
  const right = chain.pieces[(memberIndex + 1) % chain.pieces.length];
  if (left.sampleRange[1] !== right.sampleRange[0]) {
    throw new Error(`VECTORIZATION_JUNCTION_RANGE_MISMATCH:${chain.id}:${memberIndex}`);
  }
  return chain.samples[left.sampleRange[1]];
}

function polar(center: Vec2, radius: number, degrees: number): Vec2 {
  const radians = degrees * Math.PI / 180;
  return [
    center[0] + radius * Math.cos(radians),
    center[1] + radius * Math.sin(radians),
  ];
}

function slotObservation(
  sourceId: string,
  chain: PersistedCleanLineStrokeChain,
  includeCandidates: boolean,
): SlotObservationInput {
  const byType = new Map<string, number>([['polyline', chain.evidence.confidence]]);
  if (includeCandidates) {
    chain.pieces.forEach((piece) => {
      if (!piece.candidate) return;
      byType.set(
        piece.candidate.type,
        Math.max(byType.get(piece.candidate.type) ?? 0, piece.candidate.confidence),
      );
    });
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
    candidateTypes: [...byType].map(([type, score]) => ({
      type: type as SlotObservationInput['candidateTypes'][number]['type'], score,
    })),
  };
}

function commonNode(id: string, chain: PersistedCleanLineStrokeChain, confidence: number) {
  return {
    id: id as GeometryId,
    visible: true,
    quality: {
      status: confidence < LOW_CONFIDENCE_THRESHOLD ? 'candidate' as const : 'confirmed' as const,
      confidence,
      evidenceRefs: [chain.evidence.handle as EvidenceId],
    },
  };
}

export function stableVectorNodeId(sourceId: string, chainId: string): string {
  return stableId('node_vec', sourceId, chainId);
}

function stableVectorPieceNodeId(
  sourceId: string,
  chainId: string,
  pieceId: string,
  index: number,
): string {
  return stableId('node_vec', sourceId, chainId, pieceId, String(index));
}

function stableVectorRelationId(sourceId: string, chainId: string, index: number): string {
  return stableId('relation_vec', sourceId, chainId, String(index));
}

function stableVectorFeatureId(sourceId: string, chainId: string): string {
  return stableId('feature_vec', sourceId, chainId);
}

function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 20)}`;
}

function sourcePoint(
  result: Pick<PersistedCleanLineVectorizationResult, 'width' | 'height'>,
  point: Vec2,
): Vec2 {
  const factor = scale(result);
  return [round(point[0] * factor), round((result.height - point[1]) * factor)];
}

function sourceVector(
  result: Pick<PersistedCleanLineVectorizationResult, 'width'>,
  vector: Vec2,
): Vec2 {
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

function distanceBetween(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
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

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
