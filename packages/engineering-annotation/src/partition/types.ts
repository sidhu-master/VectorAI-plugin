// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import type { DrawingRef } from '@vectorai/drawing-edit-protocol';

export type EvidenceOrigin = 'document' | 'geometry' | 'fused' | 'ai' | 'manual';
export interface ShaftAxis { origin: Vec2; direction: Vec2; normal: Vec2; zMin: number; zMax: number; orientation: 'forward' | 'reversed'; geometryNodeIds?: string[] }
export interface StepCandidate {
  id: string; z: number; score: number; evidenceIds: string[]; accepted: boolean;
  policyVersion?: 'shaft-step-confidence-v1';
  confidenceBreakdown?: {
    contourContinuity: number;
    bilateralCorrespondence: number;
    axialResidence: number;
    radiusChange: number;
    entityQuality: number;
  };
}
export interface ShaftProfileSummary { minRadius: number; maxRadius: number; sampleCount: number }
export type ShaftDimensionRole = 'functional-feature' | 'process-datum' | 'transition' | 'ordinary';
export interface PartitionDiagnostic { id: string; severity: 'info' | 'warning' | 'error'; code: string; message: string; segmentIds?: string[]; evidenceIds?: string[] }
export interface PartitionEvidence { id: string; origin: EvidenceOrigin; label: string; sourceLines?: number[]; geometryNodeIds?: string[] }
export interface ShaftPartitionSegment {
  id: string; zStart: number; zEnd: number; profile: ShaftProfileSummary;
  semanticType?: string; name?: string; boundaryConfidence: number; semanticConfidence?: number;
  geometryNodeIds: string[]; boundaryEvidenceIds: string[]; semanticEvidenceIds: string[]; diagnosticIds: string[];
  profileSamples?: Array<{ z: number; radius: number; geometryNodeId: string }>;
}
export interface ShaftSemanticGroup {
  id: string;
  segmentIds: string[];
  /** Independent functional extent. Legacy persisted groups may omit it. */
  range?: { zStart: number; zEnd: number };
  semanticType: string;
  /** Dimension-chain significance; omitted by legacy persisted partitions and derived locally. */
  dimensionRole?: ShaftDimensionRole;
  name?: string;
  evidenceIds: string[];
  reconciliation?: {
    status: 'matched' | 'ambiguous' | 'conflict' | 'unmatched';
    stationError: number;
    widthError: number;
    diameterError?: number;
    topologyError: number;
    documentIdentityError: number;
    documentRange: { zStart: number; zEnd: number };
    geometryRange?: { zStart: number; zEnd: number };
  };
}
/** Geometric decomposition: these segments always cover the full shaft axis continuously. */
export type AxialShaftSegment = ShaftPartitionSegment;
/** Semantic extents: these regions may be sparse, overlap, or conflict with geometry. */
export type FunctionalShaftRegion = ShaftSemanticGroup;
export interface PartitionDraft {
  version: 1; drawingRef: DrawingRef; axis: ShaftAxis;
  segments: ShaftPartitionSegment[]; semanticGroups: ShaftSemanticGroup[];
  stepCandidates: StepCandidate[]; evidence: PartitionEvidence[]; diagnostics: PartitionDiagnostic[];
  geometryFingerprint?: string;
  basePartitionRevisionId?: string;
}
export interface PartitionRevision extends Omit<PartitionDraft, 'stepCandidates' | 'basePartitionRevisionId'> {
  id: string; parentRevisionId?: string; confirmedAt: number;
}
