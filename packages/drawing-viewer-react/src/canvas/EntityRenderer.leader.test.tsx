// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type LeaderAnnotation } from '@vectorai/drawing-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntityRenderer } from './EntityRenderer';
import { nodeBounds, nodesInWorldBox } from './geometry';

const leader: LeaderAnnotation = {
  id: 'leader' as never, type: 'leader', visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
  target: { geometryId: 'a' as never, anchor: { kind: 'start' } }, points: [[0, 0], [10, 0]], content: 'II', textHeight: 3.5,
};

function render(node: LeaderAnnotation) { return renderToStaticMarkup(<svg><EntityRenderer node={node} selected={false} onSelect={() => {}} viewport={{ x: 0, y: 0, scale: 2, width: 800, height: 600 }} /></svg>); }

describe('leader presentation and selection', () => {
  it('renders a multi-tip R1 leader and includes remote branches in selection bounds', () => {
    const node: LeaderAnnotation = { ...leader, content: 'R1', branches: [{ target: { geometryId: 'b' as never, anchor: { kind: 'end' } }, points: [[30, -20], [10, 0]] }] };
    const markup = render(node);
    expect(markup.match(/data-leader-role="arrow"/g)).toHaveLength(2);
    expect(markup).toContain('data-leader-role="branch"');
    expect(markup).toContain('30,-20 10,0');
    expect(nodeBounds(node)).toMatchObject({ minY: -20, maxX: 30 });
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
    document.annotations = [node];
    expect(nodesInWorldBox(document, { minX: 29, minY: -21, maxX: 31, maxY: -19 })).toEqual(['leader']);
  });

  it('draws a selectable detail circle and starts the leader at the circle edge', () => {
    const node: LeaderAnnotation = { ...leader, callout: { type: 'detail', radius: 4 } };
    const markup = render(node);
    expect(markup).toContain('data-leader-role="detail"');
    expect(markup).toContain('cx="0" cy="0" r="4"');
    expect(markup).toContain('points="4,0 10,0"');
    expect(markup).not.toContain('data-leader-role="arrow"');
    expect(nodeBounds(node)).toEqual({ minX: -4, minY: -4, maxX: 10, maxY: 4 });
  });
});
