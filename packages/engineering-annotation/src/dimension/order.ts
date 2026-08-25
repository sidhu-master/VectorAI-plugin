// SPDX-License-Identifier: Apache-2.0

import type { EntityAnchor } from '@vectorai/drawing-core';
import type {
  AnnotationDependency,
  DimensionFunctionalRole,
  DimensionIntent,
  EngineeringDiagnostic,
} from './types';

export interface DimensionOrderResult {
  orderedIntentIds: string[];
  diagnostics: EngineeringDiagnostic[];
}

const ROLE_RANK: Record<DimensionFunctionalRole, number> = {
  datum: 0,
  overall: 1,
  functional: 2,
  assembly: 2,
  process: 3,
  inspection: 3,
  closure: 5,
  auxiliary: 6,
};

export function orderDimensionIntents(input: {
  intents: DimensionIntent[];
  dependencies: AnnotationDependency[];
}): DimensionOrderResult {
  const diagnostics: EngineeringDiagnostic[] = [];
  const intentsById = new Map<string, DimensionIntent>();
  const duplicateIds = new Set<string>();
  for (const intent of input.intents) {
    if (intentsById.has(intent.id)) duplicateIds.add(intent.id);
    else intentsById.set(intent.id, intent);
  }
  if (duplicateIds.size > 0) {
    diagnostics.push(issue(
      'DIMENSION_ID_DUPLICATE',
      '尺寸意图 ID 必须唯一，无法生成稳定顺序。',
      [...duplicateIds].sort(),
    ));
  }

  const outgoing = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const id of intentsById.keys()) {
    outgoing.set(id, new Set());
    indegree.set(id, 0);
  }

  const unknownIds = new Set<string>();
  for (const dependency of input.dependencies) {
    const beforeKnown = intentsById.has(dependency.beforeIntentId);
    const afterKnown = intentsById.has(dependency.afterIntentId);
    if (!beforeKnown) unknownIds.add(dependency.beforeIntentId);
    if (!afterKnown) unknownIds.add(dependency.afterIntentId);
    if (!beforeKnown || !afterKnown) continue;
    const targets = outgoing.get(dependency.beforeIntentId)!;
    if (targets.has(dependency.afterIntentId)) continue;
    targets.add(dependency.afterIntentId);
    indegree.set(dependency.afterIntentId, indegree.get(dependency.afterIntentId)! + 1);
  }
  if (unknownIds.size > 0) {
    diagnostics.push(issue(
      'DIMENSION_DEPENDENCY_UNKNOWN',
      '尺寸依赖引用了不存在的尺寸意图。',
      [...unknownIds].sort(),
    ));
  }

  const compare = (firstId: string, secondId: string): number => {
    const first = intentsById.get(firstId)!;
    const second = intentsById.get(secondId)!;
    return ROLE_RANK[first.functionalRole] - ROLE_RANK[second.functionalRole]
      || targetKey(first).localeCompare(targetKey(second))
      || first.id.localeCompare(second.id);
  };
  const ready = [...intentsById.keys()].filter((id) => indegree.get(id) === 0).sort(compare);
  const orderedIntentIds: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift()!;
    orderedIntentIds.push(current);
    const nextIds = [...outgoing.get(current)!].sort(compare);
    for (const nextId of nextIds) {
      const nextDegree = indegree.get(nextId)! - 1;
      indegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        ready.push(nextId);
        ready.sort(compare);
      }
    }
  }

  if (orderedIntentIds.length !== intentsById.size) {
    const emitted = new Set(orderedIntentIds);
    const blockedIds = [...intentsById.keys()].filter((id) => !emitted.has(id)).sort();
    diagnostics.push(issue(
      'DIMENSION_DEPENDENCY_CYCLE',
      '尺寸依赖图存在环，不能静默打破依赖关系。',
      blockedIds,
    ));
  }

  return { orderedIntentIds, diagnostics };
}

function targetKey(intent: DimensionIntent): string {
  return intent.targets
    .map((target) => `${target.geometryId}:${anchorKey(target.anchor)}`)
    .sort()
    .join('|');
}

function anchorKey(anchor: EntityAnchor): string {
  switch (anchor.kind) {
    case 'start':
    case 'end':
    case 'center':
      return anchor.kind;
    case 'vertex':
      return `vertex:${anchor.index}`;
    case 'curve-parameter':
      return `curve-parameter:${anchor.parameter}`;
    case 'nearest':
      return `nearest:${anchor.point[0]}:${anchor.point[1]}`;
  }
}

function issue(code: string, message: string, entityIds: string[]): EngineeringDiagnostic {
  return {
    id: `dimension-order:${code}:${entityIds.join(',')}`,
    severity: 'error',
    code,
    message,
    entityIds,
  };
}
