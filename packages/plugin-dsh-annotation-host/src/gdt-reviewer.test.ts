// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { completeShaftGdtRecommendation, evaluateShaftGdtCoverage, groundSegmentRecommendation } from './gdt-reviewer';

describe('automatic GD&T segment grounding', () => {
  it('builds the minimum datum system from referenced functional candidates', () => {
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
        segment('keyway', 41.5, 45, 'keyway', '键槽'),
        segment('journal:middle', 70, 86, 'bearing', '中间支承面'),
        segment('gear', 92, 147, 'gear', '一级齿轮'),
        segment('bearing:right', 150, 173, 'bearing', '右轴承位'),
      ], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };

    const reviewed = {
      datums: [
        { segmentId: 'bearing:right', function: 'axis-support' as const, confidence: 0.93 },
        { segmentId: 'keyway', function: 'clocking' as const, confidence: 0.97 },
        { segmentId: 'journal:middle', function: 'axis-support' as const, confidence: 0.99 },
        { segmentId: 'bearing:left', function: 'axis-support' as const, confidence: 0.91 },
      ],
      controls: [{
        id: 'reviewed:runout', characteristic: 'circular-runout' as const,
        segmentIds: ['gear'], datumSegmentIds: ['bearing:left', 'journal:middle', 'bearing:right', 'keyway'],
        toleranceZoneShape: 'linear' as const, confidence: 0.88,
      }],
    };
    const completed = completeShaftGdtRecommendation(partition, reviewed);

    expect(completed.datums).toEqual([
      { name: 'A', segmentId: 'bearing:left', role: 'primary', confidence: 0.91 },
      { name: 'B', segmentId: 'bearing:right', role: 'secondary', confidence: 0.93 },
    ]);
    expect(completed.controls).toEqual([expect.objectContaining({
      id: 'reviewed:runout', datumNames: ['A', 'B'],
    })]);
    expect(evaluateShaftGdtCoverage(partition, completed)).toMatchObject({
      complete: true, requiredDatumCount: 2, requiredControlCount: 1,
    });
  });

  it('keeps a third datum only when an accepted control references an independent constraint', () => {
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'unrelated-shaft', revision: 4 },
      axis: { origin: [12, -8], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 311, orientation: 'forward' },
      segments: [
        testSegment('journal-near', 9, 37),
        testSegment('stop-face', 112, 119),
        testSegment('clocking-flat', 203, 229),
      ], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };
    const completed = completeShaftGdtRecommendation(partition, {
      datums: [
        { segmentId: 'clocking-flat', function: 'clocking', confidence: 0.92 },
        { segmentId: 'journal-near', function: 'axis-support', confidence: 0.96 },
        { segmentId: 'stop-face', function: 'axial-stop', confidence: 0.9 },
      ],
      controls: [{
        id: 'position:feature', characteristic: 'position', segmentIds: ['clocking-flat'],
        datumSegmentIds: ['journal-near', 'stop-face', 'clocking-flat'],
        toleranceZoneShape: 'diametrical', confidence: 0.91,
      }],
    });

    expect(completed.datums.map(({ name, segmentId, role }) => ({ name, segmentId, role }))).toEqual([
      { name: 'A', segmentId: 'journal-near', role: 'primary' },
      { name: 'B', segmentId: 'stop-face', role: 'secondary' },
      { name: 'C', segmentId: 'clocking-flat', role: 'tertiary' },
    ]);
    expect(completed.controls[0]?.datumNames).toEqual(['A', 'B', 'C']);
  });

  it('assigns common-axis datum names in declared shaft orientation', () => {
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'reversed-shaft', revision: 2 },
      axis: { origin: [0, 0], direction: [-1, 0], normal: [0, 1], zMin: 0, zMax: 200, orientation: 'reversed' },
      segments: [testSegment('support-low', 20, 40), testSegment('support-high', 160, 180)],
      semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };
    const completed = completeShaftGdtRecommendation(partition, {
      datums: [
        { segmentId: 'support-low', function: 'axis-support', confidence: 0.9 },
        { segmentId: 'support-high', function: 'axis-support', confidence: 0.9 },
      ],
      controls: [{
        id: 'runout', characteristic: 'total-runout', segmentIds: ['support-low'],
        datumSegmentIds: ['support-low', 'support-high'], toleranceZoneShape: 'linear', confidence: 0.9,
      }],
    });

    expect(completed.datums.map(({ name, segmentId }) => ({ name, segmentId }))).toEqual([
      { name: 'A', segmentId: 'support-high' },
      { name: 'B', segmentId: 'support-low' },
    ]);
  });

  it('removes datum references from intrinsic form controls', () => {
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'form-control-shaft', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 80, orientation: 'forward' },
      segments: [testSegment('journal', 10, 50)], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };
    const completed = completeShaftGdtRecommendation(partition, {
      datums: [{ segmentId: 'journal', function: 'axis-support', confidence: 0.95 }],
      controls: [{
        id: 'cylindricity', characteristic: 'cylindricity', segmentIds: ['journal'],
        datumSegmentIds: ['journal'], toleranceZoneShape: 'linear', confidence: 0.93,
      }],
    });

    expect(completed.datums).toEqual([]);
    expect(completed.controls[0]?.datumNames).toEqual([]);
  });

  it('does not claim complete coverage when semantic review returns no controls', () => {
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'generic-shaft', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 10, orientation: 'forward' },
      segments: [], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };

    expect(evaluateShaftGdtCoverage(partition, { datums: [], controls: [] })).toEqual({
      complete: false, requiredDatumCount: 0, requiredControlCount: 0,
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

function testSegment(id: string, zStart: number, zEnd: number) {
  return {
    id, zStart, zEnd, profile: { minRadius: 7, maxRadius: 7, sampleCount: 2 },
    boundaryConfidence: 1, geometryNodeIds: [`edge:${id}`], boundaryEvidenceIds: [],
    semanticEvidenceIds: [], diagnosticIds: [],
  };
}
