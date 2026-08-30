// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, Vec2 } from '@vectorai/drawing-core';
import { resolveShaftAxis } from '../shaft/axis';
import { extractShaftProfile, type ShaftProfilePiece } from '../shaft/profile';
import type { ShaftAxis } from '../partition/types';
import type { ShaftDiameterFact } from './types';

interface AxialSurface {
  zStart: number;
  zEnd: number;
  radius: number;
  side: -1 | 1;
  geometryNodeId: string;
}

interface DiameterSpan {
  zStart: number;
  zEnd: number;
  radius: number;
  sourceIds: string[];
}

export function measureShaftDiameters(document: DrawingDocument): ShaftDiameterFact[] {
  const axis = resolveShaftAxis(document, { regions: [] });
  if (!axis) return [];
  const profile = extractShaftProfile(document, axis);
  const radialTolerance = Math.max(profile.maxRadius * 5e-4, 0.005);
  const minimumPieceLength = Math.max(axis.zMax * 2e-4, 0.02);
  const surfaces = profile.pieces.flatMap((piece) => axialSurface(piece, radialTolerance, minimumPieceLength));
  return layoutFacts(diameterSpans(surfaces, axis.zMax, radialTolerance), axis);
}

function axialSurface(piece: ShaftProfilePiece, radialTolerance: number, minimumLength: number): AxialSurface[] {
  const axialLength = Math.abs(piece.z2 - piece.z1);
  if (axialLength < minimumLength || Math.abs(piece.r2 - piece.r1) > radialTolerance) return [];
  const signedRadius = (piece.r1 + piece.r2) / 2;
  if (Math.abs(signedRadius) <= radialTolerance) return [];
  return [{
    zStart: Math.min(piece.z1, piece.z2),
    zEnd: Math.max(piece.z1, piece.z2),
    radius: Math.abs(signedRadius),
    side: signedRadius > 0 ? 1 : -1,
    geometryNodeId: piece.geometryNodeId,
  }];
}

function diameterSpans(surfaces: AxialSurface[], axisLength: number, radiusTolerance: number): DiameterSpan[] {
  const radialGroups: AxialSurface[][] = [];
  for (const surface of [...surfaces].sort((left, right) => left.radius - right.radius)) {
    const group = radialGroups.at(-1);
    const reference = group === undefined ? undefined : weightedRadius(group);
    if (!group || reference === undefined || Math.abs(surface.radius - reference) > radiusTolerance) radialGroups.push([surface]);
    else group.push(surface);
  }
  const axialJoinGap = Math.max(axisLength * 0.08, 2);
  return radialGroups.flatMap((radialGroup) => splitAxially(radialGroup, axialJoinGap))
    .flatMap((group) => diameterSpan(group, axisLength));
}

function splitAxially(surfaces: AxialSurface[], joinGap: number): AxialSurface[][] {
  const groups: AxialSurface[][] = [];
  let currentEnd = Number.NEGATIVE_INFINITY;
  for (const surface of [...surfaces].sort((left, right) => left.zStart - right.zStart || left.zEnd - right.zEnd)) {
    const current = groups.at(-1);
    if (!current || surface.zStart > currentEnd + joinGap) {
      groups.push([surface]);
      currentEnd = surface.zEnd;
    } else {
      current.push(surface);
      currentEnd = Math.max(currentEnd, surface.zEnd);
    }
  }
  return groups;
}

function diameterSpan(surfaces: AxialSurface[], axisLength: number): DiameterSpan[] {
  const positive = surfaces.filter(({ side }) => side === 1);
  const negative = surfaces.filter(({ side }) => side === -1);
  if (positive.length === 0 || negative.length === 0) return [];
  const positiveCoverage = coverage(positive);
  const negativeCoverage = coverage(negative);
  const strongPair = Math.min(positiveCoverage, negativeCoverage) >= Math.max(axisLength * 0.003, 0.5);
  const asymmetricSectionEdge = Math.max(positiveCoverage, negativeCoverage) >= 2
    && Math.min(positiveCoverage, negativeCoverage) >= 0.05;
  if (!strongPair && !asymmetricSectionEdge) return [];
  const zStart = Math.max(Math.min(...positive.map(({ zStart }) => zStart)), Math.min(...negative.map(({ zStart }) => zStart)));
  const zEnd = Math.min(Math.max(...positive.map(({ zEnd }) => zEnd)), Math.max(...negative.map(({ zEnd }) => zEnd)));
  if (!(zEnd > zStart)) return [];
  return [{
    zStart,
    zEnd,
    radius: weightedRadius(surfaces),
    sourceIds: unique(surfaces.map(({ geometryNodeId }) => geometryNodeId)),
  }];
}

function layoutFacts(spans: DiameterSpan[], axis: ShaftAxis): ShaftDiameterFact[] {
  if (spans.length === 0) return [];
  const maximumRadius = Math.max(...spans.map(({ radius }) => radius));
  const left = spans.filter(({ zEnd }) => zEnd <= axis.zMax * 0.24).sort((a, b) => a.radius - b.radius);
  const right = spans.filter((span) => span.zEnd >= axis.zMax * 0.98 || Math.abs(span.radius - maximumRadius) <= 0.01)
    .filter((span) => !left.includes(span))
    .sort((a, b) => a.radius - b.radius);
  const leftLanes = new Map(left.map((span, index) => [span, -10 - index * 9]));
  const rightLanes = new Map(right.map((span, index) => [span, axis.zMax + 10 + index * 9]));
  return [...spans]
    .sort((a, b) => a.zStart - b.zStart || a.radius - b.radius)
    .map((span) => layoutFact(span, axis, leftLanes.get(span) ?? rightLanes.get(span)));
}

function layoutFact(span: DiameterSpan, axis: ShaftAxis, exteriorZ?: number): ShaftDiameterFact {
  const sourceZ = (span.zStart + span.zEnd) / 2;
  const dimensionZ = exteriorZ ?? sourceZ;
  const sourceLower = world(axis, sourceZ, -span.radius);
  const sourceUpper = world(axis, sourceZ, span.radius);
  const lower = world(axis, dimensionZ, -span.radius);
  const upper = world(axis, dimensionZ, span.radius);
  const diameter = cleanDiameter(span.radius * 2);
  return {
    key: `shaft-diameter:${numberKey(span.zStart)}:${numberKey(span.zEnd)}:${numberKey(diameter)}`,
    sourceIds: span.sourceIds,
    diameter,
    zStart: span.zStart,
    zEnd: span.zEnd,
    definitionPoints: [lower, upper, sourceLower, sourceUpper],
    textPosition: world(axis, dimensionZ, 0),
  };
}

function coverage(surfaces: AxialSurface[]): number {
  return surfaces.reduce((sum, { zStart, zEnd }) => sum + zEnd - zStart, 0);
}

function weightedRadius(surfaces: AxialSurface[]): number {
  const total = coverage(surfaces);
  if (!(total > 0)) return surfaces.reduce((sum, { radius }) => sum + radius, 0) / Math.max(surfaces.length, 1);
  return surfaces.reduce((sum, surface) => sum + surface.radius * (surface.zEnd - surface.zStart), 0) / total;
}

function world(axis: ShaftAxis, z: number, radius: number): Vec2 {
  return [axis.origin[0] + axis.direction[0] * z + axis.normal[0] * radius, axis.origin[1] + axis.direction[1] * z + axis.normal[1] * radius];
}

function unique(values: string[]): string[] { return [...new Set(values)].sort(); }
function cleanDiameter(value: number): number { return Number(value.toFixed(2)); }
function numberKey(value: number): string { return Number(value.toFixed(4)).toString(); }
