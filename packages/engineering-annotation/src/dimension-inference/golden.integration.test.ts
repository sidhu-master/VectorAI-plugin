// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import manifest from '../../test/fixtures/golden-shaft-001/manifest.json';
import { sortIntervals } from './golden-fixture-test-support';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';
import type { AxialDimensionScheme } from './types';

describe('golden axial dimension-chain inference', () => {
  it('produces a deterministic, internally valid scheme without using target annotations as input', async () => {
    const input = await analyzeGoldenInferenceInput();
    const first = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const second = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });

    expect(second).toEqual(first);
    expect(first.chains.length).toBeGreaterThan(0);
    expect(first.closureCandidateIds).toHaveLength(first.chains.length);
    expect(first.diagnostics.map(({ code }) => code)).not.toContain('DIMENSION_STATION_UNRESOLVED');
  });

  it('retains valid displayed members as switchable closure alternatives under the default policy', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const root = scheme.chains[0]!;

    expect(root.alternativeClosureCandidateIds).toContain(root.childCandidateIds[0]);
    expect(root.alternativeClosureCandidateIds.length).toBeGreaterThan(0);
  });

  it('builds the reviewed hierarchical chains from source topology and semantics', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });

    expect(sortIntervals(intervals(scheme.displayedCandidateIds, scheme))).toEqual(sortIntervals(
      manifest.displayedIntervals.map(([start, end]) => [start, end] as [number, number]),
    ));
    expect(sortIntervals(intervals(scheme.closureCandidateIds, scheme))).toEqual(sortIntervals(
      manifest.closureIntervals.map(([start, end]) => [start, end] as [number, number]),
    ));
    expect(scheme.chains).toHaveLength(3);
  });
});

function intervals(ids: readonly string[], scheme: AxialDimensionScheme): Array<[number, number]> {
  const stations = new Map(scheme.topology.stations.map(({ id, coordinate }) => [id, coordinate]));
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  return ids.map((id) => {
    const candidate = candidates.get(id);
    if (!candidate) throw new Error(`missing candidate ${id}`);
    return [stations.get(candidate.startStationId)!, stations.get(candidate.endStationId)!];
  });
}
