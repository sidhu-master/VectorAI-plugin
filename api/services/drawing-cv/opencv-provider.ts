import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import sharp from 'sharp';

import type {
  CvEvidenceDraft,
  CvOverview,
  CvPrimitiveFit,
  CvPrimitiveType,
  CvSourceImage,
  DrawingCvProvider,
  SourcePixelPoint,
  SourcePixelRect,
} from './types.js';
import type {
  CvWorkerEvidence,
  CvWorkerMessage,
  CvWorkerRequest,
  CvWorkerValue,
} from './worker-protocol.js';

export class DrawingCvError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = 'DrawingCvError';
  }
}

export class OpenCvWorkerProvider implements DrawingCvProvider {
  readonly #worker: Worker;
  readonly #pending = new Map<string, {
    resolve: (value: CvWorkerValue) => void;
    reject: (error: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
    removeAbortListener: () => void;
  }>();
  #closed = false;

  private constructor(worker: Worker) {
    this.#worker = worker;
    worker.on('message', (message: CvWorkerMessage) => this.#onMessage(message));
    worker.on('error', (error) => this.#failAll(error));
    worker.on('exit', (code) => {
      if (!this.#closed && code !== 0) this.#failAll(new DrawingCvError('CV_WORKER_EXITED'));
    });
  }

  static async create(options: { workerCount: number }): Promise<OpenCvWorkerProvider> {
    if (options.workerCount !== 1) throw new DrawingCvError('CV_WORKER_COUNT_UNSUPPORTED');
    const worker = new Worker(new URL('./opencv-worker.ts', import.meta.url), {
      execArgv: ['--import', 'tsx'],
    });
    await waitForReady(worker);
    return new OpenCvWorkerProvider(worker);
  }

  async inspectOverview(input: {
    source: CvSourceImage;
    budget: Parameters<DrawingCvProvider['inspectOverview']>[0]['budget'];
    signal: AbortSignal;
  }): Promise<CvOverview> {
    assertSource(input.source);
    if (!Number.isInteger(input.budget.maxPixels) || input.budget.maxPixels < 1) {
      throw new DrawingCvError('CV_BUDGET_EXCEEDED');
    }
    const decoded = await decodeOverview(input.source, input.budget.maxPixels);
    const value = await this.#invoke({
      id: randomUUID(),
      operation: 'overview',
      rgba: decoded.rgba,
      width: decoded.width,
      height: decoded.height,
      origin: [0, 0],
      budget: input.budget,
    }, input.signal);
    const overview = value as CvOverview;
    const scaleX = input.source.width / decoded.width;
    const scaleY = input.source.height / decoded.height;
    return {
      width: input.source.width,
      height: input.source.height,
      componentCount: overview.componentCount,
      ...(overview.foregroundBounds ? {
        foregroundBounds: {
          x: overview.foregroundBounds.x * scaleX,
          y: overview.foregroundBounds.y * scaleY,
          width: overview.foregroundBounds.width * scaleX,
          height: overview.foregroundBounds.height * scaleY,
        },
      } : {}),
    };
  }

  async extractEvidence(input: {
    source: CvSourceImage;
    regionId: string;
    region: SourcePixelRect;
    budget: Parameters<DrawingCvProvider['extractEvidence']>[0]['budget'];
    signal: AbortSignal;
  }): Promise<CvEvidenceDraft[]> {
    assertSource(input.source);
    assertRegion(input.region, input.source);
    assertPixelBudget(input.region.width, input.region.height, input.budget.maxPixels);
    const decoded = await decode(input.source, input.region);
    const value = await this.#invoke({
      id: randomUUID(),
      operation: 'extract',
      rgba: decoded.rgba,
      width: decoded.width,
      height: decoded.height,
      origin: [input.region.x, input.region.y],
      budget: input.budget,
    }, input.signal) as CvWorkerEvidence[];
    return value.map((item) => ({
      sourceId: input.source.sourceId,
      regionId: input.regionId,
      kind: item.kind,
      bounds: { ...item.bounds },
      confidence: item.confidence,
      touchesRegionEdge: item.touchesRegionEdge,
      samples: item.samples.map((point) => [...point] as SourcePixelPoint),
    }));
  }

  async fitPrimitive(input: {
    primitiveType: CvPrimitiveType;
    samples: readonly SourcePixelPoint[];
    budget: Parameters<DrawingCvProvider['fitPrimitive']>[0]['budget'];
    signal: AbortSignal;
  }): Promise<CvPrimitiveFit> {
    if (input.samples.length < 1 || input.samples.length > input.budget.maxSamplesPerResult) {
      throw new DrawingCvError('CV_BUDGET_EXCEEDED');
    }
    const packed = new Float64Array(input.samples.length * 2);
    input.samples.forEach((point, index) => {
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
        throw new DrawingCvError('CV_SAMPLES_INVALID');
      }
      packed[index * 2] = point[0];
      packed[index * 2 + 1] = point[1];
    });
    return await this.#invoke({
      id: randomUUID(),
      operation: 'fit',
      samples: packed.buffer,
      primitiveType: input.primitiveType,
      budget: input.budget,
    }, input.signal) as CvPrimitiveFit;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#failAll(new DrawingCvError('CV_PROVIDER_CLOSED'));
    await this.#worker.terminate();
  }

  #invoke(request: CvWorkerRequest, signal: AbortSignal): Promise<CvWorkerValue> {
    if (this.#closed) return Promise.reject(new DrawingCvError('CV_PROVIDER_CLOSED'));
    if (signal.aborted) return Promise.reject(signal.reason ?? new DrawingCvError('CV_ABORTED'));
    return new Promise((resolve, reject) => {
      const abort = () => this.#reject(request.id, signal.reason ?? new DrawingCvError('CV_ABORTED'));
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => {
        this.#reject(request.id, new DrawingCvError('CV_TOOL_TIMEOUT'));
      }, request.budget.timeoutMs);
      this.#pending.set(request.id, {
        resolve,
        reject,
        timer,
        removeAbortListener: () => signal.removeEventListener('abort', abort),
      });
      const transferable = request.operation === 'fit' ? request.samples : request.rgba;
      this.#worker.postMessage(request, [transferable]);
    });
  }

  #onMessage(message: CvWorkerMessage): void {
    if (message.type === 'ready') return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);
    pending.removeAbortListener();
    if (message.ok === true) pending.resolve(message.value);
    else pending.reject(new DrawingCvError(message.code, message.message));
  }

  #reject(id: string, error: unknown): void {
    const pending = this.#pending.get(id);
    if (!pending) return;
    this.#pending.delete(id);
    clearTimeout(pending.timer);
    pending.removeAbortListener();
    pending.reject(error);
  }

  #failAll(error: unknown): void {
    for (const id of [...this.#pending.keys()]) this.#reject(id, error);
  }
}

async function waitForReady(worker: Worker): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DrawingCvError('CV_WORKER_INIT_TIMEOUT')), 15_000);
    const onMessage = (message: CvWorkerMessage) => {
      if (message.type !== 'ready') return;
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      worker.off('message', onMessage);
      worker.off('error', onError);
    };
    worker.on('message', onMessage);
    worker.on('error', onError);
  });
}

async function decode(source: CvSourceImage, region?: SourcePixelRect) {
  let operation = sharp(source.bytes).ensureAlpha();
  if (region) {
    operation = operation.extract({
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height,
    });
  }
  const { data, info } = await operation.raw().toBuffer({ resolveWithObject: true });
  const copy = Uint8Array.from(data);
  return { rgba: copy.buffer, width: info.width, height: info.height };
}

async function decodeOverview(source: CvSourceImage, maxPixels: number) {
  const factor = Math.min(1, Math.sqrt(maxPixels / (source.width * source.height)));
  const width = Math.max(1, Math.floor(source.width * factor));
  const height = Math.max(1, Math.floor(source.height * factor));
  const { data, info } = await sharp(source.bytes)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const copy = Uint8Array.from(data);
  return { rgba: copy.buffer, width: info.width, height: info.height };
}

function assertSource(source: CvSourceImage): void {
  if (!Number.isInteger(source.width) || source.width < 1
    || !Number.isInteger(source.height) || source.height < 1
    || source.bytes.byteLength === 0) {
    throw new DrawingCvError('CV_SOURCE_INVALID');
  }
}

function assertRegion(region: SourcePixelRect, source: CvSourceImage): void {
  if (![region.x, region.y, region.width, region.height].every(Number.isInteger)
    || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1
    || region.x + region.width > source.width || region.y + region.height > source.height) {
    throw new DrawingCvError('CV_REGION_OUT_OF_BOUNDS');
  }
}

function assertPixelBudget(width: number, height: number, maxPixels: number): void {
  if (!Number.isInteger(maxPixels) || maxPixels < 1 || width * height > maxPixels) {
    throw new DrawingCvError('CV_BUDGET_EXCEEDED');
  }
}
