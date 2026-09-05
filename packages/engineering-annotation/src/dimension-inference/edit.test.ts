// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { applyDimensionSchemeEdit } from './edit';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';
import type { AxialDimensionScheme } from './types';

describe('applyDimensionSchemeEdit', () => {
  it('chooses a closure alternative immutably and resolves the review decision', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const original = structuredClone(scheme);
    const root = scheme.chains[0]!;
    const alternative = root.alternativeClosureCandidateIds[0]!;

    const edited = applyDimensionSchemeEdit(scheme, {
      type: 'closure.choose', chainId: root.id, candidateId: alternative,
    });

    expect(scheme).toEqual(original);
    expect(edited.chains[0]?.closureCandidateId).toBe(alternative);
    expect(edited.status).toBe('resolved');
    expect(edited.chains.slice(1).every(({ parentCandidateId }) => edited.displayedCandidateIds.includes(parentCandidateId))).toBe(true);
    expect(edited.diagnostics.map(({ code }) => code)).not.toContain('DIMENSION_CLOSURE_AMBIGUOUS');
  });

  it('marks a plan conflicting when a displayed chain member is hidden', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const childId = scheme.chains[0]!.childCandidateIds[0]!;

    const edited = applyDimensionSchemeEdit(scheme, {
      type: 'candidate.display', candidateId: childId, displayed: false,
    });

    expect(edited.status).toBe('conflict');
    expect(edited.diagnostics).toContainEqual(expect.objectContaining({ code: 'DIMENSION_CHAIN_INCOMPLETE' }));
  });

  it('rejects unknown candidate IDs', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });

    expect(() => applyDimensionSchemeEdit(scheme, {
      type: 'candidate.display', candidateId: 'candidate:missing', displayed: true,
    })).toThrow('DIMENSION_CANDIDATE_UNKNOWN');
  });

  it('stores an independent normal offset for one dimension chain', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const chainId = scheme.chains[0]!.id;
    const edited = applyDimensionSchemeEdit(scheme, { type: 'chain.layout', chainId, normalOffset: 12.5 });

    expect(scheme.layout).toBeUndefined();
    expect(edited.layout).toEqual({ chainNormalOffsets: [{ chainId, normalOffset: 12.5 }], candidateNormalOffsets: [] });
  });

  it('does not reveal suppressed transition members when the closure is changed', () => {
    const scheme = transitionClosureScheme();

    const edited = applyDimensionSchemeEdit(scheme, {
      type: 'closure.choose', chainId: 'chain:overall', candidateId: 'left-transition',
    });

    expect(edited.chains[0]?.closureCandidateId).toBe('left-transition');
    expect(edited.displayedCandidateIds).toEqual(['overall', 'feature']);
    expect(edited.status).toBe('resolved');
  });
});

function transitionClosureScheme(): AxialDimensionScheme {
  const drawingRef = { drawingId: 'transition-closure', revision: 1 };
  return {
    version: 1,
    drawingRef,
    policy: { id: 'shaft-hierarchical-dimensioning-v1', version: '1' },
    inputDigest: 'fixture:transition-closure',
    topology: {
      drawingRef, unit: 'mm',
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' },
      stations: [0, 2, 18, 20].map((coordinate) => ({
        id: `s${coordinate}`, coordinate, sourceCoordinate: coordinate, unit: 'mm' as const,
        kinds: coordinate === 0 || coordinate === 20 ? ['drawing-end'] : ['shoulder'],
        geometryNodeIds: [], evidenceIds: [],
      })),
      elementarySpans: [],
    },
    evidence: [],
    candidates: [
      { id: 'overall', startStationId: 's0', endStationId: 's20', nominalValue: 20, roles: ['overall'], evidenceIds: [], required: true, constraint: 'required' },
      { id: 'left-transition', startStationId: 's0', endStationId: 's2', nominalValue: 2, roles: ['local'], evidenceIds: [], required: false, constraint: 'prohibited' },
      { id: 'feature', startStationId: 's2', endStationId: 's18', nominalValue: 16, roles: ['functional'], evidenceIds: [], required: true, constraint: 'required' },
      { id: 'right-transition', startStationId: 's18', endStationId: 's20', nominalValue: 2, roles: ['local'], evidenceIds: [], required: false, constraint: 'prohibited' },
    ],
    displayedCandidateIds: ['overall', 'feature'],
    closureCandidateIds: ['right-transition'],
    chains: [{
      id: 'chain:overall', parentCandidateId: 'overall', childCandidateIds: ['left-transition', 'feature'],
      closureCandidateId: 'right-transition', alternativeClosureCandidateIds: ['left-transition'], status: 'resolved',
    }],
    decisions: [], diagnostics: [], status: 'resolved',
  };
}
