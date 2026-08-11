import { createHash, randomUUID } from 'node:crypto';

import {
  DrawingAgentProtocolError,
  parseDrawingToolAssertions,
  parseDrawingToolCommands,
  parseDrawingToolSelector,
} from '../../../src/contracts/drawing-agent.js';
import {
  randomIdFactory,
  type DrawingAssertion,
  type DrawingError,
  type DrawingTransaction,
  type IdFactory,
  type RepositoryCommitResult,
  type TransactionResult,
} from '../../../src/drawing/index.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import type {
  DrawingToolCapability,
  DrawingToolContext,
  DrawingToolDefinition,
  DrawingToolExecution,
  DrawingToolInvocation,
  DrawingToolOutcome,
  DrawingToolReceipt,
  DrawingToolStatus,
  PreparedDrawingTransaction,
  SpatialPreviewContext,
} from './types.js';

export const DRAWING_TOOL_DEFINITIONS: readonly DrawingToolDefinition[] = Object.freeze([
  definition('query_entities', 'read', 'model', 5_000),
  definition('inspect_entity', 'read', 'model', 5_000),
  definition('preview_transaction', 'write', 'model', 10_000),
  definition('commit_transaction', 'write', 'runtime', 10_000),
  definition('verify_goal', 'read', 'runtime', 10_000),
]);

type DrawingToolApplication = Pick<
  DrawingApplication,
  'query' | 'inspect' | 'preview' | 'execute'
>;

interface StoredPreview extends PreparedDrawingTransaction {
  transaction: DrawingTransaction;
  affectedNodeIds: string[];
}

type ParsedInput =
  | { capability: 'query_entities'; selector: ReturnType<typeof parseDrawingToolSelector> }
  | { capability: 'inspect_entity'; nodeId: string }
  | {
      capability: 'preview_transaction';
      commands: DrawingTransaction['commands'];
      postconditions: DrawingAssertion[];
      previewContext?: SpatialPreviewContext;
    }
  | { capability: 'commit_transaction'; previewHandle: string }
  | { capability: 'verify_goal'; assertions: DrawingAssertion[] };

export class DrawingToolRegistry {
  readonly #application: DrawingToolApplication;
  readonly #idFactory: IdFactory;
  readonly #now: () => number;
  readonly #handleFactory: () => string;
  readonly #previews = new Map<string, StoredPreview>();
  readonly #latestPreviewByEpisode = new Map<string, string>();
  readonly #supersededHandles = new Set<string>();

  constructor(input: {
    application: DrawingToolApplication;
    idFactory?: IdFactory;
    now?: () => number;
    handleFactory?: () => string;
  }) {
    this.#application = input.application;
    this.#idFactory = input.idFactory ?? randomIdFactory;
    this.#now = input.now ?? Date.now;
    this.#handleFactory = input.handleFactory ?? randomUUID;
    assertUniqueDefinitions(DRAWING_TOOL_DEFINITIONS);
  }

  async invoke(invocation: DrawingToolInvocation): Promise<DrawingToolExecution> {
    const startedAt = this.#now();
    const definition = findDefinition(invocation.capability);
    const inputDigest = digest(invocation.input);
    if (definition.caller !== invocation.caller) {
      return this.#error(
        invocation, definition, inputDigest, startedAt, 'TOOL_CALLER_FORBIDDEN', 'replan',
      );
    }
    let parsed: ParsedInput;
    try {
      parsed = parseInput(invocation.capability, invocation.input);
    } catch (error) {
      if (!(error instanceof DrawingAgentProtocolError)) throw error;
      return {
        receipt: this.#receipt({
          invocation, definition, inputDigest, startedAt,
          status: 'rejected',
          outcome: { kind: 'error', codes: ['INVALID_TOOL_INPUT'] },
          retry: { allowed: true, action: 'replan' },
        }),
      };
    }

    switch (parsed.capability) {
      case 'query_entities':
        return this.#query(invocation, definition, inputDigest, startedAt, parsed.selector);
      case 'inspect_entity':
        return this.#inspect(invocation, definition, inputDigest, startedAt, parsed.nodeId);
      case 'preview_transaction':
        return this.#preview(invocation, definition, inputDigest, startedAt, parsed);
      case 'commit_transaction':
        return this.#commit(invocation, definition, inputDigest, startedAt, parsed.previewHandle);
      case 'verify_goal':
        return this.#verify(invocation, definition, inputDigest, startedAt, parsed.assertions);
    }
  }

  discardPrepared(handle: string): boolean {
    const prepared = this.#previews.get(handle);
    if (prepared?.episodeId && this.#latestPreviewByEpisode.get(prepared.episodeId) === handle) {
      this.#latestPreviewByEpisode.delete(prepared.episodeId);
    }
    this.#supersededHandles.delete(handle);
    return this.#previews.delete(handle);
  }

  supersedePrepared(handle: string): boolean {
    const prepared = this.#previews.get(handle);
    if (!prepared) return false;
    this.#previews.delete(handle);
    this.#supersededHandles.add(handle);
    return true;
  }

  discardRun(runId: string): number {
    let discarded = 0;
    for (const [handle, preview] of this.#previews) {
      if (preview.runId !== runId) continue;
      this.discardPrepared(handle);
      discarded += 1;
    }
    return discarded;
  }

  async #query(
    invocation: DrawingToolInvocation,
    tool: DrawingToolDefinition,
    inputDigest: string,
    startedAt: number,
    selector: ReturnType<typeof parseDrawingToolSelector>,
  ): Promise<DrawingToolExecution> {
    const queried = await this.#application.query({
      drawingId: invocation.context.drawingId,
      selector,
    });
    return {
      receipt: this.#receipt({
        invocation, definition: tool, inputDigest, startedAt,
        revisionAfter: queried.revision,
        affectedNodeIds: queried.result.items.map((item) => item.id),
        status: 'succeeded',
        outcome: {
          kind: 'query', count: queried.result.items.length,
          truncated: queried.result.truncated,
        },
        retry: { allowed: false },
      }),
      output: queried.result,
    };
  }

  async #inspect(
    invocation: DrawingToolInvocation,
    tool: DrawingToolDefinition,
    inputDigest: string,
    startedAt: number,
    nodeId: string,
  ): Promise<DrawingToolExecution> {
    const inspected = await this.#application.inspect({
      drawingId: invocation.context.drawingId,
      nodeId,
    });
    const found = inspected.result !== null;
    return {
      receipt: this.#receipt({
        invocation, definition: tool, inputDigest, startedAt,
        revisionAfter: inspected.revision,
        affectedNodeIds: found ? [nodeId] : [],
        status: found ? 'succeeded' : 'not_found',
        outcome: {
          kind: 'inspect', found,
          relationCount: inspected.result?.relations.length ?? 0,
          featureCount: inspected.result?.features.length ?? 0,
        },
        retry: found ? { allowed: false } : { allowed: true, action: 'requery' },
      }),
      output: inspected.result,
    };
  }

  async #preview(
    invocation: DrawingToolInvocation,
    tool: DrawingToolDefinition,
    inputDigest: string,
    startedAt: number,
    input: Extract<ParsedInput, { capability: 'preview_transaction' }>,
  ): Promise<DrawingToolExecution> {
    const transaction: DrawingTransaction = {
      id: this.#idFactory.next('transaction'),
      baseRevision: invocation.context.revision,
      actor: structuredClone(invocation.context.actor),
      ...(invocation.context.goalId ? { goalId: invocation.context.goalId } : {}),
      commands: structuredClone(input.commands),
      preconditions: [],
      postconditions: structuredClone(input.postconditions),
      evidenceRefs: [],
    };
    const result = await this.#application.preview({
      drawingId: invocation.context.drawingId,
      transaction,
    });
    if (result.status !== 'ready') {
      return {
        receipt: this.#transactionReceipt({
          invocation, definition: tool, inputDigest, startedAt, result,
          successOutcome: {
            kind: 'preview', candidate: false,
            validationValid: true, goalSatisfied: true,
          },
        }),
      };
    }
    const prepared: StoredPreview = {
      handle: this.#handleFactory(),
      runId: invocation.context.runId,
      drawingId: invocation.context.drawingId,
      baseRevision: invocation.context.revision,
      transaction,
      affectedNodeIds: [...result.preview.affectedNodeIds],
      ...(input.previewContext ? structuredClone(input.previewContext) : {}),
    };
    if (prepared.episodeId) {
      const previous = this.#latestPreviewByEpisode.get(prepared.episodeId);
      if (previous && previous !== prepared.handle) this.supersedePrepared(previous);
      this.#latestPreviewByEpisode.set(prepared.episodeId, prepared.handle);
    }
    this.#previews.set(prepared.handle, prepared);
    return {
      receipt: this.#receipt({
        invocation, definition: tool, inputDigest, startedAt,
        affectedNodeIds: prepared.affectedNodeIds,
        status: 'succeeded',
        outcome: {
          kind: 'preview', candidate: result.preview.candidate,
          validationValid: result.preview.validationReport.valid,
          goalSatisfied: result.preview.outcomeReport.satisfied,
        },
        retry: { allowed: false },
      }),
      prepared: publicPrepared(prepared),
      previewDocument: structuredClone(result.resultingDocument),
    };
  }

  async #commit(
    invocation: DrawingToolInvocation,
    tool: DrawingToolDefinition,
    inputDigest: string,
    startedAt: number,
    previewHandle: string,
  ): Promise<DrawingToolExecution> {
    if (this.#supersededHandles.delete(previewHandle)) {
      return this.#error(invocation, tool, inputDigest, startedAt, 'PREVIEW_SUPERSEDED', 'replan');
    }
    const prepared = this.#previews.get(previewHandle);
    if (!prepared) {
      return this.#error(invocation, tool, inputDigest, startedAt, 'PREVIEW_NOT_FOUND', 'replan');
    }
    if (
      prepared.runId !== invocation.context.runId
      || prepared.drawingId !== invocation.context.drawingId
      || prepared.baseRevision !== invocation.context.revision
    ) {
      return this.#error(
        invocation, tool, inputDigest, startedAt, 'PREVIEW_SCOPE_MISMATCH', 'requery',
      );
    }
    if (prepared.episodeId
      && this.#latestPreviewByEpisode.get(prepared.episodeId) !== previewHandle) {
      this.#previews.delete(previewHandle);
      return this.#error(invocation, tool, inputDigest, startedAt, 'PREVIEW_SUPERSEDED', 'replan');
    }
    this.#previews.delete(previewHandle);
    if (prepared.episodeId) this.#latestPreviewByEpisode.delete(prepared.episodeId);
    const result = await this.#application.execute({
      drawingId: prepared.drawingId,
      transaction: structuredClone(prepared.transaction),
    });
    return {
      receipt: this.#commitReceipt({
        invocation, definition: tool, inputDigest, startedAt, result,
        affectedNodeIds: prepared.affectedNodeIds,
      }),
      ...(result.status === 'committed' ? { commit: structuredClone(result.commit) } : {}),
    };
  }

  async #verify(
    invocation: DrawingToolInvocation,
    tool: DrawingToolDefinition,
    inputDigest: string,
    startedAt: number,
    assertions: DrawingAssertion[],
  ): Promise<DrawingToolExecution> {
    const result = await this.#application.preview({
      drawingId: invocation.context.drawingId,
      transaction: {
        id: this.#idFactory.next('transaction'),
        baseRevision: invocation.context.revision,
        actor: structuredClone(invocation.context.actor),
        ...(invocation.context.goalId ? { goalId: invocation.context.goalId } : {}),
        commands: [], preconditions: [],
        postconditions: structuredClone(assertions), evidenceRefs: [],
      },
    });
    if (result.status === 'already_satisfied') {
      return {
        receipt: this.#receipt({
          invocation, definition: tool, inputDigest, startedAt,
          status: 'already_satisfied',
          outcome: {
            kind: 'verification', satisfied: true, assertionCount: assertions.length,
          },
          retry: { allowed: false },
        }),
      };
    }
    if (result.status === 'rejected') {
      return {
        receipt: this.#receipt({
          invocation, definition: tool, inputDigest, startedAt,
          affectedNodeIds: result.errors.flatMap((error) => error.nodeIds),
          status: classifyErrors(result.errors),
          outcome: { kind: 'verification', satisfied: false, assertionCount: assertions.length },
          retry: retryFromErrors(result.errors),
        }),
      };
    }
    return {
      receipt: this.#receipt({
        invocation, definition: tool, inputDigest, startedAt,
        status: 'rejected',
        outcome: { kind: 'verification', satisfied: false, assertionCount: assertions.length },
        retry: { allowed: true, action: 'replan' },
      }),
    };
  }

  #commitReceipt(input: {
    invocation: DrawingToolInvocation;
    definition: DrawingToolDefinition;
    inputDigest: string;
    startedAt: number;
    result: RepositoryCommitResult;
    affectedNodeIds: string[];
  }): DrawingToolReceipt {
    if (input.result.status === 'committed') {
      return this.#receipt({
        ...input,
        revisionAfter: input.result.revision,
        status: 'succeeded',
        outcome: { kind: 'commit', committed: true, commitId: input.result.commit.id },
        retry: { allowed: false },
      });
    }
    return this.#transactionReceipt({
      ...input,
      result: input.result,
      successOutcome: { kind: 'commit', committed: false },
    });
  }

  #transactionReceipt(input: {
    invocation: DrawingToolInvocation;
    definition: DrawingToolDefinition;
    inputDigest: string;
    startedAt: number;
    result: Exclude<TransactionResult | RepositoryCommitResult, { status: 'ready' | 'committed' }>;
    successOutcome: DrawingToolOutcome;
    affectedNodeIds?: string[];
  }): DrawingToolReceipt {
    if (input.result.status === 'already_satisfied') {
      return this.#receipt({
        ...input,
        status: 'already_satisfied', outcome: input.successOutcome,
        retry: { allowed: false },
      });
    }
    return this.#receipt({
      ...input,
      affectedNodeIds: input.result.errors.flatMap((error) => error.nodeIds),
      status: classifyErrors(input.result.errors),
      outcome: { kind: 'error', codes: input.result.errors.map((error) => error.code) },
      retry: retryFromErrors(input.result.errors),
    });
  }

  #error(
    invocation: DrawingToolInvocation,
    definition: DrawingToolDefinition,
    inputDigest: string,
    startedAt: number,
    code: string,
    action: 'requery' | 'replan',
  ): DrawingToolExecution {
    return {
      receipt: this.#receipt({
        invocation, definition, inputDigest, startedAt,
        status: 'rejected', outcome: { kind: 'error', codes: [code] },
        retry: { allowed: true, action },
      }),
    };
  }

  #receipt(input: {
    invocation: DrawingToolInvocation;
    definition: DrawingToolDefinition;
    inputDigest: string;
    startedAt: number;
    revisionAfter?: DrawingToolContext['revision'];
    affectedNodeIds?: string[];
    status: DrawingToolStatus;
    outcome: DrawingToolOutcome;
    retry: DrawingToolReceipt['retry'];
  }): DrawingToolReceipt {
    return {
      toolCallId: input.invocation.toolCallId,
      capability: input.definition.capability,
      version: input.definition.version,
      access: input.definition.access,
      inputDigest: input.inputDigest,
      revisionBefore: input.invocation.context.revision,
      revisionAfter: input.revisionAfter ?? input.invocation.context.revision,
      affectedNodeIds: [...new Set(input.affectedNodeIds ?? [])],
      outcome: input.outcome,
      durationMs: Math.max(0, this.#now() - input.startedAt),
      status: input.status,
      retry: input.retry,
    };
  }
}

function definition(
  capability: DrawingToolCapability,
  access: DrawingToolDefinition['access'],
  caller: DrawingToolDefinition['caller'],
  timeoutMs: number,
): DrawingToolDefinition {
  return Object.freeze({ capability, version: '1.0.0', access, caller, timeoutMs });
}

function assertUniqueDefinitions(definitions: readonly DrawingToolDefinition[]): void {
  const keys = definitions.map((tool) => `${tool.capability}@${tool.version}`);
  if (new Set(keys).size !== keys.length) throw new Error('Drawing tool definitions must be unique');
}

function findDefinition(capability: DrawingToolCapability): DrawingToolDefinition {
  const found = DRAWING_TOOL_DEFINITIONS.find((tool) => tool.capability === capability);
  if (!found) throw new Error(`Unsupported drawing tool: ${capability}`);
  return found;
}

function parseInput(capability: DrawingToolCapability, value: unknown): ParsedInput {
  const input = record(value, 'input');
  switch (capability) {
    case 'query_entities':
      exact(input, ['selector'], 'input');
      return { capability, selector: parseDrawingToolSelector(input.selector, 'input.selector') };
    case 'inspect_entity':
      exact(input, ['nodeId'], 'input');
      return { capability, nodeId: nonEmptyString(input.nodeId, 'input.nodeId') };
    case 'preview_transaction':
      exactWithOptional(input, ['commands', 'postconditions'], ['previewContext'], 'input');
      return {
        capability,
        commands: parseDrawingToolCommands(input.commands, 'input.commands'),
        postconditions: parseDrawingToolAssertions(input.postconditions, 'input.postconditions'),
        ...(input.previewContext === undefined
          ? {}
          : { previewContext: parsePreviewContext(input.previewContext) }),
      };
    case 'commit_transaction':
      exact(input, ['previewHandle'], 'input');
      return {
        capability,
        previewHandle: nonEmptyString(input.previewHandle, 'input.previewHandle'),
      };
    case 'verify_goal': {
      exact(input, ['assertions'], 'input');
      const assertions = parseDrawingToolAssertions(input.assertions, 'input.assertions');
      if (assertions.length === 0) {
        throw new DrawingAgentProtocolError('input.assertions', '验收条件不能为空');
      }
      return { capability, assertions };
    }
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DrawingAgentProtocolError(path, '必须是对象');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new DrawingAgentProtocolError(path, '必须是普通对象');
  }
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: string[], path: string): void {
  const allowed = new Set(keys);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new DrawingAgentProtocolError(`${path}.${unknown}`, '字段不受支持');
  const missing = keys.find((key) => !(key in value));
  if (missing) throw new DrawingAgentProtocolError(`${path}.${missing}`, '字段缺失');
}

function exactWithOptional(
  value: Record<string, unknown>,
  required: string[],
  optional: string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new DrawingAgentProtocolError(`${path}.${unknown}`, '字段不受支持');
  const missing = required.find((key) => !(key in value));
  if (missing) throw new DrawingAgentProtocolError(`${path}.${missing}`, '字段缺失');
}

function parsePreviewContext(value: unknown): SpatialPreviewContext {
  const input = record(value, 'input.previewContext');
  exact(input, [
    'episodeId', 'previewVersionId', 'regionId', 'selectionVersionId', 'strategy', 'lineage',
  ], 'input.previewContext');
  const strategies = new Set(['geometric-edit', 'generative-redraw', 'hybrid-edit']);
  const strategy = nonEmptyString(input.strategy, 'input.previewContext.strategy');
  if (!strategies.has(strategy)) {
    throw new DrawingAgentProtocolError('input.previewContext.strategy', '编辑策略不受支持');
  }
  if (!Array.isArray(input.lineage)) {
    throw new DrawingAgentProtocolError('input.previewContext.lineage', '必须是数组');
  }
  return {
    episodeId: nonEmptyString(input.episodeId, 'input.previewContext.episodeId'),
    previewVersionId: nonEmptyString(
      input.previewVersionId,
      'input.previewContext.previewVersionId',
    ),
    regionId: nonEmptyString(input.regionId, 'input.previewContext.regionId'),
    selectionVersionId: nonEmptyString(
      input.selectionVersionId,
      'input.previewContext.selectionVersionId',
    ),
    strategy: strategy as SpatialPreviewContext['strategy'],
    lineage: input.lineage.map((item, index) => parsePreviewLineage(item, index)),
  };
}

function parsePreviewLineage(value: unknown, index: number): SpatialPreviewContext['lineage'][number] {
  const path = `input.previewContext.lineage[${index}]`;
  const input = record(value, path);
  exact(input, ['sourceNodeId', 'fragmentId', 'sourceRange', 'role'], path);
  if (!Array.isArray(input.sourceRange) || input.sourceRange.length !== 2
    || input.sourceRange.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new DrawingAgentProtocolError(`${path}.sourceRange`, '必须是两个有限数值');
  }
  if (input.role !== 'target' && input.role !== 'protected') {
    throw new DrawingAgentProtocolError(`${path}.role`, '必须是 target 或 protected');
  }
  return {
    sourceNodeId: nonEmptyString(input.sourceNodeId, `${path}.sourceNodeId`),
    fragmentId: nonEmptyString(input.fragmentId, `${path}.fragmentId`),
    sourceRange: [input.sourceRange[0] as number, input.sourceRange[1] as number],
    role: input.role,
  };
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DrawingAgentProtocolError(path, '必须是非空字符串');
  }
  return value;
}

function classifyErrors(errors: DrawingError[]): DrawingToolStatus {
  return errors.some((error) => error.code === 'STALE_REVISION') ? 'stale' : 'rejected';
}

function retryFromErrors(errors: DrawingError[]): DrawingToolReceipt['retry'] {
  const retryable = errors.find((error) => error.retryable);
  if (!retryable) return { allowed: false };
  return {
    allowed: true,
    ...(retryable.suggestedAction ? { action: retryable.suggestedAction } : {}),
  };
}

function publicPrepared(preview: StoredPreview): PreparedDrawingTransaction {
  return {
    handle: preview.handle,
    runId: preview.runId,
    drawingId: preview.drawingId,
    baseRevision: preview.baseRevision,
    ...(preview.episodeId ? { episodeId: preview.episodeId } : {}),
    ...(preview.previewVersionId ? { previewVersionId: preview.previewVersionId } : {}),
    ...(preview.regionId ? { regionId: preview.regionId } : {}),
    ...(preview.selectionVersionId ? { selectionVersionId: preview.selectionVersionId } : {}),
    ...(preview.strategy ? { strategy: preview.strategy } : {}),
    ...(preview.lineage ? { lineage: structuredClone(preview.lineage) } : {}),
  };
}

function digest(value: unknown): string {
  let serialized: string;
  try {
    serialized = stableStringify(value);
  } catch {
    serialized = '[unserializable]';
  }
  return createHash('sha256').update(serialized).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(object[key])}`
    )).join(',')}}`;
  }
  const primitive = JSON.stringify(value);
  return primitive === undefined ? String(value) : primitive;
}
