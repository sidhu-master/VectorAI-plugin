// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationId,
  type GeometryId,
} from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import {
  drawingBounds,
  fitViewportToDrawing,
  nodesInWorldBox,
  screenToWorld,
  worldToScreen,
  zoomViewportAt,
} from './geometry';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function documentFixture() {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing' }, now: () => 1 });
  document.geometry = [{
    id: 'line-1' as GeometryId,
    type: 'line',
    start: [0, 0],
    end: [100, 50],
    visible: true,
    quality,
  }, {
    id: 'circle-1' as GeometryId,
    type: 'circle',
    center: [200, 100],
    radius: 20,
    visible: true,
    quality,
  }];
  document.annotations = [{
    id: 'text-1' as AnnotationId,
    type: 'text',
    content: 'AB',
    position: [20, 80],
    height: 10,
    rotation: 0,
    alignment: 'left',
    verticalAlignment: 'baseline',
    visible: true,
    quality,
  }];
  return document;
}

describe('shared canvas geometry', () => {
  it('converts between world and screen coordinates with an upward world Y axis', () => {
    const viewport = { x: 100, y: 300, scale: 2, width: 800, height: 600 };

    expect(worldToScreen([20, 30], viewport)).toEqual([140, 240]);
    expect(screenToWorld([140, 240], viewport)).toEqual([20, 30]);
  });

  it('keeps the world point under the pointer fixed while zooming', () => {
    const viewport = { x: 100, y: 300, scale: 2, width: 800, height: 600 };
    const worldBefore = screenToWorld([420, 180], viewport);

    const zoomed = zoomViewportAt(viewport, [420, 180], 1.5);

    expect(zoomed.scale).toBe(3);
    expect(screenToWorld([420, 180], zoomed)).toEqual(worldBefore);
  });

  it('fits all visible geometry and annotations with padding', () => {
    const document = documentFixture();

    expect(drawingBounds(document)).toEqual({ minX: 0, minY: 0, maxX: 220, maxY: 120 });
    const fitted = fitViewportToDrawing(document, { width: 1100, height: 600 }, 1.2);
    expect(fitted.x).toBeCloseTo(91.6666667);
    expect(fitted.y).toBe(550);
    expect(fitted.scale).toBeCloseTo(4.1666667);
    expect({ width: fitted.width, height: fitted.height }).toEqual({ width: 1100, height: 600 });
  });

  it('returns visible nodes whose bounds intersect a world-space selection box', () => {
    const document = documentFixture();

    expect(nodesInWorldBox(document, { minX: 10, minY: 45, maxX: 40, maxY: 90 })).toEqual([
      'line-1',
      'text-1',
    ]);
    expect(nodesInWorldBox(document, { minX: 181, minY: 81, maxX: 219, maxY: 119 })).toEqual([
      'circle-1',
    ]);
  });

  it('fits evaluated spline bounds instead of the control polygon', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-spline' }, now: () => 1 });
    document.geometry = [{
      id: 'spline-1' as GeometryId,
      type: 'spline',
      degree: 2,
      controlPoints: [[0, 0], [0, 10], [10, 0]],
      knots: [0, 0, 0, 1, 1, 1],
      closed: false,
      periodic: false,
      visible: true,
      quality,
    }];

    expect(drawingBounds(document)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 5 });
  });
});
