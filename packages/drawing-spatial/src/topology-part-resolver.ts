import type {
  AtomicSegmentRef,
  SelectionCandidate,
  SemanticAnchor,
  SpatialBoundaryAnchor,
  SpatialSelection,
  VirtualSplitPlan,
  VirtualSplitRange,
} from './topology-types';
import {
  sampleSpline,
  type DrawingDocument,
  type GeometryNode,
  type GeometryId,
  type RevisionId,
  type Vec2,
} from '@vectorai/drawing-core';
import type { SpatialBounds2D } from './query';
import { portableDigest } from './digest';
import type {
  AtomicGraphSegment,
  GeometryTopologyGraph,
} from './atomic-graph.js';

export type TopologyPartIssueCode =
  | 'TARGET_ANCHOR_MISSING'
  | 'ANCHOR_OUTSIDE_TOPOLOGY'
  | 'TARGET_OVERLAPS_PROTECTED'
  | 'UNBOUNDED_PROTECTED_CONTACT'
  | 'TRAVERSAL_BUDGET_EXCEEDED';

export interface TopologyPartIssue {
  code: TopologyPartIssueCode;
  message: string;
  anchorId?: string;
  segmentId?: string;
}

export interface SnappedTopologyAnchor {
  id: string;
  role: string;
  sourcePoint: Vec2;
  point: Vec2;
  confidence: number;
  distance: number;
  segmentId?: string;
  vertexId?: string;
}

export interface TopologyPartResolution {
  accepted: boolean;
  selectedSegmentIds: string[];
  traversalOrder: string[];
  snappedAnchors: SnappedTopologyAnchor[];
  issues: TopologyPartIssue[];
  confidence: number;
  complexityCost: number;
  selection: SpatialSelection;
  auditTrace: string[];
}

/**
 * Resolves a semantic part by snapping sparse model-provided anchors to the
 * revision's topology and traversing connectivity between explicit boundaries.
 * Geometry type and domain semantics never participate in the decision.
 */
export class TopologyPartResolver {
  resolve(input: {
    document: DrawingDocument;
    revision: RevisionId;
    graph: GeometryTopologyGraph;
    anchors: SemanticAnchor[];
    searchBounds: SpatialBounds2D;
    tolerance: number;
    maxSegments: number;
    allowEmptySelection?: boolean;
    selectionScopeId?: string;
  }): TopologyPartResolution {
    assertInput(input);
    const maxSnapDistance = Math.max(
      input.tolerance * 8,
      boundsDiagonal(input.searchBounds) * 0.03,
    );
    const issues: TopologyPartIssue[] = [];
    const snappedAnchors = input.anchors.flatMap((anchor): SnappedTopologyAnchor[] => {
      if (anchor.role === 'required') return [];
      const snapped = anchor.role === 'boundary'
        ? snapToVertex(anchor, input.graph, maxSnapDistance)
        : snapSemanticSeed(anchor, input.document, input.graph, maxSnapDistance);
      if (snapped) return [snapped];
      issues.push({
        code: 'ANCHOR_OUTSIDE_TOPOLOGY',
        message: `Anchor ${anchor.id} could not be snapped within the search-scale tolerance.`,
        anchorId: anchor.id,
      });
      return [];
    });
    const targetSeeds = snappedAnchors.filter((anchor) => anchor.role === 'target-seed');
    const targets = targetSeeds;
    if (targetSeeds.length === 0 && !input.allowEmptySelection) {
      issues.push({
        code: 'TARGET_ANCHOR_MISSING',
        message: 'At least one resolved target-seed anchor is required.',
      });
    }

    const boundaryVertexIds = new Set(snappedAnchors
      .filter((anchor) => anchor.role === 'boundary' && anchor.vertexId)
      .map((anchor) => anchor.vertexId!));
    const protectedSegmentIds = protectedSegments(
      snappedAnchors,
      input.graph,
      boundaryVertexIds,
    );
    const queue = unique(targets.map((anchor) => anchor.segmentId).filter(isString));
    const selected = new Set<string>();
    const traversalOrder: string[] = [];
    const complexityUnits = new Set<string>();
    const nodeTypeById = new Map(input.document.geometry.map((node) => [node.id, node.type]));
    const auditTrace = [
      `snap:${snappedAnchors.length}/${input.anchors.length}`,
      `seeds:${queue.length}`,
      `boundaries:${boundaryVertexIds.size}`,
      `protected:${protectedSegmentIds.size}`,
    ];

    while (queue.length > 0) {
      const segmentId = queue.shift()!;
      if (selected.has(segmentId)) continue;
      if (protectedSegmentIds.has(segmentId)) {
        issues.push({
          code: 'TARGET_OVERLAPS_PROTECTED',
          message: `Target traversal started inside protected topology at ${segmentId}.`,
          segmentId,
        });
        continue;
      }
      const segment = input.graph.segment(segmentId);
      if (!segment) continue;
      const complexityUnit = nodeTypeById.get(segment.nodeId) === 'polyline'
        ? `segment:${segment.id}`
        : `node:${segment.nodeId}`;
      if (!complexityUnits.has(complexityUnit) && complexityUnits.size >= input.maxSegments) {
        issues.push({
          code: 'TRAVERSAL_BUDGET_EXCEEDED',
          message: `Topology traversal exceeded the ${input.maxSegments}-member budget.`,
          segmentId,
        });
        break;
      }
      selected.add(segmentId);
      traversalOrder.push(segmentId);
      complexityUnits.add(complexityUnit);
      for (const adjacentId of segment.adjacentSegmentIds) {
        if (selected.has(adjacentId)) continue;
        const adjacent = input.graph.segment(adjacentId);
        if (!adjacent) continue;
        if (!segmentInsideSearchBounds(adjacent, input.searchBounds, input.tolerance)) continue;
        const connectionVertices = sharedVertexIds(segment, adjacent);
        if (connectionVertices.some((id) => boundaryVertexIds.has(id))) {
          auditTrace.push(`boundary-stop:${segment.id}->${adjacent.id}`);
          continue;
        }
        if (protectedSegmentIds.has(adjacent.id)) {
          issues.push({
            code: 'UNBOUNDED_PROTECTED_CONTACT',
            message: `Traversal reaches protected topology without a boundary port at ${adjacent.id}.`,
            segmentId: adjacent.id,
          });
          continue;
        }
        queue.push(adjacent.id);
      }
    }

    const selectedSegmentIds = [...selected].sort();
    const selection = buildSpatialSelection({
      document: input.document,
      revision: input.revision,
      graph: input.graph,
      selectedSegmentIds,
      snappedAnchors,
      protectedSegmentIds,
      ...(input.selectionScopeId ? { selectionScopeId: input.selectionScopeId } : {}),
    });
    const fatalCodes = new Set<TopologyPartIssueCode>([
      'TARGET_ANCHOR_MISSING',
      'TARGET_OVERLAPS_PROTECTED',
      'UNBOUNDED_PROTECTED_CONTACT',
      'TRAVERSAL_BUDGET_EXCEEDED',
    ]);
    const accepted = (selected.size > 0 || input.allowEmptySelection === true)
      && !issues.some((issue) => fatalCodes.has(issue.code));
    const confidence = resolutionConfidence(snappedAnchors, input.anchors, maxSnapDistance, accepted);
    auditTrace.push(
      `selected:${selected.size}`,
      `complexity:${complexityUnits.size}/${input.maxSegments}`,
      `accepted:${accepted}`,
    );
    return {
      accepted,
      selectedSegmentIds,
      traversalOrder,
      snappedAnchors,
      issues: deduplicateIssues(issues),
      confidence,
      complexityCost: complexityUnits.size,
      selection,
      auditTrace,
    };
  }
}

function assertInput(input: {
  revision: RevisionId;
  graph: GeometryTopologyGraph;
  searchBounds: SpatialBounds2D;
  tolerance: number;
  maxSegments: number;
}): void {
  if (input.graph.revision !== input.revision) throw new Error('TOPOLOGY_REVISION_MISMATCH');
  if (!Number.isFinite(input.tolerance) || input.tolerance <= 0) {
    throw new Error('TOPOLOGY_RESOLUTION_TOLERANCE_INVALID');
  }
  if (!Number.isInteger(input.maxSegments) || input.maxSegments <= 0) {
    throw new Error('TOPOLOGY_RESOLUTION_BUDGET_INVALID');
  }
  const bounds = input.searchBounds;
  if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)
    || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
    throw new Error('TOPOLOGY_RESOLUTION_BOUNDS_INVALID');
  }
}

function snapToVertex(
  anchor: SemanticAnchor,
  graph: GeometryTopologyGraph,
  maxDistance: number,
): SnappedTopologyAnchor | null {
  const nearest = nearestBy(graph.vertices, (vertex) => distance(anchor.point, vertex.point));
  if (!nearest || nearest.distance > maxDistance) return null;
  return {
    id: anchor.id,
    role: anchor.role,
    sourcePoint: anchor.point,
    point: nearest.value.point,
    confidence: anchor.confidence,
    distance: nearest.distance,
    vertexId: nearest.value.id,
    segmentId: nearest.value.incidentSegmentIds[0],
  };
}

function snapToSegment(
  anchor: SemanticAnchor,
  graph: GeometryTopologyGraph,
  maxDistance: number,
): SnappedTopologyAnchor | null {
  const nearest = nearestBy(graph.segments, (segment) => (
    distanceToSampledPath(anchor.point, segment.samples)
  ));
  if (!nearest || nearest.distance > maxDistance) return null;
  const point = closestPointOnSampledPath(anchor.point, nearest.value.samples);
  return {
    id: anchor.id,
    role: anchor.role,
    sourcePoint: anchor.point,
    point,
    confidence: anchor.confidence,
    distance: nearest.distance,
    segmentId: nearest.value.id,
  };
}

function snapSemanticSeed(
  anchor: SemanticAnchor,
  document: DrawingDocument,
  graph: GeometryTopologyGraph,
  maxDistance: number,
): SnappedTopologyAnchor | null {
  const containing = document.geometry
    .filter((node) => closedGeometryContains(node, anchor.point))
    .map((node) => ({ node, area: geometryArea(node) }))
    .sort((left, right) => left.area - right.area)[0]?.node;
  if (containing) {
    const segment = graph.segmentsFor(containing.id)[0];
    if (segment) return {
      id: anchor.id,
      role: anchor.role,
      sourcePoint: anchor.point,
      point: anchor.point,
      confidence: anchor.confidence,
      distance: 0,
      segmentId: segment.id,
    };
  }
  return snapToSegment(anchor, graph, maxDistance);
}

function segmentInsideSearchBounds(
  segment: AtomicGraphSegment,
  bounds: SpatialBounds2D,
  tolerance: number,
): boolean {
  return segment.bounds.maxX >= bounds.minX - tolerance
    && segment.bounds.minX <= bounds.maxX + tolerance
    && segment.bounds.maxY >= bounds.minY - tolerance
    && segment.bounds.minY <= bounds.maxY + tolerance;
}

function closedGeometryContains(node: GeometryNode, point: Vec2): boolean {
  switch (node.type) {
    case 'circle':
      return distance(point, node.center) <= node.radius;
    case 'ellipse': {
      if (node.startParam !== undefined || node.endParam !== undefined) return false;
      const majorLength = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      if (majorLength === 0 || node.ratio <= 0) return false;
      const dx = point[0] - node.center[0];
      const dy = point[1] - node.center[1];
      const ux = node.majorAxis[0] / majorLength;
      const uy = node.majorAxis[1] / majorLength;
      const localX = dx * ux + dy * uy;
      const localY = -dx * uy + dy * ux;
      return (localX / majorLength) ** 2
        + (localY / (majorLength * node.ratio)) ** 2 <= 1;
    }
    case 'polyline':
      return node.closed && pointInPolygon(point, node.vertices.map((vertex) => vertex.point));
    case 'spline':
      return node.closed && pointInPolygon(point, sampleSpline(node, { maxError: 0.02, maxDepth: 16 }));
    default:
      return false;
  }
}

function geometryArea(node: GeometryNode): number {
  switch (node.type) {
    case 'circle': return Math.PI * node.radius ** 2;
    case 'ellipse': {
      const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      return Math.PI * major * major * node.ratio;
    }
    case 'polyline': return Math.abs(polygonSignedArea(node.vertices.map((vertex) => vertex.point)));
    case 'spline': return Math.abs(polygonSignedArea(sampleSpline(node, { maxError: 0.02, maxDepth: 16 })));
    default: return Number.POSITIVE_INFINITY;
  }
}

function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
      && point[0] < (previousPoint[0] - currentPoint[0])
        * (point[1] - currentPoint[1]) / (previousPoint[1] - currentPoint[1])
        + currentPoint[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonSignedArea(points: readonly Vec2[]): number {
  if (points.length < 3) return 0;
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function protectedSegments(
  anchors: SnappedTopologyAnchor[],
  graph: GeometryTopologyGraph,
  boundaryVertexIds: Set<string>,
): Set<string> {
  const queue = unique(anchors
    .filter((anchor) => anchor.role === 'protected-seed' && anchor.segmentId)
    .map((anchor) => anchor.segmentId)
    .filter(isString));
  const protectedIds = new Set<string>();
  while (queue.length > 0) {
    const segmentId = queue.shift()!;
    if (protectedIds.has(segmentId)) continue;
    const segment = graph.segment(segmentId);
    if (!segment) continue;
    protectedIds.add(segmentId);
    for (const adjacentId of segment.adjacentSegmentIds) {
      const adjacent = graph.segment(adjacentId);
      if (!adjacent || adjacent.nodeId !== segment.nodeId) continue;
      if (sharedVertexIds(segment, adjacent).some((id) => boundaryVertexIds.has(id))) continue;
      queue.push(adjacent.id);
    }
  }
  return protectedIds;
}

function buildSpatialSelection(input: {
  document: DrawingDocument;
  revision: RevisionId;
  graph: GeometryTopologyGraph;
  selectedSegmentIds: string[];
  snappedAnchors: SnappedTopologyAnchor[];
  protectedSegmentIds: Set<string>;
  selectionScopeId?: string;
}): SpatialSelection {
  const selected = new Set(input.selectedSegmentIds);
  const wholeNodes: GeometryId[] = [];
  const partialSegments: AtomicSegmentRef[] = [];
  const crossingNodes: GeometryId[] = [];
  const protectedNodes: string[] = [];
  const classifications: SelectionCandidate[] = [];
  const splitPlan: VirtualSplitPlan[] = [];
  const anchorEvidence = input.snappedAnchors.map((anchor) => anchor.id);

  for (const node of input.document.geometry) {
    const segments = [...input.graph.segmentsFor(node.id)];
    const selectedSegments = segments.filter((segment) => selected.has(segment.id));
    if (selectedSegments.length === 0) {
      protectedNodes.push(node.id);
      classifications.push(classification(node.id, 'outside', anchorEvidence, 1));
      continue;
    }
    if (selectedSegments.length === segments.length) {
      wholeNodes.push(node.id);
      classifications.push(classification(node.id, 'inside', anchorEvidence, 1));
      continue;
    }
    crossingNodes.push(node.id);
    partialSegments.push(...selectedSegments);
    classifications.push(classification(node.id, 'shared-boundary', anchorEvidence, 0.95));
    splitPlan.push(buildSplitPlan(node.id, input.revision, segments, selected));
  }

  const boundaryAnchors = input.snappedAnchors
    .filter((anchor) => anchor.role === 'boundary' && anchor.vertexId)
    .map((anchor): SpatialBoundaryAnchor => {
      const incident = input.graph.vertex(anchor.vertexId!)?.incidentSegmentIds ?? [];
      return {
        id: `anchor_${digest(JSON.stringify({ revision: input.revision, source: anchor.id })).slice(0, 20)}`,
        role: 'semantic-anchor',
        point: anchor.point,
        ...(incident.find((id) => selected.has(id)) ? {
          targetSegmentId: incident.find((id) => selected.has(id)),
        } : {}),
        ...(incident.find((id) => !selected.has(id) || input.protectedSegmentIds.has(id)) ? {
          protectedSegmentId: incident.find((id) => (
            !selected.has(id) || input.protectedSegmentIds.has(id)
          )),
        } : {}),
        confidence: anchor.confidence,
      };
    });
  const regionId = input.selectionScopeId ?? `topology_${digest(JSON.stringify({
    revision: input.revision,
    anchors: input.snappedAnchors.map((anchor) => [anchor.id, anchor.role, anchor.point]),
  })).slice(0, 24)}`;
  return {
    regionId,
    revision: input.revision,
    wholeNodes,
    partialSegments,
    crossingNodes,
    protectedNodes,
    boundaryAnchors,
    classifications,
    uncertainParts: [],
    splitPlan,
  };
}

function buildSplitPlan(
  nodeId: GeometryId,
  revision: RevisionId,
  segments: AtomicGraphSegment[],
  selected: Set<string>,
): VirtualSplitPlan {
  const ranges = mergeRanges(segments
    .map((segment): VirtualSplitRange => ({
      range: segmentRange(segment),
      role: selected.has(segment.id) ? 'target' : 'protected',
    }))
    .sort((left, right) => left.range[0] - right.range[0]));
  return {
    nodeId,
    revision,
    ranges,
    cutParameters: ranges.slice(1).map((range) => range.range[0]),
  };
}

function segmentRange(segment: AtomicGraphSegment): readonly [number, number] {
  if (segment.vertexRange) {
    const [start, end] = segment.vertexRange;
    return [start, end > start ? end : start + 1];
  }
  if (segment.parameterRange) return segment.parameterRange;
  return [0, 1];
}

function mergeRanges(ranges: VirtualSplitRange[]): VirtualSplitRange[] {
  return ranges.reduce<VirtualSplitRange[]>((result, current) => {
    const previous = result.at(-1);
    if (!previous || previous.role !== current.role
      || Math.abs(previous.range[1] - current.range[0]) > 1e-9) {
      result.push({ role: current.role, range: [...current.range] });
    } else {
      result[result.length - 1] = {
        role: previous.role,
        range: [previous.range[0], current.range[1]],
      };
    }
    return result;
  }, []);
}

function classification(
  nodeId: GeometryId,
  value: SelectionCandidate['classification'],
  evidenceRefs: string[],
  confidence: number,
): SelectionCandidate {
  return { nodeId, classification: value, confidence, evidenceRefs };
}

function sharedVertexIds(left: AtomicGraphSegment, right: AtomicGraphSegment): string[] {
  const rightIds = new Set([right.startVertexId, right.endVertexId]);
  return unique([left.startVertexId, left.endVertexId].filter((id) => rightIds.has(id)));
}

function closestPointOnSampledPath(point: Vec2, samples: Vec2[]): Vec2 {
  if (samples.length === 0) return point;
  if (samples.length === 1) return samples[0];
  return samples.slice(1).reduce<{ point: Vec2; distance: number }>((best, end, index) => {
    const projected = closestPointOnSegment(point, samples[index], end);
    const candidateDistance = distance(point, projected);
    return candidateDistance < best.distance
      ? { point: projected, distance: candidateDistance }
      : best;
  }, { point: samples[0], distance: distance(point, samples[0]) }).point;
}

function distanceToSampledPath(point: Vec2, samples: Vec2[]): number {
  return distance(point, closestPointOnSampledPath(point, samples));
}

function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2): Vec2 {
  const delta: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const lengthSquared = delta[0] ** 2 + delta[1] ** 2;
  if (lengthSquared === 0) return start;
  const parameter = Math.max(0, Math.min(1, (
    (point[0] - start[0]) * delta[0] + (point[1] - start[1]) * delta[1]
  ) / lengthSquared));
  return [start[0] + delta[0] * parameter, start[1] + delta[1] * parameter];
}

function nearestBy<T>(
  values: readonly T[],
  metric: (value: T) => number,
): { value: T; distance: number } | null {
  return values.reduce<{ value: T; distance: number } | null>((best, value) => {
    const candidateDistance = metric(value);
    return !best || candidateDistance < best.distance
      ? { value, distance: candidateDistance }
      : best;
  }, null);
}

function resolutionConfidence(
  snapped: SnappedTopologyAnchor[],
  proposed: SemanticAnchor[],
  maxDistance: number,
  accepted: boolean,
): number {
  if (proposed.length === 0 || snapped.length === 0) return 0;
  const score = snapped.reduce((sum, anchor) => (
    sum + anchor.confidence * Math.max(0, 1 - anchor.distance / maxDistance)
  ), 0) / proposed.length;
  return clamp01(accepted ? score : score * 0.5);
}

function deduplicateIssues(issues: TopologyPartIssue[]): TopologyPartIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.anchorId ?? ''}:${issue.segmentId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function boundsDiagonal(bounds: SpatialBounds2D): number {
  return Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(right[0] - left[0], right[1] - left[1]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function digest(value: string): string {
  return portableDigest(value);
}
