import type {
  EditEpisode,
  EpisodeModelContext,
  EpisodeVersionStatus,
} from './types.js';

export function buildEpisodeModelContext(episode: EditEpisode): EpisodeModelContext {
  return {
    originalGoal: episode.originalGoal,
    latestFeedback: structuredClone(episode.feedbackTurns.at(-1) ?? null),
    activeRegion: structuredClone(latestActive(episode.regionVersions)),
    activeSelection: structuredClone(latestActive(episode.selectionVersions)),
    activePreview: structuredClone(latestActive(episode.previewVersions)),
    rejectedSummary: episode.previewVersions
      .filter((preview) => preview.status === 'rejected' || preview.status === 'superseded')
      .slice(-6)
      .map((preview) => ({
        previewVersionId: preview.previewVersionId,
        diffSummary: preview.diffSummary,
        defectCodes: [...preview.defectCodes],
      })),
  };
}

function latestActive<T extends { version: number; status: EpisodeVersionStatus }>(
  values: readonly T[],
): T | null {
  return [...values].filter((value) => value.status === 'active')
    .sort((left, right) => right.version - left.version)[0] ?? null;
}
