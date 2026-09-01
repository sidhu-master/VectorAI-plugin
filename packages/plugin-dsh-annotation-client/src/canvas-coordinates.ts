// SPDX-License-Identifier: Apache-2.0

export function canvasLocalPoint(
  point: { x: number; y: number },
  bounds?: Pick<DOMRect, 'left' | 'top'>,
): { x: number; y: number } {
  return bounds === undefined
    ? point
    : { x: point.x - bounds.left, y: point.y - bounds.top };
}
