// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';
import type { SVGProps } from 'react';
import { estimateScreenTextWidth, screenSpaceTransform } from './screen-space';

export interface ScreenSpaceLabelProps {
  position: Vec2;
  viewportScale: number;
  children: string;
  fontSize?: number;
  textAnchor?: 'start' | 'middle' | 'end';
  background?: boolean;
  paddingX?: number;
  paddingY?: number;
  textProps?: SVGProps<SVGTextElement>;
  className?: string;
  pointerEvents?: SVGProps<SVGGElement>['pointerEvents'];
  'data-dimension-lane'?: number;
}

export function ScreenSpaceLabel({
  position,
  viewportScale,
  children,
  fontSize = 11,
  textAnchor = 'middle',
  background = false,
  paddingX = 5,
  paddingY = 3,
  textProps,
  ...groupProps
}: ScreenSpaceLabelProps) {
  const width = estimateScreenTextWidth(children, fontSize) + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const x = textAnchor === 'middle' ? -width / 2 : textAnchor === 'end' ? -width : 0;
  return <g
    {...groupProps}
    data-screen-space-label={true}
    transform={screenSpaceTransform(position, viewportScale)}
  >
    {background && <rect
      className="vai-screen-space-label__background"
      x={x}
      y={-height / 2}
      width={width}
      height={height}
      rx={4}
    />}
    <text {...textProps} fontSize={fontSize} textAnchor={textAnchor} dominantBaseline="middle">{children}</text>
  </g>;
}
