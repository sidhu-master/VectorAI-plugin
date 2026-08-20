import { createHash } from 'node:crypto';

export type ModelDecisionPhase =
  | 'initial'
  | 'tool-evidence'
  | 'preview-review'
  | 'user-feedback'
  | 'protocol-repair'
  | 'model-retry'
  | 'post-commit';

export interface ModelDecisionContext {
  sequence: number;
  phase: ModelDecisionPhase;
  escalationReason?: string;
  evidenceDelta: {
    evidenceRefs: string[];
    diagnosticCodes: string[];
    digest: string;
  };
}

export function createModelDecisionContext(input: {
  sequence: number;
  phase: ModelDecisionPhase;
  reason: string;
  evidenceRefs: string[];
  diagnosticCodes: string[];
}): ModelDecisionContext {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error('MODEL_DECISION_SEQUENCE_INVALID');
  }
  const evidenceRefs = unique(input.evidenceRefs.filter(Boolean));
  const diagnosticCodes = unique(input.diagnosticCodes.filter(Boolean));
  const reason = input.reason.trim();
  if (input.sequence > 1 && !reason) throw new Error('ESCALATION_REASON_REQUIRED');
  if (input.sequence > 1 && evidenceRefs.length === 0 && diagnosticCodes.length === 0) {
    throw new Error('ESCALATION_EVIDENCE_REQUIRED');
  }
  const evidenceDelta = {
    evidenceRefs,
    diagnosticCodes,
    digest: digest({ reason, evidenceRefs, diagnosticCodes }),
  };
  return {
    sequence: input.sequence,
    phase: input.phase,
    ...(input.sequence > 1 ? { escalationReason: reason } : {}),
    evidenceDelta,
  };
}

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, nested]) => [key, canonicalize(nested)]));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
