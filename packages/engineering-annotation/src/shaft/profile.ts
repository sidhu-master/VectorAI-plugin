// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, Vec2 } from '@vectorai/drawing-core';
import type { ShaftAxis } from '../partition/types';
import { sampleNode } from './axis';

export interface ShaftProfilePiece { z1: number; r1: number; z2: number; r2: number; geometryNodeId: string }
export interface ShaftProfile {
  axis: ShaftAxis;
  pieces: ShaftProfilePiece[];
  shoulders: Array<{ z: number; radialSpan: number; geometryNodeIds: string[] }>;
  maxRadius: number;
  sampleCount: number;
}

export function extractShaftProfile(document: DrawingDocument, axis: ShaftAxis): ShaftProfile {
  const pieces: ShaftProfilePiece[] = [];
  const selected = axis.geometryNodeIds === undefined ? undefined : new Set(axis.geometryNodeIds);
  for (const node of document.geometry) {
    if (!node.visible || node.type === 'ray' || node.type === 'xline' || selected !== undefined && !selected.has(String(node.id))) continue;
    const points = sampleNode(node).map((point) => local(point, axis));
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1]!;
      const second = points[index]!;
      pieces.push({ z1: first[0], r1: first[1], z2: second[0], r2: second[1], geometryNodeId: String(node.id) });
    }
  }
  const maxRadius = Math.max(0, ...pieces.flatMap(({ r1, r2 }) => [Math.abs(r1), Math.abs(r2)]));
  const axialTolerance = Math.max(axis.zMax * 1e-5, 1e-6);
  const clusters = new Map<number, { z: number; positiveSpan: number; negativeSpan: number; geometryNodeIds: string[] }>();
  for (const piece of pieces) {
    if (Math.abs(piece.z2 - piece.z1) > axialTolerance) continue;
    const radialSpan = Math.abs(piece.r2 - piece.r1);
    if (radialSpan <= Math.max(maxRadius * 0.025, 0.05)) continue;
    if (piece.r1 * piece.r2 <= 0) continue;
    const z = (piece.z1 + piece.z2) / 2;
    const positive = (piece.r1 + piece.r2) / 2 > 0;
    const key = Math.round(z / axialTolerance);
    const current = clusters.get(key);
    if (current) {
      current.z = (current.z + z) / 2;
      if (positive) current.positiveSpan += radialSpan;
      else current.negativeSpan += radialSpan;
      current.geometryNodeIds = [...new Set([...current.geometryNodeIds, piece.geometryNodeId])];
    } else clusters.set(key, {
      z,
      positiveSpan: positive ? radialSpan : 0,
      negativeSpan: positive ? 0 : radialSpan,
      geometryNodeIds: [piece.geometryNodeId],
    });
  }
  const minimumSideSpan = Math.max(maxRadius * 0.01, 0.05);
  const shoulders = [...clusters.values()]
    .filter(({ positiveSpan, negativeSpan }) => positiveSpan > minimumSideSpan && negativeSpan > minimumSideSpan)
    .map(({ positiveSpan, negativeSpan, ...shoulder }) => ({ ...shoulder, radialSpan: positiveSpan + negativeSpan }))
    .sort((first, second) => first.z - second.z);
  return { axis, pieces, shoulders, maxRadius, sampleCount: pieces.length + 1 };
}

export function radiusSummary(profile: ShaftProfile, zStart: number, zEnd: number) {
  const radii = profile.pieces.flatMap((piece) => {
    const low = Math.min(piece.z1, piece.z2);
    const high = Math.max(piece.z1, piece.z2);
    if (high < zStart || low > zEnd) return [];
    return [Math.abs(piece.r1), Math.abs(piece.r2)];
  });
  return {
    minRadius: radii.length ? Math.min(...radii) : 0,
    maxRadius: radii.length ? Math.max(...radii) : 0,
    sampleCount: radii.length,
  };
}

function local(point: Vec2, axis: ShaftAxis): Vec2 {
  const delta: Vec2 = [point[0] - axis.origin[0], point[1] - axis.origin[1]];
  return [delta[0] * axis.direction[0] + delta[1] * axis.direction[1], delta[0] * axis.normal[0] + delta[1] * axis.normal[1]];
}
