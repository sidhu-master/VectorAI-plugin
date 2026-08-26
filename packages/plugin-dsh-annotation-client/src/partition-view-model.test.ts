// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import { describe, expect, it } from 'vitest';

import { partitionBands } from './partition-view-model';

const draft: PartitionDraft = {
  version: 1,
  drawingRef: { drawingId: 'drawing-1', revision: 1 },
  axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 30, orientation: 'forward' },
  segments: [
    { id: 's1', zStart: 0, zEnd: 8, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
    { id: 's2', zStart: 8, zEnd: 10, profile: { minRadius: 5, maxRadius: 6, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
    { id: 's3', zStart: 10, zEnd: 22, profile: { minRadius: 6, maxRadius: 7, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
    { id: 's4', zStart: 22, zEnd: 30, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] },
  ],
  semanticGroups: [
    { id: 'bearing', segmentIds: ['s1'], semanticType: 'bearing-seat', name: '左轴承位', evidenceIds: ['document:bearing'] },
    { id: 'gear', segmentIds: ['s3'], range: { zStart: 12, zEnd: 18 }, semanticType: 'gear', name: '齿轮区域', evidenceIds: ['document:gear'] },
  ],
  stepCandidates: [],
  evidence: [
    { id: 'document:bearing', origin: 'document', label: '左轴承位' },
    { id: 'document:gear', origin: 'document', label: '齿轮区域' },
  ],
  diagnostics: [],
};

describe('partition view model', () => {
  it('leaves unclassified transition segments empty in the functional view', () => {
    expect(partitionBands(draft, 'functional').map(({ id, zStart, zEnd }) => [id, zStart, zEnd])).toEqual([
      ['bearing', 0, 8],
      ['gear', 12, 18],
    ]);
  });

  it('shows the complete contiguous geometry only in the axial-segment view', () => {
    expect(partitionBands(draft, 'segments').map(({ id, zStart, zEnd }) => [id, zStart, zEnd])).toEqual([
      ['s1', 0, 8], ['s2', 8, 10], ['s3', 10, 22], ['s4', 22, 30],
    ]);
  });

  it('hides a legacy generic AI work-area group instead of filling an intentional gap', () => {
    const legacy = structuredClone(draft);
    legacy.semanticGroups.push({
      id: 'legacy-ai-gap', segmentIds: ['s2'], semanticType: 'shaft-work-area', name: '外花键工作区', evidenceIds: ['ai:legacy'],
    });
    legacy.evidence.push({ id: 'ai:legacy', origin: 'ai', label: '旧版泛化分类' });
    expect(partitionBands(legacy, 'functional').map(({ id }) => id)).not.toContain('legacy-ai-gap');
  });
});
