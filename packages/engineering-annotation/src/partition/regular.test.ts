// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { inferRegularShaftRegions } from './regular';
import type { PartitionDraft, ShaftPartitionSegment } from './types';

describe('regular shaft region inference', () => {
  it('fills a substantial bounded run but leaves a short transition unclassified', () => {
    const draft = makeDraft();

    const result = inferRegularShaftRegions(draft);

    expect(result.semanticGroups).toContainEqual(expect.objectContaining({
      name: '常规区域', semanticType: 'regular-shaft',
      segmentIds: ['segment:41.5-53', 'segment:53-92'],
      range: { zStart: 41.5, zEnd: 92 },
    }));
    expect(result.evidence.find(({ id }) => id.startsWith('fused:regular:'))?.origin).toBe('fused');
    expect(result.segments.find(({ id }) => id === 'segment:147-150')?.semanticType).toBeUndefined();
  });

  it('does not fill a gap bounded by AI-only or ambiguous document classifications', () => {
    const aiBounded = makeDraft();
    aiBounded.evidence = aiBounded.evidence.filter(({ id }) => id !== 'document:gear');
    aiBounded.evidence.push({ id: 'ai:gear', origin: 'ai', label: 'AI gear' });
    aiBounded.semanticGroups.find(({ id }) => id === 'gear')!.evidenceIds = ['ai:gear'];
    expect(inferRegularShaftRegions(aiBounded).semanticGroups.some(({ name }) => name === '常规区域')).toBe(false);

    const ambiguous = makeDraft();
    ambiguous.diagnostics.push({
      id: 'ambiguous:gear', severity: 'warning', code: 'DOCUMENT_REGION_AMBIGUOUS',
      message: 'tie', evidenceIds: ['document:gear'],
    });
    expect(inferRegularShaftRegions(ambiguous).semanticGroups.some(({ name }) => name === '常规区域')).toBe(false);
  });

  it('does not fill a run when document functional ranges overlap its boundaries', () => {
    const overlapping = makeDraft();
    overlapping.semanticGroups.find(({ id }) => id === 'spline')!.range = { zStart: 17, zEnd: 45 };
    overlapping.semanticGroups.find(({ id }) => id === 'gear')!.range = { zStart: 88, zEnd: 147 };

    expect(inferRegularShaftRegions(overlapping).semanticGroups.some(({ name }) => name === '常规区域')).toBe(false);
  });
});

function makeDraft(): PartitionDraft {
  const segments = [
    segment(0, 17, 'bearing', '左轴承位'),
    segment(17, 41.5, 'spline', '外花键'),
    segment(41.5, 53),
    segment(53, 92),
    segment(92, 147, 'gear', '一级齿轮'),
    segment(147, 150),
    segment(150, 173, 'bearing', '右轴承位'),
  ];
  const group = (id: string, segmentId: string, semanticType: string, name: string) => {
    const item = segments.find((candidate) => candidate.id === segmentId)!;
    return { id, segmentIds: [segmentId], range: { zStart: item.zStart, zEnd: item.zEnd }, semanticType, name, evidenceIds: [`document:${id}`] };
  };
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing:test', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 173, orientation: 'forward' },
    segments,
    semanticGroups: [
      group('left', 'segment:0-17', 'bearing', '左轴承位'),
      group('spline', 'segment:17-41.5', 'spline', '外花键'),
      group('gear', 'segment:92-147', 'gear', '一级齿轮'),
      group('right', 'segment:150-173', 'bearing', '右轴承位'),
    ],
    stepCandidates: [],
    evidence: ['left', 'spline', 'gear', 'right'].map((id) => ({ id: `document:${id}`, origin: 'document' as const, label: id })),
    diagnostics: [],
  };
}

function segment(zStart: number, zEnd: number, semanticType?: string, name?: string): ShaftPartitionSegment {
  return {
    id: `segment:${zStart}-${zEnd}`,
    zStart, zEnd,
    profile: { minRadius: 10, maxRadius: 20, sampleCount: 2 },
    boundaryConfidence: 1,
    geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
    ...(semanticType === undefined ? {} : { semanticType }),
    ...(name === undefined ? {} : { name }),
  };
}
