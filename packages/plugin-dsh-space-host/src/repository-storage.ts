// SPDX-License-Identifier: Apache-2.0

import { drawingWorkspaceSnapshotSchema } from '@vectorai/plugin-space-contracts';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import type { DrawingEntry, DrawingRepositoryStorage } from './repository';

interface StoredDrawing {
  version: 1;
  attachmentId: string;
  bounds: DrawingEntry['bounds'];
  snapshot: ReturnType<typeof snapshotForStorage>;
}

export class FileDrawingRepositoryStorage implements DrawingRepositoryStorage {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }

  load(sessionId: string): DrawingEntry | null {
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
      bounds: structuredClone(entry.bounds),
      snapshot: snapshotForStorage(entry),
    };
    try {
      writeFileSync(temporary, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
      renameSync(temporary, path);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }

  #path(sessionId: string): string {
    const key = createHash('sha256').update(sessionId).digest('hex');
    return join(this.#directory, `${key}.json`);
  }
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
