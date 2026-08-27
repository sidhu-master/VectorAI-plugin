// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import { fuseDocumentRegions } from './fuse';
import type { PartitionDraft, ShaftPartitionSegment } from './types';

describe('document region reconciliation', () => {
  it('uses a width-and-diameter matching geometric range when the document center conflicts', () => {
    const draft = makeDraft([
      segment(0, 41.5, 45),
      segment(41.5, 92, 56.3),
      segment(92, 147, 57.03),
      segment(147, 150, 55.9),
      segment(150, 173, 35),
    ]);
    const region: EngineeringRegionEvidence = {
      id: 'G01', type: 'gear', name: '一级齿轮',
      interval: { start: 63.5, end: 118.5 }, outerDiameter: 57.03,
      sourceLines: [20, 23, 26, 29],
    };

    const result = fuseDocumentRegions(draft, [region]);

    expect(result.semanticGroups[0]).toMatchObject({
      name: '一级齿轮',
      segmentIds: ['segment:92-147'],
      range: { zStart: 92, zEnd: 147 },
    });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'DOCUMENT_REGION_RECONCILED',
      segmentIds: ['segment:92-147'],
    }));
  });

  it('preserves the source range and leaves segments unclassified when geometric matches tie', () => {
    const draft = makeDraft([
      segment(0, 10, 20), segment(10, 20, 5), segment(20, 30, 20),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'G01', type: 'gear', name: '齿轮', interval: { start: 10, end: 20 },
      outerDiameter: 20, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]?.range).toEqual({ zStart: 10, zEnd: 20 });
    expect(result.segments.every(({ semanticType }) => semanticType === undefined)).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'DOCUMENT_REGION_AMBIGUOUS' }));
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ code: 'DOCUMENT_REGION_RECONCILED' }));
  });

  it('keeps an unmatched document interval available for manual review', () => {
    const draft = makeDraft([
      segment(0, 10, 20), segment(10, 20, 20), segment(20, 30, 20), segment(30, 40, 20),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'S01', type: 'spline', name: '短花键', interval: { start: 19.5, end: 20.5 },
      outerDiameter: 80, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({ name: '短花键', range: { zStart: 19.5, zEnd: 20.5 } });
    expect(result.semanticGroups[0]?.segmentIds.length).toBeGreaterThan(0);
    expect(result.segments.every(({ semanticType }) => semanticType === undefined)).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'DOCUMENT_REGION_UNMATCHED' }));
  });

  it('does not let one matching maximum diameter hide a mixed-profile candidate', () => {
    const draft = makeDraft([
      segment(0, 40, 40), segment(40, 50, 57), segment(50, 60, 40), segment(60, 80, 57),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'G01', type: 'gear', name: '齿轮', interval: { start: 40, end: 60 },
      outerDiameter: 57, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({
      segmentIds: ['segment:60-80'], range: { zStart: 60, zEnd: 80 },
    });
  });

  it('does not treat a mostly unprofiled candidate as a diameter match', () => {
    const draft = makeDraft([
      segment(0, 20, 57, 2),
      segment(20, 38, 57, 0), segment(38, 40, 57, 2),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'G01', type: 'gear', name: '齿轮', interval: { start: 20, end: 40 },
      outerDiameter: 57, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({
      segmentIds: ['segment:0-20'], range: { zStart: 0, zEnd: 20 },
    });
  });
});

function makeDraft(segments: ShaftPartitionSegment[]): PartitionDraft {
  const zMax = segments.at(-1)!.zEnd;
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing:test', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax, orientation: 'forward' },
    segments,
    semanticGroups: [],
    stepCandidates: [],
    evidence: [],
    diagnostics: [],
  };
}

function segment(zStart: number, zEnd: number, diameter: number, sampleCount = 2): ShaftPartitionSegment {
  return {
    id: `segment:${zStart}-${zEnd}`,
    zStart, zEnd,
    profile: { minRadius: diameter / 2, maxRadius: diameter / 2, sampleCount },
    boundaryConfidence: 1,
    geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
  };
}
