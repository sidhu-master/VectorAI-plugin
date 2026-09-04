// SPDX-License-Identifier: Apache-2.0

import type { DimensionTarget } from '@vectorai/drawing-core';
import type { DrawingRef } from '@vectorai/drawing-edit-protocol';
import type { EngineeringDecisionAuthority, EngineeringDiagnostic } from '../dimension/types';

export type GeometricCharacteristic =
  | 'straightness' | 'flatness' | 'circularity' | 'cylindricity'
  | 'profile-line' | 'profile-surface'
  | 'parallelism' | 'perpendicularity' | 'angularity'
  | 'position' | 'coaxiality' | 'symmetry'
  | 'circular-runout' | 'total-runout';

export type MaterialCondition = 'rfs' | 'mmc' | 'lmc';
export type ToleranceZoneShape = 'linear' | 'diametrical' | 'spherical';

export interface DatumReference {
  datumId: string;
  materialCondition?: MaterialCondition;
}

export interface ComputedGeometricTolerance {
  status: 'pending' | 'resolved' | 'conflict' | 'stale';
  value?: number;
  unit: 'mm';
  ruleRef?: { id: string; version: string };
  inputDigest?: string;
  diagnostics: EngineeringDiagnostic[];
}

export interface GeometricToleranceOverride { value: number }

export interface GeometricToleranceIntent {
  id: string;
  drawingRef: DrawingRef;
  characteristic: GeometricCharacteristic;
  controlledTargets: DimensionTarget[];
  toleranceZone: {
    shape: ToleranceZoneShape;
    materialCondition?: MaterialCondition;
    projectedZoneLength?: number;
  };
  datumReferenceFrame: DatumReference[];
  computed: ComputedGeometricTolerance;
  override?: GeometricToleranceOverride;
  source: 'document' | 'geometry' | 'manual' | 'ai-candidate';
  status: 'candidate' | 'pending-calculation' | 'resolved' | 'confirmed' | 'conflict' | 'stale';
  evidenceIds: string[];
  decisionAuthority?: EngineeringDecisionAuthority;
  /** World-space top-left position shared by rows rendered in one tolerance frame. */
  framePosition?: [number, number];
}

export type GeometricToleranceEdit =
  | { type: 'characteristic.set'; characteristic: GeometricCharacteristic }
  | { type: 'controlled-targets.set'; targets: DimensionTarget[] }
  | { type: 'datum-frame.set'; references: DatumReference[] }
  | { type: 'zone.set'; zone: GeometricToleranceIntent['toleranceZone'] }
  | { type: 'override.set'; value: number }
  | { type: 'override.clear' };

export interface GeometricToleranceRuleDescriptor {
  id: string;
  version: string;
  characteristics: GeometricCharacteristic[];
}

export interface GeometricToleranceRuleRequest {
  ruleId: string;
  ruleVersion: string;
  characteristic: GeometricCharacteristic;
  controlledTargets: DimensionTarget[];
  datumReferenceFrame: DatumReference[];
  inputs: Record<string, number | string | boolean>;
}

export interface GeometricToleranceRuleResult {
  value: number;
  unit: 'mm';
  ruleRef: { id: string; version: string };
  inputDigest: string;
  diagnostics: EngineeringDiagnostic[];
}

export interface GeometricToleranceRuleProvider {
  listRules(): GeometricToleranceRuleDescriptor[];
  evaluate(request: GeometricToleranceRuleRequest): GeometricToleranceRuleResult;
}
