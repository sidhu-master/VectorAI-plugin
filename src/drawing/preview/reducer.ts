import type {
  PerceptionPreviewDelta,
  PerceptionPreviewState,
} from './types';
import type { DrawingDocument } from '../document/types';

type AuthoritativeDrawingNodes = Pick<DrawingDocument, 'geometry' | 'annotations'>;

export function emptyPerceptionPreview(runId: string | null): PerceptionPreviewState {
  return { runId, lastSequence: 0, nodes: {}, labelsByNodeId: {} };
}

export function applyPerceptionPreviewDelta(
  state: PerceptionPreviewState,
  delta: PerceptionPreviewDelta,
): PerceptionPreviewState {
  if ((state.runId !== null && state.runId !== delta.runId)
    || delta.sequence <= state.lastSequence) return state;

  const nodes = { ...state.nodes };
  const labelsByNodeId = { ...state.labelsByNodeId };
  for (const id of delta.removeIds) {
    delete nodes[id];
    delete labelsByNodeId[id];
  }
  for (const node of delta.upserts) nodes[node.id] = structuredClone(node);
  for (const [nodeId, label] of Object.entries(delta.labelsByNodeId ?? {})) {
    labelsByNodeId[nodeId] = label;
  }
  return {
    runId: delta.runId,
    lastSequence: delta.sequence,
    nodes,
    labelsByNodeId,
  };
}

export function retainUncommittedPromotions(
  delta: PerceptionPreviewDelta,
  document: AuthoritativeDrawingNodes | null,
): PerceptionPreviewDelta {
  if (delta.action !== 'promote') return delta;
  const committedIds = drawingNodeIds(document);
  const removeIds = delta.removeIds.filter((id) => committedIds.has(id));
  return removeIds.length === delta.removeIds.length
    ? delta
    : { ...delta, removeIds };
}

export function reconcilePerceptionPreview(
  state: PerceptionPreviewState,
  document: AuthoritativeDrawingNodes | null,
): PerceptionPreviewState {
  const committedIds = drawingNodeIds(document);
  const promotedIds = Object.keys(state.nodes).filter((id) => committedIds.has(id));
  if (promotedIds.length === 0) return state;

  const nodes = { ...state.nodes };
  const labelsByNodeId = { ...state.labelsByNodeId };
  for (const id of promotedIds) {
    delete nodes[id];
    delete labelsByNodeId[id];
  }
  return {
    ...state,
    nodes,
    labelsByNodeId,
  };
}

function drawingNodeIds(document: AuthoritativeDrawingNodes | null): Set<string> {
  return new Set(document
    ? [...document.geometry, ...document.annotations].map((node) => node.id)
    : []);
}
