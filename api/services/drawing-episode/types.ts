import type { SpatialEditMode } from '../../../src/contracts/drawing-spatial-region.js';

export type EpisodeVersionStatus = 'active' | 'superseded' | 'rejected' | 'committed';

export interface EditEpisodeRegionVersion {
  version: number;
  regionId: string;
  maskHandle: string;
  status: EpisodeVersionStatus;
  createdAt: number;
}

export interface EditEpisodeSelectionVersion {
  version: number;
  selectionVersionId: string;
  regionVersion: number;
  status: EpisodeVersionStatus;
  targetNodeIds: string[];
  crossingNodeIds: string[];
  createdAt: number;
}

export interface EditEpisodePreviewVersion {
  version: number;
  previewVersionId: string;
  regionVersion: number;
  selectionVersion: number;
  strategy: SpatialEditMode;
  status: EpisodeVersionStatus;
  affectedNodeIds: string[];
  diffSummary: string;
  defectCodes: string[];
  renderHandle?: string;
  createdAt: number;
}

export interface UserFeedbackTurn {
  id: string;
  text: string;
  receivedAt: number;
  againstPreviewVersion?: number;
}

export interface EditEpisode {
  schemaVersion: 1;
  id: string;
  runId: string;
  drawingId: string;
  baseRevision: string;
  originalGoal: string;
  status: 'active' | 'completed' | 'failed';
  regionVersions: EditEpisodeRegionVersion[];
  selectionVersions: EditEpisodeSelectionVersion[];
  previewVersions: EditEpisodePreviewVersion[];
  feedbackTurns: UserFeedbackTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface EpisodeModelContext {
  originalGoal: string;
  latestFeedback: UserFeedbackTurn | null;
  activeRegion: EditEpisodeRegionVersion | null;
  activeSelection: EditEpisodeSelectionVersion | null;
  activePreview: EditEpisodePreviewVersion | null;
  rejectedSummary: Array<Pick<
    EditEpisodePreviewVersion,
    'previewVersionId' | 'diffSummary' | 'defectCodes'
  >>;
}
