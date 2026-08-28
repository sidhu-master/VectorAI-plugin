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
    expect(markup).toContain('vai-entity--angular-dimension');
    expect(markup).not.toContain('<polyline points="0,0 20,-11.547 20,11.547');
  });
});
