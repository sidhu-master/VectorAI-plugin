// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import manifest from '../../test/fixtures/golden-shaft-001/manifest.json';
import { sortIntervals } from './golden-fixture-test-support';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { inferAxialDimensionScheme } from './infer';
import {
  SHAFT_HIERARCHICAL_DIMENSIONING_V1,
  SHAFT_REFERENCE_TERMINAL_CLOSURE_V1,
} from './policy';
import type { AxialDimensionScheme } from './types';

describe('golden axial dimension-chain inference', () => {
  it('keeps the generic policy reviewable when target convention conflicts with the document', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });

    expect(scheme.status).toBe('needs-review');
    expect(scheme.diagnostics.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'DIMENSION_CLOSURE_AMBIGUOUS',
      'DIMENSION_DOCUMENT_DISPLAY_CONFLICT',
    ]));
  });

  it('reproduces the reviewed target under the explicit reference policy', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_REFERENCE_TERMINAL_CLOSURE_V1,
    });
    const expectedDisplayed = manifest.displayedIntervals.map(([start, end]) => [start, end] as [number, number]);
    const expectedClosures = manifest.closureIntervals.map(([start, end]) => [start, end] as [number, number]);

    expect(sortIntervals(intervals(scheme.displayedCandidateIds, scheme))).toEqual(sortIntervals(expectedDisplayed));
    expect(sortIntervals(intervals(scheme.closureCandidateIds, scheme))).toEqual(sortIntervals(expectedClosures));
    expect(scheme.chains).toHaveLength(3);
    expect(scheme.diagnostics).toContainEqual(expect.objectContaining({
      code: 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT', severity: 'warning',
    }));
    expect(scheme.diagnostics.map(({ code }) => code)).not.toContain('DIMENSION_STATION_UNRESOLVED');
  });

  it('retains valid displayed members as switchable closure alternatives under the default policy', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_REFERENCE_TERMINAL_CLOSURE_V1,
    });
    const root = scheme.chains[0]!;
    const inner = scheme.chains.slice(1).find(({ childCandidateIds }) => childCandidateIds.length > 0)!;

    expect(root.alternativeClosureCandidateIds).toContain(root.childCandidateIds[0]);
    expect(inner.alternativeClosureCandidateIds).toContain(inner.childCandidateIds[0]);
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
