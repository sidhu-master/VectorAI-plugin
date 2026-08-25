// SPDX-License-Identifier: Apache-2.0

import type { PartitionDiagnostic, PartitionDraft } from './types';

export function validatePartition(draft: PartitionDraft): PartitionDiagnostic[] {
  const diagnostics: PartitionDiagnostic[] = [];
  const tolerance = Math.max(1e-8, Math.abs(draft.axis.zMax - draft.axis.zMin) * 1e-8);
  const ids = new Set<string>();
  const evidence = new Set(draft.evidence.map(({ id }) => id));
  for (const [index, segment] of draft.segments.entries()) {
    if (ids.has(segment.id)) diagnostics.push(problem('PARTITION_ID_DUPLICATE', `Duplicate segment ${segment.id}`, segment.id));
    ids.add(segment.id);
    if (![segment.zStart, segment.zEnd].every(Number.isFinite) || segment.zEnd - segment.zStart <= tolerance) {
      diagnostics.push(problem('PARTITION_SEGMENT_INVALID', `Invalid segment ${segment.id}`, segment.id));
    }
    if (index > 0) {
      const previous = draft.segments[index - 1]!;
      const delta = segment.zStart - previous.zEnd;
      if (delta > tolerance) diagnostics.push(problem('PARTITION_GAP', `Gap before ${segment.id}`, segment.id));
      if (delta < -tolerance) diagnostics.push(problem('PARTITION_OVERLAP', `Overlap before ${segment.id}`, segment.id));
    }
    for (const id of [...segment.boundaryEvidenceIds, ...segment.semanticEvidenceIds]) {
      if (!evidence.has(id)) diagnostics.push(problem('PARTITION_EVIDENCE_MISSING', `Missing evidence ${id}`, segment.id));
    }
  }
  if (draft.segments.length === 0
    || Math.abs(draft.segments[0]!.zStart - draft.axis.zMin) > tolerance
    || Math.abs(draft.segments.at(-1)!.zEnd - draft.axis.zMax) > tolerance) {
    diagnostics.push({ id: 'diagnostic:coverage', severity: 'error', code: 'PARTITION_COVERAGE', message: 'Segments must cover the shaft extent exactly once' });
  }
  for (const group of draft.semanticGroups) {
    if (group.segmentIds.some((id) => !ids.has(id)) || group.evidenceIds.some((id) => !evidence.has(id))) {
      diagnostics.push({ id: `diagnostic:group:${group.id}`, severity: 'error', code: 'PARTITION_GROUP_REFERENCE_INVALID', message: `Invalid references in group ${group.id}` });
    }
  }
  return diagnostics;
}

function problem(code: string, message: string, segmentId: string): PartitionDiagnostic {
  return { id: `diagnostic:${code}:${segmentId}`, severity: 'error', code, message, segmentIds: [segmentId] };
}
