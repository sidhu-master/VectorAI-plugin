import { join } from 'node:path';

import {
  NodeAtomicJsonWriter,
  type AtomicJsonWriter,
} from '../drawing-application/file-drawing-repository.js';
import {
  parseHumanDecisionRequest,
  parseHumanDecisionResponse,
  parsePermissionGrant,
  type HumanDecisionRequest,
  type HumanDecisionResponse,
  type PermissionGrant,
} from '../../../src/contracts/drawing-agent.js';
import type {
  HumanInteractionRecord,
  HumanInteractionStore,
} from './types.js';
import { mkdir, readFile } from 'node:fs/promises';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

interface HumanInteractionFile {
  schemaVersion: 1;
  runId: string;
  records: HumanInteractionRecord[];
}

export class FileHumanInteractionStore implements HumanInteractionStore {
  readonly #rootDirectory: string;
  readonly #writer: AtomicJsonWriter;
  readonly #now: () => number;
  readonly #queues = new Map<string, Promise<void>>();

  constructor(input: {
    rootDirectory: string;
    writer?: AtomicJsonWriter;
    now?: () => number;
  }) {
    this.#rootDirectory = input.rootDirectory;
    this.#writer = input.writer ?? new NodeAtomicJsonWriter();
    this.#now = input.now ?? Date.now;
  }

  appendRequest(runId: string, request: HumanDecisionRequest): Promise<void> {
    const parsed = parseHumanDecisionRequest(request);
    return this.#enqueue(runId, async () => {
      const file = await this.#read(runId);
      if (file.records.some((record) => record.request.id === parsed.id)) {
        throw new Error('HUMAN_DECISION_REQUEST_ALREADY_EXISTS');
      }
      file.records.push({
        request: parsed,
        grants: [],
        createdAt: this.#now(),
      });
      await this.#write(file);
    });
  }

  async resolveRequest(
    runId: string,
    response: HumanDecisionResponse,
    grants: PermissionGrant[],
  ): Promise<HumanInteractionRecord> {
    const parsedResponse = parseHumanDecisionResponse(response);
    const parsedGrants = grants.map(parsePermissionGrant);
    let resolved: HumanInteractionRecord | undefined;
    await this.#enqueue(runId, async () => {
      const file = await this.#read(runId);
      const index = file.records.findIndex((record) => (
        record.request.id === parsedResponse.requestId
      ));
      if (index < 0) throw new Error('HUMAN_DECISION_REQUEST_NOT_FOUND');
      const current = file.records[index];
      if (current.response) throw new Error('HUMAN_DECISION_ALREADY_RESOLVED');
      if (!current.request.options.some((option) => option.id === parsedResponse.selectedOptionId)) {
        throw new Error('HUMAN_DECISION_OPTION_NOT_FOUND');
      }
      if (parsedGrants.some((grant) => (
        grant.requestId !== current.request.id
        || grant.episodeId !== current.request.episodeId
        || grant.revision !== current.request.revision
        || (current.request.transactionDigest !== undefined
          && grant.transactionDigest !== current.request.transactionDigest)
      ))) {
        throw new Error('HUMAN_DECISION_GRANT_SCOPE_MISMATCH');
      }
      resolved = {
        request: structuredClone(current.request),
        response: parsedResponse,
        grants: parsedGrants,
        createdAt: current.createdAt,
        resolvedAt: this.#now(),
      };
      file.records[index] = structuredClone(resolved);
      await this.#write(file);
    });
    return structuredClone(resolved!);
  }

  async getPending(runId: string): Promise<HumanDecisionRequest | null> {
    await this.#flush(runId);
    const pending = (await this.#read(runId)).records.find((record) => !record.response);
    return pending ? structuredClone(pending.request) : null;
  }

  async list(runId: string): Promise<HumanInteractionRecord[]> {
    await this.#flush(runId);
    return structuredClone((await this.#read(runId)).records);
  }

  async #read(runId: string): Promise<HumanInteractionFile> {
    const path = this.#path(runId);
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { schemaVersion: 1, runId, records: [] };
      }
      throw new Error('HUMAN_INTERACTION_STORE_CORRUPT');
    }
    return validateFile(value, runId);
  }

  async #write(file: HumanInteractionFile): Promise<void> {
    const path = this.#path(file.runId);
    await mkdir(join(this.#rootDirectory, file.runId), { recursive: true });
    await this.#writer.write(path, `${JSON.stringify(file, null, 2)}\n`);
  }

  #path(runId: string): string {
    assertSafeId(runId);
    return join(this.#rootDirectory, runId, 'human-interactions.json');
  }

  #enqueue(runId: string, operation: () => Promise<void>): Promise<void> {
    assertSafeId(runId);
    const previous = this.#queues.get(runId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    this.#queues.set(runId, current.then(() => undefined, () => undefined));
    return current;
  }

  async #flush(runId: string): Promise<void> {
    assertSafeId(runId);
    await (this.#queues.get(runId) ?? Promise.resolve());
  }
}

function validateFile(value: unknown, runId: string): HumanInteractionFile {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || value.runId !== runId
    || !Array.isArray(value.records)) {
    throw new Error('HUMAN_INTERACTION_STORE_CORRUPT');
  }
  const records = value.records.map((record): HumanInteractionRecord => {
    if (!isRecord(record)
      || typeof record.createdAt !== 'number'
      || !Number.isFinite(record.createdAt)
      || !Array.isArray(record.grants)) {
      throw new Error('HUMAN_INTERACTION_STORE_CORRUPT');
    }
    try {
      const request = parseHumanDecisionRequest(record.request);
      const response = record.response === undefined
        ? undefined
        : parseHumanDecisionResponse(record.response);
      const grants = record.grants.map(parsePermissionGrant);
      const resolvedAt = record.resolvedAt === undefined ? undefined : Number(record.resolvedAt);
      if ((response === undefined) !== (resolvedAt === undefined)
        || (resolvedAt !== undefined && !Number.isFinite(resolvedAt))) {
        throw new Error('resolution mismatch');
      }
      return {
        request,
        ...(response === undefined ? {} : { response }),
        grants,
        createdAt: record.createdAt,
        ...(resolvedAt === undefined ? {} : { resolvedAt }),
      };
    } catch {
      throw new Error('HUMAN_INTERACTION_STORE_CORRUPT');
    }
  });
  if (new Set(records.map((record) => record.request.id)).size !== records.length) {
    throw new Error('HUMAN_INTERACTION_STORE_CORRUPT');
  }
  return { schemaVersion: 1, runId, records };
}

function assertSafeId(runId: string): void {
  if (!SAFE_ID.test(runId)) throw new Error('HUMAN_INTERACTION_RUN_ID_INVALID');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
