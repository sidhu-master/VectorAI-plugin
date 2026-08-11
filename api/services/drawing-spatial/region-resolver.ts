import { createHash } from 'node:crypto';

import type {
  AtomicSegmentRef,
  SelectionCandidate,
  SemanticRegion,
  SpatialBoundaryAnchor,
  SpatialSelection,
  VirtualSplitPlan,
  VirtualSplitRange,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  Bounds2D,
  DrawingDocument,
  GeometryId,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import type {
  AtomicGeometryGraph,
  AtomicGraphSegment,
} from './atomic-graph.js';
import {
  pointInPolygonRegion,
  segmentRegionIntersections,
} from './polygon.js';

interface OwnedRange {
  role: VirtualSplitRange['role'];
  sourceRange: readonly [number, number];
  ref: AtomicSegmentRef;
  start: Vec2;
  end: Vec2;
  splitInsideAtomicSegment: boolean;
}

export class RegionResolver {
  resolve(input: {
    document: DrawingDocument;
    revision: RevisionId;
    region: SemanticRegion;
    graph: AtomicGeometryGraph;
    tolerance: number;
  }): SpatialSelection {
    assertScope(input);
    const wholeNodes: GeometryId[] = [];
    const partialSegments: AtomicSegmentRef[] = [];
    const crossingNodes: GeometryId[] = [];
    const protectedNodes: string[] = [];
    const classifications: SelectionCandidate[] = [];
    const uncertainParts: SelectionCandidate[] = [];
    const splitPlan: VirtualSplitPlan[] = [];
    const boundaryAnchors: SpatialBoundaryAnchor[] = [];

    for (const node of input.document.geometry) {
      const segments = input.graph.segmentsFor(node.id);
      const owned = segments.flatMap((segment) => partitionSegment(segment, input.region));
      const target = owned.filter((item) => item.role === 'target');
      const protectedRanges = owned.filter((item) => item.role === 'protected');
      const confidence = ownershipConfidence(input.region.confidence, target, input.tolerance);
      if (target.length === 0) {
        protectedNodes.push(node.id);
        classifications.push(candidate(node.id, 'outside', confidence, input.region));
        continue;
      }
      if (protectedRanges.length === 0) {
        wholeNodes.push(node.id);
        classifications.push(candidate(node.id, 'inside', confidence, input.region));
      } else {
        crossingNodes.push(node.id);
        partialSegments.push(...target.map((item) => item.ref));
        const classification = owned.some((item) => item.splitInsideAtomicSegment)
          ? 'crossing' as const
          : 'shared-boundary' as const;
        classifications.push(candidate(node.id, classification, confidence, input.region));
        splitPlan.push(buildSplitPlan(node.id, input.revision, owned));
        boundaryAnchors.push(...buildBoundaryAnchors(node.id, owned, input.tolerance));
      }
      if (confidence < 0.6) {
        uncertainParts.push(candidate(node.id, 'uncertain', confidence, input.region));
      }
    }

    return {
      regionId: input.region.id,
      revision: input.revision,
      wholeNodes,
      partialSegments,
      crossingNodes,
      protectedNodes,
      boundaryAnchors,
      classifications,
      uncertainParts,
      splitPlan,
    };
  }
}

function assertScope(input: {
  document: DrawingDocument;
  revision: RevisionId;
  region: SemanticRegion;
  graph: AtomicGeometryGraph;
  tolerance: number;
}): void {
  if (input.region.drawingId !== input.document.id) throw new Error('REGION_RESOLUTION_DRAWING_MISMATCH');
  if (input.region.revision !== input.revision || input.graph.revision !== input.revision) {
    throw new Error('REGION_RESOLUTION_STALE');
  }
  if (!Number.isFinite(input.tolerance) || input.tolerance < 0) {
    throw new Error('REGION_RESOLUTION_TOLERANCE_INVALID');
  }
}

function partitionSegment(segment: AtomicGraphSegment, region: SemanticRegion): OwnedRange[] {
  if (segment.kind === 'whole-node' || segment.samples.length < 2) {
    const role = pointInPolygonRegion(
      segment.start,
      region.worldContours,
      region.worldHoles,
    ) ? 'target' : 'protected';
    return [{
      role,
      sourceRange: sourceRange(segment, 0, 1),
      ref: segment,
      start: segment.start,
      end: segment.end,
      splitInsideAtomicSegment: false,
    }];
  }
  const cuts = uniqueSorted([
    0,
    ...segment.samples.slice(1).flatMap((end, index) => (
      segmentRegionIntersections(
        segment.samples[index],
        end,
        region.worldContours,
        region.worldHoles,
      ).map((value) => (index + value) / (segment.samples.length - 1))
    )),
    1,
  ]);
  const partitions: OwnedRange[] = [];
  for (let index = 1; index < cuts.length; index += 1) {
    const startParameter = cuts[index - 1];
    const endParameter = cuts[index];
    if (endParameter - startParameter <= 1e-10) continue;
    const start = pointAt(segment.samples, startParameter);
    const end = pointAt(segment.samples, endParameter);
    const midpoint = pointAt(segment.samples, (startParameter + endParameter) / 2);
    const role = pointInPolygonRegion(midpoint, region.worldContours, region.worldHoles)
      ? 'target'
      : 'protected';
    partitions.push({
      role,
      sourceRange: sourceRange(segment, startParameter, endParameter),
      ref: intervalRef(segment, startParameter, endParameter, start, end),
      start,
      end,
      splitInsideAtomicSegment: startParameter > 1e-10 || endParameter < 1 - 1e-10,
    });
  }
  return mergeOwnedRanges(partitions);
}

function intervalRef(
  segment: AtomicGraphSegment,
  startParameter: number,
  endParameter: number,
  start: Vec2,
  end: Vec2,
): AtomicSegmentRef {
  if (startParameter <= 1e-10 && endParameter >= 1 - 1e-10) return segment;
  const parameterRange = sourceRange(segment, startParameter, endParameter);
  return {
    id: `atomic_${createHash('sha256').update(JSON.stringify({
      parent: segment.id,
      parameterRange,
    })).digest('hex').slice(0, 24)}`,
    revision: segment.revision,
    nodeId: segment.nodeId,
    kind: 'parameter-range',
    parameterRange,
    start,
    end,
    bounds: boundsOf([start, end]),
    adjacentSegmentIds: [...segment.adjacentSegmentIds],
  };
}

function sourceRange(
  segment: AtomicGraphSegment,
  localStart: number,
  localEnd: number,
): readonly [number, number] {
  if (segment.vertexRange) {
    const start = segment.vertexRange[0];
    const end = segment.vertexRange[1] > start ? segment.vertexRange[1] : start + 1;
    return [mix(start, end, localStart), mix(start, end, localEnd)];
  }
  if (segment.parameterRange) {
    return [
      mix(segment.parameterRange[0], segment.parameterRange[1], localStart),
      mix(segment.parameterRange[0], segment.parameterRange[1], localEnd),
    ];
  }
  return [0, 1];
}

function buildSplitPlan(
  nodeId: GeometryId,
  revision: RevisionId,
  ranges: OwnedRange[],
): VirtualSplitPlan {
  const merged = mergeVirtualRanges(ranges.map((item) => ({
    range: item.sourceRange,
    role: item.role,
  })));
  return {
    nodeId,
    revision,
    ranges: merged,
    cutParameters: merged.slice(1).map((item) => item.range[0]),
  };
}

function buildBoundaryAnchors(
  nodeId: GeometryId,
  ranges: OwnedRange[],
  tolerance: number,
): SpatialBoundaryAnchor[] {
  const ordered = [...ranges].sort((left, right) => left.sourceRange[0] - right.sourceRange[0]);
  return ordered.slice(1).flatMap((current, index): SpatialBoundaryAnchor[] => {
    const previous = ordered[index];
    if (previous.role === current.role || distance(previous.end, current.start) > tolerance) return [];
    const target = previous.role === 'target' ? previous : current;
    const protectedRange = previous.role === 'protected' ? previous : current;
    const point = midpoint(previous.end, current.start);
    return [{
      id: `anchor_${createHash('sha256').update(JSON.stringify({ nodeId, point })).digest('hex').slice(0, 20)}`,
      role: 'shared-boundary',
      point,
      targetSegmentId: target.ref.id,
      protectedSegmentId: protectedRange.ref.id,
      confidence: 1,
    }];
  });
}

function mergeOwnedRanges(ranges: OwnedRange[]): OwnedRange[] {
  const result: OwnedRange[] = [];
  for (const current of ranges) {
    const previous = result.at(-1);
    if (!previous || previous.role !== current.role
      || Math.abs(previous.sourceRange[1] - current.sourceRange[0]) > 1e-9) {
      result.push(current);
      continue;
    }
    result[result.length - 1] = {
      ...previous,
      sourceRange: [previous.sourceRange[0], current.sourceRange[1]],
      end: current.end,
      splitInsideAtomicSegment: previous.splitInsideAtomicSegment
        || current.splitInsideAtomicSegment,
    };
  }
  return result;
}

function mergeVirtualRanges(ranges: VirtualSplitRange[]): VirtualSplitRange[] {
  const ordered = [...ranges].sort((left, right) => left.range[0] - right.range[0]);
  return ordered.reduce<VirtualSplitRange[]>((result, current) => {
    const previous = result.at(-1);
    if (!previous || previous.role !== current.role
      || Math.abs(previous.range[1] - current.range[0]) > 1e-9) {
      result.push({ range: [...current.range], role: current.role });
    } else {
      result[result.length - 1] = {
        range: [previous.range[0], current.range[1]],
        role: previous.role,
      };
    }
    return result;
  }, []);
}

function ownershipConfidence(
  regionConfidence: number,
  target: OwnedRange[],
  tolerance: number,
): number {
  const short = target.some((item) => distance(item.start, item.end) <= tolerance);
  return Math.max(0, Math.min(1, short ? regionConfidence * 0.5 : regionConfidence));
}

function candidate(
  nodeId: GeometryId,
  classification: SelectionCandidate['classification'],
  confidence: number,
  region: SemanticRegion,
): SelectionCandidate {
  return {
    nodeId,
    classification,
    confidence,
    evidenceRefs: [...region.evidenceRefs],
  };
}

function pointAt(samples: Vec2[], parameter: number): Vec2 {
  if (samples.length === 1) return samples[0];
  const scaled = Math.max(0, Math.min(1, parameter)) * (samples.length - 1);
  const index = Math.min(samples.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return [
    mix(samples[index][0], samples[index + 1][0], local),
    mix(samples[index][1], samples[index + 1][1], local),
  ];
}

function uniqueSorted(values: number[]): number[] {
  return [...values].sort((left, right) => left - right).reduce<number[]>((result, value) => (
    result.some((candidate) => Math.abs(candidate - value) <= 1e-9)
      ? result
      : [...result, value]
  ), []);
}

function boundsOf(points: Vec2[]): Bounds2D {
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function midpoint(left: Vec2, right: Vec2): Vec2 {
  return [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
}

function mix(start: number, end: number, parameter: number): number {
  return start + (end - start) * parameter;
}
