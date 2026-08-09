import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

import type { CvSourceImage, SourcePixelRect } from './types.js';

export interface CvCropSummary {
  mediaHandle: string;
  sourceId: string;
  regionId: string;
  mimeType: 'image/png';
  width: number;
  height: number;
  sourceBounds: SourcePixelRect;
}

export interface CvCropArtifact extends CvCropSummary {
  bytes: Uint8Array;
}

export class FileCvCropStore {
  readonly #rootDirectory: string;

  constructor(input: { rootDirectory: string }) {
    this.#rootDirectory = input.rootDirectory;
  }

  async create(input: {
    source: CvSourceImage;
    regionId: string;
    bounds: SourcePixelRect;
    maxPixels: number;
  }): Promise<CvCropSummary> {
    assertCreateInput(input);
    const factor = Math.min(1, Math.sqrt(input.maxPixels / area(input.bounds)));
    const width = Math.max(1, Math.floor(input.bounds.width * factor));
    const height = Math.max(1, Math.floor(input.bounds.height * factor));
    const bytes = await sharp(input.source.bytes)
      .extract({
        left: input.bounds.x,
        top: input.bounds.y,
        width: input.bounds.width,
        height: input.bounds.height,
      })
      .resize(width, height, { fit: 'fill' })
      .png()
      .toBuffer();
    const mediaHandle = `crop_${createHash('sha256')
      .update(input.source.sourceId)
      .update('\0')
      .update(input.regionId)
      .update('\0')
      .update(JSON.stringify(input.bounds))
      .digest('hex')
      .slice(0, 24)}`;
    const summary: CvCropSummary = {
      mediaHandle,
      sourceId: input.source.sourceId,
      regionId: input.regionId,
      mimeType: 'image/png',
      width,
      height,
      sourceBounds: { ...input.bounds },
    };
    await mkdir(this.#rootDirectory, { recursive: true });
    const nonce = randomUUID();
    const pendingImage = join(this.#rootDirectory, `.${mediaHandle}.${nonce}.png`);
    const pendingMetadata = join(this.#rootDirectory, `.${mediaHandle}.${nonce}.json`);
    await Promise.all([
      writeFile(pendingImage, bytes),
      writeFile(pendingMetadata, JSON.stringify(summary)),
    ]);
    await Promise.all([
      rename(pendingImage, this.#imagePath(mediaHandle)),
      rename(pendingMetadata, this.#metadataPath(mediaHandle)),
    ]);
    return structuredClone(summary);
  }

  async read(mediaHandle: string): Promise<CvCropArtifact> {
    assertMediaHandle(mediaHandle);
    const [metadata, bytes] = await Promise.all([
      readFile(this.#metadataPath(mediaHandle), 'utf8'),
      readFile(this.#imagePath(mediaHandle)),
    ]);
    const summary = JSON.parse(metadata) as CvCropSummary;
    if (summary.mediaHandle !== mediaHandle || summary.mimeType !== 'image/png') {
      throw new Error('CV_CROP_METADATA_INVALID');
    }
    return { ...structuredClone(summary), bytes: Uint8Array.from(bytes) };
  }

  #imagePath(mediaHandle: string): string {
    return join(this.#rootDirectory, `${mediaHandle}.png`);
  }

  #metadataPath(mediaHandle: string): string {
    return join(this.#rootDirectory, `${mediaHandle}.json`);
  }
}

function assertCreateInput(input: {
  source: CvSourceImage;
  regionId: string;
  bounds: SourcePixelRect;
  maxPixels: number;
}): void {
  const { x, y, width, height } = input.bounds;
  if (!/^[A-Za-z0-9_-]+$/.test(input.source.sourceId)
    || !/^[A-Za-z0-9_-]+$/.test(input.regionId)
    || ![x, y, width, height].every(Number.isInteger)
    || x < 0 || y < 0 || width < 1 || height < 1
    || x + width > input.source.width || y + height > input.source.height
    || !Number.isSafeInteger(input.maxPixels) || input.maxPixels < 1) {
    throw new Error('CV_CROP_INPUT_INVALID');
  }
}

function assertMediaHandle(mediaHandle: string): void {
  if (!/^crop_[a-f0-9]{24}$/.test(mediaHandle)) throw new Error('CV_CROP_HANDLE_INVALID');
}

function area(bounds: SourcePixelRect): number {
  return bounds.width * bounds.height;
}
