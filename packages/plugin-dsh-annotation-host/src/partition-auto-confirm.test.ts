// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/engineering-annotation';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { describe, expect, it, vi } from 'vitest';
import { acceptPendingPartitionForEvent } from './partition-auto-confirm';
import { PartitionSessionStore } from './partition-store';
import { AnnotationSessionStateStore } from './session-state';

function draft(): PartitionDraft {
  return {
    version: 1, drawingRef: { drawingId: 'd', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 2, orientation: 'forward' },
    segments: [0, 1].map((z) => ({ id: `s${z}`, zStart: z, zEnd: z + 1, profile: { minRadius: 1, maxRadius: 1, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] })),
    semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
  };
}

function event(source: { kind: string }): SessionEvent {
  return { type: 'user/message', seq: 2, time: 2, data: { id: 'm', role: 'user', content: [], source } } as SessionEvent;
}

describe('pending partition lifecycle', () => {
  it('accepts an editable partition when the next direct user task arrives', () => {
    const partitions = new PartitionSessionStore(undefined, { now: () => 3, id: () => 'r1' });
    const sessions = new AnnotationSessionStateStore(undefined, { now: () => 1 });
    partitions.beginAnalysis('s', draft().drawingRef);
    partitions.setDraft('s', draft());
    sessions.start('s', 'partition');
    const onConfirmed = vi.fn();

    expect(acceptPendingPartitionForEvent('s', event({ kind: 'user' }), partitions, sessions, onConfirmed)).toBe(true);
    expect(partitions.get('s').phase).toBe('confirmed');
    expect(sessions.get('s').workflow.status).toBe('completed');
    expect(onConfirmed).toHaveBeenCalledWith({ drawingId: 'd', revision: 1 });
  });

  it('ignores plugin-injected user-role context', () => {
    const partitions = new PartitionSessionStore();
    const sessions = new AnnotationSessionStateStore();
    partitions.beginAnalysis('s', draft().drawingRef);
    partitions.setDraft('s', draft());

    const onConfirmed = vi.fn();
    expect(acceptPendingPartitionForEvent('s', event({ kind: 'plugin' }), partitions, sessions, onConfirmed)).toBe(false);
    expect(partitions.get('s').phase).toBe('editing');
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
