// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { TYPERT } from './typert';

describe('TYPERT host contribution', () => {
  it('publishes the drawing projection route with strict codecs', () => {
    const invocation = TYPERT.invocations[0];

    expect(invocation.id).toBe(
      '@vectorai/plugin-dsh-space-host#drawingSpace/getProjection',
    );
    expect(invocation.parameters[0]?.codec.mode).toBe('strict');
    expect(invocation.result.mode).toBe('strict');
    expect(invocation.result.schema.parse(null)).toBeNull();
    expect(() => invocation.parameters[0]?.codec.schema.parse('')).toThrow();
  });
});
