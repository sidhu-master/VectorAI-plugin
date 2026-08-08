import type {
  PerceptionPreviewDelta,
  PerceptionPreviewState,
} from './types';

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
