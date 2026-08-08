import type {
  PerceptionPreviewDelta,
  PerceptionPreviewState,
} from './types';

export function emptyPerceptionPreview(runId: string | null): PerceptionPreviewState {
  return { runId, lastSequence: 0, nodes: {} };
}

export function applyPerceptionPreviewDelta(
  state: PerceptionPreviewState,
  delta: PerceptionPreviewDelta,
): PerceptionPreviewState {
  if ((state.runId !== null && state.runId !== delta.runId)
    || delta.sequence <= state.lastSequence) return state;

  const nodes = { ...state.nodes };
  for (const id of delta.removeIds) delete nodes[id];
  for (const node of delta.upserts) nodes[node.id] = structuredClone(node);
  return {
    runId: delta.runId,
    lastSequence: delta.sequence,
    nodes,
  };
}
