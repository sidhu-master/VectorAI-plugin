import type { RevisionId } from '../../../src/drawing/index.js';
import type { ModelToolResult } from '../drawing-tools/types.js';

export interface ContextEvidenceReceipt {
  ref: string;
  tool: string;
  status: ModelToolResult['receipt']['status'];
  affected: string[];
  affectedCount: number;
  durationMs: number;
  output?: unknown;
  error?: ModelToolResult['receipt']['error'];
}

export interface RevisionContextProjection {
  revision: RevisionId;
  receipts: ContextEvidenceReceipt[];
  nodeFacts: Array<{ ref: string; node: unknown }>;
}

const MAX_RECEIPTS = 16;
const MAX_NODE_FACTS = 64;
const CANDIDATE_PREVIEW_TOOLS = new Set([
  'preview_spatial_program',
  'preview_transaction',
  'revise_preview',
  'preview_connected_transform',
  'redraw_region',
]);

/** Append-only episode evidence with revision-bound aliases and deduplicated exact node facts. */
export class RevisionContextLedger {
  #revision: RevisionId;
  #sequence = 0;
  #aliasSequence = 0;
  readonly #idToAlias = new Map<string, string>();
  readonly #aliasToId = new Map<string, string>();
  readonly #receipts: ContextEvidenceReceipt[] = [];
  readonly #sourceReceipts = new Map<string, ContextEvidenceReceipt>();
  readonly #nodeFacts = new Map<string, { ref: string; node: unknown }>();
  readonly #activeNodeIds = new Set<string>();

  constructor(revision: RevisionId) {
    this.#revision = revision;
  }

  get revision(): RevisionId {
    return this.#revision;
  }

  advanceRevision(revision: RevisionId): void {
    if (revision === this.#revision) return;
    this.#revision = revision;
    this.#sequence = 0;
    this.#aliasSequence = 0;
    this.#idToAlias.clear();
    this.#aliasToId.clear();
    this.#receipts.splice(0, this.#receipts.length, ...this.#sourceReceipts.values());
    this.#nodeFacts.clear();
    this.#activeNodeIds.clear();
  }

  registerNodeIds(nodeIds: string[]): void {
    for (const nodeId of nodeIds) this.alias(nodeId);
  }

  markActive(nodeIds: string[]): void {
    for (const nodeId of nodeIds) {
      this.alias(nodeId);
      this.#activeNodeIds.add(nodeId);
    }
    while (this.#activeNodeIds.size > 64) {
      const oldest = this.#activeNodeIds.values().next().value as string | undefined;
      if (!oldest) break;
      this.#activeNodeIds.delete(oldest);
    }
  }

  activeNodeIds(limit = 48): string[] {
    return [...this.#activeNodeIds].slice(-Math.max(0, limit));
  }

  alias(nodeId: string): string {
    const existing = this.#idToAlias.get(nodeId);
    if (existing) return existing;
    const alias = `g${++this.#aliasSequence}`;
    this.#idToAlias.set(nodeId, alias);
    this.#aliasToId.set(alias, nodeId);
    return alias;
  }

  aliasesByNode(): Record<string, string> {
    return Object.fromEntries(this.#idToAlias);
  }

  resolveAliases(value: unknown): unknown {
    return resolveIdentifierAliases(value, this.#aliasToId);
  }

  projectValue(value: unknown): unknown {
    return bounded(transformStrings(value, (text) => this.#idToAlias.get(text) ?? text));
  }

  record(result: ModelToolResult): void {
    if (result.receipt.revisionBefore !== this.#revision) return;
    this.registerNodeIds(result.receipt.affectedNodeIds);
    this.markActive(result.receipt.affectedNodeIds);
    const ref = `e${++this.#sequence}`;
    if (result.receipt.tool === 'inspect_nodes') this.#recordNodeFacts(ref, result.output);
    const output = compactToolOutput(result.receipt.tool, result.output);
    const receipt: ContextEvidenceReceipt = {
      ref,
      tool: result.receipt.tool,
      status: result.receipt.status,
      affected: result.receipt.affectedNodeIds.slice(0, 32).map((id) => this.alias(id)),
      affectedCount: result.receipt.affectedNodeIds.length,
      durationMs: result.receipt.durationMs,
      ...(output === undefined ? {} : { output: this.projectValue(output) }),
      ...(result.receipt.error ? { error: structuredClone(result.receipt.error) } : {}),
    };
    if (isRevisionIndependentSourceTool(result.receipt.tool)
      && result.receipt.status === 'succeeded') {
      this.#sourceReceipts.set(result.receipt.tool, structuredClone(receipt));
    }
    if (result.receipt.status === 'succeeded'
      && CANDIDATE_PREVIEW_TOOLS.has(result.receipt.tool)
      && typeof asRecord(result.output)?.previewHandle === 'string') {
      for (let index = this.#receipts.length - 1; index >= 0; index -= 1) {
        if (CANDIDATE_PREVIEW_TOOLS.has(this.#receipts[index].tool)) {
          this.#receipts.splice(index, 1);
        }
      }
    }
    this.#receipts.push(receipt);
    if (this.#receipts.length > MAX_RECEIPTS) this.#receipts.shift();
  }

  project(options: { excludeNodeIds?: string[] } = {}): RevisionContextProjection {
    const excluded = new Set((options.excludeNodeIds ?? []).map((id) => this.#idToAlias.get(id) ?? id));
    return structuredClone({
      revision: this.#revision,
      receipts: this.#receipts,
      nodeFacts: [...this.#nodeFacts.entries()]
        .filter(([alias]) => !excluded.has(alias))
        .map(([, fact]) => fact)
        .slice(-MAX_NODE_FACTS),
    });
  }

  #recordNodeFacts(ref: string, output: unknown): void {
    const record = asRecord(output);
    if (!record || !Array.isArray(record.nodes)) return;
    for (const raw of record.nodes.slice(0, MAX_NODE_FACTS)) {
      const entry = asRecord(raw);
      const node = asRecord(entry?.node);
      if (!node || typeof node.id !== 'string') continue;
      const alias = this.alias(node.id);
      this.#nodeFacts.set(alias, { ref, node: this.projectValue(raw) });
    }
  }
}

function isRevisionIndependentSourceTool(tool: string): boolean {
  return tool === 'vectorize_image' || tool === 'inspect_source_overview';
}

function compactToolOutput(tool: string, output: unknown): unknown {
  if (output === undefined) return undefined;
  const record = asRecord(output);
  if (!record) return bounded(output);
  if (tool === 'preview_spatial_program') return compactSpatialProgramOutput(record);
  const omitted = new Set([
    'observation', 'views', 'vectorDigest', 'interactionFrame',
    'imageDataUrl', 'image', 'rgba', 'bytes',
  ]);
  if (tool === 'inspect_nodes') omitted.add('nodes');
  return bounded(Object.fromEntries(Object.entries(record).filter(([key]) => !omitted.has(key))));
}

function compactSpatialProgramOutput(record: Record<string, unknown>): unknown {
  const operationReceipts = Array.isArray(record.operationReceipts)
    ? record.operationReceipts.slice(0, 64).flatMap((raw) => {
      const receipt = asRecord(raw);
      if (!receipt) return [];
      return [{
        operationIndex: receipt.operationIndex,
        kind: receipt.kind,
        affectedNodeIds: receipt.affectedNodeIds,
        resolvedPoints: receipt.resolvedPoints,
      }];
    })
    : undefined;
  return bounded({
    status: record.status,
    previewHandle: record.previewHandle,
    hardValid: record.hardValid,
    validationValid: record.validationValid,
    goalSatisfied: record.goalSatisfied,
    affectedNodeIds: record.affectedNodeIds,
    spatialProgram: record.spatialProgram,
    ...(operationReceipts ? { operationReceipts } : {}),
    programDiagnostics: record.programDiagnostics,
    diagnostics: record.diagnostics,
    editBase: record.editBase,
  });
}

function transformStrings(value: unknown, transform: (value: string) => string): unknown {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map((item) => transformStrings(item, transform));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, transformStrings(item, transform)]));
}

function resolveIdentifierAliases(
  value: unknown,
  aliases: ReadonlyMap<string, string>,
  identifierContext = true,
): unknown {
  if (typeof value === 'string') return identifierContext
    ? resolveReferenceAlias(value, aliases)
    : value;
  if (Array.isArray(value)) {
    return value.map((item) => resolveIdentifierAliases(item, aliases, identifierContext));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    resolveIdentifierAliases(item, aliases, isIdentifierField(key)),
  ]));
}

function isIdentifierField(key: string): boolean {
  if (/^(sourceId|regionId|toolCallId|previewHandle|handle|evidenceHandle|requestId|optionId)$/i.test(key)) {
    return false;
  }
  return key === 'id'
    || key === 'ids'
    || key === 'ref'
    || /(?:node|geometry|annotation|relation|feature|resource)(?:Id|Ids)$/i.test(key)
    || /^(selectedIds|sourceIds|resultIds|hideCommittedIds|showCommittedIds|removeIds)$/i.test(key)
    || /^(targetRefs|preserveRefs|interfaceRefs|nodeRefs|preserveNodeRefs|targetNodeRefs)$/i.test(key);
}

function resolveReferenceAlias(value: string, aliases: ReadonlyMap<string, string>): string {
  const exact = aliases.get(value);
  if (exact) return exact;
  const separator = value.indexOf(':');
  if (separator <= 0) return value;
  const prefix = value.slice(0, separator + 1);
  const suffix = value.slice(separator + 1);
  const resolved = aliases.get(suffix);
  return resolved ? `${prefix}${resolved}` : value;
}

function bounded(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length <= 1_200 ? value : `${value.slice(0, 1_200)}…`;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === undefined) return undefined;
  if (depth >= 8) return '[bounded]';
  if (Array.isArray(value)) return value.slice(0, 64).map((item) => bounded(item, depth + 1));
  if (typeof value !== 'object') return String(value);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .slice(0, 64)
    .filter(([key]) => !/reasoning|thought|chain.?of.?thought|modelname/i.test(key))
    .map(([key, item]) => [key, bounded(item, depth + 1)]));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
