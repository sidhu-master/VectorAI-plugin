// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it, vi } from 'vitest';
import {
  completeShaftGdtRecommendation,
  createAutomaticGdtPipeline,
  createAutomaticGdtReviewer,
  evaluateShaftGdtCoverage,
  groundSegmentRecommendation,
} from './gdt-reviewer';
import { RecognitionPipelineRunner, type RecognitionModelPort, type RecognitionModelRequest } from './recognition-runtime';

describe('automatic GD&T segment grounding', () => {
  it('runs uncertain functional recognition through the shared bounded model port', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-ai' }, now: () => 1 });
    document.geometry = [
      { id: 'edge:left' as GeometryId, type: 'line', start: [0, 6], end: [20, 6], visible: true, quality: { status: 'confirmed', evidenceRefs: [] } },
      { id: 'edge:right' as GeometryId, type: 'line', start: [80, 6], end: [100, 6], visible: true, quality: { status: 'confirmed', evidenceRefs: [] } },
    ];
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'drawing-ai', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation: 'forward' },
      segments: [
        { ...testSegment('left', 0, 20), geometryNodeIds: ['edge:left'] },
        { ...testSegment('right', 80, 100), geometryNodeIds: ['edge:right'] },
      ],
      semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };
    const review = vi.fn(async (_request: RecognitionModelRequest<unknown>) => ({
      stopReason: 'completed',
      structured: { features: [
        { id: 'support:left', segmentIds: ['left'], function: 'axis-support', confidence: 0.94 },
        { id: 'support:right', segmentIds: ['right'], function: 'axis-support', confidence: 0.93 },
      ] },
      observations: [{
        provider: 'fixture', model: 'fixture', messageCount: 3,
        systemDigest: 'sha256:system', toolNames: ['structured_output'], requestDigest: 'sha256:request',
      }],
    }));
    const runner = new RecognitionPipelineRunner({ review } as RecognitionModelPort);
    runner.register(createAutomaticGdtPipeline({
      getSnapshot: () => ({
        version: 1, ref: partition.drawingRef, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      renderObservation: async () => ({
        status: 'rendered', png: new Uint8Array([1, 2]), contentDigest: 'sha256:gdt-image', width: 960, height: 720,
      }),
    }));

    const result = await createAutomaticGdtReviewer(runner)({
      agent: { id: 'session-ai' } as Agent,
      partition,
    });

    expect(review).toHaveBeenCalledWith(expect.objectContaining({
      pipelineId: 'shaft-gdt-semantic-review', pipelineVersion: '1', parentSessionId: 'session-ai', maxDepth: 1,
      prompt: expect.arrayContaining([expect.objectContaining({ type: 'image', data: new Uint8Array([1, 2]) })]),
    }));
    expect(result.datums.map(({ name, geometryId }) => ({ name, geometryId }))).toEqual([
      { name: 'A', geometryId: 'edge:left' },
      { name: 'B', geometryId: 'edge:right' },
    ]);
    expect(result.controls.some(({ characteristic }) => characteristic === 'total-runout')).toBe(true);
  });

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

  it('grounds bearing datums on the outer cylindrical working surfaces when source lines cross partition boundaries', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const geometry = [
      { id: 'left-shoulder' as GeometryId, type: 'line' as const, start: [31, -26] as [number, number], end: [31, -30] as [number, number], visible: true, quality },
      { id: 'left-bearing-outer' as GeometryId, type: 'line' as const, start: [31, -30] as [number, number], end: [61, -30] as [number, number], visible: true, quality },
      { id: 'left-bore' as GeometryId, type: 'line' as const, start: [22, -16] as [number, number], end: [58, -16] as [number, number], visible: true, quality },
      { id: 'right-bearing-outer' as GeometryId, type: 'line' as const, start: [208, -32] as [number, number], end: [244, -32] as [number, number], visible: true, quality },
      { id: 'right-bore-chamfer' as GeometryId, type: 'line' as const, start: [232, -10] as [number, number], end: [236, -13] as [number, number], visible: true, quality },
    ];
    const segment = (id: string, zStart: number, zEnd: number, maxRadius: number, geometryNodeIds: string[]) => ({
      id, zStart, zEnd, profile: { minRadius: 10, maxRadius, sampleCount: 8 },
      boundaryConfidence: 1, geometryNodeIds, boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
    });
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'bearing-datum-regression', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 286, orientation: 'forward' },
      segments: [
        segment('bearing-left', 31, 58, 30, ['left-shoulder', 'left-bearing-outer', 'left-bore']),
        segment('bearing-right', 208, 234, 32, ['right-bearing-outer', 'right-bore-chamfer']),
      ],
      semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };

    const result = groundSegmentRecommendation(geometry, partition, {
      datums: [
        { name: 'A', segmentId: 'bearing-left', role: 'primary', confidence: 1 },
        { name: 'B', segmentId: 'bearing-right', role: 'secondary', confidence: 1 },
      ],
      controls: [],
    });

    expect(result.datums.map(({ name, geometryId }) => ({ name, geometryId }))).toEqual([
      { name: 'A', geometryId: 'left-bearing-outer' },
      { name: 'B', geometryId: 'right-bearing-outer' },
    ]);
  });

  it('keeps datum markers below while grounding cylindrical specification tables above', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const geometry = [
      { id: 'a-bottom' as GeometryId, type: 'line' as const, start: [31, -30] as [number, number], end: [61, -30] as [number, number], visible: true, quality },
      { id: 'z-top' as GeometryId, type: 'line' as const, start: [31, 30] as [number, number], end: [61, 30] as [number, number], visible: true, quality },
    ];
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'upper-specification-table-regression', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation: 'forward' },
      segments: [{
        id: 'bearing', zStart: 31, zEnd: 61, profile: { minRadius: 12, maxRadius: 30, sampleCount: 8 },
        boundaryConfidence: 1, geometryNodeIds: ['a-bottom', 'z-top'], boundaryEvidenceIds: [],
        semanticEvidenceIds: [], diagnosticIds: [],
      }],
      semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };

    const result = groundSegmentRecommendation(geometry, partition, {
      datums: [{ name: 'A', segmentId: 'bearing', role: 'primary', confidence: 1 }],
      controls: [{
        id: 'gdt:cylindricity', characteristic: 'cylindricity', segmentIds: ['bearing'],
        surfaceRole: 'segment-surface', datumNames: [], toleranceZoneShape: 'linear', confidence: 1,
      }],
      surfaceTextures: [{
        id: 'texture:ra', segmentIds: ['bearing'], parameter: 'Ra', value: 0.8,
        materialRemoval: 'required', source: 'process-rule', confidence: 1,
      }],
    });

    expect(result.datums[0]?.geometryId).toBe('a-bottom');
    expect(result.controls[0]?.geometryIds).toEqual(['z-top']);
    expect(result.surfaceTextures?.[0]?.geometryIds).toEqual(['z-top']);
  });

  it('grounds a rotary feature on the strongest face in its adjacent locating-shoulder group', () => {
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const geometry = [
      { id: 'feature-surface' as GeometryId, type: 'line' as const, start: [10, 5] as [number, number], end: [30, 5] as [number, number], visible: true, quality },
      { id: 'feature-start-face' as GeometryId, type: 'line' as const, start: [10, 5] as [number, number], end: [10, 11] as [number, number], visible: true, quality },
      { id: 'shoulder-entry-face' as GeometryId, type: 'line' as const, start: [30, 5] as [number, number], end: [30, 7] as [number, number], visible: true, quality },
      { id: 'locating-face-upper' as GeometryId, type: 'line' as const, start: [34, 7] as [number, number], end: [34, 12] as [number, number], visible: true, quality },
      { id: 'locating-face-lower' as GeometryId, type: 'line' as const, start: [34, -12] as [number, number], end: [34, -7] as [number, number], visible: true, quality },
      { id: 'shoulder-exit-face' as GeometryId, type: 'line' as const, start: [40, 7] as [number, number], end: [40, 10] as [number, number], visible: true, quality },
    ];
    const segment = (id: string, zStart: number, zEnd: number, semanticType: string, geometryNodeIds: string[]) => ({
      id, zStart, zEnd, semanticType, profile: { minRadius: 5, maxRadius: 12, sampleCount: 2 },
      boundaryConfidence: 1, geometryNodeIds, boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
    });
    const feature = segment('rotary-feature', 10, 30, 'spline', ['feature-surface', 'feature-start-face']);
    const shoulder = segment('locating-shoulder', 30, 40, 'shoulder', [
      'shoulder-entry-face', 'locating-face-upper', 'locating-face-lower', 'shoulder-exit-face',
    ]);
    const partition: PartitionDraft = {
      version: 1, drawingRef: { drawingId: 'generic-rotary-shaft', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 60, orientation: 'forward' },
      segments: [feature, shoulder],
      semanticGroups: [{
        id: 'feature-group', segmentIds: [feature.id], range: { zStart: 10, zEnd: 30 },
        semanticType: 'spline', dimensionRole: 'functional-feature', evidenceIds: [],
      }, {
        id: 'shoulder-group', segmentIds: [shoulder.id], range: { zStart: 30, zEnd: 40 },
        semanticType: 'shoulder', dimensionRole: 'process-datum', evidenceIds: [],
      }],
      stepCandidates: [], evidence: [], diagnostics: [],
    };

    const result = groundSegmentRecommendation(geometry, partition, {
      datums: [],
      controls: [{
        id: 'runout', characteristic: 'circular-runout', segmentIds: [feature.id],
        surfaceRole: 'positive-locating-shoulder', datumNames: [], toleranceZoneShape: 'linear', confidence: 0.9,
      }],
    });

    expect(result.controls[0]?.geometryIds).toEqual(['locating-face-upper']);
  });
});

function testSegment(id: string, zStart: number, zEnd: number) {
  return {
    id, zStart, zEnd, profile: { minRadius: 7, maxRadius: 7, sampleCount: 2 },
    boundaryConfidence: 1, geometryNodeIds: [`edge:${id}`], boundaryEvidenceIds: [],
    semanticEvidenceIds: [], diagnosticIds: [],
  };
}
