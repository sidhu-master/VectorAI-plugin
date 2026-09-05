// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import { fuseDocumentRegions } from './fuse';
import type { PartitionDraft, ShaftPartitionSegment } from './types';

describe('document region reconciliation', () => {
  it('uses a unique width-and-diameter matching shoulder range when document station conflicts', () => {
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
      reconciliation: { status: 'matched', geometryRange: { zStart: 92, zEnd: 147 } },
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
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'DOCUMENT_REGION_CONFLICT' }));
  });

  it('keeps an explicit axial interval anchored when another station has a closer diameter', () => {
    const draft = makeDraft([
      segment(0, 40, 40), segment(40, 50, 57), segment(50, 60, 40), segment(60, 80, 57),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'G01', type: 'gear', name: '齿轮', interval: { start: 40, end: 60 },
      outerDiameter: 57, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({
      segmentIds: ['segment:40-50', 'segment:50-60'], range: { zStart: 40, zEnd: 60 },
    });
  });

  it('does not relocate an explicit axial interval to a remote profiled segment', () => {
    const draft = makeDraft([
      segment(0, 20, 57, 2),
      segment(20, 38, 57, 0), segment(38, 40, 57, 2),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'G01', type: 'gear', name: '齿轮', interval: { start: 20, end: 40 },
      outerDiameter: 57, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({
      segmentIds: ['segment:20-38', 'segment:38-40'], range: { zStart: 20, zEnd: 40 },
    });
  });

  it('preserves exact document boundaries when geometry differs only by curve tessellation', () => {
    const draft = makeDraft([
      segment(0, 198.10183, 98.115556),
      segment(198.10183, 200.89817, 83.5),
      segment(200.89817, 220, 88.5),
    ]);
    const result = fuseDocumentRegions(draft, [{
      id: 'U01',
      type: 'relief',
      name: '砂轮越程槽',
      interval: { start: 198, end: 201 },
      outerDiameter: 83.5,
      sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({
      segmentIds: ['segment:198.10183-200.89817'],
      range: { zStart: 198, zEnd: 201 },
      reconciliation: {
        status: 'matched',
        documentRange: { zStart: 198, zEnd: 201 },
        geometryRange: { zStart: 198.10183, zEnd: 200.89817 },
      },
    });
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'DOCUMENT_REGION_RECONCILED',
    }));
  });

  it('does not replace exact document bounds with nearby chamfer midpoints', () => {
    const draft = makeDraft([
      segment(0, 2.598, 55),
      segment(2.598, 21, 55),
      segment(21, 30, 50),
    ]);
    draft.stepCandidates = [
      step(0),
      step(2.598, 'fillet-or-groove'),
      step(21, 'chamfer'),
      step(30),
    ];

    const result = fuseDocumentRegions(draft, [{
      id: 'T01', type: 'thread', name: '左端锁紧螺纹',
      interval: { start: 2, end: 20 }, outerDiameter: 55, sourceLines: [1],
    }]);

    expect(result.semanticGroups[0]).toMatchObject({
      range: { zStart: 2, zEnd: 20 },
      reconciliation: { status: 'matched' },
    });
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'DOCUMENT_REGION_RECONCILED',
    }));
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

function step(z: number, transitionKind?: 'shoulder' | 'chamfer' | 'fillet-or-groove') {
  return {
    id: `step:${z}`,
    z,
    score: 1,
    evidenceIds: [],
    accepted: true,
    ...(transitionKind === undefined ? {} : { transitionKind }),
  };
}
