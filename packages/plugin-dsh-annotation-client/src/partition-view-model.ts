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

export function partitionSnapTolerance(axisSpan: number, scale: number): number {
  const span = Math.max(Math.abs(axisSpan), 1e-6);
  const screenRadius = 8 / Math.max(Math.abs(scale), 1e-6);
  return Math.max(span * 1e-5, Math.min(screenRadius, span * 0.03));
}

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
    const origin = evidenceOrigin(draft, group.evidenceIds) ?? 'geometry';
    if (origin === 'ai' && isGenericFunctionalGroup(group.semanticType, group.name)) return [];
    const indices = group.segmentIds
      .map((id) => indexById.get(id))
      .filter((index): index is number => index !== undefined)
      .sort((a, b) => a - b);
    if (indices.length === 0) return [];
    const startBoundaryIndex = indices[0]!;
    const endBoundaryIndex = indices.at(-1)! + 1;
    const segments = indices.map((index) => draft.segments[index]!);
    const zStart = group.range?.zStart ?? segments[0]!.zStart;
    const zEnd = group.range?.zEnd ?? segments.at(-1)!.zEnd;
    return [{
      id: group.id,
      segmentIds: segments.map(({ id }) => id),
      segments,
      zStart,
      zEnd,
      startBoundaryIndex,
      endBoundaryIndex,
      ...(group.name === undefined ? {} : { name: group.name }),
      semanticType: group.semanticType,
      origin,
    }];
  }).sort((a, b) => a.zStart - b.zStart || a.zEnd - b.zEnd);
}

function isGenericFunctionalGroup(semanticType: string, name?: string): boolean {
  return /(?:work[-_ ]?area|working[-_ ]?area|工作区域|工作区|普通轴段|常规区域|shaft[-_ ]?region)/u
    .test(`${semanticType} ${name ?? ''}`.toLowerCase());
}

function evidenceOrigin(draft: PartitionViewSource, evidenceIds: readonly string[]): string | undefined {
  return evidenceIds
    .map((id) => draft.evidence.find((item) => item.id === id)?.origin)
    .find(Boolean);
}
