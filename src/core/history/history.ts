import { applyPatch } from '../patch/apply';
import type { PatchError } from '../patch/types';
import type { SpatialModel } from '../types';
import type { CommitPatchInput, SpatialCommit, SpatialHistory } from './types';

export type CommitPatchResult =
  | { success: true; history: SpatialHistory; commit: SpatialCommit }
  | { success: false; history: SpatialHistory; errors: PatchError[] };

export function createHistory(model: SpatialModel): SpatialHistory {
  return { model, commits: [], cursor: -1 };
}

export function commitPatch(
  history: SpatialHistory,
  input: CommitPatchInput,
): CommitPatchResult {
  const applied = applyPatch(history.model, input.patch);
  if ('errors' in applied) {
    return { success: false, history, errors: applied.errors };
  }

  const retained = history.commits.slice(0, history.cursor + 1);
  const parentCommitId = retained.at(-1)?.id;
  const commit: SpatialCommit = {
    id: input.id,
    runId: input.runId,
    parentCommitId,
    stepId: input.stepId,
    source: input.source,
    patch: input.patch,
    inversePatch: applied.inversePatch,
    validation: { valid: true, errors: [] },
    confidence: input.confidence,
    timestamp: input.timestamp,
  };
  const commits = [...retained, commit];

  return {
    success: true,
    commit,
    history: { model: applied.model, commits, cursor: commits.length - 1 },
  };
}

export function undo(history: SpatialHistory): SpatialHistory {
  if (history.cursor < 0) return history;
  const commit = history.commits[history.cursor];
  const applied = applyPatch(history.model, commit.inversePatch);
  if ('errors' in applied) return history;
  return { ...history, model: applied.model, cursor: history.cursor - 1 };
}

export function redo(history: SpatialHistory): SpatialHistory {
  const nextCursor = history.cursor + 1;
  if (nextCursor >= history.commits.length) return history;
  const applied = applyPatch(history.model, history.commits[nextCursor].patch);
  if ('errors' in applied) return history;
  return { ...history, model: applied.model, cursor: nextCursor };
}
