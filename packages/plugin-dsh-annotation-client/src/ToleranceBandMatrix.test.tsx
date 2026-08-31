// SPDX-License-Identifier: Apache-2.0

import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { ToleranceBandMatrix } from './ToleranceBandMatrix';

const bands = [
  { designation: 'h6', featureClass: 'external' as const, category: 'preferred' as const, available: true },
  { designation: 'u6', featureClass: 'external' as const, category: 'common' as const, available: true },
  { designation: 'g6', featureClass: 'external' as const, category: 'unknown' as const, available: false, unavailableCode: 'TOLERANCE_STANDARD_UNAVAILABLE' as const },
  { designation: 'js6', featureClass: 'external' as const, category: 'other' as const, available: true },
];

describe('ToleranceBandMatrix', () => {
  it('renders provider categories and unavailable explanations without changing them', () => {
    const tree = create(<ToleranceBandMatrix bands={bands} onPreview={() => undefined} />);
    expect(tree.root.findByProps({ 'data-tolerance-band': 'h6' }).props).toMatchObject({
      'data-band-category': 'preferred', 'data-available': 'true',
    });
    expect(tree.root.findByProps({ 'data-tolerance-band': 'h6' }).findByType('span').children).toContain('优选');
    expect(tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props['data-band-category']).toBe('common');
    expect(tree.root.findByProps({ 'data-tolerance-band': 'g6' }).props).toMatchObject({
      disabled: true, title: 'TOLERANCE_STANDARD_UNAVAILABLE', 'data-available': 'false',
    });
  });

  it('keeps hover inspector-only and previews only an available click', () => {
    const onInspect = vi.fn();
    const onPreview = vi.fn();
    const tree = create(<ToleranceBandMatrix bands={bands} onInspect={onInspect} onPreview={onPreview} />);
    act(() => tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onMouseEnter());
    expect(onInspect).toHaveBeenCalledWith(bands[1]);
    expect(onPreview).not.toHaveBeenCalled();
    act(() => tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick());
    expect(onPreview).toHaveBeenCalledWith('u6');
  });

  it('filters by direct search and previews an exact available result with Enter', () => {
    const onPreview = vi.fn();
    const tree = create(<ToleranceBandMatrix bands={bands} onPreview={onPreview} />);
    const search = tree.root.findByProps({ 'data-tolerance-search': true });
    act(() => search.props.onChange({ currentTarget: { value: 'U6' } }));
    expect(tree.root.findAllByProps({ 'data-tolerance-band': 'u6' })).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props['data-tolerance-band'] && node.props['data-tolerance-band'] !== 'u6')).toHaveLength(0);
    act(() => search.props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }));
    expect(onPreview).toHaveBeenCalledWith('u6');
  });

  it('uses arrow keys to navigate available cells and Enter to preview focus', () => {
    const onPreview = vi.fn();
    const tree = create(<ToleranceBandMatrix bands={bands} onPreview={onPreview} />);
    const matrix = tree.root.findByProps({ 'data-tolerance-band-matrix': true });
    act(() => matrix.props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() }));
    expect(tree.root.findByProps({ 'data-tolerance-band': 'u6' }).props['data-focused']).toBe('true');
    act(() => matrix.props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() }));
    expect(tree.root.findByProps({ 'data-tolerance-band': 'js6' }).props['data-focused']).toBe('true');
    act(() => matrix.props.onKeyDown({ key: 'Enter', preventDefault: vi.fn() }));
    expect(onPreview).toHaveBeenCalledWith('js6');
  });
});
