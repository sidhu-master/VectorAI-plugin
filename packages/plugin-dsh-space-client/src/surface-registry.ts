// SPDX-License-Identifier: Apache-2.0

import {
  DRAWING_SURFACE_API_VERSION,
  type Disposable,
  type DrawingSurfaceRegistry,
  type DrawingWorkspaceContribution,
  type DrawingWorkspaceRegistrySnapshot,
} from '@vectorai/drawing-surface-api';

interface SessionSubscriber {
  listener(): void;
  claimDisposers: (() => void)[];
}

export function createDrawingSurfaceRegistry(): DrawingSurfaceRegistry {
  const contributions = new Map<string, DrawingWorkspaceContribution>();
  const subscribers = new Map<string, Set<SessionSubscriber>>();

  const releaseClaims = (subscriber: SessionSubscriber) => {
    for (const dispose of subscriber.claimDisposers.splice(0)) dispose();
  };

  const bindClaims = (sessionId: string, subscriber: SessionSubscriber) => {
    releaseClaims(subscriber);
    for (const contribution of contributions.values()) {
      if (contribution.apiVersion !== DRAWING_SURFACE_API_VERSION) continue;
      const observable = contribution.claimSource.observe(sessionId);
      subscriber.claimDisposers.push(observable.subscribe(subscriber.listener));
    }
  };

  const notifyRegistrationsChanged = () => {
    for (const [sessionId, sessionSubscribers] of subscribers) {
      for (const subscriber of sessionSubscribers) {
        bindClaims(sessionId, subscriber);
        subscriber.listener();
      }
    }
  };

  return {
    registerWorkspace(contribution): Disposable {
      if (contributions.has(contribution.id)) {
        throw new Error(`DUPLICATE_DRAWING_WORKSPACE_CONTRIBUTION:${contribution.id}`);
      }
      contributions.set(contribution.id, contribution);
      notifyRegistrationsChanged();
      let disposed = false;
      return {
        dispose() {
          if (disposed) return;
          disposed = true;
          if (contributions.get(contribution.id) !== contribution) return;
          contributions.delete(contribution.id);
          notifyRegistrationsChanged();
        },
      };
    },

    getWorkspaceSnapshot(sessionId): DrawingWorkspaceRegistrySnapshot {
      const contributionIds = [...contributions.keys()].sort((left, right) => left.localeCompare(right));
      const eligible = [...contributions.values()].flatMap((contribution) => {
        if (contribution.apiVersion !== DRAWING_SURFACE_API_VERSION) return [];
        const claim = contribution.claimSource.observe(sessionId).getSnapshot();
        return claim.active ? [{ contribution, claim }] : [];
      });
      eligible.sort((left, right) => (
        right.claim.activationEpoch - left.claim.activationEpoch
        || right.contribution.priority - left.contribution.priority
        || left.contribution.id.localeCompare(right.contribution.id)
      ));
      return {
        electedId: eligible[0]?.contribution.id ?? null,
        contributionIds,
      };
    },

    getWorkspaceContribution(id) {
      return contributions.get(id) ?? null;
    },

    subscribe(sessionId, listener) {
      const subscriber: SessionSubscriber = { listener, claimDisposers: [] };
      const sessionSubscribers = subscribers.get(sessionId) ?? new Set();
      sessionSubscribers.add(subscriber);
      subscribers.set(sessionId, sessionSubscribers);
      bindClaims(sessionId, subscriber);
      return () => {
        releaseClaims(subscriber);
        sessionSubscribers.delete(subscriber);
        if (sessionSubscribers.size === 0) subscribers.delete(sessionId);
      };
    },

    disposeSession(sessionId) {
      const sessionSubscribers = subscribers.get(sessionId);
      if (sessionSubscribers === undefined) return;
      for (const subscriber of sessionSubscribers) releaseClaims(subscriber);
      subscribers.delete(sessionId);
    },
  };
}
