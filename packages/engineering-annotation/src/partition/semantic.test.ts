// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { applySemanticProposals, type PartitionDraft } from '../index';

const draft: PartitionDraft = {
  version: 1, drawingRef: { drawingId: 'd', revision: 1 },
  axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 2, orientation: 'forward' },
  segments: [0, 1].map((z) => ({ id: `segment:${z + 1}`, zStart: z, zEnd: z + 1, profile: { minRadius: 1, maxRadius: 1, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] })),
  semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
};

describe('bounded AI semantic proposals', () => {
  it('applies known IDs without changing geometry boundaries', () => {
    const result = applySemanticProposals(draft, [{ segmentIds: ['segment:2'], semanticType: 'bearing-seat', name: '轴承位', confidence: 0.82, reason: 'constant seat', visualEvidenceIds: ['observation:segment:2'] }]);
    expect(result.draft.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([[0, 1], [1, 2]]);
    expect(result.draft.evidence.at(-1)?.origin).toBe('ai');
    expect(result.draft.segments[1]).toMatchObject({ semanticType: 'bearing-seat', semanticConfidence: 0.82 });
    expect(result.draft.semanticGroups[0]?.range).toEqual({ zStart: 1, zEnd: 2 });
  });

  it('persists an explicit dimension-chain role independently from the semantic label', () => {
    const result = applySemanticProposals(draft, [{
      segmentIds: ['segment:2'], semanticType: 'shoulder', dimensionRole: 'process-datum',
      name: '定位轴肩', confidence: 0.9, reason: '相邻功能区之间的轴向定位面',
      visualEvidenceIds: ['observation:segment:2'],
    }]);

    expect(result.draft.semanticGroups[0]).toMatchObject({
      semanticType: 'shoulder', dimensionRole: 'process-datum',
    });
  });

  it('abstains from low-confidence, generic, and incompletely evidenced proposals', () => {
    const proposals = [
      { segmentIds: ['segment:1'], semanticType: 'shaft-work-area', name: '工作区域', confidence: 0.95, reason: '普通连续外形', visualEvidenceIds: ['observation:segment:1'] },
      { segmentIds: ['segment:1'], semanticType: 'gear', name: '齿轮', confidence: 0.6, reason: '可能有齿', visualEvidenceIds: ['observation:segment:1'] },
      { segmentIds: ['segment:2'], semanticType: 'bearing-seat', name: '轴承位', confidence: 0.95, reason: '明确圆柱定位面', visualEvidenceIds: [] },
    ];
    const result = applySemanticProposals(draft, proposals, {
      allowedSegmentIds: ['segment:1', 'segment:2'],
      allowedVisualEvidenceIds: ['observation:segment:1', 'observation:segment:2'],
    });
    expect(result.applied).toBe(0);
    expect(result.draft.semanticGroups).toEqual([]);
  });

  it('clips an AI segment-derived range to the still-uncovered interval', () => {
    const source = structuredClone(draft);
    source.semanticGroups = [{
      id: 'document:gear', segmentIds: ['segment:1'], range: { zStart: 0.4, zEnd: 1.4 },
      semanticType: 'gear', evidenceIds: [],
    }];
    const result = applySemanticProposals(source, [{
      segmentIds: ['segment:2'], semanticType: 'spline', name: '内花键', confidence: 0.9,
      reason: '可见重复花键齿形', visualEvidenceIds: ['observation:segment:2'],
    }]);
    expect(result.applied).toBe(1);
    expect(result.draft.semanticGroups.at(-1)?.range).toEqual({ zStart: 1.4, zEnd: 2 });
  });

  it('rejects hallucinated IDs and coordinate-bearing output', () => {
    expect(() => applySemanticProposals(draft, [{ segmentIds: ['hallucinated'], semanticType: 'gear', confidence: 1, reason: 'unknown', visualEvidenceIds: [] }])).toThrow('AI_SEGMENT_ID_UNKNOWN');
    expect(() => applySemanticProposals(draft, [{ segmentIds: ['segment:1'], semanticType: 'gear', confidence: 1, reason: 'x=12 move boundary', visualEvidenceIds: [] }])).toThrow('AI_SEMANTIC_REASON_COORDINATES');
    expect(() => applySemanticProposals(draft, [{ segmentIds: ['segment:1'], semanticType: 'gear', confidence: 1, reason: 'visible teeth', visualEvidenceIds: ['unknown'] }], {
      allowedSegmentIds: ['segment:2'], allowedVisualEvidenceIds: ['observation:segment:2'],
    })).toThrow('AI_VISUAL_EVIDENCE_UNKNOWN');
  });
});
