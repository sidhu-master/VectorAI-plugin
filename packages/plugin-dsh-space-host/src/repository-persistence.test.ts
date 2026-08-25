// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FileDrawingRepositoryStorage } from './repository-storage';
import { InMemoryDrawingRepository, type ImageVectorizer } from './repository';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function attachment(): ImageAttachmentRef {
  return {
    attachmentId: 'persisted-source' as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png',
    bytes: 4,
    width: 120,
    height: 80,
    name: 'persisted.png',
  };
}

function vectorizer(): ImageVectorizer {
  return {
    async vectorize({ drawingId }) {
      const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
      document.geometry = [{
        id: 'persisted-line' as typeof document.geometry[number]['id'],
        type: 'line', start: [0, 0], end: [100, 50], visible: true,
        quality: { status: 'confirmed', confidence: 0.9, evidenceRefs: [] },
      }];
      return {
        document,
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 50 },
        provisional: false,
      };
    },
  };
}

describe('FileDrawingRepositoryStorage', () => {
  it('round-trips deterministic solver provenance inside the durable commit envelope', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vectorai-dsh-provenance-'));
    temporaryDirectories.push(directory);
    const storage = new FileDrawingRepositoryStorage(directory);
    const state = {
      version: 2 as const,
      entry: {
        attachmentId: 'persisted-source',
        document: (await vectorizer().vectorize({
          drawingId: 'drawing-provenance', attachment: attachment(),
          data: new Uint8Array([1]), signal: new AbortController().signal,
        })).document,
        drawingId: 'drawing-provenance',
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 50 },
        revision: 2,
        source: { id: 'persisted-source', mediaType: 'image/png' as const, width: 120, height: 80 },
        provisional: false,
      },
      commits: [{
        commitId: 'commit-1', mode: 'auto-safe' as const,
        operationId: 'operation-1', operationBindingDigest: 'sha256:binding',
        parentRevision: 1, resultingRevision: 2, forward: [], inverse: [],
        semanticDigest: 'sha256:semantic', snapshotIntegrityDigest: 'sha256:snapshot',
        solverProvenance: {
          solverVersion: 'spatial-intent-solver-0.1.0' as const,
          canonicalIntentDigest: 'sha256:intent',
          selectedPartScopeDigests: { moving: 'sha256:scope' },
          numericEvidenceDigests: ['sha256:numeric'],
          receipt: {
            version: 'spatial-intent-solver-0.1.0' as const,
            candidateCount: 5, selectedRank: 0, goalResidual: 0, movementCost: 0.1,
            deformationCost: 0, collisionPenalty: 0, topologyPenalty: 0,
            solvedTransforms: [{ partKey: 'moving', translation: [0, 10] as const }],
            inputsContainModelCoordinates: false as const,
          },
        },
        committedAt: 7,
      }],
      operations: [],
    };

    storage.saveDurable('session-provenance', state);
    expect(storage.loadDurable('session-provenance')?.commits[0]?.solverProvenance).toEqual(
      state.commits[0]!.solverProvenance,
    );
  });

  it('restores an imported and edited drawing in a new repository instance', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vectorai-dsh-storage-'));
    temporaryDirectories.push(directory);
    const first = new InMemoryDrawingRepository({
      vectorizer: vectorizer(),
      storage: new FileDrawingRepositoryStorage(directory),
    });
    first.bindPending('../session-a', attachment());
    await first.importPending('../session-a', {
      data: new Uint8Array([1, 2, 3, 4]),
      signal: new AbortController().signal,
    });
    expect(first.commit('../session-a', {
      expectedRevision: 1,
      commands: [{
        type: 'node.update',
        id: 'persisted-line',
        expected: { visible: true },
        changes: { visible: false },
      }],
    }).status).toBe('committed');

    const restored = new InMemoryDrawingRepository({
      vectorizer: vectorizer(),
      storage: new FileDrawingRepositoryStorage(directory),
    }).getSnapshot('../session-a');

    expect(restored).toMatchObject({
      ref: { drawingId: 'drawing_persisted-source', revision: 2 },
      provisional: false,
      document: { geometry: [{ id: 'persisted-line', visible: false }] },
    });
    expect(await readdir(directory)).toEqual([expect.stringMatching(/^[a-f0-9]{64}\.json$/)]);
  });

  it('does not publish an import when durable storage fails', async () => {
    const drawings = new InMemoryDrawingRepository({
      vectorizer: vectorizer(),
      storage: {
        load: () => null,
        save: () => { throw new Error('disk unavailable'); },
      },
    });
    drawings.bindPending('session-a', attachment());

    await expect(drawings.importPending('session-a', {
      data: new Uint8Array([1, 2, 3, 4]),
      signal: new AbortController().signal,
    })).rejects.toThrow('disk unavailable');
    expect(drawings.getSnapshot('session-a')).toBeNull();
  });
});
