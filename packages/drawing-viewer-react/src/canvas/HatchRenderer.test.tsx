// SPDX-License-Identifier: Apache-2.0

import type { SectionHatchAnnotation } from '@vectorai/drawing-core';
import { create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { HatchRenderer } from './HatchRenderer';

const node: SectionHatchAnnotation = {
  id: 'hatch-1' as never, type: 'section-hatch', visible: true,
  quality: { status: 'confirmed', evidenceRefs: [] }, pattern: 'ANSI31', angle: 45, spacing: 3.175,
  hatch: {
    version: 1, style: 'normal', elevation: 0, extrusion: [0, 0, 1],
    boundaryPaths: [{ flags: 3, closed: true, edges: [
      { type: 'line', start: [0, 0], end: [20, 0] },
      { type: 'line', start: [20, 0], end: [20, 10] },
      { type: 'line', start: [20, 10], end: [0, 10] },
      { type: 'line', start: [0, 10], end: [0, 0] },
    ] }],
    patternLines: [{ angle: 45, base: [0, 0], offset: [-2.2450640303, 2.2450640303], dashLengths: [] }],
    patternAngle: 0, patternScale: 1, double: false,
  },
};

describe('HatchRenderer', () => {
  it('clips a regular line family with one compound boundary path', () => {
    const tree = create(<HatchRenderer node={node} viewportScale={2} />).root;
    const clipPath = tree.findByType('clipPath');
    const boundaryPath = clipPath.findByType('path').props.d as string;
    expect(boundaryPath).toMatch(/^M .* Z$/);
    for (const corner of ['0 0', '20 0', '20 10', '0 10']) expect(boundaryPath).toContain(corner);
    const lines = tree.findAllByType('line');
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.every((line) => typeof line.props.clipPath === 'string')).toBe(true);
  });
});
