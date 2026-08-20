import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEmptyDrawing, type IdFactory } from '../../../src/drawing/document/create';
import type {
  DrawingId,
  EvidenceId,
  GeometryId,
} from '../../../src/drawing/document/types';
import type { DrawingTransaction } from '../../../src/drawing/transaction/types';
import {
  FileDrawingRepository,
  NodeAtomicJsonWriter,
  type AtomicJsonWriter,
} from './file-drawing-repository';

const temporaryDirectories: string[] = [];
const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

async function temporaryRoot(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'vectorai-drawing-repo-'));
  temporaryDirectories.push(directory);
  return directory;
}

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

function createCircle(baseRevision: DrawingTransaction['baseRevision'], id = 'circle_1'): DrawingTransaction {
  return {
    id: `tx_${id}`,
    baseRevision,
    actor: { type: 'AI', id: 'agent' },
    commands: [{
      type: 'geometry.create',
      value: {
        id: id as GeometryId,
        type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: 10,
      },
    }],
    preconditions: [{ type: 'node.absent', nodeId: id }],
    postconditions: [{ type: 'node.exists', nodeId: id }],
    evidenceRefs: [],
  };
}

function resizeCircle(
  baseRevision: DrawingTransaction['baseRevision'],
  radius: number,
): DrawingTransaction {
  return {
    id: `tx_resize_${radius}`,
    baseRevision,
    actor: { type: 'user', id: 'local-user' },
    commands: [{
      type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius },
    }],
    preconditions: [{ type: 'node.exists', nodeId: 'circle_1' }],
    postconditions: [{ type: 'document.valid' }],
    evidenceRefs: [],
  };
}

describe('FileDrawingRepository', () => {
  it('restores the exact document and revision in a new repository instance', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_persisted' }, now: () => 1,
    });
    const first = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const created = await first.create(document);
    const second = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 200 });

    const reopened = await second.getCurrent(document.id);

    expect(reopened).toEqual(created);
    expect(reopened.document).toEqual(document);
    const persisted = JSON.parse(await readFile(snapshotPath(rootDirectory, document.id), 'utf8'));
    expect(persisted.contentDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('rejects a structurally valid checkpoint changed without updating its digest', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_digest' }, now: () => 1,
    });
    const first = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const created = await first.create(document);
    const committed = await first.commit(createCircle(created.revision));
    if (committed.status !== 'committed') throw new Error('expected commit');
    const path = snapshotPath(rootDirectory, document.id);
    const snapshot = JSON.parse(await readFile(path, 'utf8'));
    snapshot.document.geometry[0].radius = 999;
    await writeFile(path, JSON.stringify(snapshot));

    const restarted = new FileDrawingRepository({ rootDirectory, idFactory: ids() });
    await expect(restarted.getCurrentCheckpoint(document.id)).rejects.toMatchObject({
      code: 'CORRUPT_SNAPSHOT', drawingId: document.id,
    });
    await expect(restarted.getCurrent(document.id)).rejects.toMatchObject({
      code: 'CORRUPT_SNAPSHOT', drawingId: document.id,
    });
  });

  it('reads one current checkpoint without replaying or loading unrelated snapshots', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_checkpoint' }, now: () => 1,
    });
    const first = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const created = await first.create(document);
    await writeFile(join(rootDirectory, 'unrelated-corrupt.json'), '{not-json');
    const restarted = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 200 });

    await expect(restarted.getCurrentCheckpoint(document.id)).resolves.toEqual(created);
    await expect(restarted.getCurrent(document.id)).resolves.toEqual(created);
    await expect(restarted.commit(createCircle(created.revision, 'circle_checkpoint')))
      .resolves.toMatchObject({ status: 'committed' });
  });

  it('persists commits and revert commits across restarts', async () => {
    const rootDirectory = await temporaryRoot();
    const idFactory = ids();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_history' }, now: () => 1,
    });
    const first = new FileDrawingRepository({ rootDirectory, idFactory, now: () => 100 });
    const opened = await first.create(document);
    const committed = await first.commit(createCircle(opened.revision));
    if (committed.status !== 'committed') throw new Error('expected commit');
    const reverted = await first.revert({
      drawingId: document.id,
      commitId: committed.commit.id,
      actor: { type: 'user', id: 'reviewer' },
    });
    if (reverted.status !== 'committed') throw new Error('expected revert');

    const reopened = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 200 });

    expect(await reopened.getCurrent(document.id)).toEqual({
      document: reverted.document,
      revision: reverted.revision,
    });
    expect(await reopened.listCommits(document.id)).toEqual([
      committed.commit,
      reverted.commit,
    ]);
  });

  it('persists model transaction metadata and rejects corrupt lineage on restart', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_metadata' }, now: () => 1,
    });
    const repository = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const opened = await repository.create(document);
    const transaction = createCircle(opened.revision);
    transaction.metadata = {
      episodeId: 'episode_file',
      summary: 'Fit and replace the observed contour.',
      confidence: 0.88,
      lineage: [{
        sourceIds: ['raster_contour_1'],
        resultIds: ['circle_1'],
        operation: 'replace',
        evidenceRefs: ['evidence_file_1' as EvidenceId],
      }],
      decisionGrantRefs: ['grant_file_1'],
    };
    const committed = await repository.commit(transaction);
    if (committed.status !== 'committed') throw new Error('expected commit');

    const reopened = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 200 });
    expect((await reopened.listCommits(document.id))[0].metadata).toEqual(transaction.metadata);

    const path = historySegmentPath(rootDirectory, document.id, 0);
    const snapshot = JSON.parse(await readFile(path, 'utf8')) as {
      commits: Array<{ metadata: { lineage: Array<{ operation: string }> } }>;
    };
    snapshot.commits[0].metadata.lineage[0].operation = 'invented-operation';
    await writeFile(path, JSON.stringify(snapshot));
    const corrupt = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 300 });

    await expect(corrupt.getCurrent(document.id)).rejects.toMatchObject({
      code: 'CORRUPT_SNAPSHOT',
    });
  });

  it('serializes concurrent commits so one stale transaction is rejected', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_concurrent' }, now: () => 1,
    });
    const repository = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const opened = await repository.create(document);

    const results = await Promise.all([
      repository.commit(createCircle(opened.revision, 'circle_a')),
      repository.commit(createCircle(opened.revision, 'circle_b')),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['committed', 'rejected']);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      status: 'rejected', errors: [{ code: 'STALE_REVISION' }],
    });
    expect(await repository.listCommits(document.id)).toHaveLength(1);
  });

  it('keeps the current checkpoint bounded while preserving an append-only replay history', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_segmented_history' }, now: () => 1,
    });
    const repository = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const opened = await repository.create(document);
    const created = await repository.commit(createCircle(opened.revision));
    if (created.status !== 'committed') throw new Error('expected circle commit');
    let revision = created.revision;
    for (let radius = 11; radius <= 74; radius += 1) {
      const committed = await repository.commit(resizeCircle(revision, radius));
      if (committed.status !== 'committed') throw new Error(`expected resize ${radius}`);
      revision = committed.revision;
    }

    const checkpointText = await readFile(snapshotPath(rootDirectory, document.id), 'utf8');
    const checkpoint = JSON.parse(checkpointText) as Record<string, unknown>;
    const historyNames = (await readdir(historyDirectory(rootDirectory, document.id)))
      .filter((name) => /^\d{12}\.json$/.test(name));
    const historyTexts = await Promise.all(historyNames.map((name) => (
      readFile(join(historyDirectory(rootDirectory, document.id), name), 'utf8')
    )));
    const historyBytes = historyTexts.reduce((total, text) => total + text.length, 0);

    expect(checkpoint).toMatchObject({
      schemaVersion: 2,
      revision,
      history: { commitCount: 65, headRevision: revision },
    });
    expect(checkpoint).not.toHaveProperty('commits');
    expect(checkpointText.length).toBeLessThan(historyBytes / 4);

    const reopened = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 200 });
    expect((await reopened.getCurrent(document.id)).document.geometry[0]).toMatchObject({
      id: 'circle_1', radius: 74,
    });
    expect(await reopened.listCommits(document.id)).toHaveLength(65);
  });

  it('rejects a corrupt snapshot instead of silently replacing it', async () => {
    const rootDirectory = await temporaryRoot();
    const drawingId = 'drawing_corrupt' as DrawingId;
    await mkdir(rootDirectory, { recursive: true });
    await writeFile(snapshotPath(rootDirectory, drawingId), JSON.stringify({
      schemaVersion: 1,
      initialDocument: { protocol: 'VectorAI-Drawing' },
      document: { protocol: 'VectorAI-Drawing' },
      revision: 'revision_1',
      commits: [],
    }));
    const repository = new FileDrawingRepository({ rootDirectory, idFactory: ids() });

    await expect(repository.getCurrent(drawingId)).rejects.toMatchObject({
      code: 'CORRUPT_SNAPSHOT',
    });
    expect(await readFile(snapshotPath(rootDirectory, drawingId), 'utf8')).toContain('revision_1');
  });

  it('converts malformed replay operations into a structured load error', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_bad_patch' }, now: () => 1,
    });
    const repository = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 100 });
    const opened = await repository.create(document);
    const committed = await repository.commit(createCircle(opened.revision));
    if (committed.status !== 'committed') throw new Error('expected commit');
    const updated = await repository.commit({
      id: 'tx_update_circle',
      baseRevision: committed.revision,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: 12 },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    });
    if (updated.status !== 'committed') throw new Error('expected update');
    const path = historySegmentPath(rootDirectory, document.id, 1);
    const snapshot = JSON.parse(await readFile(path, 'utf8')) as {
      commits: Array<{ patch: { operations: unknown[] } }>;
    };
    snapshot.commits[0].patch.operations = [{ type: 'geometry.update', id: 'circle_1' }];
    await writeFile(path, JSON.stringify(snapshot));

    const reopened = new FileDrawingRepository({ rootDirectory, idFactory: ids() });

    await expect(reopened.getCurrent(document.id)).rejects.toMatchObject({
      code: 'CORRUPT_SNAPSHOT',
    });
  });

  it('keeps the previous durable snapshot when an atomic write fails', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_write_failure' }, now: () => 1,
    });
    const initialIds = ids();
    const healthy = new FileDrawingRepository({ rootDirectory, idFactory: initialIds, now: () => 100 });
    const opened = await healthy.create(document);
    const failingWriter: AtomicJsonWriter = {
      write: async () => { throw new Error('atomic rename failed'); },
    };
    const failing = new FileDrawingRepository({
      rootDirectory,
      idFactory: initialIds,
      now: () => 200,
      writer: failingWriter,
    });

    await expect(failing.commit(createCircle(opened.revision))).rejects.toThrow('atomic rename failed');

    const recovered = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 300 });
    expect(await recovered.getCurrent(document.id)).toEqual(opened);
    expect(await recovered.listCommits(document.id)).toEqual([]);
  });

  it('ignores an uncommitted history tail when checkpoint publication fails', async () => {
    const rootDirectory = await temporaryRoot();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_orphan_history_tail' }, now: () => 1,
    });
    const sharedIds = ids();
    const healthy = new FileDrawingRepository({ rootDirectory, idFactory: sharedIds, now: () => 100 });
    const opened = await healthy.create(document);
    const created = await healthy.commit(createCircle(opened.revision));
    if (created.status !== 'committed') throw new Error('expected initial commit');
    const nodeWriter = new NodeAtomicJsonWriter();
    let failedCheckpoint = false;
    const checkpointFailingWriter: AtomicJsonWriter = {
      write: async (targetPath, json) => {
        if (!failedCheckpoint && targetPath === snapshotPath(rootDirectory, document.id)) {
          failedCheckpoint = true;
          throw new Error('checkpoint publication failed');
        }
        await nodeWriter.write(targetPath, json);
      },
    };
    const failing = new FileDrawingRepository({
      rootDirectory, idFactory: sharedIds, now: () => 200, writer: checkpointFailingWriter,
    });

    await expect(failing.commit(resizeCircle(created.revision, 20)))
      .rejects.toThrow('checkpoint publication failed');

    const recovered = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 300 });
    expect(await recovered.getCurrent(document.id)).toEqual({
      document: created.document,
      revision: created.revision,
    });
    expect(await recovered.listCommits(document.id)).toEqual([created.commit]);
  });

  it('clears the latest state atomically without a caller-owned revision', async () => {
    const rootDirectory = await temporaryRoot();
    const idFactory = ids();
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_clear' }, now: () => 1,
    });
    const repository = new FileDrawingRepository({ rootDirectory, idFactory, now: () => 100 });
    const opened = await repository.create(document);
    const committed = await repository.commit(createCircle(opened.revision));
    if (committed.status !== 'committed') throw new Error('expected commit');

    const cleared = await repository.clear({
      drawingId: document.id,
      actor: { type: 'user', id: 'local-user' },
    });

    expect(cleared.status).toBe('committed');
    if (cleared.status !== 'committed') throw new Error('expected clear commit');
    expect(cleared.document).toMatchObject({
      geometry: [], annotations: [], relations: [], features: [],
    });
    const reopened = new FileDrawingRepository({ rootDirectory, idFactory: ids(), now: () => 200 });
    expect((await reopened.getCurrent(document.id)).document.geometry).toEqual([]);
  });
});

function snapshotPath(rootDirectory: string, drawingId: DrawingId): string {
  const name = createHash('sha256').update(drawingId).digest('hex');
  return join(rootDirectory, `${name}.json`);
}

function historyDirectory(rootDirectory: string, drawingId: DrawingId): string {
  const name = createHash('sha256').update(drawingId).digest('hex');
  return join(rootDirectory, `${name}.history`);
}

function historySegmentPath(
  rootDirectory: string,
  drawingId: DrawingId,
  startIndex: number,
): string {
  return join(historyDirectory(rootDirectory, drawingId), `${String(startIndex).padStart(12, '0')}.json`);
}
