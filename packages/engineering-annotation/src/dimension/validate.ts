// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft, EngineeringDiagnostic } from './types';

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
    if (tolerance.status === 'confirmed' && tolerance.resolved === undefined) {
      diagnostics.push(problem('TOLERANCE_RESULT_REQUIRED', tolerance.id, 'Confirmed tolerance requires a resolved result'));
    }
  }
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
  return diagnostics;
}

function problem(code: string, id: string, message: string): EngineeringDiagnostic {
  return { id: `diagnostic:${code}:${id}`, severity: 'error', code, message, entityIds: [id] };
}
