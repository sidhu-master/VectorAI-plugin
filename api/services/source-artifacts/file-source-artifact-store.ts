import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  SOURCE_MIME_TYPES,
  type SourceArtifactMimeType,
  type SourceArtifactReference,
  type SourceArtifactStore,
  type StoredSourceArtifact,
} from './types.js';

export class FileSourceArtifactStore implements SourceArtifactStore {
  private readonly rootDirectory: string;
  private readonly maxBytes: number;

  constructor(options: { rootDirectory: string; maxBytes?: number }) {
    this.rootDirectory = options.rootDirectory;
    this.maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  }

  async put(input: {
    data: string;
    mimeType: string;
    page?: number;
  }): Promise<SourceArtifactReference> {
    if (!SOURCE_MIME_TYPES.includes(input.mimeType as SourceArtifactMimeType)) {
      throw new Error(`SOURCE_MIME_UNSUPPORTED: ${input.mimeType}`);
    }
    const bytes = Buffer.from(input.data, 'base64');
    if (bytes.byteLength === 0) throw new Error('SOURCE_EMPTY');
    if (bytes.byteLength > this.maxBytes) throw new Error(`SOURCE_TOO_LARGE: ${bytes.byteLength}`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const sourceId = `source_${sha256.slice(0, 24)}`;
    const metadata: SourceArtifactReference = {
      sourceId, sha256, mimeType: input.mimeType as SourceArtifactMimeType,
      byteLength: bytes.byteLength, page: input.page ?? 1,
    };
    const directory = join(this.rootDirectory, sourceId);
    await mkdir(directory, { recursive: true });
    await Promise.all([
      writeFile(join(directory, 'source.bin'), bytes),
      writeFile(join(directory, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    ]);
    return metadata;
  }

  async read(sourceId: string): Promise<StoredSourceArtifact> {
    if (!/^source_[a-f0-9]{24}$/.test(sourceId)) throw new Error('SOURCE_ID_INVALID');
    const directory = join(this.rootDirectory, sourceId);
    const [rawMetadata, bytes] = await Promise.all([
      readFile(join(directory, 'metadata.json'), 'utf8'),
      readFile(join(directory, 'source.bin')),
    ]);
    return {
      metadata: JSON.parse(rawMetadata) as SourceArtifactReference,
      bytes,
    };
  }
}
