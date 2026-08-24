// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { AnnotationSessionStateStore, type AnnotationSessionStorage } from './session-state';

class MemoryStorage implements AnnotationSessionStorage {
  readonly values = new Map<string, unknown>();
  load(sessionId: string) { return this.values.get(sessionId) ?? null; }
  save(sessionId: string, state: unknown) { this.values.set(sessionId, structuredClone(state)); }
  delete(sessionId: string) { this.values.delete(sessionId); }
}

describe('AnnotationSessionStateStore', () => {
  it('does not claim on installation and keeps ownership through terminal workflow states', () => {
    const storage = new MemoryStorage();
    const store = new AnnotationSessionStateStore(storage, { now: () => 42 });

    expect(store.get('session-1')).toMatchObject({ workspaceClaimed: false, activationEpoch: 0 });
    store.start('session-1', 'workflow-1');
    expect(store.get('session-1')).toMatchObject({
      workspaceClaimed: true,
      activationEpoch: 42,
      workflow: { status: 'running', workflowId: 'workflow-1' },
    });
    store.finish('session-1', 'completed');
    expect(store.get('session-1')).toMatchObject({
      workspaceClaimed: true,
      activationEpoch: 42,
      workflow: { status: 'completed', workflowId: 'workflow-1' },
    });
  });

  it('restores a sticky claim after plugin reload and removes it only on session disposal', () => {
    const storage = new MemoryStorage();
    const first = new AnnotationSessionStateStore(storage, { now: () => 7 });
    first.start('session-1', 'workflow-1');
    first.finish('session-1', 'failed', 'planner failed');

    const reloaded = new AnnotationSessionStateStore(storage, { now: () => 99 });
    expect(reloaded.get('session-1')).toMatchObject({
      workspaceClaimed: true,
      activationEpoch: 7,
      workflow: { status: 'failed', message: 'planner failed' },
    });
    reloaded.disposeSession('session-1');
    expect(new AnnotationSessionStateStore(storage, { now: () => 100 }).get('session-1'))
      .toMatchObject({ workspaceClaimed: false, activationEpoch: 0 });
  });
});
