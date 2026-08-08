import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LocalAttachmentPreparer,
  throwIfAborted,
} from '../agent-runtime/attachments.js';
import type {
  AgentAttachmentPreparer,
  PreparedAgentAttachment,
} from '../agent-runtime/types.js';
import type { NormalizedImageBounds } from './types.js';

export interface DrawingAssetReference {
  assetId: string;
  kind: 'page' | 'crop';
  mimeType: string;
  sha256: string;
  byteLength: number;
  page?: number;
  sourceAssetId?: string;
  bounds?: NormalizedImageBounds;
}

export interface DrawingImageCropper {
  crop(input: PreparedAgentAttachment & {
    bounds: NormalizedImageBounds;
    signal: AbortSignal;
  }): Promise<PreparedAgentAttachment>;
}

export interface DrawingAssetCacheOptions {
  preparer?: AgentAttachmentPreparer;
  cropper?: DrawingImageCropper;
  maxBytes?: number;
  maxAssets?: number;
}

interface StoredAsset {
  runId: string;
  reference: DrawingAssetReference;
  attachment: PreparedAgentAttachment;
}

export class DrawingAssetCache {
  private readonly preparer: AgentAttachmentPreparer;
  private readonly cropper: DrawingImageCropper;
  private readonly maxBytes: number;
  private readonly maxAssets: number;
  private readonly assets = new Map<string, StoredAsset>();
  private readonly pageIndex = new Map<string, string>();
  private readonly cropIndex = new Map<string, string>();
  private totalBytes = 0;

  constructor(options: DrawingAssetCacheOptions = {}) {
    this.preparer = options.preparer ?? new LocalAttachmentPreparer();
    this.cropper = options.cropper ?? new SipsImageCropper();
    this.maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    this.maxAssets = options.maxAssets ?? 128;
  }

  async putPage(input: {
    runId: string;
    page: number;
    image: string;
    mimeType: string;
    signal: AbortSignal;
  }): Promise<DrawingAssetReference> {
    throwIfAborted(input.signal);
    const indexKey = `${input.runId}:page:${input.page}`;
    const existingId = this.pageIndex.get(indexKey);
    if (existingId) return this.require(input.runId, existingId).reference;

    const attachment = await this.preparer.prepare(input);
    throwIfAborted(input.signal);
    const stored = this.store(input.runId, attachment, {
      kind: 'page',
      page: input.page,
    });
    this.pageIndex.set(indexKey, stored.reference.assetId);
    return stored.reference;
  }

  async crop(input: {
    runId: string;
    assetId: string;
    bounds: NormalizedImageBounds;
    signal: AbortSignal;
  }): Promise<DrawingAssetReference> {
    throwIfAborted(input.signal);
    assertBounds(input.bounds);
    const source = this.require(input.runId, input.assetId);
    const indexKey = `${input.runId}:${input.assetId}:${input.bounds.join(',')}`;
    const existingId = this.cropIndex.get(indexKey);
    if (existingId) return this.require(input.runId, existingId).reference;

    const attachment = await this.cropper.crop({
      ...source.attachment,
      bounds: input.bounds,
      signal: input.signal,
    });
    throwIfAborted(input.signal);
    const stored = this.store(input.runId, attachment, {
      kind: 'crop',
      sourceAssetId: input.assetId,
      bounds: [...input.bounds],
    });
    this.cropIndex.set(indexKey, stored.reference.assetId);
    return stored.reference;
  }

  async read(runId: string, assetId: string): Promise<PreparedAgentAttachment> {
    const attachment = this.require(runId, assetId).attachment;
    return { ...attachment };
  }

  metadata(runId: string): DrawingAssetReference[] {
    return [...this.assets.values()]
      .filter((asset) => asset.runId === runId)
      .map((asset) => structuredClone(asset.reference));
  }

  releaseRun(runId: string): number {
    let released = 0;
    for (const [key, asset] of this.assets) {
      if (asset.runId !== runId) continue;
      this.totalBytes -= asset.reference.byteLength;
      this.assets.delete(key);
      released += 1;
    }
    for (const [key] of this.pageIndex) if (key.startsWith(`${runId}:`)) this.pageIndex.delete(key);
    for (const [key] of this.cropIndex) if (key.startsWith(`${runId}:`)) this.cropIndex.delete(key);
    return released;
  }

  private store(
    runId: string,
    attachment: PreparedAgentAttachment,
    metadata: Omit<DrawingAssetReference, 'assetId' | 'mimeType' | 'sha256' | 'byteLength'>,
  ): StoredAsset {
    const bytes = Buffer.from(attachment.image, 'base64');
    if (this.assets.size + 1 > this.maxAssets || this.totalBytes + bytes.byteLength > this.maxBytes) {
      throw new Error('Drawing asset limit exceeded');
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const identityHash = createHash('sha256')
      .update(bytes)
      .update(JSON.stringify(metadata))
      .digest('hex');
    const assetId = `asset_${metadata.kind}_${identityHash.slice(0, 20)}`;
    const reference: DrawingAssetReference = Object.freeze({
      assetId,
      mimeType: attachment.mimeType,
      sha256,
      byteLength: bytes.byteLength,
      ...metadata,
    });
    const stored = { runId, reference, attachment: { ...attachment } };
    this.assets.set(`${runId}:${assetId}`, stored);
    this.totalBytes += bytes.byteLength;
    return stored;
  }

  private require(runId: string, assetId: string): StoredAsset {
    const asset = this.assets.get(`${runId}:${assetId}`);
    if (!asset) throw new Error(`Drawing asset "${assetId}" 不存在`);
    return asset;
  }
}

export class SipsImageCropper implements DrawingImageCropper {
  constructor(private readonly command = process.env.SIPS_PATH || 'sips') {}

  async crop(input: PreparedAgentAttachment & {
    bounds: NormalizedImageBounds;
    signal: AbortSignal;
  }): Promise<PreparedAgentAttachment> {
    throwIfAborted(input.signal);
    const directory = await mkdtemp(join(tmpdir(), 'vectorai-crop-'));
    const sourcePath = join(directory, input.mimeType === 'image/jpeg' ? 'source.jpg' : 'source.png');
    const outputPath = join(directory, 'crop.png');
    try {
      await writeFile(sourcePath, Buffer.from(input.image, 'base64'));
      const dimensions = await runCommand(this.command, [
        '--getProperty', 'pixelWidth', '--getProperty', 'pixelHeight', sourcePath,
      ], input.signal);
      const width = readSipsDimension(dimensions, 'pixelWidth');
      const height = readSipsDimension(dimensions, 'pixelHeight');
      const cropWidth = Math.max(1, Math.round(width * input.bounds[2]));
      const cropHeight = Math.max(1, Math.round(height * input.bounds[3]));
      const offsetX = Math.max(0, Math.round(width * input.bounds[0]));
      const offsetY = Math.max(0, Math.round(height * input.bounds[1]));
      await runCommand(this.command, [
        '--cropToHeightWidth', String(cropHeight), String(cropWidth),
        '--cropOffset', String(offsetY), String(offsetX),
        '--setProperty', 'format', 'png', sourcePath, '--out', outputPath,
      ], input.signal);
      return { image: (await readFile(outputPath)).toString('base64'), mimeType: 'image/png' };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

function assertBounds(bounds: NormalizedImageBounds): void {
  const [x, y, width, height] = bounds;
  if (bounds.length !== 4 || !bounds.every(Number.isFinite)
    || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
    throw new Error('crop bounds 必须位于 0-1 范围内');
  }
}

function runCommand(command: string, args: string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { signal, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

function readSipsDimension(output: string, property: string): number {
  const match = output.match(new RegExp(`${property}:\\s*(\\d+)`));
  const value = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`无法读取图片 ${property}`);
  return value;
}
