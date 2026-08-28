// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { validateEngineeringDraft } from '../dimension/validate';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_REFERENCE_TERMINAL_CLOSURE_V1 } from './policy';
import { projectAxialDimensionScheme } from './project';

describe('projectAxialDimensionScheme', () => {
  it('projects nominal intents and signed reference-only chains without tolerances', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_REFERENCE_TERMINAL_CLOSURE_V1,
    });
    const draft = projectAxialDimensionScheme({ scheme });

    expect(draft.axialScheme).toEqual(scheme);
    expect(draft.tolerances).toEqual([]);
    expect(draft.intents).toHaveLength(11);
    expect(draft.intents.every(({ nominalValue, source, targets }) => (
      Number.isFinite(nominalValue) && source === 'geometry' && targets.length === 2
    ))).toBe(true);
    expect(draft.chains).toHaveLength(3);
    expect(draft.chains.every(({ analysisMode }) => analysisMode === 'reference-only')).toBe(true);
    expect(draft.chains.flatMap(({ members }) => members).every(({ coefficient }) => coefficient === 1 || coefficient === -1)).toBe(true);
    expect(validateEngineeringDraft(draft)).toEqual([]);
  });
});
