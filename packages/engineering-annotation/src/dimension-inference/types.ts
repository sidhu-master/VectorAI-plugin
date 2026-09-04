// SPDX-License-Identifier: Apache-2.0

import type { DrawingRef } from '@vectorai/drawing-edit-protocol';
import type { ParsedEngineeringDocument } from '../engineering-document/parser';
import type { EngineeringDiagnostic } from '../dimension/types';
import type { PartitionDraft, PartitionRevision } from '../partition/types';
import type { ShaftAxis } from '../partition/types';

export type DimensionEvidenceOrigin = 'geometry' | 'partition' | 'document' | 'manual' | 'ai';
export type AxialStationKind = 'drawing-end' | 'shoulder' | 'partition-boundary' | 'datum';

export interface AxialStation {
  id: string;
  coordinate: number;
  sourceCoordinate: number;
  unit: 'mm' | 'cm' | 'm' | 'in';
  kinds: AxialStationKind[];
  geometryNodeIds: string[];
  evidenceIds: string[];
}

export interface AxialElementarySpan {
  id: string;
  startStationId: string;
  endStationId: string;
  nominalValue: number;
  segmentIds: string[];
  evidenceIds: string[];
}

export interface AxialTopology {
  drawingRef: DrawingRef;
  axis: ShaftAxis;
  unit: 'mm' | 'cm' | 'm' | 'in';
  stations: AxialStation[];
  elementarySpans: AxialElementarySpan[];
}

export type AxialDimensionRole = 'overall' | 'composite' | 'functional' | 'process' | 'local' | 'reference' | 'closure';

export interface DimensionEvidence {
  id: string;
  origin: DimensionEvidenceOrigin;
  kind: 'drawing-end' | 'elementary-span' | 'functional-region' | 'document-interval' | 'process-envelope' | 'manual-requirement';
  label: string;
  required: boolean;
  constraint?: 'required' | 'preferred' | 'prohibited';
  sourceIds: string[];
}

export interface AxialDimensionCandidate {
  id: string;
  startStationId: string;
  endStationId: string;
  nominalValue: number;
  roles: AxialDimensionRole[];
  evidenceIds: string[];
  required: boolean;
  constraint?: 'required' | 'preferred' | 'prohibited';
}

export interface GenerateCandidateInput {
  topology: AxialTopology;
  partition: PartitionDraft | PartitionRevision;
  document?: ParsedEngineeringDocument;
  manualIntervals?: Array<{ start: number; end: number; label: string }>;
}

export interface AxialCandidateSet {
  candidates: AxialDimensionCandidate[];
  evidence: DimensionEvidence[];
  diagnostics: EngineeringDiagnostic[];
}

export type DimensionScoreFeature =
  | 'manual-required'
  | 'document-exact'
  | 'functional-region'
  | 'process-envelope'
  | 'composite-block'
  | 'overall-root'
  | 'elementary-span';

export interface AxialInferencePolicy {
  id: 'shaft-hierarchical-dimensioning-v1';
  version: '1';
  weights: Readonly<Record<DimensionScoreFeature, number>>;
  ambiguityMargin: number;
}

export interface DimensionDecisionTrace {
  candidateId: string;
  decision: 'displayed' | 'closure' | 'rejected' | 'alternative';
  score: number;
  features: Array<{ feature: DimensionScoreFeature; contribution: number; evidenceIds: string[] }>;
  reasonCodes: string[];
}

export interface AxialChainNode {
  id: string;
  parentCandidateId: string;
  childCandidateIds: string[];
  closureCandidateId: string;
  alternativeClosureCandidateIds: string[];
  status: 'resolved' | 'needs-review' | 'conflict';
  closureRationale?: {
    rule: 'hard-constraints-then-evidence-authority';
    selectedEvidenceTier: number;
    reasonCodes: string[];
    counterfactualCandidateIds: string[];
  };
}

export interface AxialDimensionScheme {
  version: 1;
  drawingRef: DrawingRef;
  partitionRevisionId?: string;
  policy: { id: AxialInferencePolicy['id']; version: '1' };
  inputDigest: string;
  topology: AxialTopology;
  evidence: DimensionEvidence[];
  candidates: AxialDimensionCandidate[];
  displayedCandidateIds: string[];
  closureCandidateIds: string[];
  chains: AxialChainNode[];
  layout?: {
    chainNormalOffsets: Array<{ chainId: string; normalOffset: number }>;
    candidateNormalOffsets: Array<{ candidateId: string; normalOffset: number }>;
  };
  decisions: DimensionDecisionTrace[];
  diagnostics: EngineeringDiagnostic[];
  status: 'resolved' | 'needs-review' | 'conflict' | 'stale';
}

export interface InferAxialDimensionSchemeInput {
  topology: AxialTopology;
  candidateSet: AxialCandidateSet;
  policy: AxialInferencePolicy;
  partitionRevisionId?: string;
}
