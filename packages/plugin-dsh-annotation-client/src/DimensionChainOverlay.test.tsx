// SPDX-License-Identifier: Apache-2.0

import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { AxialDimensionScheme } from '@vectorai/plugin-space-contracts';
import { DimensionChainOverlay, dimensionChainFitPadding } from './DimensionChainOverlay';

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
  displayedCandidateIds: ['overall', 'local'], closureCandidateIds: ['closure'], chains: [{
    id: 'chain:overall', parentCandidateId: 'overall', childCandidateIds: ['local'],
    closureCandidateId: 'closure', alternativeClosureCandidateIds: [], status: 'resolved',
  }],
  diagnostics: [{ id: 'd', severity: 'error', code: 'DIMENSION_CHAIN_INCOMPLETE', message: 'conflict', entityIds: ['local'] }],
} as unknown as AxialDimensionScheme;

describe('DimensionChainOverlay', () => {
  it('renders displayed spans and muted dashed closures in world coordinates', () => {
    const root = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} visible />).root;
    expect(root.findAllByProps({ 'data-dimension-displayed': true })).toHaveLength(2);
    expect(root.findAllByProps({ 'data-dimension-closure': true })).toHaveLength(1);
    expect(root.findByProps({ 'data-dimension-conflict': true })).toBeDefined();
    const labels = root.findAll((node) => node.type === 'g' && node.props.className === 'vai-dimension-chain-label');
    expect(labels).toHaveLength(3);
    expect(labels.map(({ props }) => props['data-dimension-lane'])).toEqual([0, 0, 1]);
    expect(labels[0]?.props.transform).toMatch(/scale\(0\.5 -0\.5\)$/);
    expect(labels[0]?.findByType('text').props.fontSize).toBe(11);
    expect(labels[0]?.findAllByType('rect')).toHaveLength(1);
  });

  it('keeps label glyphs and backgrounds at a constant screen size while zooming', () => {
    const atOne = renderer.create(<DimensionChainOverlay scheme={scheme} scale={1} visible />).root
      .findAll((node) => node.type === 'g' && node.props.className === 'vai-dimension-chain-label')[0]!;
    const atFour = renderer.create(<DimensionChainOverlay scheme={scheme} scale={4} visible />).root
      .findAll((node) => node.type === 'g' && node.props.className === 'vai-dimension-chain-label')[0]!;

    expect(atOne.findByType('text').props.fontSize).toBe(11);
    expect(atFour.findByType('text').props.fontSize).toBe(11);
    expect(atOne.findByType('rect').props.width).toBe(atFour.findByType('rect').props.width);
    expect(atOne.props.transform).toMatch(/scale\(1 -1\)$/);
    expect(atFour.props.transform).toMatch(/scale\(0\.25 -0\.25\)$/);
  });

  it('places grouped chain dimensions outside the part envelope and shows their hierarchy', () => {
    const root = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} radialExtent={30} visible />).root;
    const group = root.findByProps({ 'data-dimension-chain-group': 'chain:overall' });
    const intervals = root.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string');

    expect(group.findByProps({ 'data-dimension-chain-bracket': 'chain:overall' })).toBeDefined();
    expect(group.findByProps({ 'data-dimension-chain-title': 'chain:overall' }).findByType('text').children).toEqual(['尺寸链 1']);
    expect(intervals.every(({ props }) => Math.abs(props['data-normal-offset']) > 30)).toBe(true);
    expect(root.findByProps({ 'data-dimension-candidate-id': 'overall' }).props['data-dimension-role']).toBe('parent');
    expect(root.findByProps({ 'data-dimension-candidate-id': 'local' }).props['data-dimension-role']).toBe('child');
    expect(root.findByProps({ 'data-dimension-candidate-id': 'closure' }).props['data-dimension-role']).toBe('closure');
  });

  it('drags one dimension only along the axis normal and commits a world-space offset', () => {
    const onMoveCandidate = vi.fn();
    const view = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} radialExtent={30} visible onMoveCandidate={onMoveCandidate} />);
    const interval = view.root.findByProps({ 'data-dimension-candidate-id': 'local' });
    const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
    act(() => interval.props.onPointerDown({ button: 0, pointerId: 7, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onPointerMove({ pointerId: 7, clientX: 160, clientY: 80, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onPointerUp({ pointerId: 7, clientX: 160, clientY: 80, currentTarget: target, preventDefault() {}, stopPropagation() {} }));

    expect(onMoveCandidate).toHaveBeenCalledWith('local', 10);
  });

  it('does not commit a canceled or lost-capture drag', () => {
    const onMoveCandidate = vi.fn();
    const view = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} radialExtent={30} visible onMoveCandidate={onMoveCandidate} />);
    const interval = view.root.findByProps({ 'data-dimension-candidate-id': 'local' });
    const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
    act(() => interval.props.onPointerDown({ button: 0, pointerId: 7, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onPointerMove({ pointerId: 7, clientX: 100, clientY: 60, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onPointerCancel({ pointerId: 7, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    expect(onMoveCandidate).not.toHaveBeenCalled();

    act(() => interval.props.onPointerDown({ button: 0, pointerId: 8, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onLostPointerCapture({ pointerId: 8, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    expect(onMoveCandidate).not.toHaveBeenCalled();
  });

  it('clamps persisted negative offsets outside the part envelope', () => {
    const unsafe = { ...scheme, layout: { candidateNormalOffsets: [{ candidateId: 'local', normalOffset: -1_000 }] } };
    const interval = renderer.create(<DimensionChainOverlay scheme={unsafe as AxialDimensionScheme} scale={2} radialExtent={30} visible />).root
      .findByProps({ 'data-dimension-candidate-id': 'local' });
    expect(interval.props['data-normal-offset']).toBeGreaterThanOrEqual(37);
  });

  it('derives fit padding from the actual layout extent and manual offsets', () => {
    const base = dimensionChainFitPadding({ scheme, radialExtent: 30, scale: 2, viewport: { width: 800, height: 600 } });
    const moved = dimensionChainFitPadding({
      scheme: { ...scheme, layout: { candidateNormalOffsets: [{ candidateId: 'local', normalOffset: 100 }] } },
      radialExtent: 30,
      scale: 2,
      viewport: { width: 800, height: 600 },
    });
    const shorterCanvas = dimensionChainFitPadding({ scheme, radialExtent: 30, scale: 2, viewport: { width: 800, height: 300 } });
    expect(moved).toBeGreaterThan(base);
    expect(shorterCanvas).toBeGreaterThan(base);
    expect(dimensionChainFitPadding({
      scheme: { ...scheme, layout: { candidateNormalOffsets: [{ candidateId: 'local', normalOffset: 1_000 }] } },
      radialExtent: 30,
      scale: 2,
      viewport: { width: 800, height: 600 },
    })).toBeGreaterThan(8);
  });

  it('renders a shared nested candidate as the inner parent rather than the outer child', () => {
    const nested = {
      ...scheme,
      chains: [
        { id: 'chain:outer', parentCandidateId: 'overall', childCandidateIds: ['local'], closureCandidateId: 'closure', alternativeClosureCandidateIds: [], status: 'resolved' },
        { id: 'chain:inner', parentCandidateId: 'local', childCandidateIds: [], closureCandidateId: 'closure', alternativeClosureCandidateIds: [], status: 'resolved' },
      ],
    } as AxialDimensionScheme;
    const root = renderer.create(<DimensionChainOverlay scheme={nested} scale={2} radialExtent={30} visible />).root;
    const local = root.findByProps({ 'data-dimension-candidate-id': 'local' });
    expect(local.props['data-dimension-role']).toBe('parent');
    expect(local.props['data-dimension-chain-id']).toBe('chain:inner');
    expect(local.props['data-dimension-chain-memberships']).toBe('chain:outer chain:inner');
    expect(local.props['data-dimension-membership-roles']).toBe('child parent');
    expect(root.findByProps({ 'data-dimension-chain-bracket': 'chain:outer' })
      .findByProps({ 'data-dimension-chain-member': 'local' })).toBeDefined();
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
      .findAll((node) => node.type === 'g' && node.props.className === 'vai-dimension-chain-label');

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
