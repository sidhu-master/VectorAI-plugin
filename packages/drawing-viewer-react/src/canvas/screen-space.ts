// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';

export function screenSpaceTransform(position: Vec2, viewportScale: number): string {
  const inverse = 1 / Math.max(Math.abs(viewportScale), 1e-6);
  return `translate(${position[0]} ${position[1]}) scale(${inverse} ${-inverse})`;
}

export function estimateScreenTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((width, character) => width + (character.codePointAt(0)! > 0xff ? 1 : 0.62) * fontSize, 0);
}
