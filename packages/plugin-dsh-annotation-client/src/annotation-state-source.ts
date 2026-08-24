// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type {
  DrawingSurfaceObservable,
  DrawingWorkspaceClaimSource,
} from '@vectorai/drawing-surface-api';
import type { AnnotationSessionState } from '@vectorai/plugin-space-contracts';

export interface DrawingAnnotationRemote {
  getSessionState(sessionId: string): Promise<RemoteResult<AnnotationSessionState>>;
}

interface SessionEntry {
  state: AnnotationSessionState;
  claim: { active: boolean; activationEpoch: number };
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setInterval>;
  inFlight?: Promise<void>;
  stateObservable: DrawingSurfaceObservable<AnnotationSessionState>;
  claimObservable: DrawingSurfaceObservable<{ active: boolean; activationEpoch: number }>;
}

export interface AnnotationRemoteStateSource {
  claimSource: DrawingWorkspaceClaimSource;
  observeState(sessionId: string): DrawingSurfaceObservable<AnnotationSessionState>;
  refresh(sessionId: string): Promise<void>;
  dispose(): void;
}

export function createAnnotationRemoteStateSource(
  remote: DrawingAnnotationRemote,
  options: { pollIntervalMs?: number } = {},
): AnnotationRemoteStateSource {
  const entries = new Map<string, SessionEntry>();
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;

  const ensure = (sessionId: string): SessionEntry => {
    const current = entries.get(sessionId);
    if (current !== undefined) return current;
    const state = emptyState();
    const entry = {} as SessionEntry;
    entry.state = state;
    entry.claim = claimOf(state);
    entry.listeners = new Set();
    const subscribe = (listener: () => void) => {
      entry.listeners.add(listener);
      if (entry.listeners.size === 1) {
        void refresh(sessionId);
        entry.timer = setInterval(() => { void refresh(sessionId); }, pollIntervalMs);
      }
      return () => {
        entry.listeners.delete(listener);
        if (entry.listeners.size === 0 && entry.timer !== undefined) {
          clearInterval(entry.timer);
          entry.timer = undefined;
        }
      };
    };
    entry.stateObservable = { getSnapshot: () => entry.state, subscribe };
    entry.claimObservable = { getSnapshot: () => entry.claim, subscribe };
    entries.set(sessionId, entry);
    return entry;
  };

  const refresh = async (sessionId: string): Promise<void> => {
    const entry = ensure(sessionId);
    if (entry.inFlight !== undefined) return entry.inFlight;
    entry.inFlight = (async () => {
      try {
        const result = await remote.getSessionState(sessionId);
        if (result.ok !== true) return;
        const next = structuredClone(result.value);
        if (JSON.stringify(next) === JSON.stringify(entry.state)) return;
        entry.state = next;
        entry.claim = claimOf(next);
        for (const listener of entry.listeners) listener();
      } finally {
        entry.inFlight = undefined;
      }
    })();
    return entry.inFlight;
  };

  return {
    claimSource: { observe: (sessionId) => ensure(sessionId).claimObservable },
    observeState: (sessionId) => ensure(sessionId).stateObservable,
    refresh,
    dispose() {
      for (const entry of entries.values()) {
        if (entry.timer !== undefined) clearInterval(entry.timer);
        entry.listeners.clear();
      }
      entries.clear();
    },
  };
}

function emptyState(): AnnotationSessionState {
  return {
    version: 1,
    workspaceClaimed: false,
    activationEpoch: 0,
    workflow: { status: 'idle' },
  };
}

function claimOf(state: AnnotationSessionState) {
  return {
    active: state.workspaceClaimed,
    activationEpoch: state.activationEpoch,
  };
}
