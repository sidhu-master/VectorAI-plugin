// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createEmptyDrawing, type GeometryId, type Vec2 } from '@vectorai/drawing-core';
import type { PartitionDraft } from '../partition/types';
import { buildAxialTopology } from './topology';

describe('buildAxialTopology', () => {
  it('builds one ordered station per accepted shaft boundary', () => {
    const topology = buildAxialTopology({ partition: fixturePartition() });

    expect(topology.stations.map(({ coordinate }) => coordinate)).toEqual([0, 17, 41.5, 45]);
    expect(topology.elementarySpans.map(({ nominalValue }) => nominalValue)).toEqual([17, 24.5, 3.5]);
    expect(topology.stations[1]).toMatchObject({
      kinds: expect.arrayContaining(['shoulder', 'partition-boundary']),
      evidenceIds: expect.arrayContaining(['step:17', 'group:spline']),
    });
  });

  it('is invariant to translated and reversed source axes', () => {
    const forward = buildAxialTopology({ partition: fixturePartition() });
    const reversedPartition = fixturePartition();
    reversedPartition.axis = {
      ...reversedPartition.axis,
      origin: [220, 80],
      direction: [-1, 0],
      normal: [0, -1],
      orientation: 'reversed',
    };
    const reversed = buildAxialTopology({ partition: reversedPartition });

    expect(semanticTopology(reversed)).toEqual(semanticTopology(forward));
  });

  it('rejects non-finite station coordinates', () => {
    const partition = fixturePartition();
    partition.stepCandidates.push({ id: 'step:invalid', z: Number.NaN, score: 1, evidenceIds: [], accepted: true });

    expect(() => buildAxialTopology({ partition })).toThrow('DIMENSION_STATION_UNRESOLVED');
  });

  it.each([0, 37, 180])('prefers station-supporting faces over whole-region evidence on a %s degree axis', (degrees) => {
    const partition = fixturePartition();
    const angle = degrees * Math.PI / 180;
    partition.axis = { ...partition.axis, origin: [210, -65], direction: [Math.cos(angle), Math.sin(angle)], normal: [-Math.sin(angle), Math.cos(angle)] };
    const world = (z: number, r: number): Vec2 => [210 + z * Math.cos(angle) - r * Math.sin(angle), -65 + z * Math.sin(angle) + r * Math.cos(angle)];
    const document = createEmptyDrawing({ now: () => 1 });
    const line = (id: string, start: Vec2, end: Vec2) => ({ id: id as GeometryId, type: 'line' as const, start, end, visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] } });
    document.geometry = [
      line('a-crosses-all-stations', world(-10, 4), world(60, 4)),
      line('b-region-representative', world(22, 8), world(27, 8)),
      line('y-endpoint-at-17', world(17, 9), world(30, 9)),
      ...[0, 17, 41.5, 45].map((z) => line(`z-face-${z}`, world(z, -10), world(z, 10))),
    ];
    partition.segments.forEach((segment) => { segment.geometryNodeIds = document.geometry.map(({ id }) => String(id)); });
    const before = structuredClone({ document, partition });
    const legacy = buildAxialTopology({ partition });
    const actual = buildAxialTopology({ document, partition });
    expect(actual.stations.map(({ geometryNodeIds }) => geometryNodeIds[0])).toEqual(['z-face-0', 'z-face-17', 'z-face-41.5', 'z-face-45']);
    expect(semanticTopology(actual)).toEqual(semanticTopology(legacy));
    expect(actual.stations.map(({ geometryNodeIds, ...station }) => station)).toEqual(legacy.stations.map(({ geometryNodeIds, ...station }) => station));
    expect(actual.stations.map(({ geometryNodeIds }) => [...geometryNodeIds].sort())).toEqual(legacy.stations.map(({ geometryNodeIds }) => geometryNodeIds));
    expect(legacy.stations.every(({ geometryNodeIds }) => geometryNodeIds[0] === 'a-crosses-all-stations')).toBe(true);
    expect({ document, partition }).toEqual(before);
  });
});

function semanticTopology(topology: ReturnType<typeof buildAxialTopology>) {
  return {
    stations: topology.stations.map(({ id, coordinate, kinds }) => ({ id, coordinate, kinds })),
    spans: topology.elementarySpans.map(({ startStationId, endStationId, nominalValue }) => ({
      startStationId, endStationId, nominalValue,
    })),
  };
}

function fixturePartition(): PartitionDraft {
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing:shaft', revision: 1 },
    axis: {
      origin: [100, 20], direction: [1, 0], normal: [0, 1],
      zMin: 0, zMax: 45, orientation: 'forward', geometryNodeIds: ['outline'],
    },
    segments: [
      segment('segment:bearing', 0, 17, ['bearing-line']),
      segment('segment:spline', 17, 41.5, ['spline-line']),
      segment('segment:transition', 41.5, 45, ['transition-line']),
    ],
    semanticGroups: [{
      id: 'group:spline', segmentIds: ['segment:spline'], range: { zStart: 17, zEnd: 41.5 },
      semanticType: 'spline', name: '外花键', evidenceIds: ['document:region:S01'],
    }],
    stepCandidates: [0, 17, 41.5, 45].map((z) => ({
      id: `step:${z}`, z, score: 1, evidenceIds: [`geometry:step:${z}`], accepted: true,
    })),
    evidence: [],
    diagnostics: [],
  };
}

function segment(id: string, zStart: number, zEnd: number, geometryNodeIds: string[]) {
  return {
    id, zStart, zEnd, profile: { minRadius: 10, maxRadius: 12, sampleCount: 4 },
    boundaryConfidence: 1, geometryNodeIds,
    boundaryEvidenceIds: [`boundary:${zStart}`, `boundary:${zEnd}`],
    semanticEvidenceIds: [], diagnosticIds: [],
  };
}
