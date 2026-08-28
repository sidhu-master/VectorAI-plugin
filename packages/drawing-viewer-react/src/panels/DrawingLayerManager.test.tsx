// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerDefinition } from '@vectorai/drawing-surface-api';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DrawingLayerManager } from './DrawingLayerManager';

const partitionLayer: DrawingLayerDefinition = {
  id: 'vectorai.annotation.partition',
  label: '智能分区',
  category: 'engineering',
  icon: 'partition',
  order: 100,
  defaultVisible: true,
};

describe('DrawingLayerManager', () => {
  it('groups available layers and delegates visibility changes', () => {
    const onVisibilityChange = vi.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<DrawingLayerManager
        layers={[{ definition: partitionLayer, visible: true }]}
        onVisibilityChange={onVisibilityChange}
      />);
    });

    const trigger = renderer!.root.findByProps({ 'aria-label': '管理图层' });
    expect(trigger.props['aria-expanded']).toBe(false);
    act(() => trigger.props.onClick());

    expect(renderer!.root.findByProps({ 'data-layer-category': 'engineering' }).children)
      .toContain('工程信息');
    const toggle = renderer!.root.findByProps({ 'aria-label': '隐藏智能分区' });
    expect(toggle.props['aria-pressed']).toBe(true);
    act(() => toggle.props.onClick());
    expect(onVisibilityChange).toHaveBeenCalledWith('vectorai.annotation.partition', false);
  });

  it('renders no canvas control when no layers are available', () => {
    const renderer = TestRenderer.create(<DrawingLayerManager
      layers={[]}
      onVisibilityChange={() => undefined}
    />);
    expect(renderer.toJSON()).toBeNull();
  });

  it('closes the expanded menu on Escape', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<DrawingLayerManager
        layers={[{ definition: partitionLayer, visible: false }]}
        onVisibilityChange={() => undefined}
      />);
    });
    act(() => renderer!.root.findByProps({ 'aria-label': '管理图层' }).props.onClick());
    expect(renderer!.root.findByProps({ 'aria-label': '管理图层' }).props['aria-expanded']).toBe(true);
    act(() => renderer!.root.findByProps({ 'data-layer-manager': 'true' }).props.onKeyDown({
      key: 'Escape',
      stopPropagation: vi.fn(),
    }));
    expect(renderer!.root.findByProps({ 'aria-label': '管理图层' }).props['aria-expanded']).toBe(false);
  });
});

