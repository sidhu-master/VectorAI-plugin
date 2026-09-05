// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GeometryNode } from '@vectorai/drawing-core';
import { importDxf } from '@vectorai/dxf-import';
import { parseEngineeringDocument } from '../engineering-document/parser';
import {
  analyzeShaftPartition,
  buildAxialTopology,
  generateAxialDimensionCandidates,
  inferAxialDimensionScheme,
  inferRegularShaftRegions,
  isAxialDimensionCandidateSuppressed,
  SHAFT_HIERARCHICAL_DIMENSIONING_V1,
  validatePartition,
} from '../index';

const FIXTURE_DIRECTORY = resolve(import.meta.dirname, '../../test/fixtures/external-golden-001');
const REFERENCE_DRAWING = resolve(FIXTURE_DIRECTORY, '../golden-shaft-001/initial.dxf');

describe('independently designed educational shaft initial drawing', () => {
  it('imports a closed, production-shaped sectional drawing without result annotations', async () => {
    const bytes = await readFile(resolve(FIXTURE_DIRECTORY, 'initial.dxf'));
    const imported = importDxf({
      bytes,
      source: { digest: `sha256:${sha256(bytes)}`, name: 'initial.dxf' },
      drawingId: 'drawing:external-golden-001',
      now: () => 1,
    });

    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    expect(imported.diagnostics).not.toContainEqual(expect.objectContaining({ severity: 'error' }));
    expect(imported.bounds.minX).toBe(-12);
    expect(imported.bounds.maxX).toBe(298);
    expect(imported.bounds.minY).toBeCloseTo(-49.057778, 6);
    expect(imported.bounds.maxY).toBeCloseTo(49.057778, 6);

    const layers = new Set(imported.document.geometry.map((node) => node.sourceRef?.layer));
    expect([...layers]).toEqual(expect.arrayContaining([
      'PROFILE-OUTER',
      'PROFILE-BORE',
      'DETAIL-GEAR',
      'DETAIL-GEAR-VISIBLE',
      'DETAIL-THREAD',
      'DETAIL-RELIEF',
      'CENTERLINE',
    ]));
    expect(imported.document.geometry.filter(({ type }) => type === 'line').length).toBeGreaterThanOrEqual(85);
    expect(imported.document.geometry.filter(({ type }) => type === 'spline').length).toBeGreaterThanOrEqual(16);
    expect(imported.document.geometry.filter(({ type }) => type === 'arc').length).toBeGreaterThanOrEqual(8);

    const hatches = imported.document.annotations.filter((node) => node.type === 'section-hatch');
    expect(hatches).toHaveLength(2);
    for (const hatch of hatches) {
      expect(hatch.hatch?.boundaryPaths).toHaveLength(1);
      expect(hatch.hatch?.boundaryPaths[0]?.closed).toBe(true);
      const boundaryEdges = hatch.hatch?.boundaryPaths[0]?.edges ?? [];
      expect(boundaryEdges.every(({ type }) => type === 'line')).toBe(true);
      const lineBoundaryEdges = boundaryEdges.filter((edge): edge is Extract<typeof edge, { type: 'line' }> => (
        edge.type === 'line'
      ));
      expect(closedBoundary(lineBoundaryEdges)).toBe(true);
      expect(properBoundaryIntersections(lineBoundaryEdges)).toEqual([]);
    }
    expect(imported.document.annotations.filter((node) => node.type === 'dimension')).toHaveLength(0);

    const simplifiedFeatureDiagonals = imported.document.geometry.filter((node) => (
      node.type === 'line'
      && node.sourceRef?.layer === 'DETAIL-THREAD'
      && Math.abs(node.start[0] - node.end[0]) > 1e-6
      && Math.abs(node.start[1] - node.end[1]) > 1e-6
    ));
    expect(simplifiedFeatureDiagonals).toHaveLength(0);

    const hatchPoints = (hatch: typeof hatches[number]) => (
      hatch.hatch?.boundaryPaths[0]?.edges.flatMap((edge) => (
        edge.type === 'line' ? [edge.start, edge.end] : []
      )) ?? []
    );
    const upperHatch = hatches.find((hatch) => hatchPoints(hatch).some(([, y]) => y > 0));
    const lowerHatch = hatches.find((hatch) => hatchPoints(hatch).some(([, y]) => y < 0));
    const upperGearHatchPoints = hatchPoints(upperHatch!).filter(([x]) => x >= 138 && x <= 198);
    const lowerGearHatchPoints = hatchPoints(lowerHatch!).filter(([x]) => x >= 138 && x <= 198);
    expect(Math.min(...hatchPoints(upperHatch!).map(([, y]) => y))).toBeGreaterThan(0);
    expect(Math.max(...hatchPoints(lowerHatch!).map(([, y]) => y))).toBeLessThan(0);
    const upperLeftFace = upperGearHatchPoints.filter(([x]) => Math.abs(x - 138) <= 1e-6);
    const lowerLeftFace = lowerGearHatchPoints.filter(([x]) => Math.abs(x - 138) <= 1e-6);
    expect(Math.max(...upperLeftFace.map(([, y]) => y))).toBeCloseTo(48.857778, 6);
    expect(Math.min(...lowerLeftFace.map(([, y]) => y))).toBeCloseTo(-43.432778, 6);

    const visibleToothTraces = imported.document.geometry.filter((node) => (
      node.type === 'spline' && node.sourceRef?.layer === 'DETAIL-GEAR-VISIBLE'
    ));
    expect(visibleToothTraces.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...visibleToothTraces.flatMap((node) => (
      node.type === 'spline' ? node.controlPoints.map(([, y]) => y) : []
    )))).toBeCloseTo(49.057778, 6);
    expect(Math.min(...visibleToothTraces.flatMap((node) => (
      node.type === 'spline' ? node.controlPoints.map(([, y]) => y) : []
    )))).toBeCloseTo(-49.057778, 6);

    const structuralLayers = new Set([
      'PROFILE-OUTER',
      'PROFILE-BORE',
      'DETAIL-GEAR',
      'DETAIL-GEAR-VISIBLE',
      'DETAIL-RELIEF',
    ]);
    const endpointDegrees = new Map<string, number>();
    for (const node of imported.document.geometry) {
      if (!structuralLayers.has(node.sourceRef?.layer ?? '')) continue;
      const endpoints = geometryEndpoints(node);
      for (const [x, y] of endpoints) {
        const key = `${x.toFixed(5)},${y.toFixed(5)}`;
        endpointDegrees.set(key, (endpointDegrees.get(key) ?? 0) + 1);
      }
    }
    expect([...endpointDegrees].filter(([, degree]) => degree === 1).map(([point]) => point)).toEqual([]);

    const reliefGrooveFloors = imported.document.geometry.filter((node) => (
      node.type === 'line'
      && node.sourceRef?.layer === 'DETAIL-RELIEF'
      && Math.abs(node.start[1] - node.end[1]) <= 1e-6
      && Math.min(node.start[0], node.end[0]) === 198.5
      && Math.max(node.start[0], node.end[0]) === 200.5
    ));
    expect(reliefGrooveFloors).toHaveLength(2);
    expect(reliefGrooveFloors.map((node) => node.type === 'line' ? node.start[1] : 0).sort((a, b) => a - b))
      .toEqual([-41.75, 41.75]);

    const postReliefShoulders = imported.document.geometry.filter((node) => (
      node.type === 'line'
      && node.sourceRef?.layer === 'DETAIL-RELIEF'
      && Math.abs(node.start[0] - 207) <= 1e-6
      && Math.abs(node.end[0] - 207) <= 1e-6
      && Math.min(Math.abs(node.start[1]), Math.abs(node.end[1])) === 30
      && Math.max(Math.abs(node.start[1]), Math.abs(node.end[1])) === 44.25
    ));
    expect(postReliefShoulders).toHaveLength(2);

    const postReliefDiagonals = imported.document.geometry.filter((node) => (
      node.type === 'line'
      && node.sourceRef?.layer === 'PROFILE-OUTER'
      && Math.min(node.start[0], node.end[0]) >= RELIEF_END_X
      && Math.max(node.start[0], node.end[0]) <= 208
      && Math.abs(node.start[0] - node.end[0]) > 1e-6
      && Math.abs(node.start[1] - node.end[1]) > 1e-6
    ));
    expect(postReliefDiagonals).toHaveLength(0);

    const throughBoreClosures = imported.document.geometry.filter((node) => (
      node.type === 'line'
      && node.sourceRef?.layer === 'PROFILE-BORE'
      && Math.abs(node.start[0] - node.end[0]) <= 1e-6
      && node.start[1] * node.end[1] < 0
    ));
    expect(throughBoreClosures).toHaveLength(0);

    const reference = await readFile(REFERENCE_DRAWING);
    expect(sha256(bytes)).not.toBe(sha256(reference));

    const engineering = parseEngineeringDocument(
      await readFile(resolve(FIXTURE_DIRECTORY, 'engineering-data.ini'), 'utf8'),
    );
    expect(engineering.diagnostics).toHaveLength(0);
    expect(engineering.regions).toContainEqual(expect.objectContaining({
      id: 'G01',
      type: 'gear',
      interval: { start: 138, end: 198 },
      outerDiameter: 98.115556,
    }));
  });

  it('uses the explicit centerline to partition both disconnected halves of the hollow section', async () => {
    const bytes = await readFile(resolve(FIXTURE_DIRECTORY, 'initial.dxf'));
    const engineeringText = await readFile(resolve(FIXTURE_DIRECTORY, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes,
      source: {
        digest: `sha256:${sha256(bytes)}`,
        name: 'initial.dxf',
      },
      drawingId: 'drawing:external-golden-001',
      now: () => 1,
    });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;

    const analyzed = analyzeShaftPartition({
      document: imported.document,
      drawingRef: { drawingId: 'drawing:external-golden-001', revision: 1 },
      engineeringText,
      drawingSourceName: 'initial.dxf',
    });
    expect(analyzed.status).toBe('drafted');
    if (analyzed.status !== 'drafted') return;
    const finalized = inferRegularShaftRegions(analyzed.draft);

    expect(finalized.axis.origin[1]).toBeCloseTo(0, 6);
    expect(finalized.axis.zMax).toBeCloseTo(286, 6);
    expect(finalized.segments.length).toBeGreaterThan(8);
    expect(finalized.semanticGroups.map(({ name }) => name)).toEqual(expect.arrayContaining([
      '左端锁紧螺纹',
      '左端轴承位',
      '密封工作面',
      '外花键段',
      '一体式右旋斜齿轮',
      '齿轮右侧砂轮越程槽',
      '右端轴承位',
      '右端锁紧螺纹',
    ]));
    expect(finalized.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'DOCUMENT_REGION_CONFLICT',
    }));
    expect(finalized.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'DOCUMENT_DRAWING_NAME_MISMATCH',
    }));
    expect(validatePartition(finalized)).toEqual([]);
  });

  it('keeps authored feature bounds exact and omits transition-detail dimensions', async () => {
    const bytes = await readFile(resolve(FIXTURE_DIRECTORY, 'initial.dxf'));
    const engineeringText = await readFile(resolve(FIXTURE_DIRECTORY, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes,
      source: { digest: `sha256:${sha256(bytes)}`, name: 'initial.dxf' },
      drawingId: 'drawing:external-golden-001',
      now: () => 1,
    });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    const analyzed = analyzeShaftPartition({
      document: imported.document,
      drawingRef: { drawingId: 'drawing:external-golden-001', revision: 1 },
      engineeringText,
      drawingSourceName: 'initial.dxf',
    });
    expect(analyzed.status).toBe('drafted');
    if (analyzed.status !== 'drafted') return;
    const partition = inferRegularShaftRegions(analyzed.draft);
    const engineering = parseEngineeringDocument(engineeringText);
    const topology = buildAxialTopology({ partition, document: imported.document, unit: 'mm' });
    const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: engineering });
    const scheme = inferAxialDimensionScheme({
      topology,
      candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const stationById = new Map(topology.stations.map(({ id, coordinate }) => [id, coordinate]));
    const candidateById = new Map(candidateSet.candidates.map((candidate) => [candidate.id, candidate]));
    const range = (id: string) => {
      const candidate = candidateById.get(id)!;
      return [stationById.get(candidate.startStationId), stationById.get(candidate.endStationId)];
    };

    expect(topology.stations.map(({ coordinate }) => coordinate)).toEqual([
      0, 2, 20, 22, 31, 58, 61, 62, 81, 115, 138, 198, 201, 207, 208, 244, 270, 286,
    ]);
    const relief = partition.semanticGroups.find(({ id }) => id === 'group:U01')!;
    expect(relief.range).toEqual({ zStart: 198, zEnd: 201 });
    expect(relief.segmentIds.map((id) => partition.segments.find((segment) => segment.id === id)!)
      .every(({ zStart, zEnd }) => zEnd > 198 && zStart < 201)).toBe(true);

    const root = scheme.chains.find(({ parentCandidateId }) => (
      candidateById.get(parentCandidateId)?.roles.includes('overall')
    ))!;
    expect(root.childCandidateIds.map(range)).toEqual([
      [0, 22],
      [22, 62],
      [62, 138],
      [138, 207],
      [207, 270],
    ]);
    const visible = [
      ...scheme.displayedCandidateIds,
      ...scheme.closureCandidateIds.filter((id) => !isAxialDimensionCandidateSuppressed(candidateById.get(id)!)),
    ].map(range);
    expect(visible).toEqual(expect.arrayContaining([
      [2, 20], [31, 61], [62, 81], [81, 115], [138, 198], [198, 201], [208, 244], [270, 286],
    ]));
    for (const transition of [[0, 2], [20, 22], [61, 62], [207, 208]] as const) {
      expect(visible).not.toContainEqual(transition);
    }
    expect(visible.flatMap(([start, end]) => [Number((end! - start!).toFixed(3))]))
      .not.toEqual(expect.arrayContaining([0.102, 2.005, 2.796, 2.898, 60.102]));
  });
});

const RELIEF_END_X = 201;

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

function closedBoundary(edges: readonly { start?: readonly [number, number]; end?: readonly [number, number] }[]) {
  if (edges.length < 3 || edges.some((edge) => edge.start === undefined || edge.end === undefined)) return false;
  const same = (left: readonly [number, number], right: readonly [number, number]) => (
    Math.abs(left[0] - right[0]) <= 1e-6 && Math.abs(left[1] - right[1]) <= 1e-6
  );
  return edges.every((edge, index) => same(edge.end!, edges[(index + 1) % edges.length]!.start!));
}

function geometryEndpoints(node: GeometryNode): Array<readonly [number, number]> {
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'spline') return [node.controlPoints[0]!, node.controlPoints.at(-1)!];
  if (node.type === 'arc') {
    return [node.startAngle, node.endAngle].map((angle) => {
      const radians = angle * Math.PI / 180;
      return [
        node.center[0] + node.radius * Math.cos(radians),
        node.center[1] + node.radius * Math.sin(radians),
      ] as const;
    });
  }
  return [];
}

function properBoundaryIntersections(
  edges: readonly { start?: readonly [number, number]; end?: readonly [number, number] }[],
) {
  const intersections: Array<[number, number]> = [];
  for (let left = 0; left < edges.length; left += 1) {
    for (let right = left + 1; right < edges.length; right += 1) {
      if (right === left + 1 || (left === 0 && right === edges.length - 1)) continue;
      const first = edges[left];
      const second = edges[right];
      if (!first?.start || !first.end || !second?.start || !second.end) continue;
      if (properlyIntersects(first.start, first.end, second.start, second.end)) {
        intersections.push([left, right]);
      }
    }
  }
  return intersections;
}

function properlyIntersects(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
) {
  const cross = (
    origin: readonly [number, number],
    first: readonly [number, number],
    second: readonly [number, number],
  ) => (
    (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0])
  );
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < -1e-12 && cdA * cdB < -1e-12;
}
