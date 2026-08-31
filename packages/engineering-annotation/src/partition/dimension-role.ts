// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft, PartitionRevision, ShaftDimensionRole, ShaftSemanticGroup } from './types';

export function resolveShaftDimensionRole(
  group: ShaftSemanticGroup,
  partition: PartitionDraft | PartitionRevision,
): ShaftDimensionRole {
  if (group.dimensionRole) return group.dimensionRole;
  const semanticType = group.semanticType.toLowerCase();
  if (semanticType === 'regular-shaft') return 'ordinary';
  if (semanticType === 'shoulder') return 'process-datum';
  if (semanticType === 'shaft-seat' && hasOnlyAiEvidence(group, partition)) return 'ordinary';
  return 'functional-feature';
}

function hasOnlyAiEvidence(
  group: ShaftSemanticGroup,
  partition: PartitionDraft | PartitionRevision,
): boolean {
  const evidence = group.evidenceIds
    .map((id) => partition.evidence.find((item) => item.id === id))
    .filter((item) => item !== undefined);
  return evidence.length > 0 && evidence.every(({ origin }) => origin === 'ai');
}
