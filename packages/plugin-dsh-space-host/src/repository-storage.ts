// SPDX-License-Identifier: Apache-2.0

import { drawingWorkspaceSnapshotSchema } from '@vectorai/plugin-space-contracts';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { DrawingEntry, DrawingRepositoryStorage } from './repository';
import type { DrawingDurableState, DurableDrawingRepositoryStorage } from './durable-envelope';

interface StoredDrawing {
  version: 1;
  attachmentId: string;
  dxfProjectionVersion?: number;
  bounds: DrawingEntry['bounds'];
  snapshot: ReturnType<typeof snapshotForStorage>;
}

interface StoredDurableDrawing {
  version: 2;
  entry: {
    attachmentId: string;
    dxfProjectionVersion?: number;
    bounds: DrawingEntry['bounds'];
    snapshot: ReturnType<typeof snapshotForStorage>;
  };
  commits: DrawingDurableState['commits'];
  operations: DrawingDurableState['operations'];
}

export class FileDrawingRepositoryStorage implements DrawingRepositoryStorage, DurableDrawingRepositoryStorage {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }

  load(sessionId: string): DrawingEntry | null {
    const durable = this.loadDurable(sessionId);
    if (durable) return durable.entry;
    const path = this.#path(sessionId);
    if (!existsSync(path)) return null;
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredDrawing>;
      if (value.version !== 1 || typeof value.attachmentId !== 'string' || !bounds(value.bounds)) {
        return null;
      }
      const snapshot = drawingWorkspaceSnapshotSchema.parse(value.snapshot);
      if (snapshot === null || snapshot.source === undefined) return null;
      return {
        attachmentId: value.attachmentId,
        ...(typeof value.dxfProjectionVersion === 'number'
          ? { dxfProjectionVersion: value.dxfProjectionVersion }
          : {}),
        document: snapshot.document as unknown as DrawingEntry['document'],
        drawingId: snapshot.ref.drawingId,
        bounds: value.bounds,
        revision: snapshot.ref.revision,
        source: snapshot.source,
        provisional: snapshot.provisional ?? false,
      };
    } catch {
      return null;
    }
  }

  save(sessionId: string, entry: DrawingEntry): void {
    const path = this.#path(sessionId);
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const value: StoredDrawing = {
      version: 1,
      attachmentId: entry.attachmentId,
      ...(entry.dxfProjectionVersion === undefined
        ? {}
        : { dxfProjectionVersion: entry.dxfProjectionVersion }),
      bounds: structuredClone(entry.bounds),
      snapshot: snapshotForStorage(entry),
    };
    try {
      this.#atomicWrite(path, temporary, value);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }

  loadDurable(sessionId: string): DrawingDurableState | null {
    const path = this.#path(sessionId);
    if (!existsSync(path)) return null;
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredDurableDrawing>;
      if (value.version !== 2 || !value.entry || !Array.isArray(value.commits) || !Array.isArray(value.operations)) {
        return null;
      }
      const entry = entryFromStored(value.entry);
      if (!entry) return null;
      return {
        version: 2,
        entry,
        commits: structuredClone(value.commits),
        operations: structuredClone(value.operations),
      };
    } catch {
      return null;
    }
  }

  saveDurable(sessionId: string, state: DrawingDurableState): void {
    const path = this.#path(sessionId);
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const value: StoredDurableDrawing = {
      version: 2,
      entry: {
        attachmentId: state.entry.attachmentId,
        ...(state.entry.dxfProjectionVersion === undefined
          ? {}
          : { dxfProjectionVersion: state.entry.dxfProjectionVersion }),
        bounds: structuredClone(state.entry.bounds),
        snapshot: snapshotForStorage(state.entry),
      },
      commits: structuredClone(state.commits),
      operations: structuredClone(state.operations),
    };
    try {
      this.#atomicWrite(path, temporary, value);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }

  #atomicWrite(path: string, temporary: string, value: StoredDrawing | StoredDurableDrawing): void {
    writeFileSync(temporary, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
    const file = openSync(temporary, 'r');
    try {
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    renameSync(temporary, path);
    const directory = openSync(this.#directory, 'r');
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }

  #path(sessionId: string): string {
    const key = createHash('sha256').update(sessionId).digest('hex');
    return join(this.#directory, `${key}.json`);
  }
}

function entryFromStored(value: {
  attachmentId?: unknown;
  dxfProjectionVersion?: unknown;
  bounds?: unknown;
  snapshot?: unknown;
}): DrawingEntry | null {
  if (typeof value.attachmentId !== 'string' || !bounds(value.bounds)) return null;
  const snapshot = drawingWorkspaceSnapshotSchema.safeParse(value.snapshot);
  if (!snapshot.success || snapshot.data.source === undefined) return null;
  return {
    attachmentId: value.attachmentId,
    ...(typeof value.dxfProjectionVersion === 'number'
      ? { dxfProjectionVersion: value.dxfProjectionVersion }
      : {}),
    document: snapshot.data.document as unknown as DrawingEntry['document'],
    drawingId: snapshot.data.ref.drawingId,
    bounds: value.bounds,
    revision: snapshot.data.ref.revision,
    source: snapshot.data.source,
    provisional: snapshot.data.provisional ?? false,
  };
}

function snapshotForStorage(entry: DrawingEntry) {
  return {
    version: 1 as const,
    ref: { drawingId: entry.drawingId, revision: entry.revision },
    document: structuredClone(entry.document),
    source: structuredClone(entry.source),
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: true,
    },
    provisional: entry.provisional,
  };
}

function bounds(value: unknown): value is DrawingEntry['bounds'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return ['minX', 'minY', 'maxX', 'maxY'].every((key) => (
    typeof candidate[key] === 'number' && Number.isFinite(candidate[key])
  ));
}
