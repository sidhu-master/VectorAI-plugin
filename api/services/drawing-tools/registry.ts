import { createHash } from 'node:crypto';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import type {
  ModelDrawingToolDefinition,
  ModelDrawingToolInvocation,
  ModelDrawingToolRegistrySnapshot,
  ModelToolErrorReceipt,
  ModelToolReceipt,
  ModelToolResult,
  ModelToolStatus,
} from './types.js';

export type * from './types.js';

export class ModelToolInputError extends Error {
  readonly code: string;

  constructor(message = 'Invalid model tool input', code = 'TOOL_INPUT_INVALID') {
    super(message);
    this.name = 'ModelToolInputError';
    this.code = code;
  }
}

export class ModelToolExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly suggestedAction?: ModelToolErrorReceipt['suggestedAction'];

  constructor(input: {
    code: string;
    message?: string;
    retryable: boolean;
    suggestedAction?: ModelToolErrorReceipt['suggestedAction'];
  }) {
    super(input.message ?? input.code);
    this.name = 'ModelToolExecutionError';
    this.code = input.code;
    this.retryable = input.retryable;
    this.suggestedAction = input.suggestedAction;
  }
}

class ModelToolTimeoutError extends Error {}

export class ModelDrawingToolRegistry {
  // The registry intentionally erases heterogeneous input/output types after each parser binds them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #tools = new Map<string, ModelDrawingToolDefinition<any, any>>();
  readonly #getCurrentRevision: (drawingId: DrawingId) => Promise<RevisionId>;
  readonly #now: () => number;
  readonly #consumedCalls = new Set<string>();
  readonly #writeQueues = new Map<DrawingId, Promise<void>>();

  constructor(input: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: readonly ModelDrawingToolDefinition<any, any>[];
    getCurrentRevision(drawingId: DrawingId): Promise<RevisionId>;
    now?: () => number;
  }) {
    for (const tool of input.tools) {
      if (this.#tools.has(tool.name)) {
        throw new Error(`Duplicate model drawing tool: ${tool.name}`);
      }
      if (!tool.name || !tool.version || !Number.isFinite(tool.timeoutMs) || tool.timeoutMs <= 0) {
        throw new Error(`Invalid model drawing tool definition: ${tool.name || '<unnamed>'}`);
      }
      this.#tools.set(tool.name, tool);
    }
    this.#getCurrentRevision = input.getCurrentRevision;
    this.#now = input.now ?? Date.now;
  }

  catalog(): Array<Pick<
    ModelDrawingToolDefinition,
    'name' | 'version' | 'access' | 'timeoutMs' | 'description' | 'inputSchema'
  >> {
    return [...this.#tools.values()].map(({
      name, version, access, timeoutMs, description, inputSchema,
    }) => ({
      name, version, access, timeoutMs,
      ...(description ? { description } : {}),
      ...(inputSchema ? { inputSchema: structuredClone(inputSchema) } : {}),
    }));
  }

  snapshot(): ModelDrawingToolRegistrySnapshot {
    return {
      consumedToolCallCount: this.#consumedCalls.size,
      queuedDrawingCount: this.#writeQueues.size,
    };
  }

  async invoke(
    invocation: ModelDrawingToolInvocation,
    options: { signal?: AbortSignal } = {},
  ): Promise<ModelToolResult> {
    const startedAt = this.#now();
    const inputDigest = digest(invocation.input);
    const tool = this.#tools.get(invocation.tool);
    const callKey = `${invocation.runId}\u0000${invocation.toolCallId}`;
    if (this.#consumedCalls.has(callKey)) {
      return this.#errorResult({
        invocation, tool, inputDigest, startedAt,
        status: 'rejected',
        error: {
          code: 'DUPLICATE_TOOL_CALL_ID',
          retryable: true,
          detail: 'Retry with a new toolCallId; tool call ids are single-use within a run.',
          suggestedAction: 'retry',
        },
      });
    }
    this.#consumedCalls.add(callKey);

    if (!tool) {
      return this.#errorResult({
        invocation, inputDigest, startedAt,
        status: 'rejected',
        error: { code: 'UNSUPPORTED_TOOL', retryable: true, suggestedAction: 'replan' },
      });
    }

    let parsedInput: unknown;
    try {
      parsedInput = tool.parseInput(invocation.input);
    } catch (error) {
      const inputError = error instanceof ModelToolInputError ? error : null;
      return this.#errorResult({
        invocation, tool, inputDigest, startedAt,
        status: 'rejected',
        error: {
          code: inputError?.code ?? 'TOOL_INPUT_INVALID',
          retryable: true,
          ...(safeInputErrorDetail(error) ? { detail: safeInputErrorDetail(error) } : {}),
          suggestedAction: 'replan',
        },
      });
    }

    const execute = () => this.#executeBound({
      invocation,
      tool,
      parsedInput,
      inputDigest,
      startedAt,
      externalSignal: options.signal,
    });
    return tool.access === 'write'
      ? this.#serializeWrite(invocation.drawingId, execute)
      : execute();
  }

  async #serializeWrite(
    drawingId: DrawingId,
    execute: () => Promise<ModelToolResult>,
  ): Promise<ModelToolResult> {
    const previous = this.#writeQueues.get(drawingId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.#writeQueues.set(drawingId, current);
    await previous.catch(() => undefined);
    try {
      return await execute();
    } finally {
      release();
      if (this.#writeQueues.get(drawingId) === current) this.#writeQueues.delete(drawingId);
    }
  }

  async #executeBound(input: {
    invocation: ModelDrawingToolInvocation;
    tool: ModelDrawingToolDefinition;
    parsedInput: unknown;
    inputDigest: string;
    startedAt: number;
    externalSignal?: AbortSignal;
  }): Promise<ModelToolResult> {
    let currentRevision: RevisionId;
    try {
      currentRevision = await this.#getCurrentRevision(input.invocation.drawingId);
    } catch {
      return this.#errorResult({
        ...input,
        status: 'failed',
        error: { code: 'DRAWING_STATE_UNAVAILABLE', retryable: true, suggestedAction: 'retry' },
      });
    }
    if (currentRevision !== input.invocation.revision) {
      return this.#errorResult({
        ...input,
        revisionAfter: currentRevision,
        status: 'rejected',
        error: { code: 'STALE_REVISION', retryable: true, suggestedAction: 'requery' },
      });
    }

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(
      input.externalSignal?.reason ?? new Error('MODEL_TOOL_ABORTED'),
    );
    if (input.externalSignal?.aborted) abortFromCaller();
    else input.externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        if (input.tool.access === 'read') reject(new ModelToolTimeoutError());
        controller.abort();
      }, input.tool.timeoutMs);
    });
    try {
      if (controller.signal.aborted) {
        return this.#errorResult({
          ...input,
          status: 'rejected',
          error: { code: 'TOOL_ABORTED', retryable: true, suggestedAction: 'retry' },
        });
      }
      const executionPromise = input.tool.execute({
        invocation: withoutInput(input.invocation),
        input: input.parsedInput,
        signal: controller.signal,
      });
      // Reads are cancellation-safe. A write may cross its warning timeout after
      // its durable side effect has started, so returning early would create an
      // unknowable outcome ("timed out" followed by a real commit). Keep the
      // per-drawing write queue until the handler reports its authoritative result.
      const execution = input.tool.access === 'write'
        ? await executionPromise
        : await Promise.race([executionPromise, timeout]);
      const revisionAfter = execution.revisionAfter ?? currentRevision;
      return {
        schemaVersion: 1,
        receipt: this.#receipt({
          ...input,
          revisionAfter,
          affectedNodeIds: execution.affectedNodeIds,
          status: 'succeeded',
          outputDigest: digest(execution.output),
        }),
        output: structuredClone(execution.output),
      };
    } catch (error) {
      if (input.externalSignal?.aborted) {
        return this.#errorResult({
          ...input,
          status: 'rejected',
          error: { code: 'TOOL_ABORTED', retryable: true, suggestedAction: 'retry' },
        });
      }
      if (error instanceof ModelToolTimeoutError || (timedOut && input.tool.access === 'read')) {
        return this.#errorResult({
          ...input,
          status: 'timed_out',
          error: { code: 'TOOL_TIMEOUT', retryable: true, suggestedAction: 'retry' },
        });
      }
      if (error instanceof ModelToolExecutionError) {
        const detail = safeExecutionErrorDetail(error);
        return this.#errorResult({
          ...input,
          status: 'rejected',
          error: {
            code: error.code,
            retryable: error.retryable,
            ...(detail ? { detail } : {}),
            ...(error.suggestedAction ? { suggestedAction: error.suggestedAction } : {}),
          },
        });
      }
      return this.#errorResult({
        ...input,
        status: 'failed',
        error: { code: 'TOOL_EXECUTION_FAILED', retryable: true, suggestedAction: 'retry' },
      });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      input.externalSignal?.removeEventListener('abort', abortFromCaller);
    }
  }

  #errorResult(input: {
    invocation: ModelDrawingToolInvocation;
    tool?: ModelDrawingToolDefinition;
    inputDigest: string;
    startedAt: number;
    revisionAfter?: RevisionId;
    status: Exclude<ModelToolStatus, 'succeeded'>;
    error: ModelToolErrorReceipt;
  }): ModelToolResult {
    return {
      schemaVersion: 1,
      receipt: this.#receipt({ ...input, affectedNodeIds: [] }),
    };
  }

  #receipt(input: {
    invocation: ModelDrawingToolInvocation;
    tool?: ModelDrawingToolDefinition;
    inputDigest: string;
    startedAt: number;
    revisionAfter?: RevisionId;
    affectedNodeIds?: string[];
    outputDigest?: string;
    status: ModelToolStatus;
    error?: ModelToolErrorReceipt;
  }): ModelToolReceipt {
    return {
      schemaVersion: 1,
      runId: input.invocation.runId,
      episodeId: input.invocation.episodeId,
      drawingId: input.invocation.drawingId,
      toolCallId: input.invocation.toolCallId,
      tool: input.invocation.tool,
      toolVersion: input.tool?.version ?? 'unknown',
      access: input.tool?.access ?? 'unknown',
      status: input.status,
      revisionBefore: input.invocation.revision,
      revisionAfter: input.revisionAfter ?? input.invocation.revision,
      affectedNodeIds: [...new Set(input.affectedNodeIds ?? [])],
      inputDigest: input.inputDigest,
      ...(input.outputDigest ? { outputDigest: input.outputDigest } : {}),
      durationMs: Math.max(0, this.#now() - input.startedAt),
      ...(input.error ? { error: input.error } : {}),
    };
  }
}

function withoutInput(
  invocation: ModelDrawingToolInvocation,
): Omit<ModelDrawingToolInvocation, 'input'> {
  return {
    runId: invocation.runId,
    episodeId: invocation.episodeId,
    drawingId: invocation.drawingId,
    revision: invocation.revision,
    toolCallId: invocation.toolCallId,
    tool: invocation.tool,
  };
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function safeInputErrorDetail(error: unknown): string | undefined {
  if (!(error instanceof ModelToolInputError)
    && (!(error instanceof Error) || error.name !== 'DrawingAgentProtocolError')) {
    return undefined;
  }
  return boundedAuditDetail(error.message);
}

function safeExecutionErrorDetail(error: ModelToolExecutionError): string | undefined {
  return boundedAuditDetail(error.message);
}

function boundedAuditDetail(value: string): string | undefined {
  const message = value
    .replace(/(?:Bearer\s+|api[_-]?key[=:]\s*)[^\s]+/gi, '[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  return message ? message.slice(0, 500) : undefined;
}
