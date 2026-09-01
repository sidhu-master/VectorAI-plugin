// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft, EngineeringDiagnostic, ToleranceSpec } from './types';
import { validateGeometricTolerances } from '../gdt/validate';

export function validateEngineeringDraft(draft: EngineeringAnnotationDraft): EngineeringDiagnostic[] {
  const diagnostics: EngineeringDiagnostic[] = [];
  const intentIds = new Set<string>();
  for (const intent of draft.intents) {
    if (intentIds.has(intent.id)) diagnostics.push(problem('DIMENSION_ID_DUPLICATE', intent.id, 'Duplicate dimension intent ID'));
    intentIds.add(intent.id);
  }
  const datumIds = new Set(draft.datums.map(({ id }) => id));
  for (const datum of draft.datums) {
    if (datum.status === 'stale') diagnostics.push(problem('DIMENSION_DATUM_STALE', datum.id, 'Datum references stale geometry'));
  }
  for (const intent of draft.intents) {
    if (intent.targets.length === 0) diagnostics.push(problem('DIMENSION_TARGET_REQUIRED', intent.id, 'Dimension intent has no target'));
    if (!Number.isFinite(intent.nominalValue)) diagnostics.push(problem('DIMENSION_NOMINAL_INVALID', intent.id, 'Nominal value must be finite'));
    for (const datumId of intent.datumIds) {
      if (!datumIds.has(datumId)) diagnostics.push(problem('DIMENSION_DATUM_UNKNOWN', intent.id, `Unknown datum ${datumId}`));
    }
  }
  for (const tolerance of draft.tolerances) {
    if (!intentIds.has(tolerance.dimensionIntentId)) diagnostics.push(problem('TOLERANCE_INTENT_UNKNOWN', tolerance.id, 'Tolerance references an unknown intent'));
    if ((tolerance.status === 'resolved' || tolerance.status === 'confirmed') && tolerance.resolved === undefined) {
      diagnostics.push(problem('TOLERANCE_RESULT_REQUIRED', tolerance.id, 'Confirmed tolerance requires a resolved result'));
    } else if (tolerance.resolved !== undefined && !isResolvedToleranceValid(tolerance)) {
      diagnostics.push(problem('TOLERANCE_RESULT_INVALID', tolerance.id, 'Resolved tolerance does not match its declared mode'));
    }
  }
  validateFitAssignments(draft, intentIds, diagnostics);
  for (const chain of draft.chains) {
    for (const member of chain.members) {
      if (member.coefficient !== 1 && member.coefficient !== -1) {
        diagnostics.push(problem('DIMENSION_CHAIN_COEFFICIENT_INVALID', chain.id, 'Chain coefficient must be 1 or -1'));
      }
      if (!intentIds.has(member.dimensionIntentId)) diagnostics.push(problem('DIMENSION_CHAIN_MEMBER_UNKNOWN', chain.id, `Unknown chain member ${member.dimensionIntentId}`));
    }
    if (!intentIds.has(chain.equation.closureIntentId) || !chain.members.some(({ dimensionIntentId }) => dimensionIntentId === chain.equation.closureIntentId)) {
      diagnostics.push(problem('DIMENSION_CHAIN_CLOSURE_UNKNOWN', chain.id, 'Closure intent must be a known chain member'));
    }
  }
  for (const dependency of draft.dependencies) {
    if (!intentIds.has(dependency.beforeIntentId) || !intentIds.has(dependency.afterIntentId)) {
      diagnostics.push(problem('DIMENSION_DEPENDENCY_UNKNOWN', `${dependency.beforeIntentId}->${dependency.afterIntentId}`, 'Dependency references an unknown intent'));
    }
  }
  diagnostics.push(...validateGeometricTolerances({ datums: draft.datums, intents: draft.geometricTolerances ?? [] }));
  return diagnostics;
}

function validateFitAssignments(
  draft: EngineeringAnnotationDraft,
  intentIds: ReadonlySet<string>,
  diagnostics: EngineeringDiagnostic[],
): void {
  const assignmentGroups = new Set<string>();
  for (const assignment of draft.fitAssignments) {
    const memberIdsValid = assignment.holeDimensionId !== assignment.shaftDimensionId
      && intentIds.has(assignment.holeDimensionId)
      && intentIds.has(assignment.shaftDimensionId)
      && !assignmentGroups.has(assignment.fitGroupId);
    assignmentGroups.add(assignment.fitGroupId);
    if (!memberIdsValid) {
      diagnostics.push(problem('FIT_ASSIGNMENT_MEMBER_INVALID', assignment.fitGroupId, 'Fit assignment members must be distinct existing intents'));
      continue;
    }
    const members = draft.tolerances.filter(({ fitGroupId }) => fitGroupId === assignment.fitGroupId);
    const hole = members.find(({ dimensionIntentId }) => dimensionIntentId === assignment.holeDimensionId);
    const shaft = members.find(({ dimensionIntentId }) => dimensionIntentId === assignment.shaftDimensionId);
    const sameStandard = hole?.standardRef?.id === assignment.standardRef.id
      && hole.standardRef.edition === assignment.standardRef.edition
      && shaft?.standardRef?.id === assignment.standardRef.id
      && shaft.standardRef.edition === assignment.standardRef.edition;
    const validMembers = members.length === 2
      && hole?.source === 'standard'
      && shaft.source === 'standard'
      && (hole.status === 'resolved' || hole.status === 'confirmed')
      && (shaft.status === 'resolved' || shaft.status === 'confirmed')
      && hole?.featureClass === 'internal'
      && shaft?.featureClass === 'external'
      && hole.selection?.designation === assignment.designation
      && shaft.selection?.designation === assignment.designation
      && hole.resolved?.fitDesignation === assignment.designation
      && shaft.resolved?.fitDesignation === assignment.designation
      && sameStandard;
    if (!validMembers) {
      diagnostics.push(problem('FIT_ASSIGNMENT_TOLERANCE_INVALID', assignment.fitGroupId, 'Fit assignment must match its paired tolerance members'));
    }
  }
  for (const tolerance of draft.tolerances) {
    if (!tolerance.fitGroupId || assignmentGroups.has(tolerance.fitGroupId) || tolerance.status === 'stale') continue;
    diagnostics.push(problem('FIT_ASSIGNMENT_REQUIRED', tolerance.id, 'Resolved fit tolerance requires an active fit assignment'));
  }
}

export function isResolvedToleranceValid(tolerance: ToleranceSpec): boolean {
  const resolved = tolerance.resolved;
  if (!resolved
    || !resolved.inputDigest
    || !Number.isFinite(resolved.evaluatedAt)
    || [resolved.upperDeviation, resolved.lowerDeviation, resolved.upperLimit, resolved.lowerLimit]
      .some((value) => value !== undefined && !Number.isFinite(value))) return false;
  switch (tolerance.mode) {
    case 'bilateral':
      return finite(resolved.upperDeviation) && finite(resolved.lowerDeviation)
        && resolved.lowerDeviation <= resolved.upperDeviation;
    case 'unilateral': {
      if (!finite(resolved.upperDeviation) && !finite(resolved.lowerDeviation)) return false;
      const upper = resolved.upperDeviation ?? 0;
      const lower = resolved.lowerDeviation ?? 0;
      return lower <= upper;
    }
    case 'limits':
      return finite(resolved.upperLimit) && finite(resolved.lowerLimit) && resolved.lowerLimit <= resolved.upperLimit;
    case 'fit':
      return typeof resolved.fitDesignation === 'string'
        && resolved.fitDesignation.trim().length > 0
        && resolved.fitDesignation.length <= 32;
    case 'formula':
      return false;
  }
}

function finite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function problem(code: string, id: string, message: string): EngineeringDiagnostic {
  return { id: `diagnostic:${code}:${id}`, severity: 'error', code, message, entityIds: [id] };
}
