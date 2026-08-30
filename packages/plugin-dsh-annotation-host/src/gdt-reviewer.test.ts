// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { completeShaftGdtRecommendation, evaluateShaftGdtCoverage, groundSegmentRecommendation } from './gdt-reviewer';

describe('automatic GD&T segment grounding', () => {
  it('matches the golden shaft structural oracle without embedding golden coordinates or values', () => {
    const segment = (id: string, zStart: number, zEnd: number, semanticType: string, name: string) => ({
      id, zStart, zEnd, semanticType, name,
      profile: { minRadius: 5, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1,
      geometryNodeIds: [`edge:${id}`], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
    });
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'generic-shaft', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 173, orientation: 'forward' },
      segments: [
        segment('bearing:left', 0, 17, 'bearing', '左轴承位'),
        segment('spline', 17, 41.5, 'spline', '外花键'),
        segment('gear', 92, 147, 'gear', '一级齿轮'),
        segment('bearing:right', 150, 173, 'bearing', '右轴承位'),
      ], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };

    const completed = completeShaftGdtRecommendation(partition, { datums: [], controls: [] });

    expect(completed.datums).toEqual([
      expect.objectContaining({ name: 'A', segmentId: 'bearing:right', role: 'primary' }),
      expect.objectContaining({ name: 'B', segmentId: 'bearing:left', role: 'secondary' }),
    ]);
    expect(completed.controls).toHaveLength(8);
    expect(countCharacteristics(completed.controls)).toEqual({
      circularity: 2, cylindricity: 2, 'circular-runout': 4,
    });
    expect(completed.controls.filter(({ characteristic }) => characteristic === 'circular-runout'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ segmentIds: ['bearing:left'], datumNames: ['A', 'B'] }),
        expect.objectContaining({ segmentIds: ['bearing:right'], datumNames: ['A', 'B'] }),
        expect.objectContaining({ segmentIds: ['spline'], datumNames: ['A', 'B'] }),
        expect.objectContaining({ segmentIds: ['gear'], datumNames: ['A', 'B'] }),
      ]));
    expect(evaluateShaftGdtCoverage(partition, completed)).toMatchObject({
      complete: true, requiredDatumCount: 2, requiredControlCount: 8,
    });
  });

  it('keeps AI authority semantic and chooses axial/radial geometry locally', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const geometry = [
      { id: 'global-axial' as GeometryId, type: 'line' as const, start: [-100, -5] as [number, number], end: [100, -5] as [number, number], visible: true, quality },
      { id: 'bearing-axial' as GeometryId, type: 'line' as const, start: [0, 5] as [number, number], end: [20, 5] as [number, number], visible: true, quality },
      { id: 'bearing-radial' as GeometryId, type: 'line' as const, start: [20, -5] as [number, number], end: [20, 5] as [number, number], visible: true, quality },
      { id: 'shoulder-axial' as GeometryId, type: 'line' as const, start: [20, 8] as [number, number], end: [30, 8] as [number, number], visible: true, quality },
      { id: 'shoulder-radial' as GeometryId, type: 'line' as const, start: [20, 5] as [number, number], end: [20, 8] as [number, number], visible: true, quality },
    ];
    const segment = (id: string, geometryNodeIds: string[]) => ({
      id, zStart: 0, zEnd: 20, profile: { minRadius: 5, maxRadius: 5, sampleCount: 2 },
      boundaryConfidence: 1, geometryNodeIds, boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
    });
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'drawing-1', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 30, orientation: 'forward' },
      segments: [segment('bearing', ['global-axial', 'bearing-radial', 'bearing-axial']), segment('shoulder', ['shoulder-axial', 'shoulder-radial'])],
      semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };

    expect(groundSegmentRecommendation(geometry, partition, {
      datums: [{ name: 'A', segmentId: 'bearing', role: 'primary', confidence: 0.95 }],
      controls: [{
        id: 'gdt:perpendicularity', characteristic: 'perpendicularity', segmentIds: ['shoulder'],
        datumNames: ['A'], toleranceZoneShape: 'linear', confidence: 0.9,
      }],
    })).toEqual({
      datums: [{ name: 'A', geometryId: 'bearing-axial', role: 'primary' }],
      controls: [{
        id: 'gdt:perpendicularity', characteristic: 'perpendicularity', geometryIds: ['shoulder-radial'],
        datumNames: ['A'], toleranceZoneShape: 'linear',
      }],
    });
  });
});

function countCharacteristics(controls: Array<{ characteristic: string }>): Record<string, number> {
  return controls.reduce<Record<string, number>>((counts, { characteristic }) => {
    counts[characteristic] = (counts[characteristic] ?? 0) + 1;
    return counts;
  }, {});
}
