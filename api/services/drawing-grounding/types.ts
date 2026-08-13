import type {
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';

export type SemanticSupportKind = 'node' | 'source-span' | 'half-edge' | 'face';
export type SemanticSupportRole = 'interior' | 'boundary' | 'interface' | 'context';

export interface SemanticSupport {
  kind: SemanticSupportKind;
  ref: string;
  weight: number;
  role: SemanticSupportRole;
}

export interface GroundingProvenance {
  provider: string;
  evidenceRefs: string[];
  createdAt: number;
  modelCallId?: string;
  compilerVersion?: string;
  inputDigest?: string;
}

export interface SemanticEntityHypothesis {
  id: string;
  drawingId: DrawingId;
  revision: RevisionId;
  label: string;
  referringExpression: string;
  observationRefs: string[];
  regionRefs: string[];
  supports: SemanticSupport[];
  excludedSupports: string[];
  interfaceRefs: string[];
  confidence: number;
  provenance: GroundingProvenance;
  supersedes?: string[];
}

export type GroundingEvidenceEventKind =
  | 'proposed'
  | 'selected'
  | 'refined'
  | 'rejected'
  | 'superseded'
  | 'promoted';

export interface GroundingEvidenceEvent {
  id: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  hypothesisId: string;
  kind: GroundingEvidenceEventKind;
  hypothesis?: SemanticEntityHypothesis;
  evidenceRefs: string[];
  supportDelta?: { added: SemanticSupport[]; removed: string[] };
  confidence?: number;
  reasonCode: string;
  createdAt: number;
}

export type GroundingHypothesisStatus =
  | 'active'
  | 'selected'
  | 'rejected'
  | 'superseded'
  | 'promoted';

export interface GroundingHypothesisState {
  hypothesisId: string;
  status: GroundingHypothesisStatus;
  hypothesis: SemanticEntityHypothesis;
  lastEventId: string;
  lastEventCursor: number;
}

export interface GroundingLedgerDelta {
  fromCursor: number;
  nextCursor: number;
  events: GroundingEvidenceEvent[];
  current: GroundingHypothesisState[];
}

export type TaskSemanticRelationKind =
  | 'part-of'
  | 'contains'
  | 'boundary-of'
  | 'interface-with'
  | 'context-for';

export interface TaskSemanticRelation {
  kind: TaskSemanticRelationKind;
  from: string;
  to: string;
  confidence: number;
  evidenceRefs: string[];
}

export interface TaskRelevantView {
  id: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  goalDigest: string;
  entities: SemanticEntityHypothesis[];
  relations: TaskSemanticRelation[];
  abstraction: 'detail' | 'part' | 'object' | 'region';
  evidenceRefs: string[];
  evidenceDigest: string;
}
