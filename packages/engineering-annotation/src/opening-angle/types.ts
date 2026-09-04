// SPDX-License-Identifier: Apache-2.0

import type { EvidenceId, GeometryId, Vec2 } from '@vectorai/drawing-core';

export interface OpeningAngleAxis {
  start: Vec2;
  end: Vec2;
  status: 'confirmed' | 'conflict';
}

export interface OpeningAngleFact {
  key: string;
  value: number;
  vertex: Vec2;
  rays: readonly [Vec2, Vec2];
  sourceIds: readonly [GeometryId, GeometryId];
  evidenceRefs: EvidenceId[];
  method: 'mirrored-line-pair-opening';
  error: number;
  /** Axis-local coordinate used for end selection and layout. */
  axialCoordinate?: number;
  axialSide?: 'start' | 'end';
}

export interface OpeningAngleLayout {
  textPosition: Vec2;
  definitionPoints: readonly [Vec2, Vec2, Vec2, Vec2, Vec2];
  lane: number;
}
