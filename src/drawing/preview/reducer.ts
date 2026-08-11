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
  const stageByNodeId = { ...(state.stageByNodeId ?? {}) };
  const hiddenCommittedIds = new Set(state.hiddenCommittedIds ?? []);
  for (const id of delta.showCommittedIds ?? []) hiddenCommittedIds.delete(id);
  for (const id of delta.hideCommittedIds ?? []) hiddenCommittedIds.add(id);
  for (const id of delta.removeIds) {
    delete nodes[id];
    delete labelsByNodeId[id];
    delete stageByNodeId[id];
  }
  for (const node of delta.upserts) {
    nodes[node.id] = structuredClone(node);
    stageByNodeId[node.id] = delta.source.stage;
  }
  for (const [nodeId, label] of Object.entries(delta.labelsByNodeId ?? {})) {
    labelsByNodeId[nodeId] = label;
  }
  return {
    runId: delta.runId,
    lastSequence: delta.sequence,
    nodes,
    labelsByNodeId,
    stageByNodeId,
    ...((state.hiddenCommittedIds !== undefined
      || delta.hideCommittedIds !== undefined
      || delta.showCommittedIds !== undefined)
      ? { hiddenCommittedIds: [...hiddenCommittedIds] }
      : {}),
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
  const stageByNodeId = state.stageByNodeId === undefined
    ? undefined
    : { ...state.stageByNodeId };
  for (const id of promotedIds) {
    delete nodes[id];
    delete labelsByNodeId[id];
    if (stageByNodeId) delete stageByNodeId[id];
  }
  return {
    ...state,
    nodes,
    labelsByNodeId,
    ...(stageByNodeId === undefined ? {} : { stageByNodeId }),
    ...(state.hiddenCommittedIds === undefined ? {} : { hiddenCommittedIds: [] }),
  };
}

function drawingNodeIds(document: AuthoritativeDrawingNodes | null): Set<string> {
  return new Set(document
    ? [...document.geometry, ...document.annotations].map((node) => node.id)
    : []);
}
