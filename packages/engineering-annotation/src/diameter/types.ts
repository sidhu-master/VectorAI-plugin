// SPDX-License-Identifier: Apache-2.0

import type { Vec2 } from '@vectorai/drawing-core';

export interface ShaftDiameterFact {
  key: string;
  sourceIds: string[];
  diameter: number;
  zStart: number;
  zEnd: number;
  definitionPoints: [Vec2, Vec2, Vec2, Vec2];
  textPosition: Vec2;
}
