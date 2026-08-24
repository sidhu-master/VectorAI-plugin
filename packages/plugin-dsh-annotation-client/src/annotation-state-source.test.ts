// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import { createAnnotationRemoteStateSource } from './annotation-state-source';

describe('annotation remote state source', () => {
  it('stays inactive until the Host reports a successful capability claim', async () => {
    let claimed = false;
    const remote = {
      getSessionState: vi.fn(async () => ({
        ok: true as const,
        value: {
          version: 1 as const,
          workspaceClaimed: claimed,
          activationEpoch: claimed ? 12 : 0,
          workflow: { status: claimed ? 'running' as const : 'idle' as const },
        },
      })),
    };
    const source = createAnnotationRemoteStateSource(remote, { pollIntervalMs: 60_000 });
    const claim = source.claimSource.observe('session-1');
    const listener = vi.fn();
    const unsubscribe = claim.subscribe(listener);

    await source.refresh('session-1');
    expect(claim.getSnapshot()).toEqual({ active: false, activationEpoch: 0 });
    claimed = true;
    await source.refresh('session-1');
    expect(claim.getSnapshot()).toEqual({ active: true, activationEpoch: 12 });
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    source.dispose();
  });
});
