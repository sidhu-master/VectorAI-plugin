import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SpatialCommit } from '../../../src/core/history/types.js';
import type { SpatialModel } from '../../../src/core/types.js';
import { redactAuditPayload } from './redact.js';
import type { AuditEvent, AuditRunManifest, AuditStore } from './types.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export class FileAuditStore implements AuditStore {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly rootDir: string) {}

  async startRun(manifest: AuditRunManifest): Promise<void> {
    const directory = this.runDirectory(manifest.runId);
    await mkdir(join(directory, 'commits'), { recursive: true });
    await writeJson(join(directory, 'manifest.json'), redactAuditPayload(manifest));
  }

  appendEvent(event: AuditEvent): Promise<void> {
    const directory = this.runDirectory(event.runId);
    return this.enqueue(event.runId, async () => {
      await mkdir(directory, { recursive: true });
      await appendFile(join(directory, 'events.jsonl'), `${JSON.stringify(redactAuditPayload(event))}\n`, 'utf8');
    });
  }

  async saveCommit(commit: SpatialCommit): Promise<void> {
    assertSafeId(commit.id, 'commitId');
    const directory = join(this.runDirectory(commit.runId), 'commits');
    await mkdir(directory, { recursive: true });
    await writeJson(join(directory, `${commit.id}.json`), redactAuditPayload(commit));
  }

  async finishRun(runId: string, model: SpatialModel): Promise<void> {
    await this.flush(runId);
    await writeJson(join(this.runDirectory(runId), 'final-model.json'), model);
  }

  async readEvents(runId: string): Promise<AuditEvent[]> {
    await this.flush(runId);
    try {
      const contents = await readFile(join(this.runDirectory(runId), 'events.jsonl'), 'utf8');
      return contents.split('\n').filter(Boolean).map((line) => JSON.parse(line) as AuditEvent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private runDirectory(runId: string): string {
    assertSafeId(runId, 'runId');
    return join(this.rootDir, runId);
  }

  private enqueue(runId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(runId) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    this.queues.set(runId, next);
    return next;
  }

  private async flush(runId: string): Promise<void> {
    await (this.queues.get(runId) ?? Promise.resolve());
  }
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) throw new Error(`${label} 包含非法字符`);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
