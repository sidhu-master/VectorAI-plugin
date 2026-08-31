// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { inferAxialDimensionScheme } from './infer';
import { SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from './policy';
import type { AxialCandidateSet, AxialTopology } from './types';

describe('generic axial closure selection', () => {
  it('uses the downstream terminal interval as the forward root closure', () => {
    const topology: AxialTopology = {
      drawingRef: { drawingId: 'synthetic-shaft', revision: 1 }, unit: 'mm',
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation: 'forward' },
      stations: [0, 30, 60, 100].map((coordinate) => ({
        id: `s${coordinate}`, coordinate, sourceCoordinate: coordinate, unit: 'mm' as const,
        kinds: coordinate === 0 || coordinate === 100 ? ['drawing-end'] : ['shoulder'],
        geometryNodeIds: [], evidenceIds: [],
      })),
      elementarySpans: [],
    };
    const candidateSet: AxialCandidateSet = {
      candidates: [
        { id: 'overall', startStationId: 's0', endStationId: 's100', nominalValue: 100, roles: ['overall'], evidenceIds: ['overall-evidence'], required: true },
        { id: 'left-functional', startStationId: 's0', endStationId: 's30', nominalValue: 30, roles: ['functional'], evidenceIds: ['left-document'], required: true },
        { id: 'ordinary-middle', startStationId: 's30', endStationId: 's60', nominalValue: 30, roles: ['local'], evidenceIds: ['middle-geometry'], required: false },
        { id: 'right-functional', startStationId: 's60', endStationId: 's100', nominalValue: 40, roles: ['functional'], evidenceIds: ['right-function'], required: true },
      ],
      evidence: [
        { id: 'overall-evidence', origin: 'geometry', kind: 'drawing-end', label: 'overall', required: true, sourceIds: [] },
        { id: 'left-document', origin: 'document', kind: 'document-interval', label: 'left', required: true, sourceIds: [] },
        { id: 'middle-geometry', origin: 'geometry', kind: 'elementary-span', label: 'middle', required: false, sourceIds: [] },
        { id: 'right-function', origin: 'partition', kind: 'functional-region', label: 'right', required: true, sourceIds: [] },
      ],
      diagnostics: [],
    };

    const result = inferAxialDimensionScheme({ topology, candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });

    expect(result.chains[0]?.closureCandidateId).toBe('right-functional');
    expect(result.displayedCandidateIds).toEqual(expect.arrayContaining(['left-functional', 'ordinary-middle']));
  });

  it('uses the upstream terminal interval as the reversed root closure', () => {
    const topology = genericTopology('reversed');
    const candidateSet = genericRootCandidates();

    const result = inferAxialDimensionScheme({ topology, candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });

    expect(result.chains[0]?.closureCandidateId).toBe('left-functional');
    expect(result.displayedCandidateIds).toEqual(expect.arrayContaining(['ordinary-middle', 'right-functional']));
  });

  it('uses the largest unprotected residual as an inner process-chain closure', () => {
    const topology: AxialTopology = {
      drawingRef: { drawingId: 'synthetic-process-shaft', revision: 1 }, unit: 'mm',
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation: 'forward' },
      stations: [0, 10, 30, 80, 100].map((coordinate) => ({
        id: `s${coordinate}`, coordinate, sourceCoordinate: coordinate, unit: 'mm' as const,
        kinds: coordinate === 0 || coordinate === 100 ? ['drawing-end'] : ['shoulder'],
        geometryNodeIds: [], evidenceIds: [],
      })),
      elementarySpans: [],
    };
    const candidateSet: AxialCandidateSet = {
      candidates: [
        candidate('overall', 0, 100, ['overall'], true, 'overall-evidence'),
        candidate('process-parent', 0, 80, ['process'], false, 'process-evidence'),
        candidate('functional-child', 0, 10, ['functional', 'local'], true, 'functional-evidence'),
        candidate('short-residual', 10, 30, ['local'], false, 'short-evidence'),
        candidate('long-residual', 30, 80, ['local'], false, 'long-evidence'),
        candidate('terminal', 80, 100, ['local'], false, 'terminal-evidence'),
      ],
      evidence: [
        evidence('overall-evidence', 'drawing-end', true),
        evidence('process-evidence', 'process-envelope', false),
        evidence('functional-evidence', 'functional-region', true),
        evidence('short-evidence', 'elementary-span', false),
        evidence('long-evidence', 'elementary-span', false),
        evidence('terminal-evidence', 'elementary-span', false),
      ],
      diagnostics: [],
    };

    const result = inferAxialDimensionScheme({ topology, candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });
    const inner = result.chains.find(({ parentCandidateId }) => parentCandidateId === 'process-parent');

    expect(inner?.closureCandidateId).toBe('long-residual');
    expect(inner?.childCandidateIds).toEqual(['functional-child', 'short-residual']);
  });
});

function genericTopology(orientation: 'forward' | 'reversed'): AxialTopology {
  return {
    drawingRef: { drawingId: 'synthetic-shaft', revision: 1 }, unit: 'mm',
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation },
    stations: [0, 30, 60, 100].map((coordinate) => ({
      id: `s${coordinate}`, coordinate, sourceCoordinate: coordinate, unit: 'mm' as const,
      kinds: coordinate === 0 || coordinate === 100 ? ['drawing-end'] : ['shoulder'],
      geometryNodeIds: [], evidenceIds: [],
    })),
    elementarySpans: [],
  };
}

function genericRootCandidates(): AxialCandidateSet {
  return {
    candidates: [
      candidate('overall', 0, 100, ['overall'], true, 'overall-evidence'),
      candidate('left-functional', 0, 30, ['functional'], true, 'left-document'),
      candidate('ordinary-middle', 30, 60, ['local'], false, 'middle-geometry'),
      candidate('right-functional', 60, 100, ['functional'], true, 'right-function'),
    ],
    evidence: [
      evidence('overall-evidence', 'drawing-end', true),
      { id: 'left-document', origin: 'document', kind: 'document-interval', label: 'left', required: true, sourceIds: [] },
      evidence('middle-geometry', 'elementary-span', false),
      evidence('right-function', 'functional-region', true),
    ],
    diagnostics: [],
  };
}

function candidate(
  id: string,
  start: number,
  end: number,
  roles: AxialCandidateSet['candidates'][number]['roles'],
  required: boolean,
  evidenceId: string,
): AxialCandidateSet['candidates'][number] {
  return { id, startStationId: `s${start}`, endStationId: `s${end}`, nominalValue: end - start, roles, evidenceIds: [evidenceId], required };
}

function evidence(
  id: string,
  kind: AxialCandidateSet['evidence'][number]['kind'],
  required: boolean,
): AxialCandidateSet['evidence'][number] {
  return { id, origin: 'geometry', kind, label: id, required, sourceIds: [] };
}
