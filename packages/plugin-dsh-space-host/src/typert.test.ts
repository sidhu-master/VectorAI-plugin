// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { TYPERT } from './typert';

describe('TYPERT host contribution', () => {
  it('publishes only the strict, session-scoped read and staged-write routes', () => {
    const methods = TYPERT.invocations.map(({ method }) => method);
    expect(methods).toEqual([
      'getSnapshot', 'query', 'stageInteractiveEdit', 'stageUndo', 'getOperation', 'getPreview',
    ]);
    expect(methods).not.toEqual(expect.arrayContaining([
      'commit', 'createPreview', 'commitPreview', 'discardPreview',
    ]));
    for (const invocation of TYPERT.invocations) {
      expect(invocation.invocation).toEqual({ kind: 'direct' });
      expect(invocation.scope).toEqual({ context: 'agent', wire: 'agentId' });
      expect(invocation.parameters[0]).toMatchObject({ source: 'lookup', lookup: 'agent' });
      expect(invocation.result.mode).toBe('strict');
    }
    expect(TYPERT.invocations[0]?.result.schema.parse(null)).toBeNull();
    expect(() => TYPERT.invocations[0]?.parameters[0]?.codec.schema.parse('')).toThrow();
  });
});
