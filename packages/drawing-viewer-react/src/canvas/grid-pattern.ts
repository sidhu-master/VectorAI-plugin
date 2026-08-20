// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';

export interface GridPatternMetrics {
  minorSize: number;
  majorSize: number;
  minorX: number;
  minorY: number;
  majorX: number;
  majorY: number;
}

export function gridPatternMetrics(viewport: DrawingWorkspaceViewport): GridPatternMetrics {
  const minorSize = 10 * viewport.scale;
  const majorSize = 50 * viewport.scale;
  return {
    minorSize,
    majorSize,
    minorX: modulo(viewport.x, minorSize),
    minorY: modulo(viewport.y, minorSize),
    majorX: modulo(viewport.x, majorSize),
    majorY: modulo(viewport.y, majorSize),
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
