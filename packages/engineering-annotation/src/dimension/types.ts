// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation, DimensionTarget, EntityAnchor, GeometryId } from '@vectorai/drawing-core';
import type { DrawingRef } from '@vectorai/drawing-edit-protocol';
import type { AxialDimensionScheme } from '../dimension-inference/types';
import type { GeometricToleranceIntent } from '../gdt/types';
import type { FeatureOfSizeClass, ToleranceStandardRef } from '../tolerance/standard-types';

export type EngineeringState = 'candidate' | 'resolved' | 'confirmed' | 'conflict' | 'stale';
export type DimensionFunctionalRole = 'datum' | 'overall' | 'functional' | 'assembly' | 'process' | 'inspection' | 'auxiliary' | 'closure';
export type ToleranceMode = 'bilateral' | 'unilateral' | 'limits' | 'fit' | 'formula';
export type ToleranceOrigin = 'document' | 'standard' | 'enterprise-rule' | 'manual' | 'ai-candidate';
/**
 * Records which layer is allowed to make a decision. Geometry and standards
 * may express or locate a requirement, but only requirements/review can choose
 * a design control or value.
 */
export type EngineeringDecisionAuthority =
  | 'standard-expression'
  | 'deterministic-geometry'
  | 'documented-requirement'
  | 'ai-recommendation'
  | 'user-confirmed';

export interface EngineeringDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  /** Partition segments directly involved in this engineering diagnostic. */
  segmentIds?: string[];
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
  unit: 'mm' | 'cm' | 'm' | 'in' | 'deg';
  functionalRole: DimensionFunctionalRole;
  /** Feature-of-size classification resolved while the annotation is generated. */
  featureClass?: FeatureOfSizeClass;
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
  /** World-space position of the draggable datum label; never viewport-relative. */
  labelPosition?: [number, number];
  role: 'primary' | 'secondary' | 'tertiary' | 'origin';
  source: 'document' | 'geometry' | 'manual' | 'ai-candidate';
  status: 'candidate' | 'confirmed' | 'conflict' | 'stale';
  evidenceIds: string[];
  decisionAuthority?: EngineeringDecisionAuthority;
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
  featureClass?: FeatureOfSizeClass;
  selection?: {
    designation: string;
    source: 'rule' | 'ai-recommended' | 'manual';
    evidenceRefs: string[];
  };
  standardRef?: ToleranceStandardRef;
  override?: {
    upperDeviation: number;
    lowerDeviation: number;
  };
  displayPreference?: 'deviations' | 'designation' | 'both';
  fitGroupId?: string;
  /** A mating requirement whose complementary feature is outside the current drawing. */
  matingFit?: {
    matingFeatureClass: FeatureOfSizeClass;
    matingDesignation: string;
    designation: string;
    fitType: 'clearance' | 'transition' | 'interference';
    minimumClearance: number;
    maximumClearance: number;
    standardRef: ToleranceStandardRef;
  };
}

export interface FitAssignment {
  fitGroupId: string;
  holeDimensionId: string;
  shaftDimensionId: string;
  basis: 'hole' | 'shaft';
  designation: string;
  fitType: 'clearance' | 'transition' | 'interference';
  minimumClearance: number;
  maximumClearance: number;
  standardRef: ToleranceStandardRef;
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

export interface SurfaceTextureIntent {
  id: string;
  drawingRef: DrawingRef;
  controlledTargets: DimensionTarget[];
  parameter: 'Ra' | 'Rz' | 'Rq' | 'Rt';
  value: number;
  unit: 'um';
  materialRemoval: 'required' | 'prohibited' | 'unspecified';
  source: 'document' | 'manual' | 'process-rule' | 'ai-candidate';
  status: 'candidate' | 'resolved' | 'confirmed' | 'conflict' | 'stale';
  evidenceIds: string[];
  decisionAuthority?: EngineeringDecisionAuthority;
  ruleRef?: { id: string; version: string };
  labelPosition?: [number, number];
  /** Explicit glyph facing captured when an automatic marker is moved. */
  labelFacing?: 1 | -1;
}

export interface EngineeringAnnotationDraft {
  version: 1;
  drawingRef: DrawingRef;
  datums: EngineeringDatum[];
  intents: DimensionIntent[];
  tolerances: ToleranceSpec[];
  fitAssignments: FitAssignment[];
  geometricTolerances: GeometricToleranceIntent[];
  /** Present in current drafts; optional only for persisted pre-migration plans. */
  surfaceTextures?: SurfaceTextureIntent[];
  chains: DimensionChain[];
  dependencies: AnnotationDependency[];
  diagnostics: EngineeringDiagnostic[];
  axialScheme?: AxialDimensionScheme;
  baseRevisionId?: string;
}

export interface EngineeringAnnotationRevision extends Omit<EngineeringAnnotationDraft, 'baseRevisionId'> {
  id: string;
  parentRevisionId?: string;
  generationOrder: string[];
  confirmedAt: number;
}
