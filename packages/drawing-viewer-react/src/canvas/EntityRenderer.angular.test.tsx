// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation } from '@vectorai/drawing-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EntityRenderer } from './EntityRenderer';

describe('angular dimension rendering', () => {
  it('renders semantic extension rays, a circular arc, tangent arrows, and text', () => {
    const node: DimensionAnnotation = {
      id: 'angle-1' as never, type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, dimensionKind: 'angular',
      associationStatus: 'resolved', targets: [], computedValue: 60, displayText: '60°', unit: 'deg',
      textPosition: [14, 0], definitionPoints: [[0, 0], [20, -11.547], [20, 11.547], [10, -5.7735], [10, 5.7735]],
    };

    const markup = renderToStaticMarkup(<svg><EntityRenderer
      node={node} selected={false} onSelect={() => {}}
      viewport={{ x: 0, y: 0, scale: 2, width: 800, height: 600 }}
    /></svg>);

    expect(markup.match(/data-angular-role="extension"/g)).toHaveLength(2);
    expect(markup).toContain('data-angular-role="arc"');
    expect(markup.match(/data-angular-role="arrow"/g)).toHaveLength(2);
    expect(markup).toContain('60°');
    expect(markup).toContain('data-screen-space-label="true"');
    expect(markup).toContain('scale(0.5 -0.5)');
    expect(markup).toContain('vai-entity--angular-dimension');
    expect(markup).not.toContain('<polyline points="0,0 20,-11.547 20,11.547');
  });

  it('keeps ordinary dimension text upright and at a stable screen size', () => {
    const node: DimensionAnnotation = {
      id: 'linear-1' as never, type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, dimensionKind: 'linear',
      associationStatus: 'resolved', targets: [], computedValue: 24.5, displayText: '24.5 ±0.1', unit: 'mm',
      textPosition: [12.25, 8], definitionPoints: [[0, 0], [0, 8], [24.5, 8], [24.5, 0]],
    };
    const markup = renderToStaticMarkup(<svg><EntityRenderer node={node} selected={false} onSelect={() => {}}
      viewport={{ x: 0, y: 0, scale: 4, width: 800, height: 600 }} /></svg>);

    expect(markup).toContain('24.5 ±0.1');
    expect(markup).toContain('data-screen-space-label="true"');
    expect(markup).toContain('scale(0.25 -0.25)');
    expect(markup).toContain('font-size="11"');
  });
});
