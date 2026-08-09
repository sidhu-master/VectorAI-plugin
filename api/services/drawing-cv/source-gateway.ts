import sharp from 'sharp';

import {
  LocalAttachmentPreparer,
  type DrawingAttachmentPreparer,
} from '../drawing-perception/attachments.js';
import type { SourceArtifactStore } from '../source-artifacts/types.js';
import type { CvSourceImage, SourcePixelSize } from './types.js';

export class StoredSourceCvGateway {
  readonly #sourceArtifacts: SourceArtifactStore;
  readonly #preparer: DrawingAttachmentPreparer;
  readonly #cache = new Map<string, Promise<CvSourceImage>>();
  readonly #sizes = new Map<string, SourcePixelSize>();

  constructor(input: {
    sourceArtifacts: SourceArtifactStore;
    preparer?: DrawingAttachmentPreparer;
  }) {
    this.#sourceArtifacts = input.sourceArtifacts;
    this.#preparer = input.preparer ?? new LocalAttachmentPreparer();
  }

  read(sourceId: string): Promise<CvSourceImage> {
    const cached = this.#cache.get(sourceId);
    if (cached) return cached.then(cloneSource);
    const pending = this.#load(sourceId);
    this.#cache.set(sourceId, pending);
    return pending.then(cloneSource).catch((error) => {
      if (this.#cache.get(sourceId) === pending) this.#cache.delete(sourceId);
      throw error;
    });
  }

  cachedSize(sourceId: string): SourcePixelSize {
    const size = this.#sizes.get(sourceId);
    if (!size) throw new Error('CV_SOURCE_SIZE_NOT_CACHED');
    return { ...size };
  }

  async size(sourceId: string): Promise<SourcePixelSize> {
    const cached = this.#sizes.get(sourceId);
    if (cached) return { ...cached };
    const source = await this.read(sourceId);
    return { width: source.width, height: source.height };
  }

  async #load(sourceId: string): Promise<CvSourceImage> {
    const stored = await this.#sourceArtifacts.read(sourceId);
    if (stored.metadata.sourceId !== sourceId) throw new Error('CV_SOURCE_ID_MISMATCH');
    const prepared = await this.#preparer.prepare({
      image: stored.bytes.toString('base64'),
      mimeType: stored.metadata.mimeType,
      signal: new AbortController().signal,
    });
    const bytes = Buffer.from(prepared.image, 'base64');
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error('CV_SOURCE_DIMENSIONS_MISSING');
    const source: CvSourceImage = {
      sourceId,
      mimeType: prepared.mimeType,
      bytes: Uint8Array.from(bytes),
      width: metadata.width,
      height: metadata.height,
    };
    this.#sizes.set(sourceId, { width: source.width, height: source.height });
    return source;
  }
}

function cloneSource(source: CvSourceImage): CvSourceImage {
  return { ...source, bytes: Uint8Array.from(source.bytes) };
}
