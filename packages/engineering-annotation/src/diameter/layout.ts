// SPDX-License-Identifier: Apache-2.0

import { Force, Node } from 'labella';

export interface DiameterLayoutSpan {
  id: string;
  zStart: number;
  zEnd: number;
  radius: number;
  labelWidth?: number;
}

export interface DiameterLayoutBounds {
  zMin: number;
  zMax: number;
  maximumRadius: number;
}

export type DiameterLayoutPlacement<T extends DiameterLayoutSpan> = T & {
  side: 'left' | 'right';
  placement: 'interior' | 'exterior';
  dimensionZ: number;
};

/**
 * Uses Labella's one-dimensional VPSC constraint solver to keep dimension
 * labels near their owning spans without overlap. Only labels assigned to an
 * overflow layer are moved outside the shaft interval.
 */
export function layoutDiameterSpans<T extends DiameterLayoutSpan>(
  spans: readonly T[],
  bounds: DiameterLayoutBounds,
): Array<DiameterLayoutPlacement<T>> {
  const nodes = spans.map((span) => new Node(midpoint(span), labelWidth(span), span.id));
  const force = new Force<string>({
    minPos: bounds.zMin,
    maxPos: bounds.zMax,
    nodeSpacing: CAD_DIMENSION_TEXT_GAP * 2,
    lineSpacing: CAD_DIMENSION_TEXT_GAP * 2,
    density: 1,
    algorithm: 'overlap',
    removeOverlap: true,
  }).nodes(nodes).compute();
  const nodeById = new Map((force.nodes() as Array<Node<string>>).map((node) => [node.data, node]));
  const classified = spans.map((span) => ({
    span,
    side: nearestSide(span, bounds),
    placement: nodeById.get(span.id)?.getLayerIndex() === 0 ? 'interior' as const : 'exterior' as const,
  } as const));
  const dimensionById = new Map<string, number>();

  for (const { span, placement } of classified) {
    if (placement === 'interior') dimensionById.set(span.id, nodeById.get(span.id)?.currentPos ?? midpoint(span));
  }

  for (const side of ['left', 'right'] as const) {
    const group = classified
      .filter((item) => item.placement === 'exterior' && item.side === side)
      .sort((left, right) => (
        left.span.radius - right.span.radius
        || left.span.zStart - right.span.zStart
        || left.span.zEnd - right.span.zEnd
        || left.span.id.localeCompare(right.span.id)
      ));
    let previousWidth = 0;
    let cursor = side === 'left' ? bounds.zMin : bounds.zMax;
    group.forEach(({ span }, lane) => {
      const width = labelWidth(span);
      const distance = lane === 0
        ? width / 2 + CAD_DIMENSION_TEXT_GAP
        : (previousWidth + width) / 2 + CAD_DIMENSION_TEXT_GAP * 2;
      cursor += side === 'left' ? -distance : distance;
      dimensionById.set(span.id, cursor);
      previousWidth = width;
    });
  }

  return classified.map(({ span, side, placement }) => ({
    ...span,
    side,
    placement,
    dimensionZ: dimensionById.get(span.id)!,
  }));
}

function nearestSide(span: DiameterLayoutSpan, bounds: DiameterLayoutBounds): 'left' | 'right' {
  const leftGap = Math.max(0, span.zStart - bounds.zMin);
  const rightGap = Math.max(0, bounds.zMax - span.zEnd);
  return leftGap <= rightGap ? 'left' : 'right';
}

function midpoint(span: DiameterLayoutSpan): number { return (span.zStart + span.zEnd) / 2; }

export const CAD_DIMENSION_TEXT_HEIGHT = 2.5;
export const CAD_DIMENSION_TEXT_GAP = 0.625;

export function diameterLabelWidth(diameter: number): number {
  const text = `⌀${Number(diameter.toFixed(2))}`;
  return [...text].reduce((width, character) => (
    width + (character.codePointAt(0)! > 0xff ? 1 : 0.62) * CAD_DIMENSION_TEXT_HEIGHT
  ), CAD_DIMENSION_TEXT_GAP * 2);
}

export function findNearestFreeCoordinate(input: {
  start: number;
  direction: -1 | 1;
  step: number;
  maximumDistance: number;
  isBlocked: (coordinate: number) => boolean;
}): number {
  const step = Math.max(input.step, Number.EPSILON);
  for (let distance = 0; distance <= input.maximumDistance; distance += step) {
    const coordinate = input.start + input.direction * distance;
    if (!input.isBlocked(coordinate)) return coordinate;
  }
  return input.start + input.direction * input.maximumDistance;
}

function labelWidth(span: DiameterLayoutSpan): number {
  return span.labelWidth ?? diameterLabelWidth(span.radius * 2);
}
