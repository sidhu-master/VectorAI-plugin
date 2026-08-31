// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { projectCadLinearDimension } from './cad-dimension-projector';

describe('projectCadLinearDimension', () => {
  it('uses a GB linear dimension with MTEXT and two filled hatch arrowheads', () => {
    const entity = projectCadLinearDimension({
      layer: '7标注层', witnessA: [0, 0], witnessB: [20, 0],
      start: [0, 10], end: [20, 10], textPosition: [10, 13],
      text: '20', measurement: 20,
      presentation: {
        dimensionStyle: 'GB_LINEAR', textStyle: 'STANDARD', textHeight: 3.5,
        arrowSize: 3.5, lineColor: 4, textColor: 3,
      },
    });

    expect(entity).toMatchObject({ dimensionKind: 'linear', style: 'GB_LINEAR', text: '' });
    expect(entity.picture.filter(({ type }) => type === 'solid-hatch')).toHaveLength(2);
    expect(entity.picture.filter(({ type }) => type === 'mtext')).toEqual([
      expect.objectContaining({ content: '20', height: 3.5, style: 'STANDARD' }),
    ]);
  });
});
