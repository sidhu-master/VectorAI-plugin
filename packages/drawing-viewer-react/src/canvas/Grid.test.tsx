// SPDX-License-Identifier: Apache-2.0

import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { CadGrid } from './Grid';
import { gridPatternMetrics } from './grid-pattern';

describe('shared CAD grid', () => {
  it('uses the same fixed world spacing and offsets as the website canvas', () => {
    expect(gridPatternMetrics({ x: -82, y: -151, scale: 1.5, width: 800, height: 600 }))
      .toEqual({
        minorSize: 15,
        majorSize: 75,
        minorX: 8,
        minorY: 14,
        majorX: 68,
        majorY: 74,
      });
  });

  it('renders minor and major grids as sibling layers instead of nested patterns', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <svg>
          <CadGrid
            viewport={{ x: 80, y: 500, scale: 2, width: 800, height: 600 }}
            showGrid
            showAxes={false}
          />
        </svg>,
      );
    });

    const patterns = renderer.root.findAllByType('pattern');
    const layers = renderer.root.findAll((node) => node.props['data-grid-layer'] !== undefined);

    expect(patterns).toHaveLength(2);
    expect(patterns.every((pattern) => pattern.findAllByType('rect').length === 0)).toBe(true);
    expect(layers.map((layer) => layer.props['data-grid-layer'])).toEqual(['minor', 'major']);
    act(() => renderer.unmount());
  });
});
