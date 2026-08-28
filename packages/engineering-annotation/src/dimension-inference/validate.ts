// SPDX-License-Identifier: Apache-2.0

import type { EngineeringDiagnostic } from '../dimension/types';
import type { AxialDimensionCandidate, AxialDimensionScheme } from './types';

export function validateAxialDimensionScheme(scheme: AxialDimensionScheme): EngineeringDiagnostic[] {
  const diagnostics: EngineeringDiagnostic[] = [];
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const displayed = new Set(scheme.displayedCandidateIds);
  const closures = new Set(scheme.closureCandidateIds);
  const selected = scheme.displayedCandidateIds.flatMap((id) => candidates.get(id) ?? []);
  for (const [index, left] of selected.entries()) {
    for (const right of selected.slice(index + 1)) {
      if (crosses(left, right, scheme)) diagnostics.push(problem('DIMENSION_CANDIDATE_CROSSES_SELECTED', [left.id, right.id]));
    }
  }
  for (const chain of scheme.chains) {
    const parent = candidates.get(chain.parentCandidateId);
    const closure = candidates.get(chain.closureCandidateId);
    const children = chain.childCandidateIds.map((id) => candidates.get(id));
    if (!parent || !closure || children.some((candidate) => !candidate)) {
      diagnostics.push(problem('DIMENSION_CLOSURE_MISSING', [chain.id]));
      continue;
    }
    if (!displayed.has(parent.id)
      || chain.childCandidateIds.some((id) => !displayed.has(id))
      || displayed.has(closure.id)
      || !closures.has(closure.id)) {
      diagnostics.push(problem('DIMENSION_CHAIN_INCOMPLETE', [chain.id]));
    }
    const childTotal = children.reduce((sum, candidate) => sum + candidate!.nominalValue, 0);
    const difference = Math.abs(parent.nominalValue - childTotal - closure.nominalValue);
    if (difference > Math.max(parent.nominalValue * 1e-8, 1e-6)) {
      diagnostics.push(problem('DIMENSION_CHAIN_ARITHMETIC_MISMATCH', [chain.id]));
    }
  }
  return dedupe(diagnostics);
}

function crosses(left: AxialDimensionCandidate, right: AxialDimensionCandidate, scheme: AxialDimensionScheme): boolean {
  const coordinate = new Map(scheme.topology.stations.map(({ id, coordinate }) => [id, coordinate]));
  const [a, b] = [coordinate.get(left.startStationId)!, coordinate.get(left.endStationId)!];
  const [c, d] = [coordinate.get(right.startStationId)!, coordinate.get(right.endStationId)!];
  return a < c && c < b && b < d || c < a && a < d && d < b;
}

function problem(code: string, entityIds: string[]): EngineeringDiagnostic {
  return { id: `dimension-scheme:${code}:${entityIds.join(':')}`, severity: 'error', code, message: code, entityIds };
}

function dedupe(diagnostics: EngineeringDiagnostic[]): EngineeringDiagnostic[] {
  return [...new Map(diagnostics.map((item) => [item.id, item])).values()].sort((left, right) => left.id.localeCompare(right.id));
}
