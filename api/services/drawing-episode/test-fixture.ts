import type { EditEpisode } from './types.js';

export function episodeFixture(): EditEpisode {
  return {
    schemaVersion: 1,
    id: 'episode_1', runId: 'run_1', drawingId: 'drawing_1', baseRevision: 'revision_1',
    originalGoal: '把右手抬起来', status: 'active',
    regionVersions: [{
      version: 1, regionId: 'region_1', maskHandle: 'mask_1', status: 'active', createdAt: 1,
    }],
    selectionVersions: [{
      version: 1, selectionVersionId: 'selection_1', regionVersion: 1,
      status: 'active', targetNodeIds: ['arm'], crossingNodeIds: [], createdAt: 2,
    }],
    previewVersions: [{
      version: 1, previewVersionId: 'preview_1', regionVersion: 1, selectionVersion: 1,
      strategy: 'geometric-edit', status: 'rejected', affectedNodeIds: ['arm'],
      diffSummary: 'arm rotated 20deg', defectCodes: ['too-low'], createdAt: 3,
    }],
    feedbackTurns: [{
      id: 'feedback_1', text: '手臂再抬高一点', receivedAt: 4, againstPreviewVersion: 1,
    }],
    createdAt: 1, updatedAt: 4,
  };
}
