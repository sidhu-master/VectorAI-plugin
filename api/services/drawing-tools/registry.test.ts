import { describe, expect, it, vi } from 'vitest';

import type { DrawingId, RevisionId } from '../../../src/drawing/index';
import {
  ModelDrawingToolRegistry,
  ModelToolInputError,
  type ModelDrawingToolDefinition,
} from './registry';

const drawingId = 'drawing_1' as DrawingId;
const revision = 'revision_1' as RevisionId;

function invocation(input: Partial<{
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  toolCallId: string;
  tool: string;
  input: unknown;
}> = {}) {
  return {
    runId: 'run_1',
    episodeId: 'episode_1',
    drawingId,
    revision,
    toolCallId: 'call_1',
    tool: 'read_counter',
    input: { value: 1 },
    ...input,
  };
}

function integerInput(value: unknown): { value: number } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ModelToolInputError('input must be an object');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !Number.isInteger(record.value)) {
    throw new ModelToolInputError('input must contain only integer value');
  }
  return { value: record.value as number };
}

function tool(input: Partial<ModelDrawingToolDefinition<{ value: number }, unknown>> = {}) {
  return {
    name: 'read_counter',
    version: '1.0.0',
    access: 'read',
    timeoutMs: 50,
    parseInput: integerInput,
    execute: async ({ input: parsed }: { input: { value: number } }) => ({
      output: { value: parsed.value },
    }),
    ...input,
  } satisfies ModelDrawingToolDefinition<{ value: number }, unknown>;
}

describe('ModelDrawingToolRegistry', () => {
  it('executes a tool call at most once and emits a versioned audit receipt', async () => {
    const execute = vi.fn(tool().execute);
    const registry = new ModelDrawingToolRegistry({
      tools: [tool({ execute })],
      getCurrentRevision: async () => revision,
      now: (() => {
        let value = 100;
        return () => value += 5;
      })(),
    });

    const first = await registry.invoke(invocation());
    const duplicate = await registry.invoke(invocation());

    expect(first).toMatchObject({
      schemaVersion: 1,
      output: { value: 1 },
      receipt: {
        schemaVersion: 1,
        toolCallId: 'call_1',
        tool: 'read_counter',
        toolVersion: '1.0.0',
        access: 'read',
        status: 'succeeded',
        revisionBefore: revision,
        revisionAfter: revision,
        inputDigest: expect.stringMatching(/^sha256:/),
        outputDigest: expect.stringMatching(/^sha256:/),
      },
    });
    expect(duplicate).toMatchObject({
      receipt: {
        status: 'rejected',
        error: { code: 'DUPLICATE_TOOL_CALL_ID', retryable: false },
      },
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown fields and stale revisions before executing the handler', async () => {
    const execute = vi.fn(tool().execute);
    let currentRevision = revision;
    const registry = new ModelDrawingToolRegistry({
      tools: [tool({ execute })],
      getCurrentRevision: async () => currentRevision,
    });

    const malformed = await registry.invoke(invocation({
      toolCallId: 'call_bad',
      input: { value: 1, hiddenInstruction: 'do not pass' },
    }));
    currentRevision = 'revision_2' as RevisionId;
    const stale = await registry.invoke(invocation({ toolCallId: 'call_stale' }));

    expect(malformed.receipt).toMatchObject({
      status: 'rejected', error: { code: 'TOOL_INPUT_INVALID', retryable: true },
    });
    expect(JSON.stringify(malformed)).not.toContain('hiddenInstruction');
    expect(stale.receipt).toMatchObject({
      status: 'rejected',
      revisionAfter: 'revision_2',
      error: { code: 'STALE_REVISION', retryable: true },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows concurrent reads but serializes writes per drawing', async () => {
    let activeReads = 0;
    let maxReads = 0;
    let activeWrites = 0;
    let maxWrites = 0;
    const releaseRead: Array<() => void> = [];
    const releaseWrite: Array<() => void> = [];
    const registry = new ModelDrawingToolRegistry({
      tools: [
        tool({
          execute: async () => {
            activeReads += 1;
            maxReads = Math.max(maxReads, activeReads);
            await new Promise<void>((resolve) => releaseRead.push(resolve));
            activeReads -= 1;
            return { output: { ok: true } };
          },
        }),
        tool({
          name: 'write_counter', access: 'write',
          execute: async () => {
            activeWrites += 1;
            maxWrites = Math.max(maxWrites, activeWrites);
            await new Promise<void>((resolve) => releaseWrite.push(resolve));
            activeWrites -= 1;
            return { output: { ok: true } };
          },
        }),
      ],
      getCurrentRevision: async () => revision,
    });

    const reads = [
      registry.invoke(invocation({ toolCallId: 'read_1' })),
      registry.invoke(invocation({ toolCallId: 'read_2' })),
    ];
    await vi.waitFor(() => expect(releaseRead).toHaveLength(2));
    releaseRead.splice(0).forEach((release) => release());
    await Promise.all(reads);

    const writes = [
      registry.invoke(invocation({ toolCallId: 'write_1', tool: 'write_counter' })),
      registry.invoke(invocation({ toolCallId: 'write_2', tool: 'write_counter' })),
    ];
    await vi.waitFor(() => expect(releaseWrite).toHaveLength(1));
    releaseWrite.shift()?.();
    await vi.waitFor(() => expect(releaseWrite).toHaveLength(1));
    releaseWrite.shift()?.();
    await Promise.all(writes);

    expect(maxReads).toBe(2);
    expect(maxWrites).toBe(1);
  });

  it('turns timeouts and thrown errors into audit-safe receipts', async () => {
    vi.useFakeTimers();
    const registry = new ModelDrawingToolRegistry({
      tools: [
        tool({
          name: 'slow', timeoutMs: 10,
          execute: ({ signal }) => new Promise((resolve) => {
            signal.addEventListener('abort', () => resolve({ output: { aborted: true } }));
          }),
        }),
        tool({
          name: 'throws',
          execute: async () => { throw new Error('secret provider credential'); },
        }),
      ],
      getCurrentRevision: async () => revision,
    });

    const pending = registry.invoke(invocation({ toolCallId: 'slow_1', tool: 'slow' }));
    await vi.advanceTimersByTimeAsync(11);
    const timedOut = await pending;
    const failed = await registry.invoke(invocation({ toolCallId: 'throws_1', tool: 'throws' }));
    vi.useRealTimers();

    expect(timedOut.receipt).toMatchObject({
      status: 'timed_out', error: { code: 'TOOL_TIMEOUT', retryable: true },
    });
    expect(failed.receipt).toMatchObject({
      status: 'failed', error: { code: 'TOOL_EXECUTION_FAILED', retryable: true },
    });
    expect(JSON.stringify(failed)).not.toContain('secret provider credential');
  });

  it('always reads canonical state through the handler instead of caching a document', async () => {
    let canonicalValue = 1;
    const registry = new ModelDrawingToolRegistry({
      tools: [tool({
        execute: async () => ({ output: { canonicalValue } }),
      })],
      getCurrentRevision: async () => revision,
    });

    const first = await registry.invoke(invocation({ toolCallId: 'fresh_1' }));
    canonicalValue = 2;
    const second = await registry.invoke(invocation({ toolCallId: 'fresh_2' }));

    expect(first.output).toEqual({ canonicalValue: 1 });
    expect(second.output).toEqual({ canonicalValue: 2 });
    expect(registry.snapshot()).toEqual({
      consumedToolCallCount: 2,
      queuedDrawingCount: 0,
    });
  });
});
