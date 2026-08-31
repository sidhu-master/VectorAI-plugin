// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft, DimensionIntent, ToleranceSpec } from '../dimension/types';
import type { ResolvedFit, ResolvedStandardTolerance } from './standard-types';

type SelectionSource = 'rule' | 'ai-recommended' | 'manual';
type DisplayPreference = 'deviations' | 'designation' | 'both';

export interface ApplySingleToleranceOptions {
  dimensionIntentId: string;
  selectionSource: SelectionSource;
  displayPreference: DisplayPreference;
  evidenceRefs: string[];
}

export interface ApplyFitToleranceOptions {
  fitGroupId: string;
  holeDimensionIntentId: string;
  shaftDimensionIntentId: string;
  selectionSource: SelectionSource;
  displayPreference: DisplayPreference;
  evidenceRefs: string[];
}

export interface ApplyManualToleranceOptions {
  dimensionIntentId: string;
  mode: 'bilateral' | 'unilateral';
  upperDeviation?: number;
  lowerDeviation?: number;
  displayPreference: DisplayPreference;
  evidenceRefs: string[];
}

export function applySingleTolerance(
  draft: EngineeringAnnotationDraft,
  result: ResolvedStandardTolerance,
  options: ApplySingleToleranceOptions,
): EngineeringAnnotationDraft {
  const intent = requireMillimetreIntent(draft, options.dimensionIntentId);
  validateStandardResult(result, intent.nominalValue);
  const spec = standardSpec(options.dimensionIntentId, result, {
    selection: result.designation,
    selectionSource: options.selectionSource,
    displayPreference: options.displayPreference,
    evidenceRefs: options.evidenceRefs,
  });
  return { ...draft, tolerances: replaceIntentTolerance(draft.tolerances, options.dimensionIntentId, spec) };
}

export function applyFitTolerance(
  draft: EngineeringAnnotationDraft,
  result: ResolvedFit,
  options: ApplyFitToleranceOptions,
): EngineeringAnnotationDraft {
  if (!nonBlank(options.fitGroupId)) throw new Error('TOLERANCE_FIT_GROUP_REQUIRED');
  if (options.holeDimensionIntentId === options.shaftDimensionIntentId) throw new Error('TOLERANCE_FIT_INTENTS_DISTINCT');
  const holeIntent = requireMillimetreIntent(draft, options.holeDimensionIntentId);
  const shaftIntent = requireMillimetreIntent(draft, options.shaftDimensionIntentId);
  validateFitResult(result, holeIntent.nominalValue, shaftIntent.nominalValue);
  rejectFitTargetConflict(draft, options);

  const common = {
    selection: result.designation,
    selectionSource: options.selectionSource,
    displayPreference: options.displayPreference,
    evidenceRefs: options.evidenceRefs,
  } as const;
  const hole = { ...standardSpec(options.holeDimensionIntentId, result.hole, common), fitGroupId: options.fitGroupId };
  const shaft = { ...standardSpec(options.shaftDimensionIntentId, result.shaft, common), fitGroupId: options.fitGroupId };
  const targetIds = new Set([options.holeDimensionIntentId, options.shaftDimensionIntentId]);
  const tolerances = [
    ...draft.tolerances.filter((spec) => spec.fitGroupId !== options.fitGroupId && !targetIds.has(spec.dimensionIntentId)),
    hole,
    shaft,
  ];
  const assignment = {
    fitGroupId: options.fitGroupId,
    holeDimensionId: options.holeDimensionIntentId,
    shaftDimensionId: options.shaftDimensionIntentId,
    basis: result.basis,
    designation: result.designation,
    fitType: result.fitType,
    minimumClearance: result.minimumClearance,
    maximumClearance: result.maximumClearance,
    standardRef: { ...result.hole.standardRef },
  };
  return {
    ...draft,
    tolerances,
    fitAssignments: [...draft.fitAssignments.filter(({ fitGroupId }) => fitGroupId !== options.fitGroupId), assignment],
  };
}

export function applyManualTolerance(
  draft: EngineeringAnnotationDraft,
  options: ApplyManualToleranceOptions,
): EngineeringAnnotationDraft {
  requireIntent(draft, options.dimensionIntentId);
  validateManualDeviations(options);
  const resolved = {
    ...(options.upperDeviation === undefined ? {} : { upperDeviation: options.upperDeviation }),
    ...(options.lowerDeviation === undefined ? {} : { lowerDeviation: options.lowerDeviation }),
    inputDigest: `manual:${options.dimensionIntentId}`,
    evaluatedAt: 0,
  };
  const spec: ToleranceSpec = {
    id: `tolerance:manual:${options.dimensionIntentId}`,
    dimensionIntentId: options.dimensionIntentId,
    mode: options.mode,
    source: 'manual',
    inputs: {},
    resolved,
    status: 'resolved',
    evidenceIds: [...options.evidenceRefs],
    diagnostics: [],
    displayPreference: options.displayPreference,
  };
  return { ...draft, tolerances: replaceIntentTolerance(draft.tolerances, options.dimensionIntentId, spec) };
}

export function setToleranceOverride(
  draft: EngineeringAnnotationDraft,
  dimensionIntentId: string,
  override: { upperDeviation: number; lowerDeviation: number },
): EngineeringAnnotationDraft {
  validateDeviationPair(override.upperDeviation, override.lowerDeviation);
  const index = requireToleranceIndex(draft, dimensionIntentId);
  const spec = draft.tolerances[index]!;
  if (!spec.resolved) throw new Error('TOLERANCE_RESULT_REQUIRED');
  return {
    ...draft,
    tolerances: draft.tolerances.map((item, itemIndex) => itemIndex === index
      ? { ...item, override: { ...override } }
      : item),
  };
}

export function clearToleranceOverride(draft: EngineeringAnnotationDraft, dimensionIntentId: string): EngineeringAnnotationDraft {
  const index = requireToleranceIndex(draft, dimensionIntentId);
  return {
    ...draft,
    tolerances: draft.tolerances.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const { override: _override, ...withoutOverride } = item;
      return withoutOverride;
    }),
  };
}

function standardSpec(
  dimensionIntentId: string,
  result: ResolvedStandardTolerance,
  options: { selection: string; selectionSource: SelectionSource; displayPreference: DisplayPreference; evidenceRefs: string[] },
): ToleranceSpec {
  return {
    id: `tolerance:standard:${dimensionIntentId}`,
    dimensionIntentId,
    mode: 'bilateral',
    source: 'standard',
    ruleRef: { id: result.ruleRef.id, version: result.ruleRef.version },
    inputs: { basicSize: result.basicSize, featureClass: result.featureClass, designation: result.designation },
    resolved: {
      upperDeviation: result.upperDeviation,
      lowerDeviation: result.lowerDeviation,
      upperLimit: result.upperLimitSize,
      lowerLimit: result.lowerLimitSize,
      fitDesignation: options.selection,
      inputDigest: result.ruleRef.inputDigest,
      evaluatedAt: 0,
    },
    status: 'resolved',
    evidenceIds: [...options.evidenceRefs],
    diagnostics: [],
    featureClass: result.featureClass,
    selection: { designation: options.selection, source: options.selectionSource, evidenceRefs: [...options.evidenceRefs] },
    standardRef: { ...result.standardRef },
    displayPreference: options.displayPreference,
  };
}

function replaceIntentTolerance(tolerances: readonly ToleranceSpec[], dimensionIntentId: string, replacement: ToleranceSpec): ToleranceSpec[] {
  return [...tolerances.filter((spec) => spec.dimensionIntentId !== dimensionIntentId), replacement];
}

function requireIntent(draft: EngineeringAnnotationDraft, dimensionIntentId: string): DimensionIntent {
  const intent = draft.intents.find(({ id }) => id === dimensionIntentId);
  if (!intent) throw new Error('TOLERANCE_INTENT_UNKNOWN');
  return intent;
}

function requireMillimetreIntent(draft: EngineeringAnnotationDraft, dimensionIntentId: string): DimensionIntent {
  const intent = requireIntent(draft, dimensionIntentId);
  if (intent.unit !== 'mm' || !Number.isFinite(intent.nominalValue)) throw new Error('TOLERANCE_BASIC_SIZE_INVALID');
  return intent;
}

function requireToleranceIndex(draft: EngineeringAnnotationDraft, dimensionIntentId: string): number {
  requireIntent(draft, dimensionIntentId);
  let index = -1;
  for (const [candidateIndex, spec] of draft.tolerances.entries()) {
    if (spec.dimensionIntentId === dimensionIntentId) index = candidateIndex;
  }
  if (index < 0) throw new Error('TOLERANCE_SPEC_UNKNOWN');
  return index;
}

function rejectFitTargetConflict(draft: EngineeringAnnotationDraft, options: ApplyFitToleranceOptions): void {
  const targetIds = new Set([options.holeDimensionIntentId, options.shaftDimensionIntentId]);
  const assignmentConflict = draft.fitAssignments.some((assignment) => (
    assignment.fitGroupId !== options.fitGroupId
    && (targetIds.has(assignment.holeDimensionId) || targetIds.has(assignment.shaftDimensionId))
  ));
  const toleranceConflict = draft.tolerances.some((spec) => (
    targetIds.has(spec.dimensionIntentId)
    && spec.fitGroupId !== undefined
    && nonBlank(spec.fitGroupId)
    && spec.fitGroupId !== options.fitGroupId
  ));
  if (assignmentConflict || toleranceConflict) throw new Error('FIT_PAIR_TARGET_CONFLICT');
}

function validateStandardResult(result: ResolvedStandardTolerance, basicSize: number): void {
  if (!['internal', 'external'].includes(result.featureClass)) throw new Error('TOLERANCE_FEATURE_CLASS_INVALID');
  if (!nonBlank(result.designation) || !nonBlank(result.standardRef.id) || !nonBlank(result.standardRef.edition)
    || !nonBlank(result.ruleRef.id) || !nonBlank(result.ruleRef.version) || !nonBlank(result.ruleRef.inputDigest)) {
    throw new Error('TOLERANCE_STANDARD_PROVENANCE_REQUIRED');
  }
  if (!Number.isFinite(result.basicSize) || result.basicSize !== basicSize) throw new Error('TOLERANCE_BASIC_SIZE_MISMATCH');
  validateDeviationPair(result.upperDeviation, result.lowerDeviation);
  if (!Number.isFinite(result.upperLimitSize) || !Number.isFinite(result.lowerLimitSize)
    || result.lowerLimitSize > result.upperLimitSize) throw new Error('TOLERANCE_LIMIT_ORDER');
}

function validateFitResult(result: ResolvedFit, holeBasicSize: number, shaftBasicSize: number): void {
  if (!nonBlank(result.designation) || !nonBlank(result.basis) || !['clearance', 'transition', 'interference'].includes(result.fitType)) {
    throw new Error('TOLERANCE_FIT_INVALID');
  }
  if (result.designation !== `${result.hole.designation}/${result.shaft.designation}`) {
    throw new Error('TOLERANCE_FIT_DESIGNATION_MISMATCH');
  }
  if (!Number.isFinite(result.minimumClearance) || !Number.isFinite(result.maximumClearance)
    || result.minimumClearance > result.maximumClearance) throw new Error('TOLERANCE_FIT_CLEARANCE_INVALID');
  if (result.hole.featureClass !== 'internal' || result.shaft.featureClass !== 'external') throw new Error('TOLERANCE_FIT_FEATURE_CLASS_INVALID');
  if (holeBasicSize !== shaftBasicSize || result.hole.basicSize !== result.shaft.basicSize
    || result.hole.basicSize !== holeBasicSize) throw new Error('TOLERANCE_FIT_BASIC_SIZE_MISMATCH');
  validateStandardResult(result.hole, holeBasicSize);
  validateStandardResult(result.shaft, shaftBasicSize);
  if (result.hole.standardRef.id !== result.shaft.standardRef.id || result.hole.standardRef.edition !== result.shaft.standardRef.edition) {
    throw new Error('TOLERANCE_FIT_STANDARD_MISMATCH');
  }
}

function validateManualDeviations(options: ApplyManualToleranceOptions): void {
  const hasUpper = options.upperDeviation !== undefined;
  const hasLower = options.lowerDeviation !== undefined;
  if (options.mode === 'bilateral' && (!hasUpper || !hasLower)) throw new Error('TOLERANCE_DEVIATIONS_REQUIRED');
  if (options.mode === 'unilateral' && !hasUpper && !hasLower) throw new Error('TOLERANCE_DEVIATION_REQUIRED');
  if ((hasUpper && !Number.isFinite(options.upperDeviation)) || (hasLower && !Number.isFinite(options.lowerDeviation))) {
    throw new Error('TOLERANCE_DEVIATION_INVALID');
  }
  const upper = options.upperDeviation ?? 0;
  const lower = options.lowerDeviation ?? 0;
  if (lower > upper) throw new Error('TOLERANCE_DEVIATION_ORDER');
}

function validateDeviationPair(upperDeviation: number, lowerDeviation: number): void {
  if (!Number.isFinite(upperDeviation) || !Number.isFinite(lowerDeviation)) throw new Error('TOLERANCE_DEVIATION_INVALID');
  if (lowerDeviation > upperDeviation) throw new Error('TOLERANCE_DEVIATION_ORDER');
}

function nonBlank(value: string): boolean { return value.trim().length > 0; }
