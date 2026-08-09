import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DrawingFeedbackCheckpoint } from './loop-controller.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export interface DrawingFeedbackCheckpointStore {
  save(checkpoint: DrawingFeedbackCheckpoint): Promise<void>;
  read(runId: string): Promise<DrawingFeedbackCheckpoint | undefined>;
}

export class FileDrawingFeedbackCheckpointStore implements DrawingFeedbackCheckpointStore {
  constructor(private readonly input: { rootDirectory: string }) {}

  async save(checkpoint: DrawingFeedbackCheckpoint): Promise<void> {
    assertSafeRunId(checkpoint.runId);
    validateCheckpoint(checkpoint, checkpoint.runId);
    const directory = join(this.input.rootDirectory, checkpoint.runId);
    const target = join(directory, 'feedback-checkpoint.json');
    const temporary = join(directory, 'feedback-checkpoint.tmp');
    await mkdir(directory, { recursive: true });
    await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
    await rename(temporary, target);
  }

  async read(runId: string): Promise<DrawingFeedbackCheckpoint | undefined> {
    assertSafeRunId(runId);
    let raw: string;
    try {
      raw = await readFile(join(this.input.rootDirectory, runId, 'feedback-checkpoint.json'), 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('FEEDBACK_CHECKPOINT_CORRUPT');
    }
    validateCheckpoint(parsed, runId);
    return structuredClone(parsed);
  }
}

function assertSafeRunId(runId: string): void {
  if (!SAFE_ID.test(runId)) throw new Error('FEEDBACK_RUN_ID_INVALID');
}

function validateCheckpoint(
  value: unknown,
  expectedRunId: string,
): asserts value is DrawingFeedbackCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FEEDBACK_CHECKPOINT_CORRUPT');
  }
  const checkpoint = value as Partial<DrawingFeedbackCheckpoint>;
  if (checkpoint.schemaVersion !== 1
    || checkpoint.runId !== expectedRunId
    || typeof checkpoint.sourceId !== 'string'
    || typeof checkpoint.revision !== 'string'
    || !Number.isInteger(checkpoint.iteration)
    || !Array.isArray(checkpoint.recentReceipts)
    || !checkpoint.residual || typeof checkpoint.residual !== 'object'
    || !Number.isInteger(checkpoint.unresolvedRequired)
    || !checkpoint.nonImprovingBySlot || typeof checkpoint.nonImprovingBySlot !== 'object') {
    throw new Error('FEEDBACK_CHECKPOINT_CORRUPT');
  }
}
