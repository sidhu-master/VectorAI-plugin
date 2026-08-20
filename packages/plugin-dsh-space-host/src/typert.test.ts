// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { TYPERT } from './typert';

describe('TYPERT host contribution', () => {
  it('publishes session-scoped snapshot and commit routes with strict codecs', () => {
    const [snapshot, commit, query, getPreview, createPreview, commitPreview, discardPreview] = TYPERT.invocations;

    expect(snapshot?.id).toBe(
      '@vectorai/plugin-dsh-space-host#drawingSpace/getSnapshot',
    );
    expect(snapshot?.invocation).toEqual({ kind: 'direct' });
    expect(snapshot?.scope).toEqual({ context: 'agent', wire: 'agentId' });
    expect(snapshot?.parameters[0]).toMatchObject({ source: 'lookup', lookup: 'agent' });
    expect(snapshot?.result.mode).toBe('strict');
    expect(snapshot?.result.schema.parse(null)).toBeNull();
    expect(() => snapshot?.parameters[0]?.codec.schema.parse('')).toThrow();

    expect(commit?.id).toBe('@vectorai/plugin-dsh-space-host#drawingSpace/commit');
    expect(commit?.parameters[1]?.codec.mode).toBe('strict');
    expect(commit?.result.mode).toBe('strict');

    expect(query?.id).toBe('@vectorai/plugin-dsh-space-host#drawingSpace/query');
    expect(query?.parameters[1]?.codec.mode).toBe('strict');
    expect(query?.result.mode).toBe('strict');
    expect(getPreview?.method).toBe('getPreview');
    expect(createPreview?.method).toBe('createPreview');
    expect(commitPreview?.method).toBe('commitPreview');
    expect(discardPreview?.method).toBe('discardPreview');
  });
});
