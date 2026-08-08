import { open, mkdir, readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { DrawingCommit } from '../../../src/drawing/index.js';
import {
  NodeAtomicJsonWriter,
  type AtomicJsonWriter,
} from '../drawing-application/file-drawing-repository.js';
import type {
  DrawingAgentAuditEvent,
  DrawingAgentAuditManifest,
  DrawingAgentAuditRun,
  DrawingAgentAuditStore,
} from './audit-types.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const DEFAULT_SECRET_FIELDS = ['apiKey', 'authorization', 'internalToken', 'sessionSecret'];

export class DrawingAgentAuditLoadError extends Error {
  readonly code = 'CORRUPT_DRAWING_AGENT_AUDIT';

  constructor(message: string) {
    super(message);
    this.name = 'DrawingAgentAuditLoadError';
  }
}

export class DrawingAgentAuditPayloadError extends Error {
  readonly code = 'MEDIA_BODY_FORBIDDEN';

  constructor(path: string) {
    super(`审计事件禁止包含媒体正文: ${path}`);
    this.name = 'DrawingAgentAuditPayloadError';
  }
}

export class FileDrawingAgentAuditStore implements DrawingAgentAuditStore {
  readonly #rootDirectory: string;
  readonly #writer: AtomicJsonWriter;
  readonly #secretFields: Set<string>;
  readonly #queues = new Map<string, Promise<void>>();
  readonly #manifests = new Map<string, DrawingAgentAuditManifest>();

  constructor(input: {
    rootDirectory: string;
    writer?: AtomicJsonWriter;
    secretFields?: string[];
  }) {
    this.#rootDirectory = input.rootDirectory;
    this.#writer = input.writer ?? new NodeAtomicJsonWriter();
    this.#secretFields = new Set(
      (input.secretFields ?? DEFAULT_SECRET_FIELDS).map(normalizeKey),
    );
  }

  async startRun(manifest: DrawingAgentAuditManifest): Promise<void> {
    validateManifest(manifest);
    const directory = this.#runDirectory(manifest.runId);
    await mkdir(join(directory, 'commits'), { recursive: true });
    await this.#writer.write(
      join(directory, 'manifest.json'),
      serialize(this.#sanitize(manifest)),
    );
    this.#manifests.set(manifest.runId, structuredClone(manifest));
  }

  updateManifest(manifest: DrawingAgentAuditManifest): Promise<void> {
    validateManifest(manifest);
    return this.#enqueue(manifest.runId, async () => {
      const current = await this.#manifest(manifest.runId);
      if (current.drawingId !== manifest.drawingId
        || current.baseRevision !== manifest.baseRevision) {
        throw new Error('审计 Manifest 的图纸或基础版本不可变');
      }
      await this.#writer.write(
        join(this.#runDirectory(manifest.runId), 'manifest.json'),
        serialize(this.#sanitize(manifest)),
      );
      this.#manifests.set(manifest.runId, structuredClone(manifest));
    });
  }

  appendEvent(event: DrawingAgentAuditEvent): Promise<void> {
    validateEvent(event);
    return this.#enqueue(event.runId, async () => {
      const sanitized = this.#sanitize(event);
      await this.#manifest(event.runId);
      const directory = this.#runDirectory(event.runId);
      await mkdir(directory, { recursive: true });
      const handle = await open(join(directory, 'events.jsonl'), 'a');
      try {
        await handle.writeFile(`${JSON.stringify(sanitized)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
  }

  saveCommit(runId: string, commit: DrawingCommit): Promise<void> {
    assertSafeId(commit.id, 'commitId');
    const sanitized = this.#sanitize(commit);
    return this.#enqueue(runId, async () => {
      const manifest = await this.#manifest(runId);
      if (commit.drawingId !== manifest.drawingId) {
        throw new Error('DrawingCommit 不属于审计任务的图纸');
      }
      const directory = join(this.#runDirectory(runId), 'commits');
      await mkdir(directory, { recursive: true });
      await this.#writer.write(join(directory, `${commit.id}.json`), serialize(sanitized));
    });
  }

  async readRun(runId: string): Promise<DrawingAgentAuditRun> {
    await this.#flush(runId);
    const manifest = await this.#readManifest(runId);
    const events = await this.#readEvents(runId);
    const commits = await this.#readCommits(runId, manifest);
    return { manifest, events, commits };
  }

  #sanitize<T>(value: T): T {
    return sanitize(value, this.#secretFields, '$') as T;
  }

  async #manifest(runId: string): Promise<DrawingAgentAuditManifest> {
    const cached = this.#manifests.get(runId);
    if (cached) return structuredClone(cached);
    const manifest = await this.#readManifest(runId);
    this.#manifests.set(runId, structuredClone(manifest));
    return manifest;
  }

  async #readManifest(runId: string): Promise<DrawingAgentAuditManifest> {
    const value = await readJson(
      join(this.#runDirectory(runId), 'manifest.json'),
      'Manifest',
    );
    try {
      validateManifest(value);
    } catch (error) {
      throw new DrawingAgentAuditLoadError(
        `Manifest 结构无效: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return structuredClone(value);
  }

  async #readEvents(runId: string): Promise<DrawingAgentAuditEvent[]> {
    let contents: string;
    try {
      contents = await readFile(join(this.#runDirectory(runId), 'events.jsonl'), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return contents.split('\n').filter(Boolean).map((line, index) => {
      let value: unknown;
      try {
        value = JSON.parse(line);
        validateEvent(value);
      } catch (error) {
        throw new DrawingAgentAuditLoadError(
          `events.jsonl 第 ${index + 1} 行无效: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (value.runId !== runId) {
        throw new DrawingAgentAuditLoadError(`events.jsonl 第 ${index + 1} 行 runId 不匹配`);
      }
      return value;
    });
  }

  async #readCommits(
    runId: string,
    manifest: DrawingAgentAuditManifest,
  ): Promise<DrawingCommit[]> {
    const directory = join(this.#runDirectory(runId), 'commits');
    let names: string[];
    try {
      names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return Promise.all(names.map(async (name) => {
      const value = await readJson(join(directory, name), `Commit ${name}`);
      if (!looksLikeCommit(value)
        || `${value.id}.json` !== basename(name)
        || value.drawingId !== manifest.drawingId) {
        throw new DrawingAgentAuditLoadError(`Commit ${name} 结构或引用无效`);
      }
      return structuredClone(value as unknown as DrawingCommit);
    }));
  }

  #runDirectory(runId: string): string {
    assertSafeId(runId, 'runId');
    return join(this.#rootDirectory, runId);
  }

  #enqueue(runId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.#queues.get(runId) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    this.#queues.set(runId, next.then(() => undefined, () => undefined));
    return next;
  }

  async #flush(runId: string): Promise<void> {
    await (this.#queues.get(runId) ?? Promise.resolve());
  }
}

function sanitize(value: unknown, secrets: Set<string>, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitize(item, secrets, `${path}[${index}]`));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const normalized = normalizeKey(key);
    const childPath = `${path}.${key}`;
    if (isMediaBody(normalized)) throw new DrawingAgentAuditPayloadError(childPath);
    if (secrets.has(normalized)) return [key, '[REDACTED]'];
    return [key, sanitize(item, secrets, childPath)];
  }));
}

function isMediaBody(key: string): boolean {
  const reference = key.includes('hash') || key.includes('sha256') || key.includes('reference');
  const bounds = key.endsWith('bounds');
  return !reference && !bounds && (
    key.includes('image') || key.includes('screenshot') || key.includes('pdfbody')
  );
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function validateManifest(value: unknown): asserts value is DrawingAgentAuditManifest {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.runId !== 'string'
    || typeof value.drawingId !== 'string'
    || typeof value.baseRevision !== 'string'
    || typeof value.startedAt !== 'number'
    || typeof value.drawingProtocolVersion !== 'string'
    || typeof value.commandSchemaVersion !== 'string'
    || typeof value.toolSchemaVersion !== 'string'
    || !isRecord(value.promptHashes)
    || typeof value.promptHashes.planner !== 'string'
    || typeof value.promptHashes.decision !== 'string'
    || !isRecord(value.modelProfile)
    || typeof value.modelProfile.planner !== 'string'
    || typeof value.modelProfile.decision !== 'string'
    || typeof value.modelProfile.repair !== 'string'
    || (value.goalSpec !== null && !isRecord(value.goalSpec))) {
    throw new Error('必需字段缺失或类型错误');
  }
  assertSafeId(value.runId, 'runId');
}

function validateEvent(value: unknown): asserts value is DrawingAgentAuditEvent {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.id !== 'string'
    || typeof value.runId !== 'string'
    || typeof value.type !== 'string'
    || typeof value.timestamp !== 'number'
    || !isRecord(value.payload)) {
    throw new Error('Audit Event 必需字段缺失或类型错误');
  }
  assertSafeId(value.id, 'eventId');
  assertSafeId(value.runId, 'runId');
}

function looksLikeCommit(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.drawingId === 'string'
    && typeof value.parentRevision === 'string'
    && typeof value.resultingRevision === 'string'
    && Array.isArray(value.commands)
    && isRecord(value.patch)
    && isRecord(value.inversePatch);
}

async function readJson(path: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new DrawingAgentAuditLoadError(
      `${label} 无法读取: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertSafeId(value: string, label: string): void {
  if (!SAFE_ID.test(value)) throw new Error(`${label} 包含非法字符`);
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
