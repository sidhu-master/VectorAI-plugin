import type {
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';

export type ModelDrawingToolAccess = 'read' | 'write';

export type ModelToolStatus =
  | 'succeeded'
  | 'rejected'
  | 'failed'
  | 'timed_out';

export interface ModelDrawingToolInvocation {
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  toolCallId: string;
  tool: string;
  input: unknown;
}

export interface ModelToolErrorReceipt {
  code: string;
  retryable: boolean;
  suggestedAction?: 'retry' | 'requery' | 'replan' | 'request-human-decision';
}

export interface ModelToolReceipt {
  schemaVersion: 1;
  runId: string;
  episodeId: string;
  drawingId: DrawingId;
  toolCallId: string;
  tool: string;
  toolVersion: string;
  access: ModelDrawingToolAccess | 'unknown';
  status: ModelToolStatus;
  revisionBefore: RevisionId;
  revisionAfter: RevisionId;
  affectedNodeIds: string[];
  inputDigest: string;
  outputDigest?: string;
  durationMs: number;
  error?: ModelToolErrorReceipt;
}

export interface ModelToolResult<T = unknown> {
  schemaVersion: 1;
  receipt: ModelToolReceipt;
  output?: T;
}

export interface ModelDrawingToolExecutionContext<I> {
  invocation: Readonly<Omit<ModelDrawingToolInvocation, 'input'>>;
  input: I;
  signal: AbortSignal;
}

export interface ModelDrawingToolExecutionResult<O> {
  output: O;
  revisionAfter?: RevisionId;
  affectedNodeIds?: string[];
}

export type ModelDrawingToolExecutor<I, O> = {
  execute(context: ModelDrawingToolExecutionContext<I>): Promise<ModelDrawingToolExecutionResult<O>>;
}['execute'];

export interface ModelDrawingToolDefinition<I = unknown, O = unknown> {
  name: string;
  version: string;
  access: ModelDrawingToolAccess;
  timeoutMs: number;
  parseInput(value: unknown): I;
  execute: ModelDrawingToolExecutor<I, O>;
}

export interface ModelDrawingToolRegistrySnapshot {
  consumedToolCallCount: number;
  queuedDrawingCount: number;
}
