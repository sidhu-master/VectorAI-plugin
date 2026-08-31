// SPDX-License-Identifier: Apache-2.0

import type { DxfBlockGraphic, DxfExportEntity, Vec2 } from '@vectorai/drawing-core';

export interface CadDimensionPresentation {
  dimensionStyle: 'GB_LINEAR' | 'GB_ANGULAR' | 'GB_RADIAL';
  textStyle: string;
  textHeight: number;
  arrowSize: number;
  lineColor?: number;
  textColor?: number;
}

export interface CadLinearDimensionInput {
  layer: string;
  witnessA: Vec2;
  witnessB: Vec2;
  start: Vec2;
  end: Vec2;
  textPosition: Vec2;
  text: string;
  measurement: number;
  presentation: CadDimensionPresentation;
}

/** Project one semantic axial measurement into a native GB-style CAD dimension. */
export function projectCadLinearDimension(input: CadLinearDimensionInput): Extract<DxfExportEntity, { type: 'dimension' }> {
  const direction = normalized([
    input.end[0] - input.start[0],
    input.end[1] - input.start[1],
  ]);
  const rotation = Math.atan2(direction[1], direction[0]) * 180 / Math.PI;
  return {
    type: 'dimension',
    layer: input.layer,
    dimensionKind: 'linear',
    definitionPoints: [input.witnessA, input.witnessB, input.start, input.end],
    textPosition: input.textPosition,
    text: '',
    measurement: input.measurement,
    style: input.presentation.dimensionStyle,
    picture: [
      { type: 'line', layer: input.layer, color: input.presentation.lineColor, start: input.witnessA, end: input.start },
      { type: 'line', layer: input.layer, color: input.presentation.lineColor, start: input.witnessB, end: input.end },
      { type: 'line', layer: input.layer, color: input.presentation.lineColor, start: input.start, end: input.end },
      arrow(input.layer, input.start, direction, input.presentation.arrowSize, input.presentation.lineColor),
      arrow(input.layer, input.end, [-direction[0], -direction[1]], input.presentation.arrowSize, input.presentation.lineColor),
      {
        type: 'mtext',
        layer: input.layer,
        position: input.textPosition,
        content: input.text,
        height: input.presentation.textHeight,
        rotation,
        style: input.presentation.textStyle,
        alignment: 5,
        color: input.presentation.textColor,
      },
    ],
  };
}

function arrow(layer: string, tip: Vec2, direction: Vec2, size: number, color?: number): DxfBlockGraphic {
  const normal: Vec2 = [-direction[1], direction[0]];
  const base: Vec2 = [
    tip[0] + direction[0] * size,
    tip[1] + direction[1] * size,
  ];
  const halfWidth = size / 6;
  return {
    type: 'solid-hatch',
    layer,
    color,
    boundary: [
      tip,
      [base[0] + normal[0] * halfWidth, base[1] + normal[1] * halfWidth],
      [base[0] - normal[0] * halfWidth, base[1] - normal[1] * halfWidth],
    ],
  };
}

function normalized(value: Vec2): Vec2 {
  const length = Math.hypot(value[0], value[1]) || 1;
  return [value[0] / length, value[1] / length];
}
