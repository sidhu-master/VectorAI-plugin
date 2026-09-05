// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { parseEngineeringDocument } from '../engineering-document/parser';
import type { PartitionDraft, ShaftPartitionSegment } from '../partition/types';
import { generateAxialDimensionCandidates } from './candidates';
import { buildAxialTopology } from './topology';
import type { AxialDimensionCandidate, AxialTopology } from './types';

describe('generateAxialDimensionCandidates', () => {
  it('merges geometry, functional, and document evidence on the same interval', () => {
    const input = fixtureInput();
    const { candidates, evidence } = generateAxialDimensionCandidates(input);
    const spline = findInterval(candidates, input.topology, 17, 41.5);

    expect(spline).toMatchObject({ nominalValue: 24.5, roles: expect.arrayContaining(['functional']) });
    expect(spline?.evidenceIds).toEqual(expect.arrayContaining(['document:region:S01']));
    expect(evidence.find(({ id }) => id === 'document:region:S01')).toMatchObject({
      origin: 'document', kind: 'document-interval', required: true,
    });
  });

  it('derives process envelopes and a composite chain from adjacent transition topology', () => {
    const input = fixtureInput();
    const { candidates } = generateAxialDimensionCandidates(input);

    expect(findInterval(candidates, input.topology, 17, 45)?.roles).toContain('process');
    expect(findInterval(candidates, input.topology, 92, 150)?.roles).toContain('process');
    expect(findInterval(candidates, input.topology, 45, 150)?.roles).toContain('composite');
    expect(findInterval(candidates, input.topology, 0, 173)?.roles).toContain('overall');
    expect(findInterval(candidates, input.topology, 0, 92)).toBeUndefined();
    expect(findInterval(candidates, input.topology, 41.5, 92)).toBeUndefined();
  });

  it('derives process hierarchy without depending on golden coordinates or span ratios', () => {
    const partition = genericHierarchyPartition();
    const topology = buildAxialTopology({ partition });
    const { candidates } = generateAxialDimensionCandidates({ topology, partition });

    expect(findInterval(candidates, topology, 11, 37)?.roles).toContain('process');
    expect(findInterval(candidates, topology, 90, 140)?.roles).toContain('process');
    expect(findInterval(candidates, topology, 37, 140)?.roles).toContain('composite');
    expect(findInterval(candidates, topology, 11, 29)?.roles).toContain('functional');
    expect(findInterval(candidates, topology, 0, 90)).toBeUndefined();
  });

  it('keeps AI structural regions from replacing functional dimension anchors', () => {
    const partition = aiEnrichedStructuralPartition();
    const topology = buildAxialTopology({ partition });
    const { candidates } = generateAxialDimensionCandidates({ topology, partition });

    expect(findInterval(candidates, topology, 17, 45)?.roles).toContain('process');
    expect(findInterval(candidates, topology, 92, 150)?.roles).toContain('process');
    expect(findInterval(candidates, topology, 45, 150)?.roles).toContain('composite');
    expect(findInterval(candidates, topology, 41.5, 53)).toBeUndefined();
    expect(findInterval(candidates, topology, 53, 92)?.roles).toEqual(['local']);
  });

  it('keeps transition-only local spans out of automatic display while document dimensions override them', () => {
    const input = fixtureInput();
    input.topology.stations.find(({ coordinate }) => coordinate === 41.5)!.kinds = ['partition-boundary'];

    const { candidates, evidence } = generateAxialDimensionCandidates(input);

    expect(findInterval(candidates, input.topology, 41.5, 45)).toMatchObject({
      roles: ['local'], constraint: 'prohibited', required: false,
    });
    expect(findInterval(candidates, input.topology, 17, 41.5)).toMatchObject({
      constraint: 'required', required: true,
    });
    expect(evidence.find(({ id }) => id === 'geometry:span:station:41.5:station:45'))
      .toMatchObject({ constraint: 'prohibited' });
  });

  it('reports document intervals that do not resolve to geometry stations', () => {
    const input = fixtureInput('[region:gear:G02]\nname=未知齿轮\ncenter_z=81\nwidth=13');
    const result = generateAxialDimensionCandidates(input);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'DIMENSION_STATION_UNRESOLVED', evidenceIds: ['document:region:G02'],
    }));
  });
});

function fixtureInput(extraDocument = '') {
  const partition = fixturePartition();
  const topology = buildAxialTopology({ partition });
  const document = parseEngineeringDocument(`
[drawing]
unit=mm
[region:bearing:B01]
name=左轴承位
center_z=8.5
width=17
[region:spline:S01]
name=外花键
center_z=29.25
width=24.5
[region:gear:G01]
name=一级齿轮
center_z=119.5
width=55
[region:bearing:B02]
name=右轴承位
center_z=161.5
width=23
${extraDocument}`);
  return { topology, partition, document };
}

function findInterval(
  candidates: readonly AxialDimensionCandidate[],
  topology: AxialTopology,
  start: number,
  end: number,
): AxialDimensionCandidate | undefined {
  const stations = new Map(topology.stations.map((station) => [station.id, station.coordinate]));
  return candidates.find((candidate) => (
    stations.get(candidate.startStationId) === start && stations.get(candidate.endStationId) === end
  ));
}

function fixturePartition(): PartitionDraft {
  const ranges = [[0, 17], [17, 41.5], [41.5, 45], [45, 53], [53, 92], [92, 147], [147, 150], [150, 173]] as const;
  const segments = ranges.map(([start, end], index) => segment(`segment:${index}`, start, end, index));
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing:shaft', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 173, orientation: 'forward' },
    segments,
    semanticGroups: [
      group('bearing:left', 'bearing', '左轴承位', 0, 17, [segments[0]!.id]),
      group('spline', 'spline', '外花键', 17, 41.5, [segments[1]!.id]),
      group('gear', 'gear', '一级齿轮', 92, 147, [segments[5]!.id]),
      group('bearing:right', 'bearing', '右轴承位', 150, 173, [segments[7]!.id]),
      group('regular', 'regular-shaft', '常规轴段', 41.5, 92, [segments[2]!.id, segments[3]!.id, segments[4]!.id]),
    ],
    stepCandidates: [0, 17, 41.5, 45, 53, 92, 147, 150, 173].map((z) => ({
      id: `step:${z}`, z, score: 1, evidenceIds: [`geometry:step:${z}`], accepted: true,
    })),
    evidence: [], diagnostics: [],
  };
}

function genericHierarchyPartition(): PartitionDraft {
  const ranges = [[0, 11], [11, 29], [29, 37], [37, 50], [50, 90], [90, 126], [126, 140], [140, 159]] as const;
  const segments = ranges.map(([start, end], index) => segment(`generic:${index}`, start, end, index));
  return {
    version: 1,
    drawingRef: { drawingId: 'drawing:generic-shaft', revision: 1 },
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 159, orientation: 'forward' },
    segments,
    semanticGroups: [
      group('generic-bearing:left', 'bearing', '左支承', 0, 11, [segments[0]!.id]),
      group('generic-spline', 'spline', '传动花键', 11, 29, [segments[1]!.id]),
      group('generic-gear', 'gear', '传动齿轮', 90, 126, [segments[5]!.id]),
      group('generic-bearing:right', 'bearing', '右支承', 140, 159, [segments[7]!.id]),
    ],
    stepCandidates: ranges.flatMap(([start, end]) => [start, end]).filter((value, index, values) => values.indexOf(value) === index).map((z) => ({
      id: `generic-step:${z}`, z, score: 1, evidenceIds: [`geometry:generic-step:${z}`], accepted: true,
    })),
    evidence: [], diagnostics: [],
  };
}

function aiEnrichedStructuralPartition(): PartitionDraft {
  const output = fixturePartition();
  output.semanticGroups = output.semanticGroups.filter(({ semanticType }) => semanticType !== 'regular-shaft');
  const structural = [
    { id: 'ai:left-shoulder', semanticType: 'shoulder', name: '左定位轴肩', range: { zStart: 41.5, zEnd: 53 }, segmentIds: [output.segments[2]!.id, output.segments[3]!.id] },
    { id: 'ai:middle-seat', semanticType: 'shaft-seat', name: '中间轴座', range: { zStart: 53, zEnd: 92 }, segmentIds: [output.segments[4]!.id] },
    { id: 'ai:right-shoulder', semanticType: 'shoulder', name: '右定位轴肩', range: { zStart: 147, zEnd: 150 }, segmentIds: [output.segments[6]!.id] },
  ];
  for (const item of structural) {
    const evidenceId = `evidence:${item.id}`;
    output.evidence.push({ id: evidenceId, origin: 'ai', label: item.name });
    output.semanticGroups.push({ ...item, id: `group:${item.id}`, evidenceIds: [evidenceId] });
    for (const segmentId of item.segmentIds) {
      const segment = output.segments.find(({ id }) => id === segmentId)!;
      segment.semanticType = item.semanticType;
      segment.name = item.name;
      segment.semanticEvidenceIds.push(evidenceId);
    }
  }
  return output;
}

function segment(id: string, zStart: number, zEnd: number, index: number): ShaftPartitionSegment {
  const radii = [17.5, 22.5, 20, 20, 20, 28.5, 20, 17.5];
  return {
    id, zStart, zEnd,
    profile: { minRadius: radii[index]!, maxRadius: radii[index]!, sampleCount: 4 },
    boundaryConfidence: 1, geometryNodeIds: [`geometry:${id}`],
    boundaryEvidenceIds: [`boundary:${zStart}`, `boundary:${zEnd}`],
    semanticEvidenceIds: [], diagnosticIds: [],
  };
}

function group(id: string, semanticType: string, name: string, zStart: number, zEnd: number, segmentIds: string[]) {
  return { id: `group:${id}`, semanticType, name, range: { zStart, zEnd }, segmentIds, evidenceIds: [`document:${id}`] };
}
