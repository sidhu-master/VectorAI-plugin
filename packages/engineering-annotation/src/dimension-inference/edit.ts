// SPDX-License-Identifier: Apache-2.0

import type { EngineeringDiagnostic } from '../dimension/types';
import { validateAxialDimensionScheme } from './validate';
import type { AxialDimensionCandidate, AxialDimensionScheme, DimensionDecisionTrace } from './types';

export type ApplyDimensionSchemeEditInput =
  | { type: 'candidate.display'; candidateId: string; displayed: boolean }
  | { type: 'closure.choose'; chainId: string; candidateId: string }
  | { type: 'candidate.layout'; candidateId: string; normalOffset: number };

export function applyDimensionSchemeEdit(
  scheme: AxialDimensionScheme,
  command: ApplyDimensionSchemeEditInput,
): AxialDimensionScheme {
  const candidate = scheme.candidates.find(({ id }) => id === command.candidateId);
  if (!candidate) throw new Error('DIMENSION_CANDIDATE_UNKNOWN');
  const edited = command.type === 'candidate.display'
    ? setCandidateDisplayed(scheme, candidate.id, command.displayed)
    : command.type === 'closure.choose'
      ? chooseChainClosure(scheme, command.chainId, candidate)
      : setCandidateNormalOffset(scheme, candidate.id, command.normalOffset);
  const validation = validateAxialDimensionScheme(edited);
  const diagnostics = dedupe([
    ...edited.diagnostics.filter(({ code }) => !isDerivedValidationCode(code)),
    ...validation,
  ]);
  return {
    ...edited,
    diagnostics,
    status: validation.some(({ severity }) => severity === 'error') ? 'conflict' : edited.status,
  };
}

function setCandidateNormalOffset(
  scheme: AxialDimensionScheme,
  candidateId: string,
  normalOffset: number,
): AxialDimensionScheme {
  if (!Number.isFinite(normalOffset)) throw new Error('DIMENSION_LAYOUT_OFFSET_INVALID');
  const current = scheme.layout?.candidateNormalOffsets ?? [];
  return {
    ...structuredClone(scheme),
    layout: {
      candidateNormalOffsets: [
        ...current.filter((item) => item.candidateId !== candidateId),
        { candidateId, normalOffset },
      ],
    },
  };
}

function setCandidateDisplayed(
  scheme: AxialDimensionScheme,
  candidateId: string,
  displayed: boolean,
): AxialDimensionScheme {
  const displayedCandidateIds = displayed
    ? unique([...scheme.displayedCandidateIds, candidateId])
    : scheme.displayedCandidateIds.filter((id) => id !== candidateId);
  return {
    ...structuredClone(scheme),
    displayedCandidateIds,
    decisions: updateDecisions(scheme.decisions, displayedCandidateIds, scheme.closureCandidateIds, scheme.chains),
  };
}

function chooseChainClosure(
  scheme: AxialDimensionScheme,
  chainId: string,
  chosen: AxialDimensionCandidate,
): AxialDimensionScheme {
  const chainIndex = scheme.chains.findIndex(({ id }) => id === chainId);
  if (chainIndex < 0) throw new Error('DIMENSION_CHAIN_UNKNOWN');
  const chain = scheme.chains[chainIndex]!;
  if (chain.closureCandidateId !== chosen.id && !chain.alternativeClosureCandidateIds.includes(chosen.id)) {
    throw new Error('DIMENSION_CLOSURE_ALTERNATIVE_REQUIRED');
  }
  const parent = requireCandidate(scheme, chain.parentCandidateId);
  const leftChildren = coverRange(scheme, parent.startStationId, chosen.startStationId, parent.id, chosen.id);
  const rightChildren = coverRange(scheme, chosen.endStationId, parent.endStationId, parent.id, chosen.id);
  const childCandidateIds = [...leftChildren, ...rightChildren].map(({ id }) => id);
  const nextChain = {
    ...chain,
    childCandidateIds,
    closureCandidateId: chosen.id,
    alternativeClosureCandidateIds: unique([
      chain.closureCandidateId,
      ...chain.alternativeClosureCandidateIds.filter((id) => id !== chosen.id),
    ]),
    status: 'resolved' as const,
  };
  const chains = [...scheme.chains];
  chains[chainIndex] = nextChain;
  const displayedCandidateIds = unique([
    ...scheme.displayedCandidateIds.filter((id) => !chain.childCandidateIds.includes(id) && id !== chosen.id),
    ...childCandidateIds,
  ]);
  const closureCandidateIds = unique([
    ...scheme.closureCandidateIds.filter((id) => id !== chain.closureCandidateId),
    chosen.id,
  ]);
  const diagnostics = scheme.diagnostics.filter(({ code }) => (
    code !== 'DIMENSION_CLOSURE_AMBIGUOUS' && code !== 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT'
  ));
  const documentEvidence = chosen.evidenceIds.filter((id) => scheme.evidence.find((item) => item.id === id)?.origin === 'document');
  if (documentEvidence.length > 0) diagnostics.push({
    id: `dimension-scheme:DIMENSION_DOCUMENT_DISPLAY_CONFLICT:${chosen.id}`,
    severity: 'warning', code: 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT',
    message: 'A document-backed interval is used as an unmarked closure by the selected drafting policy.',
    entityIds: [chosen.id], evidenceIds: documentEvidence,
  });
  return {
    ...structuredClone(scheme),
    chains,
    displayedCandidateIds,
    closureCandidateIds,
    diagnostics,
    status: 'resolved',
    decisions: updateDecisions(scheme.decisions, displayedCandidateIds, closureCandidateIds, chains),
  };
}

function coverRange(
  scheme: AxialDimensionScheme,
  startStationId: string,
  endStationId: string,
  parentCandidateId: string,
  excludedCandidateId: string,
): AxialDimensionCandidate[] {
  if (startStationId === endStationId) return [];
  const coordinates = new Map(scheme.topology.stations.map(({ id, coordinate }) => [id, coordinate]));
  const targetEnd = coordinates.get(endStationId);
  if (targetEnd === undefined) throw new Error('DIMENSION_STATION_UNRESOLVED');
  const scores = new Map(scheme.decisions.map(({ candidateId, score }) => [candidateId, score]));
  const memo = new Map<string, AxialDimensionCandidate[] | null>();
  const visit = (stationId: string): AxialDimensionCandidate[] | null => {
    if (stationId === endStationId) return [];
    if (memo.has(stationId)) return memo.get(stationId)!;
    const options = scheme.candidates.filter((candidate) => (
      candidate.id !== parentCandidateId
      && candidate.id !== excludedCandidateId
      && candidate.startStationId === stationId
      && (coordinates.get(candidate.endStationId) ?? Number.POSITIVE_INFINITY) <= targetEnd
    ));
    let best: AxialDimensionCandidate[] | null = null;
    for (const option of options) {
      const remainder = visit(option.endStationId);
      if (!remainder) continue;
      const proposal = [option, ...remainder];
      if (!best || proposal.length < best.length || proposal.length === best.length && score(proposal, scores) > score(best, scores)) best = proposal;
    }
    memo.set(stationId, best);
    return best;
  };
  const result = visit(startStationId);
  if (!result) throw new Error('DIMENSION_CHAIN_INCOMPLETE');
  return result;
}

function updateDecisions(
  decisions: readonly DimensionDecisionTrace[],
  displayed: readonly string[],
  closures: readonly string[],
  chains: AxialDimensionScheme['chains'],
): DimensionDecisionTrace[] {
  return decisions.map((decision) => ({
    ...decision,
    decision: displayed.includes(decision.candidateId)
      ? 'displayed'
      : closures.includes(decision.candidateId)
        ? 'closure'
        : chains.some(({ alternativeClosureCandidateIds }) => alternativeClosureCandidateIds.includes(decision.candidateId))
          ? 'alternative'
          : 'rejected',
  }));
}

function requireCandidate(scheme: AxialDimensionScheme, id: string): AxialDimensionCandidate {
  const candidate = scheme.candidates.find((item) => item.id === id);
  if (!candidate) throw new Error('DIMENSION_CANDIDATE_UNKNOWN');
  return candidate;
}

function score(candidates: readonly AxialDimensionCandidate[], scores: ReadonlyMap<string, number>): number {
  return candidates.reduce((sum, candidate) => sum + (scores.get(candidate.id) ?? 0), 0);
}

function isDerivedValidationCode(code: string): boolean {
  return code === 'DIMENSION_CHAIN_INCOMPLETE'
    || code === 'DIMENSION_CLOSURE_MISSING'
    || code === 'DIMENSION_CHAIN_ARITHMETIC_MISMATCH'
    || code === 'DIMENSION_CANDIDATE_CROSSES_SELECTED';
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
function dedupe(values: EngineeringDiagnostic[]): EngineeringDiagnostic[] {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort((left, right) => left.id.localeCompare(right.id));
}
