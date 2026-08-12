import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

    const path = snapshotPath(rootDirectory, document.id);
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
    const path = snapshotPath(rootDirectory, document.id);
    const snapshot = JSON.parse(await readFile(path, 'utf8')) as {
      commits: Array<{ patch: { operations: unknown[] } }>;
    };
    snapshot.commits[1].patch.operations = [{ type: 'geometry.update', id: 'circle_1' }];
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
});

function snapshotPath(rootDirectory: string, drawingId: DrawingId): string {
  const name = createHash('sha256').update(drawingId).digest('hex');
  return join(rootDirectory, `${name}.json`);
}
