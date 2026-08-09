import sharp from 'sharp';

import type { DrawingDocument } from '../../../src/drawing/index.js';
import type { CvSourceGateway } from '../drawing-cv/tool-registry.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';
import {
  compareDrawingRegion,
  type RegionGeometryMetrics,
  type RegionResidualReport,
} from './residual-comparator.js';
import { renderDrawingRegion } from './source-renderer.js';

const DEFAULT_PAGE_WIDTH = 500;

export class SourceRasterFeedbackComparator {
  readonly #sources: CvSourceGateway;
  readonly #cache = new Map<string, Promise<{
    width: number;
    height: number;
    edges: Uint8Array;
  }>>();

  constructor(input: { sources: CvSourceGateway }) {
    this.#sources = input.sources;
  }

  async compare(
    document: DrawingDocument,
    previous: RegionGeometryMetrics | undefined,
    context: { sourceId: string; region?: SourcePixelRect },
  ): Promise<RegionResidualReport> {
    const source = await this.#sourceMask(context.sourceId);
    const scale = source.width / DEFAULT_PAGE_WIDTH;
    const region = clampRegion(
      context.region ?? { x: 0, y: 0, width: source.width, height: source.height },
      source,
    );
    const rendered = renderDrawingRegion(document, {
      region,
      documentToSource: [scale, 0, 0, -scale, 0, source.height],
      strokeWidthPixels: Math.max(1, Math.round(scale)),
    });
    return compareDrawingRegion({
      sourceEdges: cropMask(source.edges, source.width, region),
      rendered,
      region,
      tolerancePixels: Math.max(1, Math.ceil(scale)),
      ...(previous ? { previousGeometry: previous } : {}),
    });
  }

  #sourceMask(sourceId: string): Promise<{ width: number; height: number; edges: Uint8Array }> {
    const cached = this.#cache.get(sourceId);
    if (cached) return cached;
    const pending = this.#buildSourceMask(sourceId);
    this.#cache.set(sourceId, pending);
    return pending.catch((error) => {
      if (this.#cache.get(sourceId) === pending) this.#cache.delete(sourceId);
      throw error;
    });
  }

  async #buildSourceMask(sourceId: string) {
    const source = await this.#sources.read(sourceId);
    const { data, info } = await sharp(source.bytes)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const histogram = new Uint32Array(256);
    for (const value of data) histogram[value] += 1;
    const threshold = otsuThreshold(histogram, data.length);
    const edges = Uint8Array.from(data, (value) => value <= threshold ? 1 : 0);
    return { width: info.width, height: info.height, edges };
  }
}

function clampRegion(
  region: SourcePixelRect,
  source: { width: number; height: number },
): SourcePixelRect {
  const x = Math.max(0, Math.min(source.width - 1, Math.floor(region.x)));
  const y = Math.max(0, Math.min(source.height - 1, Math.floor(region.y)));
  const right = Math.max(x + 1, Math.min(source.width, Math.ceil(region.x + region.width)));
  const bottom = Math.max(y + 1, Math.min(source.height, Math.ceil(region.y + region.height)));
  return { x, y, width: right - x, height: bottom - y };
}

function cropMask(mask: Uint8Array, sourceWidth: number, region: SourcePixelRect): Uint8Array {
  const output = new Uint8Array(region.width * region.height);
  for (let row = 0; row < region.height; row += 1) {
    const start = (region.y + row) * sourceWidth + region.x;
    output.set(mask.subarray(start, start + region.width), row * region.width);
  }
  return output;
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
  let weightedSum = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    weightedSum += value * histogram[value];
  }
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 127;
  for (let value = 0; value < histogram.length; value += 1) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedSum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return Math.min(245, threshold);
}
