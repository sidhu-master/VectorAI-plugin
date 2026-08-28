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
  unit: 'mm' | 'cm' | 'm';
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
  unit: 'mm' | 'cm' | 'm';
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
