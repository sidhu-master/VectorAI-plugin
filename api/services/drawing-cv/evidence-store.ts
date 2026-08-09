import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  CvEvidenceDraft,
  CvEvidencePage,
  CvEvidenceStore,
  CvEvidenceSummary,
  SourcePixelPoint,
  SourcePixelSize,
} from './types.js';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const EVIDENCE_HANDLE = /^evidence_[a-f0-9]{24}$/;
const MAX_PAGE_SIZE = 1_000;

export class FileCvEvidenceStore implements CvEvidenceStore {
  readonly #rootDirectory: string;
  readonly #resolveSourceSize: (sourceId: string) => Promise<SourcePixelSize>;

  constructor(options: {
    rootDirectory: string;
    resolveSourceSize: (sourceId: string) => Promise<SourcePixelSize>;
  }) {
    this.#rootDirectory = options.rootDirectory;
    this.#resolveSourceSize = options.resolveSourceSize;
  }

  async putEvidence(draft: CvEvidenceDraft): Promise<CvEvidenceSummary> {
    assertSafeId(draft.sourceId, 'CV_SOURCE_ID_INVALID');
    assertSafeId(draft.regionId, 'CV_REGION_ID_INVALID');
    const sourceSize = await this.#resolveSourceSize(draft.sourceId);
    assertDraft(draft, sourceSize);
    const sampleBytes = encodeSamples(draft.samples);
    const canonical = canonicalMetadata(draft, draft.samples.length);
    const handle = `evidence_${createHash('sha256')
      .update(canonical)
      .update(sampleBytes)
      .digest('hex')
      .slice(0, 24)}`;
    const summary: CvEvidenceSummary = {
      handle,
      sourceId: draft.sourceId,
      regionId: draft.regionId,
      kind: draft.kind,
      bounds: { ...draft.bounds },
      confidence: draft.confidence,
      touchesRegionEdge: draft.touchesRegionEdge,
      sampleCount: draft.samples.length,
    };
    const directory = join(this.#rootDirectory, draft.sourceId);
    await mkdir(directory, { recursive: true });
    await Promise.all([
      writeIfAbsent(join(directory, `${handle}.json`), Buffer.from(`${JSON.stringify(summary, null, 2)}\n`)),
      writeIfAbsent(join(directory, `${handle}.bin`), sampleBytes),
    ]);
    return summary;
  }

  async readSummary(handle: string): Promise<CvEvidenceSummary> {
    assertHandle(handle);
    const file = await this.#findMetadata(handle);
    const summary = JSON.parse(await readFile(file, 'utf8')) as CvEvidenceSummary;
    if (summary.handle !== handle) throw new Error('CV_EVIDENCE_HANDLE_MISMATCH');
    return summary;
  }

  async readSamples(
    handle: string,
    page: { offset: number; limit: number },
  ): Promise<CvEvidencePage> {
    assertHandle(handle);
    if (!Number.isInteger(page.offset) || page.offset < 0) throw new Error('CV_PAGE_OFFSET_INVALID');
    if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > MAX_PAGE_SIZE) {
      throw new Error('CV_PAGE_LIMIT_INVALID');
    }
    const summary = await this.readSummary(handle);
    const bytes = await readFile(join(this.#rootDirectory, summary.sourceId, `${handle}.bin`));
    if (bytes.byteLength !== summary.sampleCount * 16) throw new Error('CV_EVIDENCE_SAMPLE_SIZE_MISMATCH');
    const end = Math.min(summary.sampleCount, page.offset + page.limit);
    const items: SourcePixelPoint[] = [];
    for (let index = page.offset; index < end; index += 1) {
      items.push([bytes.readDoubleLE(index * 16), bytes.readDoubleLE(index * 16 + 8)]);
    }
    return {
      items,
      ...(end < summary.sampleCount ? { nextOffset: end } : {}),
      total: summary.sampleCount,
    };
  }

  async #findMetadata(handle: string): Promise<string> {
    const sourceDirectories = await readdir(this.#rootDirectory, { withFileTypes: true })
      .catch(() => []);
    for (const entry of sourceDirectories) {
      if (!entry.isDirectory()) continue;
      const path = join(this.#rootDirectory, entry.name, `${handle}.json`);
      try {
        await readFile(path, 'utf8');
        return path;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
    throw new Error('CV_EVIDENCE_NOT_FOUND');
  }
}

function assertDraft(draft: CvEvidenceDraft, sourceSize: SourcePixelSize): void {
  const { x, y, width, height } = draft.bounds;
  if (![x, y, width, height].every(Number.isFinite)
    || x < 0 || y < 0 || width <= 0 || height <= 0
    || x + width > sourceSize.width || y + height > sourceSize.height) {
    throw new Error('CV_REGION_OUT_OF_BOUNDS');
  }
  if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1) {
    throw new Error('CV_CONFIDENCE_INVALID');
  }
  for (const point of draft.samples) {
    if (point.length !== 2 || !point.every(Number.isFinite)
      || point[0] < 0 || point[1] < 0
      || point[0] > sourceSize.width || point[1] > sourceSize.height) {
      throw new Error('CV_SAMPLE_OUT_OF_BOUNDS');
    }
  }
}

function canonicalMetadata(draft: CvEvidenceDraft, sampleCount: number): string {
  return JSON.stringify({
    sourceId: draft.sourceId,
    regionId: draft.regionId,
    kind: draft.kind,
    bounds: draft.bounds,
    confidence: draft.confidence,
    touchesRegionEdge: draft.touchesRegionEdge,
    sampleCount,
  });
}

function encodeSamples(samples: readonly SourcePixelPoint[]): Buffer {
  const bytes = Buffer.allocUnsafe(samples.length * 16);
  samples.forEach(([x, y], index) => {
    bytes.writeDoubleLE(x, index * 16);
    bytes.writeDoubleLE(y, index * 16 + 8);
  });
  return bytes;
}

async function writeIfAbsent(path: string, bytes: Buffer): Promise<void> {
  try {
    await writeFile(path, bytes, { flag: 'wx' });
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
}

function assertSafeId(value: string, code: string): void {
  if (!SAFE_ID.test(value)) throw new Error(code);
}

function assertHandle(handle: string): void {
  if (!EVIDENCE_HANDLE.test(handle)) throw new Error('CV_EVIDENCE_HANDLE_INVALID');
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST');
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
