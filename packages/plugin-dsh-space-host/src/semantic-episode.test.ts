// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { SemanticEditEpisodeStore } from './semantic-episode';

function createStore() {
  let nextId = 0;
  return new SemanticEditEpisodeStore({
    id(prefix) {
      nextId += 1;
      return `${prefix}-${nextId}`;
    },
    digest(value) {
      return `sha256:${createHash('sha256').update(value).digest('hex')}`;
    },
  });
}

const instructionA = {
  rootUserMessageId: 'message-a',
  rootUserMessageDigest: 'sha256:message-a',
  objective: 'move the selected parts below the center',
  numericConstraints: [],
};
const instructionB = {
  rootUserMessageId: 'message-b',
  rootUserMessageDigest: 'sha256:message-b',
  objective: 'inspect another part',
  numericConstraints: [],
};
const drawingRef = { drawingId: 'drawing-1', revision: 3 };

describe('SemanticEditEpisodeStore', () => {
  it('keeps one cloned current episode per trusted session', () => {
    const store = createStore();
    const first = store.start('session-1', instructionA, drawingRef);
    const current = store.current('session-1');

    expect(current?.episodeId).toBe(first.episodeId);
    expect(current?.stage).toBe('canonical');
    if (!current) throw new Error('expected current episode');
    current.instruction.objective = 'caller mutation';
    expect(store.current('session-1')?.instruction.objective).toBe(instructionA.objective);
    expect(store.current('session-2')).toBeNull();
  });

  it('replays an identical transition without advancing the epoch', () => {
    const store = createStore();
    const first = store.start('session-1', instructionA, drawingRef);
    const transition = { kind: 'observed' as const, observation: { digest: 'sha256:observation' } };

    const observed = store.transition('session-1', first.stateEpoch, transition);
    const replay = store.transition('session-1', observed.stateEpoch, transition);

    expect(observed.stateEpoch).toBe(first.stateEpoch + 1);
    expect(replay).toEqual(observed);
  });

  it('advances on a different semantic request and rejects a stale CAS epoch', () => {
    const store = createStore();
    const first = store.start('session-1', instructionA, drawingRef);
    const observed = store.transition('session-1', first.stateEpoch, {
      kind: 'observed', observation: { digest: 'sha256:observation' },
    });
    const selected = store.transition('session-1', observed.stateEpoch, {
      kind: 'selected',
      semanticRequest: { parts: [{ partKey: 'part-a' }] },
      selection: { partKeys: ['part-a'] },
    });

    expect(selected.stateEpoch).toBe(observed.stateEpoch + 1);
    expect(() => store.transition('session-1', observed.stateEpoch, {
      kind: 'selected',
      semanticRequest: { parts: [{ partKey: 'part-b' }] },
      selection: { partKeys: ['part-b'] },
    })).toThrow('EDIT_EPISODE_STALE');
  });

  it('keeps a repeated root binding and invalidates a different direct user turn', () => {
    const store = createStore();
    const first = store.start('session-1', instructionA, drawingRef);

    store.bindInstruction('session-1', { ...instructionA });
    expect(store.current('session-1')?.episodeId).toBe(first.episodeId);
    store.bindInstruction('session-1', instructionB);
    expect(store.current('session-1')).toBeNull();

    const second = store.start('session-1', instructionB, drawingRef);
    expect(second.episodeId).not.toBe(first.episodeId);
    expect(second.stateEpoch).toBeGreaterThan(first.stateEpoch);
  });

  it('invalidates stale Drawing revisions and disposes only transient state', () => {
    const store = createStore();
    store.start('session-1', instructionA, drawingRef);

    expect(store.current('session-1', { drawingId: 'drawing-1', revision: 4 })).toBeNull();
    store.start('session-1', instructionA, { drawingId: 'drawing-1', revision: 4 });
    store.dispose('session-1');
    expect(store.current('session-1')).toBeNull();
  });
});
