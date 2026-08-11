import { describe, expect, it } from 'vitest';

import type {
  DrawingAgentProgressEvent,
} from '../../../src/contracts/drawing-agent.js';
import {
  MemoryDrawingRepository,
  type DrawingCommit,
  type DrawingDocument,
  type GeometryId,
  type IdFactory,
} from '../../../src/drawing/index.js';
import type { DrawingAgentAuditEvent } from '../drawing-agent/audit-types.js';
import { evaluateSemanticEditBenchmark } from './semantic-edit.js';

describe('semantic edit release benchmark', () => {
  it('proves target replacement, anchor continuity, preservation, verification, replay, and latency', async () => {
    const initial = fixtureDocument();
    const repository = new MemoryDrawingRepository({ idFactory: ids(), now: () => 20 });
    const opened = await repository.create(initial);
    const result = await repository.commit({
      id: 'tx_raise_hand',
      baseRevision: opened.revision,
      actor: { type: 'AI', id: 'drawing-agent' },
      commands: [
        { type: 'geometry.delete', id: 'old_hand' as GeometryId },
        {
          type: 'geometry.create',
          value: line('raised_hand', [10, 0], [10, 20]),
        },
      ],
      preconditions: [],
      postconditions: [],
      evidenceRefs: [],
    });
    if (result.status !== 'committed') throw new Error('expected benchmark commit');
    const commits = await repository.listCommits(initial.id);

    const report = evaluateSemanticEditBenchmark({
      initialDocument: initial,
      finalDocument: result.document,
      commits,
      oldTargetNodeIds: ['old_hand'],
      editedNodeIds: ['raised_hand'],
      preservedNodeIds: ['body', 'fixed_arm'],
      anchors: [{ nodeIds: ['raised_hand'], point: [10, 0], tolerance: 0.01 }],
      auditEvents: auditTimeline([
        ['region', 80, { id: 'region_arm' }],
        ['selection', 90, { selectionVersionId: 'selection_1' }],
        ['episode', 95, { previewVersionId: 'preview_version_1' }],
        ['preview', 100, {}],
        ['verification', 120, { phase: 'preview', satisfied: true }],
        ['commit', 130, { receipt: { status: 'succeeded' } }],
      ]),
      progressEvents: progressTimeline([0, 25_000, 49_000]),
    });

    expect(report).toMatchObject({
      passed: true,
      oldTargetRemoved: true,
      anchorsConnected: true,
      preservedNodesChanged: [],
      previewVerifiedBeforeCommit: true,
      replayExact: true,
      visibleFeedbackWithinTarget: true,
      regionSelectedBeforeNodes: true,
      feedbackPreviewVersionCount: 1,
    });
    expect(report.maxVisibleSilenceMs).toBe(25_000);
    expect(report.maxVisibleSilenceMs).toBeLessThanOrEqual(30_000);
  });

  it('fails when verification follows commit, a protected node changes, or progress goes silent', () => {
    const initial = fixtureDocument();
    const final = fixtureDocument();
    final.geometry = [
      line('fixed_arm', [0, 0], [11, 0]),
      line('old_hand', [10, 0], [20, 0]),
      circle('body', [0, 0], 5),
    ];

    const report = evaluateSemanticEditBenchmark({
      initialDocument: initial,
      finalDocument: final,
      commits: [] as DrawingCommit[],
      oldTargetNodeIds: ['old_hand'],
      editedNodeIds: ['old_hand'],
      preservedNodeIds: ['body', 'fixed_arm'],
      anchors: [{ nodeIds: ['old_hand'], point: [999, 999], tolerance: 1 }],
      auditEvents: auditTimeline([
        ['commit', 100, { receipt: { status: 'succeeded' } }],
        ['verification', 120, { phase: 'preview', satisfied: true }],
      ]),
      progressEvents: progressTimeline([0, 31_000]),
    });

    expect(report).toMatchObject({
      passed: false,
      oldTargetRemoved: false,
      anchorsConnected: false,
      preservedNodesChanged: ['fixed_arm'],
      previewVerifiedBeforeCommit: false,
      replayExact: false,
      maxVisibleSilenceMs: 31_000,
      visibleFeedbackWithinTarget: false,
    });
  });

  it('reports delayed visual feedback without failing a correct Drawing IR result', async () => {
    const initial = fixtureDocument();
    const repository = new MemoryDrawingRepository({ idFactory: ids(), now: () => 20 });
    const opened = await repository.create(initial);
    const result = await repository.commit({
      id: 'tx_raise_hand_slow_feedback',
      baseRevision: opened.revision,
      actor: { type: 'AI', id: 'drawing-agent' },
      commands: [
        { type: 'geometry.delete', id: 'old_hand' as GeometryId },
        { type: 'geometry.create', value: line('raised_hand', [10, 0], [10, 20]) },
      ],
      preconditions: [],
      postconditions: [],
      evidenceRefs: [],
    });
    if (result.status !== 'committed') throw new Error('expected benchmark commit');

    const report = evaluateSemanticEditBenchmark({
      initialDocument: initial,
      finalDocument: result.document,
      commits: await repository.listCommits(initial.id),
      oldTargetNodeIds: ['old_hand'],
      editedNodeIds: ['raised_hand'],
      preservedNodeIds: ['body', 'fixed_arm'],
      anchors: [{ nodeIds: ['raised_hand'], point: [10, 0], tolerance: 0.01 }],
      auditEvents: auditTimeline([
        ['preview', 100, {}],
        ['verification', 120, { phase: 'preview', satisfied: true }],
        ['commit', 130, { receipt: { status: 'succeeded' } }],
      ]),
      progressEvents: progressTimeline([0, 45_000]),
    });

    expect(report).toMatchObject({
      passed: true,
      maxVisibleSilenceMs: 45_000,
      visibleFeedbackWithinTarget: false,
    });
  });
});

function fixtureDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_test2_semantic' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      line('fixed_arm', [0, 0], [10, 0]),
      line('old_hand', [10, 0], [20, 0]),
      circle('body', [0, 0], 5),
    ],
    annotations: [],
    relations: [],
    features: [],
  };
}

function line(id: string, start: readonly [number, number], end: readonly [number, number]) {
  return {
    id: id as GeometryId,
    type: 'line' as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
    start,
    end,
  };
}

function circle(id: string, center: readonly [number, number], radius: number) {
  return {
    id: id as GeometryId,
    type: 'circle' as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
    center,
    radius,
  };
}

function ids(): IdFactory {
  let sequence = 0;
  return { next: (kind) => `${kind}_${++sequence}` };
}

function auditTimeline(
  values: [DrawingAgentAuditEvent['type'], number, Record<string, unknown>][],
): DrawingAgentAuditEvent[] {
  return values.map(([type, timestamp, payload], index) => ({
    schemaVersion: 1,
    id: `audit_${index}`,
    runId: 'run_semantic_benchmark',
    type,
    timestamp,
    payload,
  }));
}

function progressTimeline(timestamps: number[]): DrawingAgentProgressEvent[] {
  return timestamps.map((timestamp, index) => ({
    id: `progress_${index}`,
    runId: 'run_semantic_benchmark',
    type: index === timestamps.length - 1 ? 'completed' : 'heartbeat',
    title: 'visible progress',
    timestamp,
    elapsedMs: timestamp,
  }));
}
