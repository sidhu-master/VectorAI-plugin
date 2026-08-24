// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { TYPERT } from './typert';

describe('annotation TYPERT contribution', () => {
  it('publishes only the readonly session state projection', () => {
    expect(TYPERT.invocations.map(({ method }) => method)).toEqual(['getSessionState']);
    expect(TYPERT.invocations[0]?.result.schema).toHaveProperty('_zod');
  });
});
