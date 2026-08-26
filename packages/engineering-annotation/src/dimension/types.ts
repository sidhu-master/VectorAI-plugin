// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation, DimensionTarget, EntityAnchor, GeometryId } from '@vectorai/drawing-core';
import type { DrawingRef } from '@vectorai/drawing-edit-protocol';

export type EngineeringState = 'candidate' | 'resolved' | 'confirmed' | 'conflict' | 'stale';
export type DimensionFunctionalRole = 'datum' | 'overall' | 'functional' | 'assembly' | 'process' | 'inspection' | 'auxiliary' | 'closure';
export type ToleranceMode = 'bilateral' | 'unilateral' | 'limits' | 'fit' | 'formula';
export type ToleranceOrigin = 'document' | 'standard' | 'enterprise-rule' | 'manual' | 'ai-candidate';

export interface EngineeringDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  entityIds?: string[];
  evidenceIds?: string[];
}

export interface DimensionIntent {
  id: string;
  drawingRef: DrawingRef;
  kind: DimensionAnnotation['dimensionKind'];
  targets: DimensionTarget[];
  datumIds: string[];
  nominalValue: number;
  unit: 'mm' | 'cm' | 'm' | 'deg';
  functionalRole: DimensionFunctionalRole;
  source: 'document' | 'geometry' | 'manual' | 'ai-candidate';
  status: EngineeringState;
  evidenceIds: string[];
}

export interface EngineeringDatum {
  id: string;
  drawingRef: DrawingRef;
  name: string;
  geometryId: GeometryId;
  anchor: EntityAnchor;
  role: 'primary' | 'secondary' | 'tertiary' | 'origin';
  source: 'document' | 'geometry' | 'manual' | 'ai-candidate';
  status: 'candidate' | 'confirmed' | 'conflict' | 'stale';
  evidenceIds: string[];
}

export interface ResolvedTolerance {
  upperDeviation?: number;
  lowerDeviation?: number;
  upperLimit?: number;
  lowerLimit?: number;
  fitDesignation?: string;
  inputDigest: string;
  evaluatedAt: number;
}

export interface ToleranceSpec {
  id: string;
  dimensionIntentId: string;
  mode: ToleranceMode;
  source: ToleranceOrigin;
  ruleRef?: { id: string; version: string };
  inputs: Record<string, number | string | boolean>;
  resolved?: ResolvedTolerance;
  status: EngineeringState;
  evidenceIds: string[];
  diagnostics: EngineeringDiagnostic[];
}

export interface DimensionChainMember {
  dimensionIntentId: string;
  coefficient: 1 | -1;
  role: 'functional' | 'component' | 'closure';
  sequenceHint?: number;
}

export interface DimensionChain {
  id: string;
  drawingRef: DrawingRef;
  name?: string;
  datumIds: string[];
  members: DimensionChainMember[];
  equation: { closureIntentId: string; targetValue?: number };
  analysisMode: 'worst-case' | 'statistical' | 'reference-only';
  status: EngineeringState;
  evidenceIds: string[];
  diagnostics: EngineeringDiagnostic[];
}

export interface AnnotationDependency {
  beforeIntentId: string;
  afterIntentId: string;
  reason: 'datum-before-dependent' | 'overall-before-functional' | 'functional-before-component' | 'component-before-closure' | 'explicit-document-order';
  evidenceIds: string[];
}

export interface EngineeringAnnotationDraft {
  version: 1;
  drawingRef: DrawingRef;
  datums: EngineeringDatum[];
  intents: DimensionIntent[];
  tolerances: ToleranceSpec[];
  chains: DimensionChain[];
  dependencies: AnnotationDependency[];
  diagnostics: EngineeringDiagnostic[];
  baseRevisionId?: string;
}

export interface EngineeringAnnotationRevision extends Omit<EngineeringAnnotationDraft, 'baseRevisionId'> {
  id: string;
  parentRevisionId?: string;
  generationOrder: string[];
  confirmedAt: number;
}
