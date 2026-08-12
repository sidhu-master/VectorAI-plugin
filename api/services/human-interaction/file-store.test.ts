import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  HumanDecisionRequest,
  HumanDecisionResponse,
  PermissionGrant,
} from '../../../src/contracts/drawing-agent';
import type { AtomicJsonWriter } from '../drawing-application/file-drawing-repository';
import { FileHumanInteractionStore } from './file-store';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('FileHumanInteractionStore', () => {
  it('persists a pending request atomically and recovers it after restart', async () => {
    const rootDirectory = await temporaryRoot();
    const store = new FileHumanInteractionStore({ rootDirectory, now: () => 10 });

    await store.appendRequest('run_1', request());

    expect(await store.getPending('run_1')).toEqual(request());
    const restarted = new FileHumanInteractionStore({ rootDirectory, now: () => 20 });
    expect(await restarted.getPending('run_1')).toEqual(request());
    expect(JSON.parse(await readFile(
      join(rootDirectory, 'run_1', 'human-interactions.json'), 'utf8',
    ))).toEqual({
      schemaVersion: 1,
      runId: 'run_1',
      records: [{ request: request(), grants: [], createdAt: 10 }],
    });
  });

  it('resolves exactly one pending request and returns its persisted grants', async () => {
    const rootDirectory = await temporaryRoot();
    const store = new FileHumanInteractionStore({ rootDirectory, now: () => 10 });
    await store.appendRequest('run_1', request());
    const response = decisionResponse();

    const resolved = await store.resolveRequest('run_1', response, [grant()]);

    expect(resolved).toEqual({
      request: request(), response, grants: [grant()], createdAt: 10, resolvedAt: 10,
    });
    expect(await store.getPending('run_1')).toBeNull();
    expect(await store.list('run_1')).toEqual([resolved]);
    await expect(store.resolveRequest('run_1', response, [grant()]))
      .rejects.toThrow('HUMAN_DECISION_ALREADY_RESOLVED');
  });

  it('serializes concurrent requests without losing either record', async () => {
    const rootDirectory = await temporaryRoot();
    const store = new FileHumanInteractionStore({ rootDirectory, now: () => 10 });
    const second = { ...request(), id: 'request_2' };

    await Promise.all([
      store.appendRequest('run_1', request()),
      store.appendRequest('run_1', second),
    ]);

    expect(await store.list('run_1')).toHaveLength(2);
    expect((await store.list('run_1')).map((record) => record.request.id)).toEqual([
      'request_1', 'request_2',
    ]);
  });

  it('keeps the last durable state when an atomic write fails', async () => {
    const rootDirectory = await temporaryRoot();
    const healthy = new FileHumanInteractionStore({ rootDirectory, now: () => 10 });
    await healthy.appendRequest('run_1', request());
    const writer: AtomicJsonWriter = { write: vi.fn(async () => { throw new Error('write failed'); }) };
    const failing = new FileHumanInteractionStore({ rootDirectory, now: () => 20, writer });

    await expect(failing.resolveRequest('run_1', decisionResponse(), [grant()]))
      .rejects.toThrow('write failed');

    const recovered = new FileHumanInteractionStore({ rootDirectory, now: () => 30 });
    expect(await recovered.getPending('run_1')).toEqual(request());
    expect((await recovered.list('run_1'))[0].response).toBeUndefined();
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-human-interaction-'));
  roots.push(root);
  return root;
}

function request(): HumanDecisionRequest {
  return {
    id: 'request_1', episodeId: 'episode_1', revision: 'revision_1' as never,
    candidateId: 'candidate_1', transactionDigest: 'a'.repeat(64),
    kind: 'grant-permission', question: '允许解除这个约束吗？',
    reason: '候选事务需要删除一个已有约束',
    options: [{
      id: 'allow', label: '仅允许本次',
      effect: {
        type: 'permission', decision: 'allow',
        actions: ['constraint.delete'], resourceIds: ['constraint_1'],
      },
    }],
    recommendedOptionId: 'allow',
    affectedResources: [{
      plane: 'relation', ids: ['constraint_1'], action: 'constraint.delete',
    }],
    previewHandle: 'preview_1', expiresWhenRevisionChanges: true,
  };
}

function decisionResponse(): HumanDecisionResponse {
  return { requestId: 'request_1', selectedOptionId: 'allow', decidedAt: 10 };
}

function grant(): PermissionGrant {
  return {
    id: 'grant_1', requestId: 'request_1', episodeId: 'episode_1',
    revision: 'revision_1' as never, transactionDigest: 'a'.repeat(64),
    actions: ['constraint.delete'], resourceIds: ['constraint_1'],
    effect: 'allow', scope: 'candidate',
  };
}
