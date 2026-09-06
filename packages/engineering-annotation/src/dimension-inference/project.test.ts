// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { validateEngineeringDraft } from '../dimension/validate';
import { analyzeGoldenInferenceInput } from './golden-input-test-support';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';
import { axialDimensionIntentId, mergeAxialDimensionProjection, projectAxialDimensionScheme } from './project';
import { loadGoldenDrawing } from './golden-fixture-test-support';

describe('projectAxialDimensionScheme', () => {
  it('maps a chain candidate to the stable engineering intent id used by projection', () => {
    expect(axialDimensionIntentId('candidate:3')).toBe('dimension-intent:candidate:3');
  });

  it('projects nominal intents and signed reference-only chains without tolerances', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const draft = projectAxialDimensionScheme({ scheme });

    expect(draft.axialScheme).toEqual(scheme);
    expect(draft.tolerances).toEqual([]);
    expect(draft.intents).toHaveLength(new Set([
      ...scheme.displayedCandidateIds,
      ...scheme.closureCandidateIds,
    ]).size);
    expect(draft.intents.every(({ nominalValue, source, targets }) => (
      Number.isFinite(nominalValue) && source === 'geometry' && targets.length === 2
    ))).toBe(true);
    expect(draft.chains).toHaveLength(scheme.chains.length);
    expect(draft.chains.every(({ analysisMode }) => analysisMode === 'reference-only')).toBe(true);
    expect(draft.chains.flatMap(({ members }) => members).every(({ coefficient }) => coefficient === 1 || coefficient === -1)).toBe(true);
    expect(validateEngineeringDraft(draft)).toEqual([]);
  });

  it('preserves paired-fit assignments when refreshing an axial projection', async () => {
    const input = await analyzeGoldenInferenceInput();
    const scheme = inferAxialDimensionScheme({
      topology: input.topology,
      candidateSet: input.candidateSet,
      policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    const base = projectAxialDimensionScheme({ scheme });
    base.fitAssignments = [{
      fitGroupId: 'fit-1',
      holeDimensionId: 'hole-dimension',
      shaftDimensionId: 'shaft-dimension',
      basis: 'hole',
      designation: 'H7/g6',
      fitType: 'clearance',
      minimumClearance: 0.01,
      maximumClearance: 0.04,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
    }];

    const merged = mergeAxialDimensionProjection(base, projectAxialDimensionScheme({ scheme }));

    expect(merged.fitAssignments).toEqual(base.fitAssignments);
  });

  it('binds all eight displayed real axial dimensions to geometry that owns each measured station', async () => {
    const input = await analyzeGoldenInferenceInput();
    const document = await loadGoldenDrawing('initial.dxf');
    const scheme = inferAxialDimensionScheme({ topology: input.topology, candidateSet: input.candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });
    const before = structuredClone(scheme);
    const draft = projectAxialDimensionScheme({ scheme });
    const byGeometry = new Map(document.geometry.map((node) => [String(node.id), node]));
    const { origin, direction } = scheme.topology.axis;
    const coordinate = (point: Vec2) => (point[0] - origin[0]) * direction[0] + (point[1] - origin[1]) * direction[1];
    const checks = scheme.displayedCandidateIds.map((id) => {
      const candidate = scheme.candidates.find((item) => item.id === id)!;
      const intent = draft.intents.find((item) => item.id === axialDimensionIntentId(id))!;
      return intent.targets.every((target, index) => {
        const stationId = index === 0 ? candidate.startStationId : candidate.endStationId;
        const station = scheme.topology.stations.find((item) => item.id === stationId)!;
        const node = byGeometry.get(String(target.geometryId))!;
        return actualEndpoints(node).some((point) => Math.abs(coordinate(point) - station.sourceCoordinate) < 0.002);
      });
    });
    expect(checks).toEqual(Array(8).fill(true));
    expect(scheme).toEqual(before);
    expect(draft.axialScheme).toEqual(before);
    expect(draft.intents.every((intent) => intent.targets.every(({ anchor }) => anchor.kind === 'nearest'))).toBe(true);
  });
});

function actualEndpoints(node: GeometryNode): Vec2[] {
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
  if (node.type === 'arc') return [node.startAngle, node.endAngle].map((degrees) => {
    const angle = degrees * Math.PI / 180;
    return [node.center[0] + node.radius * Math.cos(angle), node.center[1] + node.radius * Math.sin(angle)];
  });
  if (node.type === 'spline') return [node.controlPoints[0]!, node.controlPoints.at(-1)!];
  return [];
}
