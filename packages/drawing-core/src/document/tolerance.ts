// SPDX-License-Identifier: Apache-2.0

import type { ToleranceProjection } from './types';

export function validateToleranceProjection(value: ToleranceProjection): void {
  const numeric = [
    value.upperDeviation,
    value.lowerDeviation,
    value.upperLimit,
    value.lowerLimit,
  ].filter((item): item is number => item !== undefined);
  if (numeric.some((item) => !Number.isFinite(item))) throw new TypeError('TOLERANCE_NUMBER_INVALID');
  if (value.mode === 'limits') {
    if (value.lowerLimit === undefined || value.upperLimit === undefined) throw new TypeError('TOLERANCE_LIMITS_REQUIRED');
    if (value.lowerLimit > value.upperLimit) throw new TypeError('TOLERANCE_LIMIT_ORDER');
  }
  if (value.mode === 'bilateral' && (value.upperDeviation === undefined || value.lowerDeviation === undefined)) {
    throw new TypeError('TOLERANCE_DEVIATIONS_REQUIRED');
  }
  if (value.mode === 'unilateral' && value.upperDeviation === undefined && value.lowerDeviation === undefined) {
    throw new TypeError('TOLERANCE_DEVIATION_REQUIRED');
  }
  if (value.mode === 'fit' && !value.fitDesignation?.trim()) throw new TypeError('TOLERANCE_FIT_REQUIRED');
  if (value.fitDesignation !== undefined && value.fitDesignation.length > 32) throw new TypeError('TOLERANCE_FIT_INVALID');
  if (value.status === 'confirmed' && value.evidenceRefs.length === 0) throw new TypeError('TOLERANCE_EVIDENCE_REQUIRED');
  if (value.ruleRef !== undefined && (!value.ruleRef.id || !value.ruleRef.version || !value.ruleRef.inputDigest)) {
    throw new TypeError('TOLERANCE_RULE_REF_INVALID');
  }
  if (value.standardRef !== undefined && (!value.standardRef.id.trim() || !value.standardRef.edition.trim())) {
    throw new TypeError('TOLERANCE_STANDARD_REF_INVALID');
  }
  if (value.featureClass !== undefined && value.unit === 'deg') {
    throw new TypeError('TOLERANCE_FEATURE_CLASS_UNIT_INVALID');
  }
}

export function normalizeToleranceProjection(input: {
  projection?: ToleranceProjection;
  legacy?: { upper?: number; lower?: number };
  unit: 'mm' | 'cm' | 'm' | 'in' | 'deg';
}): ToleranceProjection | undefined {
  if (input.projection !== undefined) {
    validateToleranceProjection(input.projection);
    return structuredClone(input.projection);
  }
  if (input.legacy === undefined || input.legacy.upper === undefined && input.legacy.lower === undefined) return undefined;
  const projection: ToleranceProjection = {
    mode: input.legacy.upper !== undefined && input.legacy.lower !== undefined ? 'bilateral' : 'unilateral',
    ...(input.legacy.upper === undefined ? {} : { upperDeviation: input.legacy.upper }),
    ...(input.legacy.lower === undefined ? {} : { lowerDeviation: input.legacy.lower }),
    unit: input.unit,
    status: 'confirmed',
    source: 'manual',
    evidenceRefs: ['evidence:tolerance:legacy'],
  };
  validateToleranceProjection(projection);
  return projection;
}
