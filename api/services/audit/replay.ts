import type { SpatialCommit } from '../../../src/core/history/types.js';
import { applyPatch } from '../../../src/core/patch/apply.js';
import type { SpatialModel } from '../../../src/core/types.js';

export function replayCommits(initialModel: SpatialModel, commits: SpatialCommit[]): SpatialModel {
  let model = initialModel;
  for (const commit of commits) {
    const result = applyPatch(model, commit.patch);
    if ('errors' in result) {
      throw new Error(`无法回放提交 ${commit.id}: ${result.errors.map((error) => error.message).join('; ')}`);
    }
    model = result.model;
  }
  return model;
}
