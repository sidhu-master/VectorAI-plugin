// SPDX-License-Identifier: Apache-2.0

import renderer from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { AxialDimensionScheme } from '@vectorai/plugin-space-contracts';
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
} as unknown as AxialDimensionScheme;

describe('DimensionChainOverlay', () => {
  it('renders displayed spans and muted dashed closures in world coordinates', () => {
    const root = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} visible />).root;
    expect(root.findAllByProps({ 'data-dimension-displayed': true })).toHaveLength(2);
    expect(root.findAllByProps({ 'data-dimension-closure': true })).toHaveLength(1);
    expect(root.findByProps({ 'data-dimension-conflict': true })).toBeDefined();
    const labels = root.findAllByProps({ 'data-screen-space-label': true });
    expect(labels).toHaveLength(3);
    expect(labels.map(({ props }) => props['data-dimension-lane'])).toEqual([0, 1, 2]);
    expect(labels[0]?.props.transform).toMatch(/scale\(0\.5 -0\.5\)$/);
    expect(labels[0]?.findByType('text').props.fontSize).toBe(11);
    expect(labels[0]?.findAllByType('rect')).toHaveLength(1);
  });

  it('keeps label glyphs and backgrounds at a constant screen size while zooming', () => {
    const atOne = renderer.create(<DimensionChainOverlay scheme={scheme} scale={1} visible />).root
      .findAllByProps({ 'data-screen-space-label': true })[0]!;
    const atFour = renderer.create(<DimensionChainOverlay scheme={scheme} scale={4} visible />).root
      .findAllByProps({ 'data-screen-space-label': true })[0]!;

    expect(atOne.findByType('text').props.fontSize).toBe(11);
    expect(atFour.findByType('text').props.fontSize).toBe(11);
    expect(atOne.findByType('rect').props.width).toBe(atFour.findByType('rect').props.width);
    expect(atOne.props.transform).toMatch(/scale\(1 -1\)$/);
    expect(atFour.props.transform).toMatch(/scale\(0\.25 -0\.25\)$/);
  });

  it('puts visually overlapping labels on separate lanes even when their dimension spans do not overlap', () => {
    const wideLabels = {
      ...scheme,
      topology: { ...scheme.topology, stations: [
        { id: 's0', sourceCoordinate: 0 }, { id: 's1', sourceCoordinate: 10 },
        { id: 's2', sourceCoordinate: 20 }, { id: 's3', sourceCoordinate: 30 },
      ] },
      candidates: [
        { id: 'first', startStationId: 's0', endStationId: 's1', nominalValue: 123456789.123 },
        { id: 'second', startStationId: 's2', endStationId: 's3', nominalValue: 987654321.987 },
      ],
      displayedCandidateIds: ['first', 'second'], closureCandidateIds: [], diagnostics: [],
    } as never;
    const labels = renderer.create(<DimensionChainOverlay scheme={wideLabels} scale={1} visible />).root
      .findAllByProps({ 'data-screen-space-label': true });

    expect(labels.map(({ props }) => props['data-dimension-lane'])).toEqual([0, 1]);
  });

  it('renders nothing while hidden', () => {
    expect(renderer.create(<DimensionChainOverlay scheme={scheme} scale={1} visible={false} />).toJSON()).toBeNull();
  });

  it('keeps clean displayed dimensions while long-press preview hides closures and conflict styling', () => {
    const root = renderer.create(<DimensionChainOverlay scheme={scheme} scale={1} visible previewHeld />).root;
    expect(root.findAllByProps({ 'data-dimension-displayed': true })).toHaveLength(2);
    expect(root.findAllByProps({ 'data-dimension-closure': true })).toHaveLength(0);
    expect(root.findAllByProps({ 'data-dimension-conflict': true })).toHaveLength(0);
  });
});
