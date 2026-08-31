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
    expect(labels.map(({ props }) => props['data-dimension-lane'])).toEqual([2, 0, 1]);
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

  it('switches the right-clicked interval to the missing segment of its selected chain', () => {
    const switchable = {
      ...scheme,
      chains: [{
        ...scheme.chains[0]!,
        alternativeClosureCandidateIds: ['local'],
      }],
    } as AxialDimensionScheme;
    const onChooseClosure = vi.fn();
    const view = renderer.create(<DimensionChainOverlay
      scheme={switchable}
      scale={2}
      visible
      onMoveChain={() => undefined}
      onChooseClosure={onChooseClosure}
    />);
    const local = view.root.findByProps({ 'data-dimension-candidate-id': 'local' });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    act(() => local.props.onContextMenu({ preventDefault, stopPropagation }));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    const menu = view.root.findByProps({ 'data-dimension-closure-menu': 'local' });
    const action = menu.findByProps({ 'data-closure-chain-id': 'chain:overall' });
    expect(action.findByType('text').children).toEqual(['切换为缺省段']);

    act(() => action.props.onClick({ stopPropagation() {} }));
    expect(onChooseClosure).toHaveBeenCalledWith('chain:overall', 'local');
    expect(view.root.findAllByProps({ 'data-dimension-closure-menu': 'local' })).toHaveLength(0);
  });

  it('drags only the selected dimension chain as one group from any member or its title', () => {
    const multiChainScheme = {
      ...scheme,
      topology: {
        ...scheme.topology,
        stations: [...scheme.topology.stations, { id: 's3', sourceCoordinate: 30 }, { id: 's4', sourceCoordinate: 40 }],
      },
      candidates: [
        ...scheme.candidates,
        { id: 'overall-b', startStationId: 's2', endStationId: 's4', nominalValue: 20 },
        { id: 'local-b', startStationId: 's2', endStationId: 's3', nominalValue: 10 },
        { id: 'closure-b', startStationId: 's3', endStationId: 's4', nominalValue: 10 },
      ],
      displayedCandidateIds: [...scheme.displayedCandidateIds, 'overall-b', 'local-b'],
      closureCandidateIds: [...scheme.closureCandidateIds, 'closure-b'],
      chains: [...scheme.chains, {
        id: 'chain:b', parentCandidateId: 'overall-b', childCandidateIds: ['local-b'],
        closureCandidateId: 'closure-b', alternativeClosureCandidateIds: [], status: 'resolved',
      }],
      layout: { chainNormalOffsets: [{ chainId: 'chain:b', normalOffset: 30 }], candidateNormalOffsets: [] },
    } as unknown as AxialDimensionScheme;
    const onMoveChain = vi.fn();
    const view = renderer.create(<DimensionChainOverlay scheme={multiChainScheme} scale={2} radialExtent={30} visible onMoveChain={onMoveChain} />);
    const group = view.root.findByProps({ 'data-dimension-chain-group': 'chain:overall' });
    const otherGroup = view.root.findByProps({ 'data-dimension-chain-group': 'chain:b' });
    const before = group.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .map(({ props }) => props['data-normal-offset'] as number);
    const otherBefore = otherGroup.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .map(({ props }) => props['data-normal-offset'] as number);
    const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
    expect(typeof group.props.onPointerDown).toBe('function');
    act(() => group.props.onPointerDown({ button: 0, pointerId: 7, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => group.props.onPointerMove({ pointerId: 7, clientX: 160, clientY: 80, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    const after = group.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .map(({ props }) => props['data-normal-offset'] as number);
    const otherAfter = otherGroup.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .map(({ props }) => props['data-normal-offset'] as number);
    expect(after).toEqual(before.map((offset) => offset + 10));
    expect(otherAfter).toEqual(otherBefore);
    act(() => group.props.onPointerUp({ pointerId: 7, clientX: 160, clientY: 80, currentTarget: target, preventDefault() {}, stopPropagation() {} }));

    expect(onMoveChain).toHaveBeenCalledWith('chain:overall', 10);
    expect(group.findByProps({ 'data-dimension-chain-title': 'chain:overall' })).toBeDefined();
    expect(group.findByProps({ 'data-dimension-chain-bracket': 'chain:overall' }).props.pointerEvents).toBe('all');
    expect(group.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .every(({ props }) => props.pointerEvents === 'all')).toBe(true);

    const firstAfterFirstDrag = group.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .map(({ props }) => props['data-normal-offset'] as number);
    act(() => otherGroup.props.onPointerDown({ button: 0, pointerId: 8, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => otherGroup.props.onPointerMove({ pointerId: 8, clientX: 160, clientY: 80, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    expect(group.findAll((node) => typeof node.props['data-dimension-candidate-id'] === 'string')
      .map(({ props }) => props['data-normal-offset'] as number)).toEqual(firstAfterFirstDrag);
    act(() => otherGroup.props.onPointerUp({ pointerId: 8, clientX: 160, clientY: 80, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    expect(onMoveChain).toHaveBeenLastCalledWith('chain:b', 40);
  });

  it('does not commit a canceled or lost-capture drag', () => {
    const onMoveChain = vi.fn();
    const view = renderer.create(<DimensionChainOverlay scheme={scheme} scale={2} radialExtent={30} visible onMoveChain={onMoveChain} />);
    const interval = view.root.findByProps({ 'data-dimension-chain-group': 'chain:overall' });
    const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
    act(() => interval.props.onPointerDown({ button: 0, pointerId: 7, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onPointerMove({ pointerId: 7, clientX: 100, clientY: 60, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onPointerCancel({ pointerId: 7, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    expect(onMoveChain).not.toHaveBeenCalled();

    act(() => interval.props.onPointerDown({ button: 0, pointerId: 8, clientX: 100, clientY: 100, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    act(() => interval.props.onLostPointerCapture({ pointerId: 8, currentTarget: target, preventDefault() {}, stopPropagation() {} }));
    expect(onMoveChain).not.toHaveBeenCalled();
  });

  it('clamps persisted negative offsets outside the part envelope', () => {
    const unsafe = { ...scheme, layout: { chainNormalOffsets: [{ chainId: 'chain:overall', normalOffset: -1_000 }], candidateNormalOffsets: [] } };
    const interval = renderer.create(<DimensionChainOverlay scheme={unsafe as AxialDimensionScheme} scale={2} radialExtent={30} visible />).root
      .findByProps({ 'data-dimension-candidate-id': 'local' });
    expect(interval.props['data-normal-offset']).toBeGreaterThanOrEqual(37);
  });

  it('derives fit padding from the actual layout extent and manual offsets', () => {
    const base = dimensionChainFitPadding({ scheme, radialExtent: 30, scale: 2, viewport: { width: 800, height: 600 } });
    const moved = dimensionChainFitPadding({
      scheme: { ...scheme, layout: { chainNormalOffsets: [{ chainId: 'chain:overall', normalOffset: 100 }], candidateNormalOffsets: [] } },
      radialExtent: 30,
      scale: 2,
      viewport: { width: 800, height: 600 },
    });
    const shorterCanvas = dimensionChainFitPadding({ scheme, radialExtent: 30, scale: 2, viewport: { width: 800, height: 300 } });
    expect(moved).toBeGreaterThan(base);
    expect(shorterCanvas).toBeGreaterThan(base);
    expect(dimensionChainFitPadding({
      scheme: { ...scheme, layout: { chainNormalOffsets: [{ chainId: 'chain:overall', normalOffset: 1_000 }], candidateNormalOffsets: [] } },
      radialExtent: 30,
      scale: 2,
      viewport: { width: 800, height: 600 },
    })).toBeGreaterThan(8);
  });

  it('renders a shared nested candidate only in its owning inner chain', () => {
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
      .findAllByProps({ 'data-dimension-chain-member': 'local' })).toHaveLength(0);
  });

  it('keeps an outer chain visual fixed when a nested chain moves a shared candidate', () => {
    const nested = {
      ...scheme,
      chains: [
        { id: 'chain:outer', parentCandidateId: 'overall', childCandidateIds: ['local'], closureCandidateId: 'closure', alternativeClosureCandidateIds: [], status: 'resolved' },
        { id: 'chain:inner', parentCandidateId: 'local', childCandidateIds: [], closureCandidateId: 'closure', alternativeClosureCandidateIds: [], status: 'resolved' },
      ],
    } as AxialDimensionScheme;
    const chainVisual = (current: AxialDimensionScheme, chainId: string) => {
      const bracket = renderer.create(<DimensionChainOverlay scheme={current} scale={2} radialExtent={30} visible />).root
        .findByProps({ 'data-dimension-chain-bracket': chainId });
      return {
        path: bracket.findByType('path').props.d as string,
        title: bracket.findByProps({ 'data-dimension-chain-title': chainId }).props.position as readonly [number, number],
      };
    };
    const outerBefore = chainVisual(nested, 'chain:outer');
    const innerBefore = chainVisual(nested, 'chain:inner');
    const moved = {
      ...nested,
      layout: { chainNormalOffsets: [{ chainId: 'chain:inner', normalOffset: 30 }], candidateNormalOffsets: [] },
    };

    expect(chainVisual(moved, 'chain:outer')).toEqual(outerBefore);
    expect(chainVisual(moved, 'chain:inner')).not.toEqual(innerBefore);
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

  it('places longer axial dimensions farther outside than shorter dimensions regardless of input order', () => {
    const lengthOrdered = {
      ...scheme,
      topology: { ...scheme.topology, stations: [
        { id: 's0', sourceCoordinate: 0 }, { id: 's1', sourceCoordinate: 10 },
        { id: 's2', sourceCoordinate: 100 },
      ] },
      candidates: [
        { id: 'long', startStationId: 's0', endStationId: 's2', nominalValue: 100 },
        { id: 'short', startStationId: 's0', endStationId: 's1', nominalValue: 10 },
      ],
      displayedCandidateIds: ['long', 'short'], closureCandidateIds: [], chains: [], diagnostics: [],
    } as unknown as AxialDimensionScheme;
    const root = renderer.create(<DimensionChainOverlay scheme={lengthOrdered} scale={1} radialExtent={30} visible />).root;
    const long = root.findByProps({ 'data-dimension-candidate-id': 'long' });
    const short = root.findByProps({ 'data-dimension-candidate-id': 'short' });

    expect(long.props['data-normal-offset']).toBeGreaterThan(short.props['data-normal-offset']);
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
