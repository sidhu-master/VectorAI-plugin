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
  });

  it('rejects hallucinated IDs and coordinate-bearing output', () => {
    expect(() => applySemanticProposals(draft, [{ segmentIds: ['hallucinated'], semanticType: 'gear', confidence: 1, reason: 'unknown', visualEvidenceIds: [] }])).toThrow('AI_SEGMENT_ID_UNKNOWN');
    expect(() => applySemanticProposals(draft, [{ segmentIds: ['segment:1'], semanticType: 'gear', confidence: 1, reason: 'x=12 move boundary', visualEvidenceIds: [] }])).toThrow('AI_SEMANTIC_REASON_COORDINATES');
    expect(() => applySemanticProposals(draft, [{ segmentIds: ['segment:1'], semanticType: 'gear', confidence: 1, reason: 'visible teeth', visualEvidenceIds: ['unknown'] }], {
      allowedSegmentIds: ['segment:2'], allowedVisualEvidenceIds: ['observation:segment:2'],
    })).toThrow('AI_VISUAL_EVIDENCE_UNKNOWN');
  });
});
