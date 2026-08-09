import type { CanvasViewTransform } from './pan-interaction';

export interface GridPatternMetrics {
  minorSize: number;
  majorSize: number;
  minorX: number;
  minorY: number;
  majorX: number;
  majorY: number;
}

export function gridPatternMetrics(transform: CanvasViewTransform): GridPatternMetrics {
  const minorSize = 10 * transform.scale;
  const majorSize = 50 * transform.scale;
  return {
    minorSize,
    majorSize,
    minorX: modulo(transform.offsetX, minorSize),
    minorY: modulo(transform.offsetY, minorSize),
    majorX: modulo(transform.offsetX, majorSize),
    majorY: modulo(transform.offsetY, majorSize),
  };
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
