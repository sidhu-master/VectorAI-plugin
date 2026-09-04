// SPDX-License-Identifier: Apache-2.0

import type { EngineeringDiagnostic } from '../dimension/types';
import { validateAxialDimensionScheme } from './validate';
import type {
  AxialChainNode,
  AxialDimensionCandidate,
  AxialDimensionScheme,
  DimensionDecisionTrace,
  DimensionEvidence,
  DimensionScoreFeature,
  InferAxialDimensionSchemeInput,
} from './types';

interface CoordinateIndex {
  station: Map<string, number>;
  candidate: Map<string, AxialDimensionCandidate>;
}

interface ClosurePlan {
  closure: AxialDimensionCandidate;
  leftChildren: AxialDimensionCandidate[];
  rightChildren: AxialDimensionCandidate[];
}

export function inferAxialDimensionScheme(input: InferAxialDimensionSchemeInput): AxialDimensionScheme {
  const index = coordinateIndex(input);
  const root = requireOverall(input.candidateSet.candidates);
  const decisions = input.candidateSet.candidates.map((candidate) => scoreCandidate(candidate, input.candidateSet.evidence, input.policy.weights));
  const rootPlans = viableClosurePlans(root, input.candidateSet.candidates, input.candidateSet.evidence, decisions, index);
  const selectedRootPlan = rootPlans[0];
  if (!selectedRootPlan) throw new Error('DIMENSION_CLOSURE_MISSING');
  const rootClosure = selectedRootPlan.closure;
  const rootChildren = [...selectedRootPlan.leftChildren, ...selectedRootPlan.rightChildren];
  const rootAmbiguous = rootPlans[1] !== undefined
    && sameClosurePreference(rootPlans[0]!.closure, rootPlans[1]!.closure, input.candidateSet.evidence, decisions);
  const chains: AxialChainNode[] = [{
    id: `chain:${root.id}`,
    parentCandidateId: root.id,
    childCandidateIds: rootChildren.map(({ id }) => id),
    closureCandidateId: rootClosure.id,
    alternativeClosureCandidateIds: rootPlans.slice(1).map(({ closure }) => closure.id),
    status: rootAmbiguous ? 'needs-review' : 'resolved',
    closureRationale: closureRationale(rootClosure, rootPlans.slice(1).map(({ closure }) => closure), input.candidateSet.evidence),
  }];
  for (const parent of rootChildren.filter((candidate) => candidate.roles.some((role) => role === 'process' || role === 'composite'))) {
    const chain = materializeInnerChain(parent, input.candidateSet.candidates, input.candidateSet.evidence, decisions, index);
    if (chain) chains.push(chain);
  }
  const displayedCandidateIds = unique([
    root.id,
    ...chains.flatMap(({ childCandidateIds }) => childCandidateIds),
    ...chains.slice(1).map(({ parentCandidateId }) => parentCandidateId),
  ]);
  const closureCandidateIds = unique(chains.map(({ closureCandidateId }) => closureCandidateId));
  const hasAmbiguousChain = chains.some(({ status }) => status === 'needs-review');
  const diagnostics: EngineeringDiagnostic[] = [...input.candidateSet.diagnostics];
  if (hasAmbiguousChain) {
    diagnostics.push({
      id: `dimension-scheme:DIMENSION_CLOSURE_AMBIGUOUS:${root.id}`,
      severity: 'warning', code: 'DIMENSION_CLOSURE_AMBIGUOUS',
      message: 'Multiple viable closure intervals have equivalent evidence and require review.', entityIds: [root.id],
    });
  }
  for (const closureId of closureCandidateIds) {
    const closure = index.candidate.get(closureId)!;
    const documentEvidence = closure.evidenceIds.filter((id) => input.candidateSet.evidence.find((item) => item.id === id)?.origin === 'document');
    if (documentEvidence.length > 0) diagnostics.push({
      id: `dimension-scheme:DIMENSION_DOCUMENT_DISPLAY_CONFLICT:${closure.id}`,
      severity: 'warning', code: 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT',
      message: 'A document-backed interval is used as an unmarked closure by the selected drafting policy.',
      entityIds: [closure.id], evidenceIds: documentEvidence,
    });
  }
  const initial: AxialDimensionScheme = {
    version: 1,
    drawingRef: input.topology.drawingRef,
    ...(input.partitionRevisionId === undefined ? {} : { partitionRevisionId: input.partitionRevisionId }),
    policy: { id: input.policy.id, version: input.policy.version },
    inputDigest: digestInput(input),
    topology: structuredClone(input.topology),
    evidence: structuredClone(input.candidateSet.evidence),
    candidates: structuredClone(input.candidateSet.candidates),
    displayedCandidateIds,
    closureCandidateIds,
    chains,
    decisions: decisions.map((decision) => ({
      ...decision,
      decision: displayedCandidateIds.includes(decision.candidateId)
        ? 'displayed'
        : closureCandidateIds.includes(decision.candidateId)
          ? 'closure'
          : chains.some(({ alternativeClosureCandidateIds }) => alternativeClosureCandidateIds.includes(decision.candidateId))
            ? 'alternative'
            : 'rejected',
    })),
    diagnostics: [],
    status: hasAmbiguousChain ? 'needs-review' : 'resolved',
  };
  const validation = validateAxialDimensionScheme(initial);
  return {
    ...initial,
    diagnostics: dedupe([...diagnostics, ...validation]),
    status: validation.length > 0 ? 'conflict' : initial.status,
  };
}

function materializeInnerChain(
  parent: AxialDimensionCandidate,
  candidates: readonly AxialDimensionCandidate[],
  evidence: readonly DimensionEvidence[],
  decisions: readonly DimensionDecisionTrace[],
  index: CoordinateIndex,
): AxialChainNode | undefined {
  const inside = candidates.filter((candidate) => candidate.id !== parent.id && contains(parent, candidate, index));
  const protectedCandidates = inside
    .filter((candidate) => candidate.roles.includes('functional') || candidate.evidenceIds.some((id) => evidence.find((item) => item.id === id)?.origin === 'document'))
    .sort((left, right) => start(left, index) - start(right, index));
  const elementary = inside
    .filter((candidate) => candidate.roles.includes('local'))
    .sort((left, right) => start(left, index) - start(right, index));
  const uncovered = elementary.filter((candidate) => !protectedCandidates.some((protectedCandidate) => contains(protectedCandidate, candidate, index)));
  if (uncovered.length === 0) return undefined;
  const ranked = [...uncovered]
    .sort((left, right) => right.nominalValue - left.nominalValue
      || compareClosurePreference(left, right, evidence, decisions)
      || left.id.localeCompare(right.id));
  const closure = ranked[0];
  if (!closure) return undefined;
  const children = uniqueCandidates([
    ...protectedCandidates,
    ...uncovered.filter(({ id }) => id !== closure.id),
  ]).sort((left, right) => start(left, index) - start(right, index));
  if (!coversParent(parent, children, closure, index)) return undefined;
  return {
    id: `chain:${parent.id}`,
    parentCandidateId: parent.id,
    childCandidateIds: children.map(({ id }) => id),
    closureCandidateId: closure.id,
    alternativeClosureCandidateIds: viableRootClosureAlternatives(
      parent, closure, candidates, evidence, decisions, index,
    ).map(({ id }) => id),
    status: ranked[1] && sameClosurePreference(closure, ranked[1], evidence, decisions) ? 'needs-review' : 'resolved',
    closureRationale: closureRationale(closure, ranked.slice(1), evidence),
  };
}

function solveCoverage(
  startStationId: string,
  endStationId: string,
  root: AxialDimensionCandidate,
  candidates: readonly AxialDimensionCandidate[],
  decisions: readonly DimensionDecisionTrace[],
  index: CoordinateIndex,
): AxialDimensionCandidate[] {
  if (startStationId === endStationId) return [];
  const targetEnd = index.station.get(endStationId)!;
  const score = new Map(decisions.map((decision) => [decision.candidateId, decision.score]));
  const memo = new Map<string, AxialDimensionCandidate[] | null>();
  const visit = (stationId: string): AxialDimensionCandidate[] | null => {
    if (stationId === endStationId) return [];
    if (memo.has(stationId)) return memo.get(stationId)!;
    const options = candidates.filter((candidate) => (
      candidate.id !== root.id
      && candidate.startStationId === stationId
      && index.station.get(candidate.endStationId)! <= targetEnd
    ));
    let best: AxialDimensionCandidate[] | null = null;
    for (const candidate of options) {
      const rest = visit(candidate.endStationId);
      if (!rest) continue;
      const proposal = [candidate, ...rest];
      if (!best || proposal.length < best.length || proposal.length === best.length && totalScore(proposal, score) > totalScore(best, score)) best = proposal;
    }
    memo.set(stationId, best);
    return best;
  };
  const result = visit(startStationId);
  if (!result) throw new Error('DIMENSION_CHAIN_INCOMPLETE');
  return result;
}

function viableRootClosureAlternatives(
  root: AxialDimensionCandidate,
  selected: AxialDimensionCandidate,
  candidates: readonly AxialDimensionCandidate[],
  evidence: readonly DimensionEvidence[],
  decisions: readonly DimensionDecisionTrace[],
  index: CoordinateIndex,
): AxialDimensionCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.id === root.id || candidate.id === selected.id || !contains(root, candidate, index)) return false;
    try {
      solveCoverage(root.startStationId, candidate.startStationId, root, candidates, decisions, index);
      solveCoverage(candidate.endStationId, root.endStationId, root, candidates, decisions, index);
      return true;
    } catch {
      return false;
    }
  }).sort((left, right) => compareClosurePreference(left, right, evidence, decisions) || left.id.localeCompare(right.id));
}

function viableClosurePlans(
  root: AxialDimensionCandidate,
  candidates: readonly AxialDimensionCandidate[],
  evidence: readonly DimensionEvidence[],
  decisions: readonly DimensionDecisionTrace[],
  index: CoordinateIndex,
): ClosurePlan[] {
  // A required interval must remain represented in the chain, but it may be
  // the closure itself (the reviewed CAD convention uses the terminal bearing
  // interval this way). Closure eligibility is therefore separate from the
  // candidate's required flag; only prohibited evidence is excluded.
  return candidates.flatMap((closure): ClosurePlan[] => {
    if (closure.id === root.id || !contains(root, closure, index)) return [];
    try {
      return [{
        closure,
        leftChildren: solveCoverage(root.startStationId, closure.startStationId, root, candidates, decisions, index),
        rightChildren: solveCoverage(closure.endStationId, root.endStationId, root, candidates, decisions, index),
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => Number(isDocumentBackedTerminal(right.closure, root, evidence, index))
      - Number(isDocumentBackedTerminal(left.closure, root, evidence, index))
      || compareClosurePreference(left.closure, right.closure, evidence, decisions)
      || left.closure.id.localeCompare(right.closure.id));
}

function isDocumentBackedTerminal(
  candidate: AxialDimensionCandidate,
  root: AxialDimensionCandidate,
  evidence: readonly DimensionEvidence[],
  index: CoordinateIndex,
): boolean {
  return end(candidate, index) === end(root, index)
    && candidate.evidenceIds.some((id) => evidence.find((item) => item.id === id)?.origin === 'document');
}

function compareClosurePreference(
  left: AxialDimensionCandidate,
  right: AxialDimensionCandidate,
  evidence: readonly DimensionEvidence[],
  decisions: readonly DimensionDecisionTrace[],
): number {
  return Number(!isProhibited(left, evidence)) - Number(!isProhibited(right, evidence))
    || evidenceTier(left, evidence) - evidenceTier(right, evidence)
    || scoreOf(left, decisions) - scoreOf(right, decisions);
}

function sameClosurePreference(
  left: AxialDimensionCandidate,
  right: AxialDimensionCandidate,
  evidence: readonly DimensionEvidence[],
  decisions: readonly DimensionDecisionTrace[],
): boolean {
  return isProhibited(left, evidence) === isProhibited(right, evidence)
    && evidenceTier(left, evidence) === evidenceTier(right, evidence)
    && scoreOf(left, decisions) === scoreOf(right, decisions)
    && left.constraint === right.constraint;
}

function isProhibited(candidate: AxialDimensionCandidate, evidence: readonly DimensionEvidence[]): boolean {
  return candidate.constraint === 'prohibited'
    || candidate.evidenceIds.some((id) => evidence.find((item) => item.id === id)?.constraint === 'prohibited');
}
function evidenceTier(candidate: AxialDimensionCandidate, evidence: readonly DimensionEvidence[]): number {
  const authority = { ai: 0, geometry: 1, partition: 2, document: 3, manual: 4 } as const;
  return Math.max(0, ...candidate.evidenceIds.map((id) => authority[evidence.find((item) => item.id === id)?.origin ?? 'ai']));
}
function closureRationale(
  selected: AxialDimensionCandidate,
  alternatives: readonly AxialDimensionCandidate[],
  evidence: readonly DimensionEvidence[],
): NonNullable<AxialChainNode['closureRationale']> {
  return {
    rule: 'hard-constraints-then-evidence-authority',
    selectedEvidenceTier: evidenceTier(selected, evidence),
    reasonCodes: [
      isProhibited(selected, evidence) ? 'DIMENSION_CLOSURE_EXPLICITLY_PROHIBITED_FROM_DISPLAY' : 'DIMENSION_CLOSURE_LOWEST_EVIDENCE_AUTHORITY',
    ],
    counterfactualCandidateIds: alternatives.map(({ id }) => id),
  };
}

function scoreCandidate(
  candidate: AxialDimensionCandidate,
  evidence: readonly DimensionEvidence[],
  weights: Readonly<Record<DimensionScoreFeature, number>>,
): DimensionDecisionTrace {
  const features = candidate.evidenceIds.flatMap((id) => {
    const item = evidence.find((entry) => entry.id === id);
    if (!item) return [];
    const feature = featureFor(item, candidate);
    return [{ feature, contribution: weights[feature], evidenceIds: [id] }];
  });
  return {
    candidateId: candidate.id,
    decision: 'rejected',
    score: features.reduce((sum, item) => sum + item.contribution, 0),
    features,
    reasonCodes: unique(features.map(({ feature }) => `DIMENSION_SCORE_${feature.toUpperCase().replace(/-/g, '_')}`)),
  };
}

function featureFor(evidence: DimensionEvidence, candidate: AxialDimensionCandidate): DimensionScoreFeature {
  if (evidence.origin === 'manual') return 'manual-required';
  if (evidence.origin === 'document') return 'document-exact';
  if (candidate.roles.includes('overall')) return 'overall-root';
  if (candidate.roles.includes('composite')) return 'composite-block';
  if (candidate.roles.includes('process')) return 'process-envelope';
  if (candidate.roles.includes('functional')) return 'functional-region';
  return 'elementary-span';
}

function requireOverall(candidates: readonly AxialDimensionCandidate[]): AxialDimensionCandidate {
  const root = candidates.find(({ roles }) => roles.includes('overall'));
  if (!root) throw new Error('DIMENSION_CHAIN_INCOMPLETE');
  return root;
}

function coordinateIndex(input: InferAxialDimensionSchemeInput): CoordinateIndex {
  return {
    station: new Map(input.topology.stations.map(({ id, coordinate }) => [id, coordinate])),
    candidate: new Map(input.candidateSet.candidates.map((candidate) => [candidate.id, candidate])),
  };
}

function contains(parent: AxialDimensionCandidate, child: AxialDimensionCandidate, index: CoordinateIndex): boolean {
  return start(parent, index) <= start(child, index) && end(child, index) <= end(parent, index);
}

function coversParent(parent: AxialDimensionCandidate, children: readonly AxialDimensionCandidate[], closure: AxialDimensionCandidate, index: CoordinateIndex): boolean {
  const intervals = [...children, closure].sort((left, right) => start(left, index) - start(right, index));
  return intervals[0]?.startStationId === parent.startStationId
    && intervals.at(-1)?.endStationId === parent.endStationId
    && intervals.every((item, itemIndex) => itemIndex === 0 || intervals[itemIndex - 1]!.endStationId === item.startStationId);
}

function start(candidate: AxialDimensionCandidate, index: CoordinateIndex): number { return index.station.get(candidate.startStationId)!; }
function end(candidate: AxialDimensionCandidate, index: CoordinateIndex): number { return index.station.get(candidate.endStationId)!; }
function totalScore(candidates: readonly AxialDimensionCandidate[], scores: ReadonlyMap<string, number>): number { return candidates.reduce((sum, candidate) => sum + (scores.get(candidate.id) ?? 0), 0); }
function scoreOf(candidate: AxialDimensionCandidate, decisions: readonly DimensionDecisionTrace[]): number { return decisions.find(({ candidateId }) => candidateId === candidate.id)?.score ?? 0; }
function unique(values: string[]): string[] { return [...new Set(values)]; }
function uniqueCandidates(values: AxialDimensionCandidate[]): AxialDimensionCandidate[] { return [...new Map(values.map((value) => [value.id, value])).values()]; }
function dedupe(values: EngineeringDiagnostic[]): EngineeringDiagnostic[] { return [...new Map(values.map((value) => [value.id, value])).values()].sort((left, right) => left.id.localeCompare(right.id)); }

function digestInput(input: InferAxialDimensionSchemeInput): string {
  const value = JSON.stringify({
    drawingRef: input.topology.drawingRef,
    stations: input.topology.stations.map(({ id, coordinate }) => [id, coordinate]),
    candidates: input.candidateSet.candidates.map(({ id, evidenceIds }) => [id, evidenceIds]),
    policy: [input.policy.id, input.policy.version],
  });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
