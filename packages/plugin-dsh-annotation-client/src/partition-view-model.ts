// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';

export type PartitionViewMode = 'functional' | 'segments';

export interface PartitionBand {
  id: string;
  segmentIds: string[];
  segments: PartitionDraft['segments'];
  zStart: number;
  zEnd: number;
  startBoundaryIndex: number;
  endBoundaryIndex: number;
  name?: string;
  semanticType?: string;
  origin: string;
}

type PartitionViewSource = Pick<PartitionDraft, 'segments' | 'semanticGroups' | 'evidence'>;

export function partitionBands(draft: PartitionViewSource, mode: PartitionViewMode): PartitionBand[] {
  if (mode === 'segments') return draft.segments.map((segment, index) => ({
    id: segment.id,
    segmentIds: [segment.id],
    segments: [segment],
    zStart: segment.zStart,
    zEnd: segment.zEnd,
    startBoundaryIndex: index,
    endBoundaryIndex: index + 1,
    ...(segment.name === undefined ? {} : { name: segment.name }),
    ...(segment.semanticType === undefined ? {} : { semanticType: segment.semanticType }),
    origin: evidenceOrigin(draft, segment.semanticEvidenceIds) ?? 'geometry',
  }));

  const indexById = new Map(draft.segments.map((segment, index) => [segment.id, index]));
  return draft.semanticGroups.flatMap((group) => {
    const indices = group.segmentIds
      .map((id) => indexById.get(id))
      .filter((index): index is number => index !== undefined)
      .sort((a, b) => a - b);
    if (indices.length === 0) return [];
    const startBoundaryIndex = indices[0]!;
    const endBoundaryIndex = indices.at(-1)! + 1;
    const segments = indices.map((index) => draft.segments[index]!);
    return [{
      id: group.id,
      segmentIds: segments.map(({ id }) => id),
      segments,
      zStart: segments[0]!.zStart,
      zEnd: segments.at(-1)!.zEnd,
      startBoundaryIndex,
      endBoundaryIndex,
      ...(group.name === undefined ? {} : { name: group.name }),
      semanticType: group.semanticType,
      origin: evidenceOrigin(draft, group.evidenceIds) ?? 'geometry',
    }];
  }).sort((a, b) => a.zStart - b.zStart || a.zEnd - b.zEnd);
}

function evidenceOrigin(draft: PartitionViewSource, evidenceIds: readonly string[]): string | undefined {
  return evidenceIds
    .map((id) => draft.evidence.find((item) => item.id === id)?.origin)
    .find(Boolean);
}
