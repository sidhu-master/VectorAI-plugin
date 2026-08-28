// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
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
