// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { validateEngineeringDraft } from '../dimension/validate';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';
import { mergeAxialDimensionProjection, projectAxialDimensionScheme } from './project';

describe('projectAxialDimensionScheme', () => {
  it('projects nominal intents and signed reference-only chains without tolerances', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const draft = projectAxialDimensionScheme({ scheme });

    expect(draft.axialScheme).toEqual(scheme);
    expect(draft.tolerances).toEqual([]);
    expect(draft.intents).toHaveLength(new Set([
      ...scheme.displayedCandidateIds,
      ...scheme.closureCandidateIds,
    ]).size);
    expect(draft.intents.every(({ nominalValue, source, targets }) => (
      Number.isFinite(nominalValue) && source === 'geometry' && targets.length === 2
    ))).toBe(true);
    expect(draft.chains).toHaveLength(scheme.chains.length);
    expect(draft.chains.every(({ analysisMode }) => analysisMode === 'reference-only')).toBe(true);
    expect(draft.chains.flatMap(({ members }) => members).every(({ coefficient }) => coefficient === 1 || coefficient === -1)).toBe(true);
    expect(validateEngineeringDraft(draft)).toEqual([]);
  });

  it('preserves paired-fit assignments when refreshing an axial projection', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const base = projectAxialDimensionScheme({ scheme });
    base.fitAssignments = [{
      fitGroupId: 'fit-1',
      holeDimensionId: 'hole-dimension',
      shaftDimensionId: 'shaft-dimension',
      basis: 'hole',
      designation: 'H7/g6',
      fitType: 'clearance',
      minimumClearance: 0.01,
      maximumClearance: 0.04,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
    }];

    const merged = mergeAxialDimensionProjection(base, projectAxialDimensionScheme({ scheme }));

    expect(merged.fitAssignments).toEqual(base.fitAssignments);
  });
});
