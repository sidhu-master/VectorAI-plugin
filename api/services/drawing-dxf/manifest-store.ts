import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  NodeAtomicJsonWriter,
  type AtomicJsonWriter,
} from '../drawing-application/file-drawing-repository.js';
import type { DxfManifest } from './types.js';

const SAFE_SOURCE_ID = /^source_[a-f0-9]{24}$/;

export interface StoredDxfManifest {
  schemaVersion: '1.0';
  sourceId: string;
  createdAt: number;
  manifest: DxfManifest;
}

export interface DxfManifestStore {
  write(input: { sourceId: string; manifest: DxfManifest }): Promise<StoredDxfManifest>;
  read(sourceId: string): Promise<StoredDxfManifest>;
}

export class FileDxfManifestStore implements DxfManifestStore {
  readonly #rootDirectory: string;
  readonly #writer: AtomicJsonWriter;
  readonly #now: () => number;

  constructor(input: {
    rootDirectory: string;
    writer?: AtomicJsonWriter;
    now?: () => number;
  }) {
    this.#rootDirectory = input.rootDirectory;
    this.#writer = input.writer ?? new NodeAtomicJsonWriter();
    this.#now = input.now ?? Date.now;
  }

  async write(input: { sourceId: string; manifest: DxfManifest }): Promise<StoredDxfManifest> {
    assertSourceId(input.sourceId);
    const stored: StoredDxfManifest = {
      schemaVersion: '1.0',
      sourceId: input.sourceId,
      createdAt: this.#now(),
      manifest: structuredClone(input.manifest),
    };
    const directory = join(this.#rootDirectory, input.sourceId);
    await mkdir(directory, { recursive: true });
    await this.#writer.write(join(directory, 'manifest.json'), JSON.stringify(stored));
    return structuredClone(stored);
  }

  async read(sourceId: string): Promise<StoredDxfManifest> {
    assertSourceId(sourceId);
    const raw = await readFile(join(this.#rootDirectory, sourceId, 'manifest.json'), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredManifest(parsed) || parsed.sourceId !== sourceId) {
      throw new Error('DXF_MANIFEST_CORRUPT');
    }
    return structuredClone(parsed);
  }
}

function assertSourceId(sourceId: string): void {
  if (!SAFE_SOURCE_ID.test(sourceId)) throw new Error('DXF_SOURCE_ID_INVALID');
}

function isStoredManifest(value: unknown): value is StoredDxfManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const manifest = record.manifest;
  return record.schemaVersion === '1.0'
    && typeof record.sourceId === 'string'
    && typeof record.createdAt === 'number'
    && Boolean(manifest && typeof manifest === 'object'
      && (manifest as Record<string, unknown>).format === 'ascii-dxf');
}
