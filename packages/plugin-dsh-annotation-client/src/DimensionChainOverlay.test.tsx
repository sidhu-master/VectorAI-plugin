// SPDX-License-Identifier: Apache-2.0

import renderer from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { DimensionChainOverlay } from './DimensionChainOverlay';

const scheme = {
  topology: {
    axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1] },
    stations: [
      { id: 's0', sourceCoordinate: 0 }, { id: 's1', sourceCoordinate: 10 }, { id: 's2', sourceCoordinate: 20 },
    ],
  },
  candidates: [
    { id: 'overall', startStationId: 's0', endStationId: 's2', nominalValue: 20 },
    { id: 'local', startStationId: 's0', endStationId: 's1', nominalValue: 10 },
    { id: 'closure', startStationId: 's1', endStationId: 's2', nominalValue: 10 },
  ],
  displayedCandidateIds: ['overall', 'local'], closureCandidateIds: ['closure'], chains: [],
  diagnostics: [{ id: 'd', severity: 'error', code: 'DIMENSION_CHAIN_INCOMPLETE', message: 'conflict', entityIds: ['local'] }],
} as never;

describe('DimensionChainOverlay', () => {
  it('renders displayed spans and muted dashed closures in world coordinates', () => {
    const root = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} visible />).root;
    expect(root.findAllByProps({ 'data-dimension-displayed': true })).toHaveLength(2);
    expect(root.findAllByProps({ 'data-dimension-closure': true })).toHaveLength(1);
    expect(root.findByProps({ 'data-dimension-conflict': true })).toBeDefined();
  });

  it('renders nothing while hidden', () => {
    expect(renderer.create(<DimensionChainOverlay scheme={scheme} scale={1} visible={false} />).toJSON()).toBeNull();
  });
});
