import { createHash } from 'node:crypto';

import type {
  AtomicSegmentRef,
  FragmentAuthorization,
  LocalityMetrics,
  SelectionProofProposal,
  SpatialSelection,
  VirtualSplitPlan,
  VirtualSplitRange,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  Bounds2D,
  DrawingDocument,
  GeometryId,
  GeometryNode,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import { drawingNodeContentHash } from '../drawing-edit/preserve-report.js';
import { renderGroundingSnapshot } from '../drawing-vision/grounding-renderer.js';
import type { AtomicGeometryGraph } from './atomic-graph.js';
import { roughGeometryBounds } from './geometry-sampling.js';

export interface AtomicSelectionCandidate {
  fragmentId: string;
  sourceNodeId: GeometryId;
  kind: AtomicSegmentRef['kind'];
  sourceRange?: readonly [number, number];
  start: Vec2;
  end: Vec2;
  bounds: Bounds2D;
  adjacentSegmentIds: string[];
  baselineHash: string;
}

export interface SelectionCandidateSet {
  revision: RevisionId;
  regionId: string;
  candidates: AtomicSelectionCandidate[];
  protectedNodeIds: GeometryId[];
}

export interface SelectionProofViewMapping {
  label: string;
  fragmentId: string;
  sourceNodeId: GeometryId;
  rgb: [number, number, number];
  bounds: Bounds2D;
}

export interface SelectionProofView {
  id: string;
  imageDataUrl: string;
  width: number;
  height: number;
  mapping: SelectionProofViewMapping[];
}

export function buildSelectionCandidateSet(input: {
  document: DrawingDocument;
  selection: SpatialSelection;
  graph: AtomicGeometryGraph;
}): SelectionCandidateSet {
  if (input.selection.revision !== input.graph.revision) {
    throw new Error('SELECTION_CANDIDATE_REVISION_MISMATCH');
  }
  const whole = new Set(input.selection.wholeNodes);
  const partialByNode = new Map<string, AtomicSegmentRef[]>();
  for (const segment of input.selection.partialSegments) {
    partialByNode.set(segment.nodeId, [...(partialByNode.get(segment.nodeId) ?? []), segment]);
  }
  const candidates = input.document.geometry.flatMap((node): AtomicSelectionCandidate[] => {
    if (whole.has(node.id)) {
      const graphSegments = input.graph.segmentsFor(node.id);
      const bounds = roughGeometryBounds(node) ?? boundsOf(graphSegments.flatMap((segment) => (
        [segment.start, segment.end]
      )));
      const start = graphSegments[0]?.start ?? center(bounds);
      const end = graphSegments.at(-1)?.end ?? start;
      return [{
        fragmentId: `node:${node.id}`,
        sourceNodeId: node.id,
        kind: 'whole-node',
        start,
        end,
        bounds,
        adjacentSegmentIds: unique(graphSegments.flatMap((segment) => segment.adjacentSegmentIds)),
        baselineHash: drawingNodeContentHash(node),
      }];
    }
    return (partialByNode.get(node.id) ?? []).map((segment) => ({
      fragmentId: segment.id,
      sourceNodeId: segment.nodeId,
      kind: segment.kind,
      ...(segment.vertexRange
        ? { sourceRange: segment.vertexRange }
        : segment.parameterRange ? { sourceRange: segment.parameterRange } : {}),
      start: segment.start,
      end: segment.end,
      bounds: { ...segment.bounds },
      adjacentSegmentIds: [...segment.adjacentSegmentIds],
      baselineHash: digest(JSON.stringify({
        sourceNodeId: segment.nodeId,
        kind: segment.kind,
        vertexRange: segment.vertexRange,
        parameterRange: segment.parameterRange,
        start: segment.start,
        end: segment.end,
      })),
    }));
  });
  return {
    revision: input.selection.revision,
    regionId: input.selection.regionId,
    candidates,
    protectedNodeIds: input.selection.protectedNodes as GeometryId[],
  };
}

export function authorizeSelection(input: {
  document: DrawingDocument;
  rawSelection: SpatialSelection;
  candidates: SelectionCandidateSet;
  proof: SelectionProofProposal;
  locality: LocalityMetrics;
  maxEditableFragments: number;
}): { selection: SpatialSelection; authorization: FragmentAuthorization } {
  if (input.rawSelection.revision !== input.candidates.revision
    || input.rawSelection.regionId !== input.candidates.regionId) {
    throw new Error('SELECTION_AUTHORIZATION_SCOPE_MISMATCH');
  }
  if (input.proof.editableFragmentIds.length > input.maxEditableFragments) {
    throw new Error('SELECTION_FRAGMENT_BUDGET_EXCEEDED');
  }
  const byId = new Map(input.candidates.candidates.map((candidate) => (
    [candidate.fragmentId, candidate]
  )));
  for (const id of input.proof.editableFragmentIds) {
    if (!byId.has(id)) throw new Error(`SELECTION_FRAGMENT_UNKNOWN:${id}`);
  }
  const anchorById = new Map(input.rawSelection.boundaryAnchors.map((anchor) => [anchor.id, anchor]));
  for (const id of input.proof.anchorIds) {
    if (!anchorById.has(id)) throw new Error(`SELECTION_ANCHOR_UNKNOWN:${id}`);
  }
  const editable = new Set(input.proof.editableFragmentIds);
  const selectedCandidates = input.candidates.candidates.filter((candidate) => (
    editable.has(candidate.fragmentId)
  ));
  const wholeNodes = selectedCandidates
    .filter((candidate) => candidate.kind === 'whole-node')
    .map((candidate) => candidate.sourceNodeId);
  const partialSegments = input.rawSelection.partialSegments.filter((segment) => (
    editable.has(segment.id)
  ));
  const partialNodeIds = unique(partialSegments.map((segment) => segment.nodeId));
  const crossingNodes = input.rawSelection.crossingNodes.filter((id) => partialNodeIds.includes(id));
  const splitPlan = input.rawSelection.splitPlan
    .filter((plan) => partialNodeIds.includes(plan.nodeId))
    .map((plan) => authorizeSplitPlan(plan, partialSegments.filter((segment) => (
      segment.nodeId === plan.nodeId
    ))));
  const unselectedWhole = input.rawSelection.wholeNodes.filter((id) => !wholeNodes.includes(id));
  const unselectedCrossing = input.rawSelection.crossingNodes.filter((id) => !crossingNodes.includes(id));
  const protectedNodes = unique([
    ...input.rawSelection.protectedNodes,
    ...unselectedWhole,
    ...unselectedCrossing,
  ]);
  const boundaryAnchors = input.proof.anchorIds.map((id) => anchorById.get(id)!);
  const selection: SpatialSelection = {
    regionId: input.rawSelection.regionId,
    revision: input.rawSelection.revision,
    wholeNodes,
    partialSegments,
    crossingNodes,
    protectedNodes,
    boundaryAnchors,
    classifications: input.rawSelection.classifications,
    uncertainParts: input.rawSelection.uncertainParts.filter((part) => (
      wholeNodes.includes(part.nodeId) || crossingNodes.includes(part.nodeId)
    )),
    splitPlan,
  };
  const protectedFragmentIds = input.candidates.candidates
    .filter((candidate) => !editable.has(candidate.fragmentId))
    .map((candidate) => candidate.fragmentId);
  const protectedHashes: Record<string, string> = {};
  for (const candidate of input.candidates.candidates) {
    if (!editable.has(candidate.fragmentId)) {
      protectedHashes[`${candidate.sourceNodeId}:${candidate.fragmentId}`] = candidate.baselineHash;
    }
  }
  for (const nodeId of protectedNodes) {
    const node = input.document.geometry.find((item) => item.id === nodeId);
    if (node) protectedHashes[`node:${nodeId}`] = drawingNodeContentHash(node);
  }
  for (const plan of splitPlan) {
    const source = input.document.geometry.find((node) => node.id === plan.nodeId);
    if (!source) continue;
    for (const range of plan.ranges.filter((item) => item.role === 'protected')) {
      protectedHashes[`${plan.nodeId}:${range.range[0]}-${range.range[1]}`] = digest(JSON.stringify({
        sourceHash: drawingNodeContentHash(source),
        range: range.range,
      }));
    }
  }
  const selectionProofId = `proof_${digest(JSON.stringify({
    revision: input.candidates.revision,
    regionId: input.candidates.regionId,
    editableFragmentIds: [...editable].sort(),
    anchorIds: [...input.proof.anchorIds].sort(),
  })).slice(0, 24)}`;
  const authorization: FragmentAuthorization = {
    id: `authorization_${digest(JSON.stringify({ selectionProofId, protectedHashes })).slice(0, 24)}`,
    revision: input.candidates.revision,
    regionId: input.candidates.regionId,
    editableFragmentIds: [...input.proof.editableFragmentIds],
    protectedFragmentIds,
    boundaryAnchorIds: [...input.proof.anchorIds],
    protectedHashes,
    selectionProofId,
    locality: structuredClone(input.locality),
  };
  return { selection, authorization };
}

export async function renderSelectionProofView(input: {
  document: DrawingDocument;
  candidates: SelectionCandidateSet;
}): Promise<SelectionProofView> {
  if (input.candidates.candidates.length === 0) throw new Error('SELECTION_PROOF_EMPTY');
  const geometry = input.candidates.candidates.map((candidate) => (
    candidateGeometry(input.document, candidate)
  ));
  const proofDocument: DrawingDocument = {
    ...structuredClone(input.document),
    id: `${input.document.id}_selection_proof` as DrawingDocument['id'],
    geometry,
    annotations: [],
    relations: [],
    features: [],
  };
  const sourceBounds = boundsOf(input.candidates.candidates.flatMap((candidate) => (
    [[candidate.bounds.minX, candidate.bounds.minY], [candidate.bounds.maxX, candidate.bounds.maxY]] as Vec2[]
  )));
  const viewport = fitBounds(sourceBounds, 768, 768);
  const snapshot = await renderGroundingSnapshot({
    document: proofDocument,
    revision: input.candidates.revision,
    ...viewport,
    background: [13, 16, 20],
  });
  const rendered = new Map(snapshot.nodes.map((node) => [node.nodeId, node]));
  const mapping = input.candidates.candidates.map((candidate, index): SelectionProofViewMapping => {
    const node = rendered.get(candidate.fragmentId);
    if (!node) throw new Error(`SELECTION_PROOF_FRAGMENT_NOT_RENDERED:${candidate.fragmentId}`);
    return {
      label: `F${String(index + 1).padStart(3, '0')}`,
      fragmentId: candidate.fragmentId,
      sourceNodeId: candidate.sourceNodeId,
      rgb: [...node.rgb],
      bounds: { ...candidate.bounds },
    };
  });
  const id = `proof_view_${digest(JSON.stringify({
    revision: input.candidates.revision,
    regionId: input.candidates.regionId,
    mapping,
  })).slice(0, 24)}`;
  return {
    id,
    imageDataUrl: snapshot.imageDataUrl,
    width: snapshot.width,
    height: snapshot.height,
    mapping,
  };
}

function authorizeSplitPlan(
  plan: VirtualSplitPlan,
  selectedSegments: AtomicSegmentRef[],
): VirtualSplitPlan {
  const selectedRanges = selectedSegments.map(segmentRange);
  const boundaries = uniqueNumbers([
    ...plan.ranges.flatMap((range) => [...range.range]),
    ...selectedRanges.flatMap((range) => [...range]),
  ]).sort((left, right) => left - right);
  const ranges: VirtualSplitRange[] = boundaries.slice(1).map((end, index) => {
    const start = boundaries[index];
    const midpoint = (start + end) / 2;
    return {
      range: [start, end] as const,
      role: selectedRanges.some((range) => midpoint >= range[0] - 1e-9 && midpoint <= range[1] + 1e-9)
        ? 'target' as const
        : 'protected' as const,
    };
  });
  const merged = mergeRanges(ranges);
  return {
    nodeId: plan.nodeId,
    revision: plan.revision,
    ranges: merged,
    cutParameters: merged.slice(1).map((range) => range.range[0]),
  };
}

function segmentRange(segment: AtomicSegmentRef): readonly [number, number] {
  if (segment.vertexRange) return segment.vertexRange;
  if (segment.parameterRange) return segment.parameterRange;
  return [0, 1];
}

function mergeRanges(ranges: VirtualSplitRange[]): VirtualSplitRange[] {
  return ranges.reduce<VirtualSplitRange[]>((result, range) => {
    const previous = result.at(-1);
    if (!previous || previous.role !== range.role
      || Math.abs(previous.range[1] - range.range[0]) > 1e-9) {
      result.push({ role: range.role, range: [...range.range] });
    } else {
      result[result.length - 1] = {
        role: previous.role,
        range: [previous.range[0], range.range[1]],
      };
    }
    return result;
  }, []);
}

function candidateGeometry(
  document: DrawingDocument,
  candidate: AtomicSelectionCandidate,
): GeometryNode {
  if (candidate.kind === 'whole-node') {
    const source = document.geometry.find((node) => node.id === candidate.sourceNodeId);
    if (!source) throw new Error(`SELECTION_SOURCE_NODE_MISSING:${candidate.sourceNodeId}`);
    return { ...structuredClone(source), id: candidate.fragmentId as GeometryId };
  }
  return {
    id: candidate.fragmentId as GeometryId,
    type: 'line',
    start: candidate.start,
    end: candidate.end,
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  };
}

function fitBounds(bounds: Bounds2D, width: number, height: number) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(width * 0.82 / spanX, height * 0.82 / spanY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    offsetX: width / 2 - centerX * scale,
    offsetY: height / 2 + centerY * scale,
    width,
    height,
  };
}

function boundsOf(points: Vec2[]): Bounds2D {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function center(bounds: Bounds2D): Vec2 {
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueNumbers(values: number[]): number[] {
  return values.reduce<number[]>((result, value) => (
    result.some((existing) => Math.abs(existing - value) <= 1e-9)
      ? result
      : [...result, value]
  ), []);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
