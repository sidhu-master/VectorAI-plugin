// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { policyById, SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';

describe('dimension policy lookup', () => {
  it('resolves the declared policy and rejects unknown policy ids', () => {
    expect(policyById(SHAFT_HIERARCHICAL_DIMENSIONING_V1.id)).toBe(SHAFT_HIERARCHICAL_DIMENSIONING_V1);
    expect(() => policyById('golden-terminal-convention')).toThrow('DIMENSION_POLICY_UNKNOWN');
  });
});
