// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  DRAWING_SURFACE_API_VERSION,
  electDrawingWorkspaceContribution,
  type DrawingSurfaceObservable,
  type DrawingWorkspaceClaim,
  type DrawingWorkspaceContribution,
} from './index';

const Component = () => null;

function observable<T>(value: T): DrawingSurfaceObservable<T> {
  return {
    getSnapshot: () => value,
    subscribe: () => () => undefined,
  };
}

function contribution(
  id: string,
  claim: DrawingWorkspaceClaim,
  priority = 0,
): DrawingWorkspaceContribution {
  return {
    id,
    apiVersion: DRAWING_SURFACE_API_VERSION,
    priority,
    claimSource: { observe: () => observable(claim) },
    Component,
  };
}

describe('drawing surface contribution election', () => {
  it('keeps the fallback when no available contribution has an active claim', () => {
    const elected = electDrawingWorkspaceContribution('session-a', [
      { contribution: contribution('inactive', { active: false, activationEpoch: 99 }), available: true },
      { contribution: contribution('missing', { active: true, activationEpoch: 100 }), available: false },
    ]);

    expect(elected).toBeNull();
  });

  it('elects by activation epoch, then priority, then stable id', () => {
    const older = contribution('older', { active: true, activationEpoch: 3 }, 100);
    const lowPriority = contribution('z-low', { active: true, activationEpoch: 5 }, 1);
    const lexicalLater = contribution('z-high', { active: true, activationEpoch: 5 }, 10);
    const lexicalWinner = contribution('a-high', { active: true, activationEpoch: 5 }, 10);

    const elected = electDrawingWorkspaceContribution('session-a', [
      { contribution: older, available: true },
      { contribution: lowPriority, available: true },
      { contribution: lexicalLater, available: true },
      { contribution: lexicalWinner, available: true },
    ]);

    expect(elected?.id).toBe('a-high');
  });

  it('ignores contributions built for an unsupported API version', () => {
    const incompatible = {
      ...contribution('future', { active: true, activationEpoch: 10 }),
      apiVersion: 2,
    } as unknown as DrawingWorkspaceContribution;

    expect(electDrawingWorkspaceContribution('session-a', [
      { contribution: incompatible, available: true },
    ])).toBeNull();
  });

  it('evaluates claims for the current session only', () => {
    const sessionBound: DrawingWorkspaceContribution = {
      id: 'annotation',
      apiVersion: DRAWING_SURFACE_API_VERSION,
      priority: 0,
      claimSource: {
        observe: (sessionId) => observable({
          active: sessionId === 'session-a',
          activationEpoch: 8,
        }),
      },
      Component,
    };

    expect(electDrawingWorkspaceContribution('session-a', [
      { contribution: sessionBound, available: true },
    ])?.id).toBe('annotation');
    expect(electDrawingWorkspaceContribution('session-b', [
      { contribution: sessionBound, available: true },
    ])).toBeNull();
  });
});
