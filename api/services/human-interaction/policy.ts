import { createHash } from 'node:crypto';

import type {
  PermissionGrant,
} from '../../../src/contracts/drawing-agent.js';
import type {
  DrawingCommand,
  DrawingDocument,
  DrawingTransaction,
} from '../../../src/drawing/index.js';
import type {
  HumanInteractionPolicyInput,
  HumanInteractionPolicyResult,
  HumanInteractionRequirement,
} from './types.js';

export interface PermissionGrantMatchInput {
  requestId?: string;
  episodeId: string;
  revision: DrawingTransaction['baseRevision'];
  transactionDigest: string;
  actions: string[];
  resourceIds: string[];
}

export class HumanInteractionPolicy {
  evaluate(input: HumanInteractionPolicyInput): HumanInteractionPolicyResult {
    const requirements = collectRequirements(input);
    if (requirements.length === 0) return { status: 'allowed', grantRefs: [] };

    const referencedIds = input.transaction.metadata?.decisionGrantRefs ?? [];
    const referenced = referencedIds.map((id) => input.grants.find((grant) => grant.id === id));
    const expected = {
      episodeId: input.transaction.metadata?.episodeId ?? '',
      revision: input.transaction.baseRevision,
      transactionDigest: digestDrawingTransaction(input.transaction),
      actions: requirements.map((requirement) => requirement.action),
      resourceIds: requirements.map((requirement) => requirement.resourceId),
    };
    const valid = referenced.filter((grant): grant is PermissionGrant => (
      grant !== undefined && permissionGrantMatches(grant, expected)
    ));
    const invalidGrantRefs = referencedIds.filter((id) => !valid.some((grant) => grant.id === id));
    const denied = valid.filter((grant) => grant.effect === 'deny');
    if (denied.length > 0) {
      return {
        status: 'denied',
        requirements,
        grantRefs: denied.map((grant) => grant.id),
      };
    }
    const allowed = valid.filter((grant) => grant.effect === 'allow');
    if (allowed.length > 0) {
      return { status: 'allowed', grantRefs: allowed.map((grant) => grant.id) };
    }
    return { status: 'decision_required', requirements, invalidGrantRefs };
  }
}

export function permissionGrantMatches(
  grant: PermissionGrant,
  expected: PermissionGrantMatchInput,
): boolean {
  return grant.scope === 'candidate'
    && (expected.requestId === undefined || grant.requestId === expected.requestId)
    && grant.episodeId === expected.episodeId
    && grant.revision === expected.revision
    && grant.transactionDigest === expected.transactionDigest
    && sameStringSet(grant.actions, expected.actions)
    && sameStringSet(grant.resourceIds, expected.resourceIds);
}

export function digestDrawingTransaction(transaction: DrawingTransaction): string {
  const metadata = transaction.metadata === undefined
    ? undefined
    : {
        ...transaction.metadata,
        decisionGrantRefs: undefined,
      };
  return createHash('sha256').update(canonicalJson({
    id: transaction.id,
    baseRevision: transaction.baseRevision,
    actor: transaction.actor,
    goalId: transaction.goalId,
    commands: transaction.commands,
    preconditions: transaction.preconditions,
    postconditions: transaction.postconditions,
    evidenceRefs: transaction.evidenceRefs,
    metadata,
  })).digest('hex');
}

function collectRequirements(input: HumanInteractionPolicyInput): HumanInteractionRequirement[] {
  const requirements = new Map<string, HumanInteractionRequirement>();
  for (const command of input.transaction.commands) {
    const resourceId = commandResourceId(command);
    if (!resourceId) continue;
    const constraint = input.document.relations.find((relation) => (
      relation.id === resourceId && relation.plane === 'constraint'
    ));
    const constraintAction = constraintMeaningChange(command, constraint);
    if (constraintAction) {
      addRequirement(requirements, {
        action: constraintAction,
        resourceId,
        reasonCode: 'EXISTING_CONSTRAINT_CHANGE',
      });
    }
    for (const protection of input.protections) {
      if (protection.resourceId !== resourceId) continue;
      if (!protection.actions.includes('*') && !protection.actions.includes(command.type)) continue;
      addRequirement(requirements, {
        action: command.type,
        resourceId,
        reasonCode: 'PROTECTED_RESOURCE_CHANGE',
      });
    }
  }
  return [...requirements.values()].sort((left, right) => (
    `${left.action}\u0000${left.resourceId}`.localeCompare(`${right.action}\u0000${right.resourceId}`)
  ));
}

function constraintMeaningChange(
  command: DrawingCommand,
  constraint: DrawingDocument['relations'][number] | undefined,
): string | null {
  if (!constraint || constraint.plane !== 'constraint') return null;
  if (command.type === 'relation.delete') return 'constraint.delete';
  if (command.type !== 'relation.update') return null;
  const changes = Object.keys(command.changes);
  return changes.some((field) => field !== 'status') ? 'constraint.update' : null;
}

function commandResourceId(command: DrawingCommand): string | null {
  if (command.type === 'history.revert' || 'value' in command) return null;
  return command.id;
}

function addRequirement(
  target: Map<string, HumanInteractionRequirement>,
  requirement: HumanInteractionRequirement,
): void {
  target.set(`${requirement.action}\u0000${requirement.resourceId}`, requirement);
}

function sameStringSet(left: string[], right: string[]): boolean {
  const normalize = (values: string[]) => [...new Set(values)].sort();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item)]));
}
