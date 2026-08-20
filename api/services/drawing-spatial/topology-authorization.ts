import { createHash } from 'node:crypto';

import type {
  LocalityMetrics,
  SpatialEditAuthorization,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import type { DrawingDocument } from '../../../src/drawing/index.js';
import { drawingNodeContentHash } from '../drawing-edit/preserve-report.js';
import type { GeometryTopologyGraph } from './atomic-graph.js';

/** Creates deterministic write authority from a validated topology resolution. */
export function authorizeTopologySelection(input: {
  document: DrawingDocument;
  graph: GeometryTopologyGraph;
  selection: SpatialSelection;
  selectedSegmentIds: readonly string[];
  locality: LocalityMetrics;
}): SpatialEditAuthorization {
  if (input.graph.revision !== input.selection.revision) {
    throw new Error('TOPOLOGY_AUTHORIZATION_REVISION_MISMATCH');
  }
  const selected = new Set(input.selectedSegmentIds);
  const editableTargetIds = [
    ...input.selection.wholeNodes.map((id) => `node:${id}`),
    ...input.selection.partialSegments.map((segment) => segment.id),
  ].sort();
  const protectedTargetIds = [
    ...input.selection.protectedNodes.map((id) => `node:${id}`),
    ...input.graph.segments
      .filter((segment) => !selected.has(segment.id))
      .filter((segment) => !input.selection.protectedNodes.includes(segment.nodeId))
      .map((segment) => segment.id),
  ].sort();
  const protectedHashes: Record<string, string> = {};
  for (const nodeId of input.selection.protectedNodes) {
    const node = input.document.geometry.find((item) => item.id === nodeId);
    if (node) protectedHashes[`node:${nodeId}`] = drawingNodeContentHash(node);
  }
  for (const segmentId of protectedTargetIds.filter((id) => !id.startsWith('node:'))) {
    const segment = input.graph.segment(segmentId);
    const node = segment && input.document.geometry.find((item) => item.id === segment.nodeId);
    if (!segment || !node) continue;
    protectedHashes[segment.id] = digest(JSON.stringify({
      sourceHash: drawingNodeContentHash(node),
      kind: segment.kind,
      vertexRange: segment.vertexRange,
      parameterRange: segment.parameterRange,
    }));
  }
  const topologyResolutionId = `topology_resolution_${digest(JSON.stringify({
    revision: input.selection.revision,
    regionId: input.selection.regionId,
    editableTargetIds,
    protectedTargetIds,
    boundaryAnchorIds: input.selection.boundaryAnchors.map((anchor) => anchor.id).sort(),
  })).slice(0, 24)}`;
  return {
    id: `authorization_${digest(JSON.stringify({ topologyResolutionId, protectedHashes })).slice(0, 24)}`,
    revision: input.selection.revision,
    regionId: input.selection.regionId,
    editableTargetIds,
    protectedTargetIds,
    boundaryAnchorIds: input.selection.boundaryAnchors.map((anchor) => anchor.id),
    protectedHashes,
    topologyResolutionId,
    locality: structuredClone(input.locality),
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
