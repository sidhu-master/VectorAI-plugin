// SPDX-License-Identifier: Apache-2.0

export type FeatureOfSizeClass = 'internal' | 'external';
export type ToleranceBandCategory = 'preferred' | 'common' | 'other';

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
  listBands(request: { basicSize: number; featureClass: FeatureOfSizeClass }): ToleranceBand[];
  resolveBand(request: { basicSize: number; featureClass: FeatureOfSizeClass; designation: string }): ResolvedStandardTolerance;
  resolveFit(request: { basicSize: number; basis: 'hole' | 'shaft'; designation: string }): ResolvedFit;
}
