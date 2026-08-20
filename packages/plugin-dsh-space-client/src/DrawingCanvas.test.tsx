// SPDX-License-Identifier: Apache-2.0

import type { DrawingCanvasProjection } from '@vectorai/plugin-space-contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DrawingCanvas } from './DrawingCanvas';

function projection(): DrawingCanvasProjection {
  return {
    version: 1,
    ref: { drawingId: 'drawing-source', revision: 1 },
    source: {
      attachmentId: 'source',
      mediaType: 'image/png',
      width: 120,
      height: 80,
      name: 'drawing.png',
      dataUrl: 'data:image/png;base64,AQIDBA==',
    },
    bounds: { minX: 0, minY: 0, maxX: 120, maxY: 80 },
    geometry: [
      { id: 'top', type: 'line', start: [0, 0], end: [120, 0], status: 'candidate' },
      { id: 'right', type: 'line', start: [120, 0], end: [120, 80], status: 'candidate' },
      { id: 'bottom', type: 'line', start: [120, 80], end: [0, 80], status: 'candidate' },
      { id: 'left', type: 'line', start: [0, 80], end: [0, 0], status: 'candidate' },
    ],
    provisional: true,
  };
}

describe('DrawingCanvas', () => {
  it('renders a localized empty state without a Drawing', () => {
    const markup = renderToStaticMarkup(<DrawingCanvas projection={null} />);

    expect(markup).toContain('还没有已导入的图纸');
  });

  it('renders the source raster and four lines in one pixel coordinate viewBox', () => {
    const markup = renderToStaticMarkup(<DrawingCanvas projection={projection()} />);

    expect(markup).toContain('viewBox="0 0 120 80"');
    expect(markup).toContain('href="data:image/png;base64,AQIDBA=="');
    expect(markup.match(/<line /g)).toHaveLength(4);
    expect(markup).toContain('vector-effect="non-scaling-stroke"');
  });

  it('shows drawing identity, revision, and provisional status', () => {
    const markup = renderToStaticMarkup(<DrawingCanvas projection={projection()} />);

    expect(markup).toContain('drawing-source');
    expect(markup).toContain('Revision 1');
    expect(markup).toContain('候选几何');
  });

  it('keeps an existing projection visible while showing a Remote error', () => {
    const markup = renderToStaticMarkup(
      <DrawingCanvas projection={projection()} error="Remote disconnected" />,
    );

    expect(markup).toContain('Remote disconnected');
    expect(markup).toContain('drawing-source');
    expect(markup.match(/<line /g)).toHaveLength(4);
  });
});
