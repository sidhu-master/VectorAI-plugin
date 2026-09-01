// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation, ToleranceProjection } from '@vectorai/drawing-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EntityRenderer } from './EntityRenderer';

const viewport = { x: 0, y: 0, scale: 2, width: 800, height: 600 };

function renderTolerance(projection: ToleranceProjection, unit: DimensionAnnotation['unit'] = 'mm'): string {
  const node: DimensionAnnotation = {
    id: 'dimension-1' as never,
    type: 'dimension',
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    dimensionKind: 'linear',
    associationStatus: 'resolved',
    targets: [],
    computedValue: unit === 'in' ? 1 : 25.4,
    unit,
    textPosition: [12, 8],
    definitionPoints: [[0, 0], [25.4, 0]],
    toleranceProjection: projection,
  };
  return renderToStaticMarkup(<svg><EntityRenderer
    node={node}
    viewport={viewport}
    selected={false}
    onSelect={() => undefined}
  /></svg>);
}

function projection(overrides: Partial<ToleranceProjection> = {}): ToleranceProjection {
  return {
    mode: 'bilateral',
    upperDeviation: .044,
    lowerDeviation: .033,
    fitDesignation: 'u6',
    unit: 'mm',
    status: 'resolved',
    source: 'standard',
    displayPreference: 'both',
    evidenceRefs: [],
    ...overrides,
  };
}

describe('portable tolerance dimension rendering', () => {
  it.each([
    ['deviations', '25.4 mm +0.044/+0.033'],
    ['designation', '25.4 mm u6'],
    ['both', '25.4 mm u6 +0.044/+0.033'],
  ] as const)('honors the %s display preference in actual SVG text', (displayPreference, expected) => {
    expect(renderTolerance(projection({ displayPreference }))).toContain(expected);
  });

  it('converts portable deviation values into the visible dimension unit', () => {
    expect(renderTolerance(projection({
      upperDeviation: 2.54,
      lowerDeviation: -1.27,
      displayPreference: 'deviations',
    }), 'in')).toContain('1 in +0.1/-0.05');
  });

  it('does not invent a missing deviation or render unresolved portable metadata', () => {
    expect(renderTolerance(projection({
      mode: 'unilateral',
      upperDeviation: undefined,
      lowerDeviation: -.01,
      fitDesignation: undefined,
      displayPreference: 'deviations',
    }))).toContain('25.4 mm -0.01');
    expect(renderTolerance(projection({ status: 'candidate' }))).not.toContain('u6');
    expect(renderTolerance(projection({ status: 'candidate' }))).not.toContain('+0.044');
  });
});
