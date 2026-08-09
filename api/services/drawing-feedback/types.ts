import type {
  CvEvidenceKind,
  CvPrimitiveType,
  SourcePixelRect,
} from '../drawing-cv/types.js';

export type ObservationPurpose =
  | 'inventory'
  | 'geometry'
  | 'topology'
  | 'annotation'
  | 'verification';

export interface ObservationRegion {
  id: string;
  sourceId: string;
  bounds: SourcePixelRect;
  purpose: ObservationPurpose;
  targetSlotIds: string[];
  parentRegionId?: string;
  resolutionLevel: number;
  attempt: number;
}

export interface SlotEvidenceRef {
  handle: string;
  kind: CvEvidenceKind;
  bounds: SourcePixelRect;
  confidence: number;
  touchesRegionEdge: boolean;
}

export interface SlotCandidateType {
  type: CvPrimitiveType;
  score: number;
}

export type ObservationSlotStatus =
  | 'unobserved'
  | 'candidate'
  | 'committed'
  | 'conflict'
  | 'rejected';

export type SlotLineageAction =
  | 'create'
  | 'update'
  | 'retype'
  | 'merge'
  | 'split'
  | 'delete'
  | 'reject';

export interface SlotLineageRecord {
  revision: number;
  action: SlotLineageAction;
  parentSlotIds: string[];
  removedDrawingEntityIds: string[];
  addedDrawingEntityIds: string[];
}

export interface ObservationSlot {
  id: string;
  sourceId: string;
  evidenceRefs: string[];
  evidence: SlotEvidenceRef[];
  candidateTypes: SlotCandidateType[];
  drawingEntityIds: string[];
  status: ObservationSlotStatus;
  revision: number;
  lineage: SlotLineageRecord[];
}

export interface SlotObservationInput {
  sourceId: string;
  evidence: SlotEvidenceRef;
  candidateTypes: SlotCandidateType[];
}
