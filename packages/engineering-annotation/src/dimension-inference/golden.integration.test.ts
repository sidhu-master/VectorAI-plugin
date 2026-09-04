// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { sortIntervals } from './golden-fixture-test-support';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';
import type { AxialDimensionScheme } from './types';

describe('golden axial dimension-chain inference', () => {
  it('keeps chamfer midpoints out of the reviewed dimension stations and chains', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    expect(input.topology.stations.map(({ coordinate }) => coordinate)).toEqual([
      0, 17, 41.5, 45, 53, 92, 147, 150, 173,
    ]);
    expect(sortIntervals(intervals(scheme.displayedCandidateIds, scheme))).toEqual([
      [0, 17], [0, 173], [17, 41.5], [17, 45], [45, 53], [45, 150], [92, 147], [147, 150],
    ]);
    expect(sortIntervals(intervals(scheme.closureCandidateIds, scheme))).toEqual([
      [41.5, 45], [53, 92], [150, 173],
    ]);
    expect(scheme.chains.map((chain) => ({
      parent: range(chain.parentCandidateId, scheme),
      children: intervals(chain.childCandidateIds, scheme),
      closure: range(chain.closureCandidateId, scheme),
    })).sort((left, right) => left.parent[0] - right.parent[0] || left.parent[1] - right.parent[1])).toEqual([
      { parent: [0, 173], children: [[0, 17], [17, 45], [45, 150]], closure: [150, 173] },
      { parent: [17, 45], children: [[17, 41.5]], closure: [41.5, 45] },
      { parent: [45, 150], children: [[45, 53], [92, 147], [147, 150]], closure: [53, 92] },
    ]);
  });

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

  it('never suppresses required engineering evidence and exposes ambiguous alternatives', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });

    const candidates = new Map(scheme.candidates.map((item) => [item.id, item]));
    const represented = new Set([...scheme.displayedCandidateIds, ...scheme.closureCandidateIds]);
    for (const candidate of candidates.values()) {
      if (candidate.required) expect(represented.has(candidate.id)).toBe(true);
    }
    expect(scheme.chains.every(({ closureRationale }) => closureRationale?.rule === 'hard-constraints-then-evidence-authority')).toBe(true);
    expect(scheme.status).toBe('needs-review');
  });
});

function intervals(ids: readonly string[], scheme: AxialDimensionScheme): Array<[number, number]> {
  return ids.map((id) => range(id, scheme));
}

function range(id: string, scheme: AxialDimensionScheme): [number, number] {
  const stations = new Map(scheme.topology.stations.map((station) => [station.id, station.coordinate]));
  const candidate = scheme.candidates.find(({ id: candidateId }) => candidateId === id);
  if (!candidate) throw new Error(`missing candidate ${id}`);
  return [stations.get(candidate.startStationId)!, stations.get(candidate.endStationId)!];
}
