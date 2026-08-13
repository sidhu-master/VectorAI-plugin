import { describe, expect, it } from 'vitest';

import {
  createEmptyDrawing,
  previewTransaction,
  type DrawingDocument,
  type DrawingId,
  type DrawingTransaction,
  type GeometryId,
  type RevisionId,
} from '../../../src/drawing/index.js';
import { CounterfactualWorldService } from './service.js';

describe('CounterfactualWorldService', () => {
  it('derives a local before/after world and reports unchanged canonical nodes', () => {
    const before = document();
    before.geometry.push(
      line('line_a', [0, 0], [10, 0]),
      line('line_neighbor', [10, 0], [20, 0]),
      line('line_far', [1000, 1000], [1010, 1000]),
    );
    const revision = 'revision_1' as RevisionId;
    const preview = readyPreview(before, revision, {
      type: 'geometry.update',
      id: 'line_a' as GeometryId,
      changes: { end: [10, 10] },
    });

    const service = new CounterfactualWorldService({ handleFactory: () => 'branch_1' });
    const branch = service.create({
      baseDocument: before,
      baseRevision: revision,
      preview,
      transactionDigest: `sha256:${'a'.repeat(64)}`,
    });

    expect(branch).toMatchObject({
      id: 'branch_1',
      baseRevision: revision,
      affectedScope: { nodeIds: ['line_a'] },
      delta: {
        changedNodeIds: ['line_a'],
        unchangedNodeCount: 2,
      },
    });
    expect(branch.affectedScope.bounds.maxX).toBeLessThan(1000);
    expect(branch.beforeWorld.sourceSpans.some((span) => span.sourceNodeId === 'line_far')).toBe(false);
    expect(branch.afterWorld.sourceSpans.some((span) => span.sourceNodeId === 'line_far')).toBe(false);
    expect(service.snapshot()).toEqual({ branchCount: 1, documentCount: 2 });
  });

  it('includes deleted geometry bounds from the base document', () => {
    const before = document();
    before.geometry.push(line('line_deleted', [50, 60], [70, 80]));
    const revision = 'revision_delete' as RevisionId;
    const preview = readyPreview(before, revision, {
      type: 'geometry.delete', id: 'line_deleted' as GeometryId,
    });
    const branch = new CounterfactualWorldService({ handleFactory: () => 'branch_delete' }).create({
      baseDocument: before,
      baseRevision: revision,
      preview,
      transactionDigest: `sha256:${'b'.repeat(64)}`,
    });

    expect(branch.affectedScope.bounds).toEqual(expect.objectContaining({
      minX: expect.any(Number), minY: expect.any(Number), maxX: expect.any(Number), maxY: expect.any(Number),
    }));
    expect(branch.affectedScope.bounds.minX).toBeLessThanOrEqual(50);
    expect(branch.affectedScope.bounds.maxX).toBeGreaterThanOrEqual(70);
  });

  it('rejects stale revision or transaction digest and can discard a run branch', () => {
    const before = document();
    before.geometry.push(line('line_a', [0, 0], [10, 0]));
    const revision = 'revision_1' as RevisionId;
    const digest = `sha256:${'c'.repeat(64)}`;
    const service = new CounterfactualWorldService({ handleFactory: () => 'branch_1' });
    const branch = service.create({
      runId: 'run_1',
      baseDocument: before,
      baseRevision: revision,
      preview: readyPreview(before, revision, {
        type: 'geometry.update', id: 'line_a' as GeometryId, changes: { end: [5, 5] },
      }),
      transactionDigest: digest,
    });

    expect(service.get(branch.id, { revision, transactionDigest: digest })).toMatchObject({ id: branch.id });
    expect(() => service.get(branch.id, {
      revision: 'revision_other' as RevisionId,
      transactionDigest: digest,
    })).toThrow(/COUNTERFACTUAL_STALE/);
    expect(() => service.get(branch.id, {
      revision,
      transactionDigest: `sha256:${'d'.repeat(64)}`,
    })).toThrow(/COUNTERFACTUAL_STALE/);
    expect(service.discardRun('run_1')).toBe(1);
    expect(service.snapshot()).toEqual({ branchCount: 0, documentCount: 0 });
  });
});

function readyPreview(
  before: DrawingDocument,
  revision: RevisionId,
  command: DrawingTransaction['commands'][number],
): Extract<ReturnType<typeof previewTransaction>, { status: 'ready' }> {
  const result = previewTransaction({ document: before, currentRevision: revision }, {
    id: 'transaction_1',
    baseRevision: revision,
    actor: { type: 'AI', id: 'test' },
    commands: [command],
    preconditions: [],
    postconditions: [{ type: 'document.valid' }],
    evidenceRefs: [],
  });
  if (result.status !== 'ready') throw new Error(`expected ready preview, got ${result.status}`);
  return result;
}

function document(): DrawingDocument {
  return createEmptyDrawing({
    idFactory: { next: (kind) => kind === 'drawing' ? 'drawing_1' : `${kind}_unused` },
    now: () => 1,
  });
}

function line(
  id: string,
  start: readonly [number, number],
  end: readonly [number, number],
) {
  return {
    id: id as GeometryId,
    type: 'line' as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
    start,
    end,
  };
}
