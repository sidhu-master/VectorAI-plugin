// SPDX-License-Identifier: Apache-2.0

export type FeatureOfSizeClass = 'internal' | 'external';
export type ToleranceBandCategory = 'preferred' | 'common' | 'other' | 'unknown';

export interface ToleranceDatasetProvenance {
  kind: 'authorized-standard-tabulation' | 'plan-reference-vector';
  referenceId: string;
  description: string;
}

export interface ToleranceDatasetMetadata {
  completeness: 'complete' | 'partial';
  catalogClassification: 'verified' | 'unverified';
  numericProvenance: readonly ToleranceDatasetProvenance[];
}

export interface ToleranceStandardRef {
  id: string;
  edition: string;
}

export interface ToleranceBand {
  designation: string;
  featureClass: FeatureOfSizeClass;
  category: ToleranceBandCategory;
  available: boolean;
  unavailableCode?: 'TOLERANCE_SIZE_RANGE_UNSUPPORTED' | 'TOLERANCE_DESIGNATION_INVALID' | 'TOLERANCE_STANDARD_UNAVAILABLE';
}

export interface ResolvedStandardTolerance {
  designation: string;
  featureClass: FeatureOfSizeClass;
  basicSize: number;
  unit: 'mm';
  upperDeviation: number;
  lowerDeviation: number;
  upperLimitSize: number;
  lowerLimitSize: number;
  standardRef: ToleranceStandardRef;
  ruleRef: { id: string; version: string; inputDigest: string };
}

export interface ResolvedFit {
  designation: string;
  basis: 'hole' | 'shaft';
  hole: ResolvedStandardTolerance;
  shaft: ResolvedStandardTolerance;
  fitType: 'clearance' | 'transition' | 'interference';
  minimumClearance: number;
  maximumClearance: number;
}

export interface ToleranceStandardProvider {
  readonly standardRef: ToleranceStandardRef;
  readonly datasetMetadata: ToleranceDatasetMetadata;
  listBands(request: { basicSize: number; featureClass: FeatureOfSizeClass }): ToleranceBand[];
  resolveBand(request: { basicSize: number; featureClass: FeatureOfSizeClass; designation: string }): ResolvedStandardTolerance;
  resolveFit(request: { basicSize: number; basis: 'hole' | 'shaft'; designation: string }): ResolvedFit;
}
