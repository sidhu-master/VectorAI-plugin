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
  constructor(message = 'Invalid model tool input') {
    super(message);
    this.name = 'ModelToolInputError';
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
  readonly #tools = new Map<string, ModelDrawingToolDefinition<any, any>>();
  readonly #getCurrentRevision: (drawingId: DrawingId) => Promise<RevisionId>;
  readonly #now: () => number;
  readonly #consumedCalls = new Set<string>();
  readonly #writeQueues = new Map<DrawingId, Promise<void>>();

  constructor(input: {
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

  catalog(): Array<Pick<ModelDrawingToolDefinition, 'name' | 'version' | 'access' | 'timeoutMs'>> {
    return [...this.#tools.values()].map(({ name, version, access, timeoutMs }) => ({
      name, version, access, timeoutMs,
    }));
  }

  snapshot(): ModelDrawingToolRegistrySnapshot {
    return {
      consumedToolCallCount: this.#consumedCalls.size,
      queuedDrawingCount: this.#writeQueues.size,
    };
  }

  async invoke(invocation: ModelDrawingToolInvocation): Promise<ModelToolResult> {
    const startedAt = this.#now();
    const inputDigest = digest(invocation.input);
    const tool = this.#tools.get(invocation.tool);
    const callKey = `${invocation.runId}\u0000${invocation.toolCallId}`;
    if (this.#consumedCalls.has(callKey)) {
      return this.#errorResult({
        invocation, tool, inputDigest, startedAt,
        status: 'rejected',
        error: { code: 'DUPLICATE_TOOL_CALL_ID', retryable: false },
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
    } catch {
      return this.#errorResult({
        invocation, tool, inputDigest, startedAt,
        status: 'rejected',
        error: { code: 'TOOL_INPUT_INVALID', retryable: true, suggestedAction: 'replan' },
      });
    }

    const execute = () => this.#executeBound({
      invocation,
      tool,
      parsedInput,
      inputDigest,
      startedAt,
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new ModelToolTimeoutError());
        controller.abort();
      }, input.tool.timeoutMs);
    });
    try {
      const execution = await Promise.race([
        input.tool.execute({
          invocation: withoutInput(input.invocation),
          input: input.parsedInput,
          signal: controller.signal,
        }),
        timeout,
      ]);
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
      if (error instanceof ModelToolTimeoutError) {
        return this.#errorResult({
          ...input,
          status: 'timed_out',
          error: { code: 'TOOL_TIMEOUT', retryable: true, suggestedAction: 'retry' },
        });
      }
      if (error instanceof ModelToolExecutionError) {
        return this.#errorResult({
          ...input,
          status: 'rejected',
          error: {
            code: error.code,
            retryable: error.retryable,
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
  const { input: _input, ...context } = invocation;
  return context;
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
