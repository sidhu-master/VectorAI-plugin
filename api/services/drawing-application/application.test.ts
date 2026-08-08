import { describe, expect, it } from 'vitest';

import {
  type DrawingTransaction,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing/index';
import type { DrawingId, GeometryId } from '../../../src/drawing/index';
import { DrawingApplication } from './application';

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

function setup() {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  return { application, repository };
}

describe('DrawingApplication', () => {
  it('creates and reopens a complete workspace snapshot', async () => {
    const { application } = setup();

    const created = await application.create({ unit: 'cm' });
    const reopened = await application.open(created.document.id);

    expect(created).toEqual({
      document: expect.objectContaining({
        protocol: 'VectorAI-Drawing',
        unitSystem: { length: 'cm', angle: 'deg' },
      }),
      revision: 'revision_1',
      commits: [],
    });
    expect(reopened).toEqual(created);
  });

  it('executes a manual transaction against the named drawing', async () => {
    const { application } = setup();
    const workspace = await application.create();

    const result = await application.execute({
      drawingId: workspace.document.id,
      transaction: {
        id: 'tx_create_circle',
        baseRevision: workspace.revision,
        actor: { type: 'user', id: 'user' },
        commands: [{
          type: 'geometry.create',
          value: {
            id: 'circle_1' as GeometryId,
            type: 'circle', visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] },
            center: [0, 0], radius: 5,
          },
        }],
        preconditions: [],
        postconditions: [{ type: 'node.exists', nodeId: 'circle_1' }],
        evidenceRefs: [],
      },
    });

    expect(result).toMatchObject({
      status: 'committed',
      document: { geometry: [expect.objectContaining({ id: 'circle_1' })] },
    });
  });

  it('preserves stale revision semantics for the same drawing', async () => {
    const { application } = setup();
    const workspace = await application.create();
    const input = {
      drawingId: workspace.document.id,
      transaction: {
        id: 'tx_create_point',
        baseRevision: workspace.revision,
        actor: { type: 'user' as const, id: 'user' },
        commands: [{
          type: 'geometry.create' as const,
          value: {
            id: 'point_1' as GeometryId,
            type: 'point' as const, visible: true,
            quality: { status: 'confirmed' as const, evidenceRefs: [] },
            x: 0, y: 0,
          },
        }],
        preconditions: [], postconditions: [], evidenceRefs: [],
      },
    };
    await application.execute(input);

    const stale = await application.execute(input);

    expect(stale).toMatchObject({
      status: 'rejected', errors: [{ code: 'STALE_REVISION', stage: 'revision' }],
    });
  });

  it('rejects a revision owned by a different drawing before repository commit', async () => {
    const { application } = setup();
    const first = await application.create();
    const second = await application.create();

    const result = await application.execute({
      drawingId: first.document.id,
      transaction: {
        id: 'tx_wrong_drawing',
        baseRevision: second.revision,
        actor: { type: 'user', id: 'user' },
        commands: [], preconditions: [], postconditions: [], evidenceRefs: [],
      },
    });

    expect(result).toMatchObject({
      status: 'rejected', errors: [{ code: 'DRAWING_REVISION_MISMATCH' }],
    });
    expect((await application.open(first.document.id)).commits).toEqual([]);
  });

  it('does not add a commit when the requested result already exists', async () => {
    const { application } = setup();
    const workspace = await application.create();

    const result = await application.execute({
      drawingId: workspace.document.id,
      transaction: {
        id: 'tx_noop', baseRevision: workspace.revision,
        actor: { type: 'AI', id: 'agent' }, commands: [], preconditions: [],
        postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
      },
    });

    expect(result.status).toBe('already_satisfied');
    expect((await application.open(workspace.document.id)).commits).toEqual([]);
  });

  it('reverts through the repository and returns the durable workspace state', async () => {
    const { application } = setup();
    const workspace = await application.create();
    const committed = await application.execute({
      drawingId: workspace.document.id,
      transaction: {
        id: 'tx_add', baseRevision: workspace.revision,
        actor: { type: 'user', id: 'user' },
        commands: [{
          type: 'geometry.create',
          value: {
            id: 'point_1' as GeometryId,
            type: 'point', visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] }, x: 1, y: 2,
          },
        }],
        preconditions: [], postconditions: [], evidenceRefs: [],
      },
    });
    if (committed.status !== 'committed') throw new Error('expected commit');

    const reverted = await application.revert({
      drawingId: workspace.document.id,
      commitId: committed.commit.id,
      actor: { type: 'user', id: 'user' },
    });

    expect(reverted).toMatchObject({ status: 'committed', document: { geometry: [] } });
    expect((await application.open(workspace.document.id)).commits).toHaveLength(2);
  });

  it('rejects opening an unknown drawing without fabricating state', async () => {
    const { application } = setup();
    await expect(application.open('missing' as DrawingId)).rejects.toMatchObject({
      code: 'DRAWING_NOT_FOUND',
    });
  });

  it('queries the current drawing projection together with its revision', async () => {
    const { application } = setup();
    const workspace = await application.create();
    const committed = await application.execute({
      drawingId: workspace.document.id,
      transaction: circleTransaction(workspace.revision, 'circle_query'),
    });
    if (committed.status !== 'committed') throw new Error('expected commit');

    const queried = await application.query({
      drawingId: workspace.document.id,
      selector: { plane: 'geometry', types: ['circle'], limit: 10 },
    });

    expect(queried).toEqual({
      revision: committed.revision,
      result: {
        items: [{
          id: 'circle_query', plane: 'geometry', type: 'circle',
          summary: 'circle center=[0,0] radius=5',
          bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
        }],
        truncated: false,
      },
    });
  });

  it('previews a transaction without changing the repository', async () => {
    const { application } = setup();
    const workspace = await application.create();

    const preview = await application.preview({
      drawingId: workspace.document.id,
      transaction: circleTransaction(workspace.revision, 'circle_preview'),
    });

    expect(preview).toMatchObject({
      status: 'ready',
      preview: { affectedNodeIds: ['circle_preview'], candidate: false },
      resultingDocument: { geometry: [expect.objectContaining({ id: 'circle_preview' })] },
    });
    expect(await application.open(workspace.document.id)).toEqual(workspace);
  });

  it('marks a candidate node in the preview without persisting it', async () => {
    const { application } = setup();
    const workspace = await application.create();
    const transaction = circleTransaction(workspace.revision, 'circle_candidate');
    const command = transaction.commands[0];
    if (command.type !== 'geometry.create') throw new Error('expected create');
    command.value.quality = { status: 'candidate', confidence: 0.42, evidenceRefs: [] };

    const preview = await application.preview({
      drawingId: workspace.document.id,
      transaction,
    });

    expect(preview).toMatchObject({ status: 'ready', preview: { candidate: true } });
    expect((await application.open(workspace.document.id)).document.geometry).toEqual([]);
  });

  it('preserves stale and wrong-drawing revision errors during preview', async () => {
    const { application } = setup();
    const first = await application.create();
    const second = await application.create();
    await application.execute({
      drawingId: first.document.id,
      transaction: circleTransaction(first.revision, 'circle_committed'),
    });

    const stale = await application.preview({
      drawingId: first.document.id,
      transaction: circleTransaction(first.revision, 'circle_stale'),
    });
    const wrongDrawing = await application.preview({
      drawingId: first.document.id,
      transaction: circleTransaction(second.revision, 'circle_wrong'),
    });

    expect(stale).toMatchObject({
      status: 'rejected', errors: [{ code: 'STALE_REVISION', retryable: true }],
    });
    expect(wrongDrawing).toMatchObject({
      status: 'rejected', errors: [{ code: 'DRAWING_REVISION_MISMATCH', retryable: false }],
    });
  });
});

function circleTransaction(revision: string, id: string): DrawingTransaction {
  return {
    id: `tx_${id}`,
    baseRevision: revision as DrawingTransaction['baseRevision'],
    actor: { type: 'AI' as const, id: 'agent' },
    commands: [{
      type: 'geometry.create' as const,
      value: {
        id: id as GeometryId,
        type: 'circle' as const,
        visible: true,
        quality: { status: 'confirmed' as const, evidenceRefs: [] },
        center: [0, 0] as const,
        radius: 5,
      },
    }],
    preconditions: [],
    postconditions: [{ type: 'node.exists' as const, nodeId: id }],
    evidenceRefs: [],
  };
}
