import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

import type {
  CleanLineVectorizationProvider,
  CleanLineVectorizationResult,
} from './types.js';

interface PythonResponse {
  id: string | null;
  ok: boolean;
  value?: unknown;
  code?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  removeAbortListener: () => void;
}

export class PythonVectorizationError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = 'PythonVectorizationError';
  }
}

export class PythonVectorizationProvider implements CleanLineVectorizationProvider {
  readonly #process: ChildProcessWithoutNullStreams;
  readonly #timeoutMs: number;
  readonly #pending = new Map<string, PendingRequest>();
  #closed = false;
  #stderr = '';

  private constructor(process: ChildProcessWithoutNullStreams, timeoutMs: number) {
    this.#process = process;
    this.#timeoutMs = timeoutMs;
    createInterface({ input: process.stdout }).on('line', (line) => this.#onLine(line));
    process.stderr.setEncoding('utf8');
    process.stderr.on('data', (chunk: string) => {
      this.#stderr = `${this.#stderr}${chunk}`.slice(-4_096);
    });
    process.on('error', () => this.#failAll(new PythonVectorizationError('PYTHON_VECTORIZATION_PROCESS_ERROR')));
    process.on('exit', () => {
      if (!this.#closed) {
        this.#failAll(new PythonVectorizationError('PYTHON_VECTORIZATION_EXITED'));
      }
    });
  }

  static async create(options: {
    pythonPath?: string;
    scriptPath?: string;
    timeoutMs?: number;
  } = {}): Promise<PythonVectorizationProvider> {
    const pythonPath = options.pythonPath ?? await defaultPythonPath();
    const scriptPath = options.scriptPath ?? resolve(process.cwd(), 'python/vectorai_vectorizer.py');
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new PythonVectorizationError('PYTHON_VECTORIZATION_TIMEOUT_INVALID');
    }
    const child = spawn(pythonPath, ['-u', scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const provider = new PythonVectorizationProvider(child, timeoutMs);
    try {
      await provider.#invoke({ operation: 'health' }, new AbortController().signal);
      return provider;
    } catch (error) {
      await provider.close();
      throw error;
    }
  }

  async vectorize(input: Parameters<CleanLineVectorizationProvider['vectorize']>[0]) {
    if (!Number.isInteger(input.maxPixels) || input.maxPixels < 1) {
      throw new PythonVectorizationError('PYTHON_VECTORIZATION_BUDGET_INVALID');
    }
    if (input.source.bytes.byteLength === 0 || input.source.width < 1 || input.source.height < 1) {
      throw new PythonVectorizationError('PYTHON_VECTORIZATION_SOURCE_INVALID');
    }
    const value = await this.#invoke({
      operation: 'vectorize',
      sourceId: input.source.sourceId,
      mimeType: input.source.mimeType,
      imageBase64: Buffer.from(input.source.bytes).toString('base64'),
      maxPixels: input.maxPixels,
    }, input.signal);
    return parseVectorizationResult(value, input.source.sourceId);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#failAll(new PythonVectorizationError('PYTHON_VECTORIZATION_CLOSED'));
    if (this.#process.exitCode !== null || this.#process.signalCode !== null) return;
    await new Promise<void>((resolveClose) => {
      const timer = setTimeout(() => {
        this.#process.kill('SIGKILL');
        resolveClose();
      }, 1_000);
      this.#process.once('exit', () => {
        clearTimeout(timer);
        resolveClose();
      });
      this.#process.kill('SIGTERM');
    });
  }

  #invoke(payload: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    if (this.#closed) return Promise.reject(new PythonVectorizationError('PYTHON_VECTORIZATION_CLOSED'));
    if (signal.aborted) return Promise.reject(signal.reason ?? new PythonVectorizationError('PYTHON_VECTORIZATION_ABORTED'));
    const id = randomUUID();
    return new Promise((resolveValue, reject) => {
      const abort = () => this.#reject(id, signal.reason ?? new PythonVectorizationError('PYTHON_VECTORIZATION_ABORTED'));
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => {
        this.#reject(id, new PythonVectorizationError('PYTHON_VECTORIZATION_TIMEOUT'));
      }, this.#timeoutMs);
      this.#pending.set(id, {
        resolve: resolveValue,
        reject,
        timer,
        removeAbortListener: () => signal.removeEventListener('abort', abort),
      });
      this.#process.stdin.write(`${JSON.stringify({ id, ...payload })}\n`, (error) => {
        if (error) this.#reject(id, new PythonVectorizationError('PYTHON_VECTORIZATION_WRITE_FAILED'));
      });
    });
  }

  #onLine(line: string): void {
    let response: PythonResponse;
    try {
      response = JSON.parse(line) as PythonResponse;
    } catch {
      this.#failAll(new PythonVectorizationError('PYTHON_VECTORIZATION_PROTOCOL_INVALID'));
      return;
    }
    if (typeof response.id !== 'string') return;
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    clearTimeout(pending.timer);
    pending.removeAbortListener();
    if (response.ok === true) pending.resolve(response.value);
    else pending.reject(new PythonVectorizationError(response.code || 'PYTHON_VECTORIZATION_FAILED'));
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

async function defaultPythonPath(): Promise<string> {
  if (process.env.VECTORAI_CV_PYTHON) return process.env.VECTORAI_CV_PYTHON;
  const local = resolve(process.cwd(), '.local/vectorai/cv-venv/bin/python');
  try {
    await access(local);
    return local;
  } catch {
    return 'python3';
  }
}

function parseVectorizationResult(value: unknown, expectedSourceId: string): CleanLineVectorizationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PythonVectorizationError('PYTHON_VECTORIZATION_RESULT_INVALID');
  }
  const result = value as Record<string, unknown>;
  if (result.sourceId !== expectedSourceId
    || typeof result.pipelineVersion !== 'string'
    || !positiveInteger(result.width)
    || !positiveInteger(result.height)
    || !positive(result.analysisScale)
    || !positive(result.medianLineWidthPx)
    || !Array.isArray(result.chains)) {
    throw new PythonVectorizationError('PYTHON_VECTORIZATION_RESULT_INVALID');
  }
  for (const chain of result.chains) validateChain(chain, result.width, result.height);
  return {
    sourceId: result.sourceId,
    pipelineVersion: result.pipelineVersion,
    width: result.width,
    height: result.height,
    analysisScale: result.analysisScale,
    medianLineWidthPx: result.medianLineWidthPx,
    chains: result.chains.map((value) => {
      const chain = value as Record<string, unknown>;
      const bounds = chain.bounds as number[];
      return {
        id: chain.id as string,
        closed: chain.closed as boolean,
        samples: structuredClone(chain.samples) as CleanLineVectorizationResult['chains'][number]['samples'],
        simplified: structuredClone(chain.simplified) as CleanLineVectorizationResult['chains'][number]['simplified'],
        bounds: { x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3] },
        candidate: structuredClone(chain.candidate) as CleanLineVectorizationResult['chains'][number]['candidate'],
      };
    }),
  };
}

function validateChain(value: unknown, width: unknown, height: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PythonVectorizationError('PYTHON_VECTORIZATION_CHAIN_INVALID');
  }
  const chain = value as Record<string, unknown>;
  if (typeof chain.id !== 'string' || !/^chain_[a-f0-9]{20}$/.test(chain.id)
    || typeof chain.closed !== 'boolean'
    || !points(chain.samples, width as number, height as number)
    || !points(chain.simplified, width as number, height as number)
    || !rect(chain.bounds, width as number, height as number)
    || !(chain.candidate === null || validCandidate(chain.candidate))) {
    throw new PythonVectorizationError('PYTHON_VECTORIZATION_CHAIN_INVALID');
  }
}

function validCandidate(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return ['line', 'circle', 'arc', 'ellipse'].includes(String(candidate.type))
    && candidate.parameters !== null && typeof candidate.parameters === 'object'
    && finite(candidate.fitErrorMean) && finite(candidate.fitErrorP95)
    && finite(candidate.fitErrorMax) && finite(candidate.confidence)
    && (candidate.confidence as number) >= 0 && (candidate.confidence as number) <= 1;
}

function points(value: unknown, width: number, height: number): boolean {
  return Array.isArray(value) && value.length >= 2 && value.every((point) => (
    Array.isArray(point) && point.length === 2 && finite(point[0]) && finite(point[1])
    && point[0] >= 0 && point[1] >= 0 && point[0] <= width && point[1] <= height
  ));
}

function rect(value: unknown, width: number, height: number): boolean {
  return Array.isArray(value) && value.length === 4 && value.every(finite)
    && value[0] >= 0 && value[1] >= 0 && value[2] > 0 && value[3] > 0
    && value[0] + value[2] <= width + 0.001
    && value[1] + value[3] <= height + 0.001;
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
