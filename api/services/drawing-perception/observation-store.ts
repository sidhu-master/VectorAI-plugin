import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const FORBIDDEN_KEYS = [
  'image', 'base64', 'prompt', 'token', 'credential', 'apikey', 'password', 'secret',
];

export interface DrawingObservationStore {
  save(runId: string, name: string, value: unknown): Promise<void>;
}

export class FileDrawingObservationStore implements DrawingObservationStore {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly rootDir: string) {}

  async save(runId: string, name: string, value: unknown): Promise<void> {
    assertSafeId(runId, 'runId');
    assertSafeId(name, 'record name');
    assertNoSensitivePayload(value);
    const snapshot = structuredClone(value);
    await this.enqueue(runId, async () => {
      const directory = join(this.rootDir, runId, 'drawing');
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, `${name}.json`),
        `${JSON.stringify(snapshot, null, 2)}\n`,
        'utf8',
      );
    });
  }

  async read<T = unknown>(runId: string, name: string): Promise<T> {
    assertSafeId(runId, 'runId');
    assertSafeId(name, 'record name');
    await (this.queues.get(runId) ?? Promise.resolve());
    return JSON.parse(await readFile(
      join(this.rootDir, runId, 'drawing', `${name}.json`),
      'utf8',
    )) as T;
  }

  private enqueue(runId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(runId) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    this.queues.set(runId, next);
    return next;
  }
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) throw new Error(`${label} 包含非法字符`);
}

function assertNoSensitivePayload(value: unknown, path = 'record'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitivePayload(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_KEYS.some((forbidden) => normalized === forbidden
      || normalized.startsWith(forbidden) && forbidden !== 'image')) {
      throw new Error(`${path}.${key} 包含 media 或敏感数据`);
    }
    assertNoSensitivePayload(child, `${path}.${key}`);
  }
}
