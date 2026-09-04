// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { fuseDocumentRegions } from './fuse';
import type { PartitionDraft, ShaftPartitionSegment } from './types';

describe('axial segments and functional regions remain independent', () => {
  it('keeps continuous geometry while leaving semantic gaps sparse', () => {
    const draft = makeDraft([segment(0, 10, 20), segment(10, 20, 22), segment(20, 30, 20)]);
    const result = fuseDocumentRegions(draft, [
      { id: 'left', type: 'bearing-seat', interval: { start: 0, end: 8 }, sourceLines: [1] },
      { id: 'right', type: 'gear', interval: { start: 22, end: 30 }, sourceLines: [2] },
    ]);
    expect(result.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([[0, 10], [10, 20], [20, 30]]);
    expect(result.semanticGroups.map(({ range }) => range)).toEqual([
      { zStart: 0, zEnd: 8 }, { zStart: 22, zEnd: 30 },
    ]);
  });

  it('retains document and geometry evidence on a hard conflict', () => {
    const draft = makeDraft([segment(0, 10, 20), segment(10, 20, 40)]);
    draft.segments[0]!.boundaryEvidenceIds = ['geometry:step:0'];
    draft.segments[1]!.boundaryEvidenceIds = ['geometry:step:1'];
    const result = fuseDocumentRegions(draft, [{
      id: 'doc', type: 'bearing-seat', interval: { start: 0, end: 10 }, outerDiameter: 80, sourceLines: [7],
    }]);
    expect(result.semanticGroups[0]?.reconciliation?.status).toBe('conflict');
    expect(result.semanticGroups[0]?.evidenceIds).toEqual(expect.arrayContaining(['document:region:doc', 'geometry:step:1']));
    expect(result.segments.every(({ semanticType }) => semanticType === undefined)).toBe(true);
  });
});

function makeDraft(segments: ShaftPartitionSegment[]): PartitionDraft {
  return {
    version: 1, drawingRef: { drawingId: 'd', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: segments.at(-1)!.zEnd, orientation: 'forward' },
    segments, semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
  };
}

function segment(zStart: number, zEnd: number, diameter: number): ShaftPartitionSegment {
  return {
    id: `s:${zStart}:${zEnd}`, zStart, zEnd,
    profile: { minRadius: diameter / 2, maxRadius: diameter / 2, sampleCount: 2 },
    boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
  };
}
