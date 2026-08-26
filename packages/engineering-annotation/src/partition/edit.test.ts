// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  mergeBoundary,
  moveBoundary,
  moveSemanticRange,
  splitSegment,
  updateSegmentMetadata,
  validatePartition,
  type PartitionDraft,
} from '../index';

function draft(): PartitionDraft {
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing-1', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 30, orientation: 'forward' },
    segments: [0, 10, 20].map((zStart, index) => ({
      id: `segment:${zStart}-${zStart + 10}`,
      zStart, zEnd: zStart + 10,
      profile: { minRadius: 4, maxRadius: 5, sampleCount: 10 },
      boundaryConfidence: 0.9,
      geometryNodeIds: [`line:${index}`], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
    })),
    semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
  };
}

describe('editable shaft partition', () => {
  it('moves a shared boundary with deterministic snapping and preserves coverage', () => {
    const moved = moveBoundary(draft(), {
      boundaryIndex: 1, requestedZ: 9.8,
      snapCandidates: [{ id: 'step:10', z: 10, score: 0.95, evidenceIds: ['geometry:10'], accepted: true }],
      snapTolerance: 0.5,
    });
    expect(moved.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([[0, 10], [10, 20], [20, 30]]);
    expect(moved.evidence.at(-1)?.origin).toBe('manual');
    expect(validatePartition(moved)).toEqual([]);
    expect(() => moveBoundary(draft(), {
      boundaryIndex: 1, requestedZ: 20.1, snapCandidates: [], snapTolerance: 0,
    })).toThrow('PARTITION_BOUNDARY_ORDER');
  });

  it('splits, merges, and edits metadata without losing a valid full partition', () => {
    const source = draft();
    source.semanticGroups = [{ id: 'group:middle', segmentIds: ['segment:10-20'], semanticType: 'seat', evidenceIds: [] }];
    source.segments[1]!.profileSamples = [
      { z: 10, radius: 2, geometryNodeId: 'left' }, { z: 14, radius: 2, geometryNodeId: 'left' },
      { z: 16, radius: 7, geometryNodeId: 'right' }, { z: 20, radius: 7, geometryNodeId: 'right' },
    ];
    const split = splitSegment(source, { segmentId: 'segment:10-20', z: 15, snapCandidates: [], snapTolerance: 0 });
    expect(split.segments.map(({ zStart, zEnd }) => [zStart, zEnd])).toEqual([[0, 10], [10, 15], [15, 20], [20, 30]]);
    expect(split.segments[1]).toMatchObject({ profile: { maxRadius: 2 }, geometryNodeIds: ['left'] });
    expect(split.segments[2]).toMatchObject({ profile: { maxRadius: 7 }, geometryNodeIds: ['right'] });
    expect(split.semanticGroups[0]!.segmentIds).toEqual([split.segments[1]!.id, split.segments[2]!.id]);
    const merged = mergeBoundary(split, { boundaryIndex: 2 });
    expect(merged.segments).toHaveLength(3);
    const renamed = updateSegmentMetadata(merged, { segmentId: merged.segments[1]!.id, name: '轴承位', semanticType: 'bearing-seat' });
    expect(renamed.segments[1]).toMatchObject({ name: '轴承位', semanticType: 'bearing-seat' });
    expect(validatePartition(renamed)).toEqual([]);
  });

  it('moves a semantic range edge without changing physical segments', () => {
    const source = draft();
    source.semanticGroups = [{
      id: 'group:gear', segmentIds: ['segment:10-20'], range: { zStart: 12, zEnd: 18 },
      semanticType: 'gear', evidenceIds: [],
    }];
    const moved = moveSemanticRange(source, {
      groupId: 'group:gear', edge: 'start', requestedZ: 11.5, snapCandidates: [], snapTolerance: 0,
    });
    expect(moved.semanticGroups[0]?.range).toEqual({ zStart: 11.5, zEnd: 18 });
    expect(moved.segments).toEqual(source.segments);
    expect(moved.evidence.at(-1)).toMatchObject({ origin: 'manual' });
  });
});
