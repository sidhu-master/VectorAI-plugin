// SPDX-License-Identifier: Apache-2.0

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

export interface CleanLinePrimitiveCandidate {
  type: 'line' | 'circle' | 'arc' | 'ellipse';
  parameters: Record<string, unknown>;
  fitErrorMean: number;
  fitErrorP95: number;
  fitErrorMax: number;
  confidence: number;
}

export interface CleanLineStrokePiece {
  id: string;
  sampleRange: [number, number];
  wraps: boolean;
  closed: boolean;
  simplified: Array<[number, number]>;
  bounds: { x: number; y: number; width: number; height: number };
  candidate: CleanLinePrimitiveCandidate | null;
}

export interface CleanLineStrokeChain {
  id: string;
  closed: boolean;
  samples: Array<[number, number]>;
  simplified: Array<[number, number]>;
  bounds: { x: number; y: number; width: number; height: number };
  pieces: CleanLineStrokePiece[];
  segmentation: {
    algorithmVersion: string;
    fitTolerancePx: number;
    [key: string]: unknown;
  };
}

export interface CleanLineVectorizationResult {
  sourceId: string;
  pipelineVersion: string;
  width: number;
  height: number;
  analysisScale: number;
  medianLineWidthPx: number;
  chains: CleanLineStrokeChain[];
}

export interface VectorizerHealth {
  protocolVersion: string;
  pipelineVersion: string;
  pythonVersion: string;
  dependencies: {
    numpy: string;
    'opencv-python-headless': string;
    'scikit-image': string;
  };
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: unknown): void;
  timer: ReturnType<typeof setTimeout>;
  removeAbort(): void;
}

export class LocalVectorizerProcess {
  readonly #pending = new Map<string, PendingRequest>();
  #closed = false;
  #stderr = '';
  health!: VectorizerHealth;

  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly timeoutMs: number,
  ) {
    createInterface({ input: child.stdout }).on('line', (line) => this.#onLine(line));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { this.#stderr = `${this.#stderr}${chunk}`.slice(-4_096); });
    child.on('error', () => this.#failAll(new Error('PYTHON_VECTORIZATION_PROCESS_ERROR')));
    child.on('exit', () => {
      if (!this.#closed) this.#failAll(new Error(`PYTHON_VECTORIZATION_EXITED ${this.#stderr}`.trim()));
    });
  }

  static async create(input: {
    executablePath: string;
    args?: string[];
    timeoutMs: number;
    expected: { protocolVersion: string; pipelineVersion: string };
  }): Promise<LocalVectorizerProcess> {
    const child = spawn(input.executablePath, input.args ?? [], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const provider = new LocalVectorizerProcess(child, input.timeoutMs);
    try {
      provider.health = parseHealth(await provider.#invoke(
        { operation: 'health' },
        new AbortController().signal,
      ));
      if (provider.health.protocolVersion !== input.expected.protocolVersion) {
        throw new Error('VECTORAI_VECTORIZER_PROTOCOL_MISMATCH');
      }
      if (provider.health.pipelineVersion !== input.expected.pipelineVersion) {
        throw new Error('VECTORAI_VECTORIZER_PIPELINE_MISMATCH');
      }
      return provider;
    } catch (error) {
      await provider.close();
      throw error;
    }
  }

  async vectorize(input: {
    sourceId: string;
    mimeType: string;
    bytes: Uint8Array;
    width: number;
    height: number;
    maxPixels: number;
    signal: AbortSignal;
  }): Promise<CleanLineVectorizationResult> {
    if (input.bytes.byteLength === 0 || input.width < 1 || input.height < 1 || input.maxPixels < 1) {
      throw new Error('PYTHON_VECTORIZATION_SOURCE_INVALID');
    }
    const value = await this.#invoke({
      operation: 'vectorize', sourceId: input.sourceId, mimeType: input.mimeType,
      imageBase64: Buffer.from(input.bytes).toString('base64'), maxPixels: input.maxPixels,
    }, input.signal);
    return parseResult(value, input.sourceId);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#failAll(new Error('PYTHON_VECTORIZATION_CLOSED'));
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { this.child.kill('SIGKILL'); resolve(); }, 1_000);
      this.child.once('exit', () => { clearTimeout(timer); resolve(); });
      this.child.kill('SIGTERM');
    });
  }

  #invoke(payload: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    if (this.#closed) return Promise.reject(new Error('PYTHON_VECTORIZATION_CLOSED'));
    signal.throwIfAborted();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const abort = () => this.#reject(id, signal.reason ?? new Error('PYTHON_VECTORIZATION_ABORTED'));
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => this.#reject(id, new Error('PYTHON_VECTORIZATION_TIMEOUT')), this.timeoutMs);
      this.#pending.set(id, {
        resolve, reject, timer, removeAbort: () => signal.removeEventListener('abort', abort),
      });
      this.child.stdin.write(`${JSON.stringify({ id, ...payload })}\n`, (error) => {
        if (error) this.#reject(id, new Error('PYTHON_VECTORIZATION_WRITE_FAILED'));
      });
    });
  }

  #onLine(line: string): void {
    let response: { id?: unknown; ok?: unknown; value?: unknown; code?: unknown };
    try { response = JSON.parse(line) as typeof response; } catch {
      this.#failAll(new Error('PYTHON_VECTORIZATION_PROTOCOL_INVALID'));
      return;
    }
    if (typeof response.id !== 'string') return;
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    clearTimeout(pending.timer);
    pending.removeAbort();
    if (response.ok === true) pending.resolve(response.value);
    else pending.reject(new Error(typeof response.code === 'string' ? response.code : 'PYTHON_VECTORIZATION_FAILED'));
  }

  #reject(id: string, error: unknown): void {
    const pending = this.#pending.get(id);
    if (!pending) return;
    this.#pending.delete(id);
    clearTimeout(pending.timer);
    pending.removeAbort();
    pending.reject(error);
  }

  #failAll(error: unknown): void {
    for (const id of [...this.#pending.keys()]) this.#reject(id, error);
  }
}

/** @deprecated Use LocalVectorizerProcess. */
export const LocalPythonVectorizerProcess = LocalVectorizerProcess;

function parseHealth(value: unknown): VectorizerHealth {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('VECTORAI_VECTORIZER_HEALTH_INVALID');
  }
  const health = value as Record<string, unknown>;
  const dependencies = health.dependencies;
  if (
    typeof health.protocolVersion !== 'string'
    || typeof health.pipelineVersion !== 'string'
    || typeof health.pythonVersion !== 'string'
    || !dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)
  ) throw new Error('VECTORAI_VECTORIZER_HEALTH_INVALID');
  const versions = dependencies as Record<string, unknown>;
  for (const name of ['numpy', 'opencv-python-headless', 'scikit-image']) {
    if (typeof versions[name] !== 'string' || versions[name] === '') {
      throw new Error('VECTORAI_VECTORIZER_HEALTH_INVALID');
    }
  }
  return structuredClone(value) as VectorizerHealth;
}

function parseResult(value: unknown, sourceId: string): CleanLineVectorizationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PYTHON_VECTORIZATION_RESULT_INVALID');
  const result = value as Record<string, unknown>;
  if (
    result.sourceId !== sourceId || typeof result.pipelineVersion !== 'string'
    || !positiveInteger(result.width) || !positiveInteger(result.height)
    || !positive(result.analysisScale) || !positive(result.medianLineWidthPx)
    || !Array.isArray(result.chains)
  ) throw new Error('PYTHON_VECTORIZATION_RESULT_INVALID');
  for (const chain of result.chains) {
    if (!chain || typeof chain !== 'object' || Array.isArray(chain)) throw new Error('PYTHON_VECTORIZATION_CHAIN_INVALID');
    const record = chain as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.closed !== 'boolean'
      || !Array.isArray(record.simplified) || !Array.isArray(record.pieces)
      || !record.segmentation || typeof record.segmentation !== 'object') {
      throw new Error('PYTHON_VECTORIZATION_CHAIN_INVALID');
    }
  }
  return structuredClone(result) as unknown as CleanLineVectorizationResult;
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function positiveInteger(value: unknown): value is number {
  return positive(value) && Number.isInteger(value);
}
