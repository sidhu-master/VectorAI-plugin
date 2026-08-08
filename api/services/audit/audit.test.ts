import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileAuditStore } from './file-audit-store';
import { redactAuditPayload } from './redact';
import { replayCommits } from './replay';
import { createEmptyModel } from '../../../src/core/model';
import { commitPatch, createHistory } from '../../../src/core/history/history';

let rootDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'vectorai-audit-'));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('FileAuditStore', () => {
  it('writes a complete run and reads events in append order', async () => {
    const store = new FileAuditStore(rootDir);
    await store.startRun({ runId: 'run_1', startedAt: 1, protocolVersion: '0.1' });
    await Promise.all([
      store.appendEvent({ id: 'e1', runId: 'run_1', type: 'one', timestamp: 2, payload: {} }),
      store.appendEvent({ id: 'e2', runId: 'run_1', type: 'two', timestamp: 3, payload: {} }),
    ]);

    const initial = createEmptyModel();
    const committed = commitPatch(createHistory(initial), {
      id: 'c1', runId: 'run_1', stepId: 's1', source: 'AI', timestamp: 4,
      patch: { operations: [{
        type: 'entity.add',
        entity: { id: 'p1', type: 'point', visible: true, x: 1, y: 2 },
      }] },
    });
    if (!committed.success) throw new Error('fixture commit failed');
    await store.saveCommit(committed.commit);
    await store.saveDrawingRecord('run_1', 'geometry', [{
      id: 'observation_1', imageBounds: [0, 0, 1, 1], sourceSha256: 'drawing-hash',
    }]);
    await store.finishRun('run_1', committed.history.model);

    expect((await store.readEvents('run_1')).map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(JSON.parse(await readFile(join(rootDir, 'run_1', 'manifest.json'), 'utf8'))).toMatchObject({ runId: 'run_1' });
    expect(JSON.parse(await readFile(join(rootDir, 'run_1', 'commits', 'c1.json'), 'utf8'))).toMatchObject({ id: 'c1' });
    expect(JSON.parse(await readFile(join(rootDir, 'run_1', 'drawing', 'geometry.json'), 'utf8')))
      .toEqual([{ id: 'observation_1', imageBounds: [0, 0, 1, 1], sourceSha256: 'drawing-hash' }]);
    expect(JSON.parse(await readFile(join(rootDir, 'run_1', 'final-model.json'), 'utf8')).entities).toHaveLength(1);
  });

  it('redacts nested secrets and media bodies while preserving hashes', () => {
    expect(redactAuditPayload({
      apiKey: 'secret',
      headers: { Authorization: 'Bearer secret' },
      imageBase64: 'large-body',
      sourceSha256: 'abc123',
    })).toEqual({
      apiKey: '[REDACTED]',
      headers: { Authorization: '[REDACTED]' },
      imageBase64: '[REDACTED]',
      sourceSha256: 'abc123',
    });
  });

  it('replays stored commits to the same final model', () => {
    const initial = createEmptyModel();
    const committed = commitPatch(createHistory(initial), {
      id: 'c1', runId: 'run_1', stepId: 's1', source: 'AI', timestamp: 4,
      patch: { operations: [{
        type: 'entity.add',
        entity: { id: 'p1', type: 'point', visible: true, x: 1, y: 2 },
      }] },
    });
    if (!committed.success) throw new Error('fixture commit failed');

    expect(replayCommits(initial, committed.history.commits)).toEqual(committed.history.model);
  });
});
