import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileDrawingFeedbackCheckpointStore } from './checkpoint-store.js';
import type { DrawingFeedbackCheckpoint } from './loop-controller.js';

let rootDirectory: string;

beforeEach(async () => {
  rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-feedback-checkpoint-'));
});

afterEach(async () => {
  await rm(rootDirectory, { recursive: true, force: true });
});

describe('FileDrawingFeedbackCheckpointStore', () => {
  it('atomically saves and reloads a resumable checkpoint', async () => {
    const store = new FileDrawingFeedbackCheckpointStore({ rootDirectory });
    await store.save(checkpoint());

    await expect(store.read('run_1')).resolves.toEqual(checkpoint());
  });

  it('rejects unsafe run IDs and corrupt checkpoint scope', async () => {
    const store = new FileDrawingFeedbackCheckpointStore({ rootDirectory });
    await expect(store.read('../escape')).rejects.toThrow('FEEDBACK_RUN_ID_INVALID');
    await expect(store.save({ ...checkpoint(), runId: '../escape' })).rejects.toThrow(
      'FEEDBACK_RUN_ID_INVALID',
    );
  });
});

function checkpoint(): DrawingFeedbackCheckpoint {
  return {
    schemaVersion: 1,
    runId: 'run_1',
    sourceId: 'source_1',
    revision: 'revision_1' as DrawingFeedbackCheckpoint['revision'],
    iteration: 2,
    recentReceipts: [{ capability: 'inspect_source_overview' }],
    residual: {
      geometry: {
        edgePrecision: 0.8, edgeRecall: 0.7, edgeF1: 0.746,
        fitP50: 1, fitP95: 3, fitMax: 5,
      },
      topologyFailures: [], associationMismatches: [],
      residualRegions: [{ x: 1, y: 2, width: 3, height: 4 }],
      improved: true,
    },
    unresolvedRequired: 1,
    nonImprovingBySlot: { slot_1: 1 },
  };
}
