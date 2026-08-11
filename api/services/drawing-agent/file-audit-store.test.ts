import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type DrawingCommit,
  type DrawingId,
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing';
import { DrawingApplication } from '../drawing-application/application';
import {
  DrawingAgentAuditLoadError,
  DrawingAgentAuditPayloadError,
  FileDrawingAgentAuditStore,
} from './file-audit-store';
import type { DrawingAgentAuditManifest } from './audit-types';

let rootDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-drawing-audit-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

describe('FileDrawingAgentAuditStore', () => {
  it('survives restart and preserves concurrent append invocation order', async () => {
    const store = new FileDrawingAgentAuditStore({ rootDirectory });
    await store.startRun(manifest());
    await Promise.all([
      store.appendEvent(event('event_1', 'instruction', 2, { instruction: '半径改为 10' })),
      store.appendEvent(event('event_2', 'plan', 3, { workflowNodeIds: ['inspect'] })),
      store.appendEvent(event('event_3', 'state', 4, { status: 'running' })),
    ]);
    const commit = await createCommit();
    await store.saveCommit('run_1', commit);

    const restarted = new FileDrawingAgentAuditStore({ rootDirectory });
    const loaded = await restarted.readRun('run_1');

    expect(loaded.manifest).toEqual(manifest());
    expect(loaded.events.map((item) => item.id)).toEqual(['event_1', 'event_2', 'event_3']);
    expect(loaded.commits).toEqual([commit]);
    expect(loaded.events[0].payload).toEqual({ instruction: '半径改为 10' });
  });

  it('atomically updates the manifest once the strict GoalSpec exists', async () => {
    const store = new FileDrawingAgentAuditStore({ rootDirectory });
    await store.startRun(manifest());
    const updated: DrawingAgentAuditManifest = {
      ...manifest(),
      goalSpec: {
        id: 'goal_1', objective: '创建圆', scope: { plane: 'geometry', limit: 20 },
        acceptanceCriteria: [{ type: 'document.valid' }],
        riskPolicy: { candidateAllowed: true, maxCommits: 2 },
      },
    };

    await store.updateManifest(updated);

    expect((await store.readRun('run_1')).manifest.goalSpec).toEqual(updated.goalSpec);
    expect(JSON.parse(await readFile(
      join(rootDirectory, 'run_1', 'manifest.json'), 'utf8',
    ))).toEqual(updated);
  });

  it('redacts configured secrets but rejects media bodies instead of persisting them', async () => {
    const store = new FileDrawingAgentAuditStore({
      rootDirectory,
      secretFields: ['apiKey', 'authorization', 'sessionSecret'],
    });
    await store.startRun(manifest());
    await store.appendEvent(event('event_secret', 'tool_call', 2, {
      apiKey: 'secret-key',
      headers: { authorization: 'Bearer secret', sessionSecret: 'secret-session' },
      sourceSha256: 'safe-hash',
      imageHandle: 'observation_view_1',
    }));

    const stored = (await store.readRun('run_1')).events[0];
    expect(stored.payload).toEqual({
      apiKey: '[REDACTED]',
      headers: { authorization: '[REDACTED]', sessionSecret: '[REDACTED]' },
      sourceSha256: 'safe-hash',
      imageHandle: 'observation_view_1',
    });
    await expect(store.appendEvent(event('event_media', 'tool_call', 3, {
      imageBase64: 'large-body',
    }))).rejects.toBeInstanceOf(DrawingAgentAuditPayloadError);
    expect((await store.readRun('run_1')).events).toHaveLength(1);
  });

  it('reports malformed audit files instead of silently skipping them', async () => {
    const store = new FileDrawingAgentAuditStore({ rootDirectory });
    await store.startRun(manifest());
    await writeFile(join(rootDirectory, 'run_1', 'events.jsonl'), '{bad json}\n', 'utf8');

    await expect(store.readRun('run_1')).rejects.toBeInstanceOf(DrawingAgentAuditLoadError);
  });

  it('stores DrawingCommit records by ID with no legacy spatial model fields', async () => {
    const store = new FileDrawingAgentAuditStore({ rootDirectory });
    await store.startRun(manifest());
    const commit = await createCommit();
    await store.appendEvent(event('event_commit', 'commit', 5, { commitId: commit.id }));
    await store.saveCommit('run_1', commit);

    const loaded = await store.readRun('run_1');
    const serialized = JSON.stringify(loaded);
    expect(loaded.events[0].payload.commitId).toBe(commit.id);
    expect(loaded.commits[0].id).toBe(commit.id);
    expect(serialized).not.toContain('SpatialModel');
    expect(serialized).not.toContain('SpatialCommit');
    expect(serialized).not.toContain('"entities"');
  });

  it('loads commits in revision-chain order instead of filename order', async () => {
    const store = new FileDrawingAgentAuditStore({ rootDirectory });
    await store.startRun(manifest());
    const commits = await createNonLexicalCommits();
    await Promise.all(commits.map((commit) => store.saveCommit('run_1', commit)));

    const restarted = new FileDrawingAgentAuditStore({ rootDirectory });

    expect((await restarted.readRun('run_1')).commits.map((commit) => commit.id)).toEqual([
      'commit_z',
      'commit_a',
    ]);
  });
});

function manifest(): DrawingAgentAuditManifest {
  return {
    schemaVersion: 1,
    runId: 'run_1',
    drawingId: 'drawing_1' as DrawingId,
    baseRevision: 'revision_1' as DrawingAgentAuditManifest['baseRevision'],
    startedAt: 1,
    drawingProtocolVersion: '1.0',
    commandSchemaVersion: '1.0.0',
    toolSchemaVersion: '1.0.0',
    promptHashes: { planner: 'planner-hash', decision: 'decision-hash' },
    modelProfile: {
      planner: 'doubao-seed-2.0-lite',
      decision: 'doubao-seed-2.0-lite',
      repair: 'doubao-seed-2.1-turbo',
    },
    goalSpec: null,
  };
}

function event(
  id: string,
  type: 'instruction' | 'plan' | 'tool_call' | 'commit' | 'state',
  timestamp: number,
  payload: Record<string, unknown>,
) {
  return { schemaVersion: 1 as const, id, runId: 'run_1', type, timestamp, payload };
}

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

async function createCommit(): Promise<DrawingCommit> {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 5 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const workspace = await application.create();
  const result = await application.execute({
    drawingId: workspace.document.id,
    transaction: {
      id: 'transaction_1', baseRevision: workspace.revision,
      actor: { type: 'AI', id: 'drawing-agent' }, goalId: 'goal_1',
      commands: [{
        type: 'geometry.create',
        value: {
          id: 'circle_1' as GeometryId,
          type: 'circle', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
          center: [0, 0], radius: 5,
        },
      }],
      preconditions: [], postconditions: [{ type: 'node.exists', nodeId: 'circle_1' }],
      evidenceRefs: [],
    },
  });
  if (result.status !== 'committed') throw new Error('expected commit');
  return result.commit;
}

async function createNonLexicalCommits(): Promise<DrawingCommit[]> {
  let sequence = 0;
  let commitSequence = 0;
  const idFactory: IdFactory = { next: (kind) => {
    if (kind === 'commit') return commitSequence++ === 0 ? 'commit_z' : 'commit_a';
    return `${kind}_${++sequence}`;
  } };
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 5 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const workspace = await application.create();
  const first = await application.execute({
    drawingId: workspace.document.id,
    transaction: {
      id: 'transaction_first', baseRevision: workspace.revision,
      actor: { type: 'AI', id: 'drawing-agent' },
      commands: [{
        type: 'geometry.create',
        value: {
          id: 'point_1' as GeometryId,
          type: 'point', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] }, x: 0, y: 0,
        },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    },
  });
  if (first.status !== 'committed') throw new Error('expected first commit');
  const second = await application.execute({
    drawingId: workspace.document.id,
    transaction: {
      id: 'transaction_second', baseRevision: first.revision,
      actor: { type: 'AI', id: 'drawing-agent' },
      commands: [{
        type: 'geometry.update', id: 'point_1' as GeometryId, changes: { x: 1 },
      }],
      preconditions: [], postconditions: [], evidenceRefs: [],
    },
  });
  if (second.status !== 'committed') throw new Error('expected second commit');
  return [first.commit, second.commit];
}
