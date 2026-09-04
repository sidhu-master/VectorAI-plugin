// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, Vec2 } from '@vectorai/drawing-core';
import { resolveShaftAxis } from '../shaft/axis';
import { extractShaftProfile, type ShaftProfilePiece } from '../shaft/profile';
import type { ShaftAxis } from '../partition/types';
import { diameterLabelWidth, layoutDiameterSpans } from './layout';
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
  measurementUncertainty: number;
}

export function measureShaftDiameters(document: DrawingDocument): ShaftDiameterFact[] {
  const axis = resolveShaftAxis(document, { regions: [] });
  if (!axis) return [];
  const profile = extractShaftProfile(document, axis);
  const axisLength = axis.zMax - axis.zMin;
  const radialTolerance = Math.max(profile.maxRadius * 5e-4, axisLength * 1e-6, Number.EPSILON * 1e6);
  const minimumPieceLength = Math.max(axisLength * 2e-4, radialTolerance * 4);
  const surfaces = profile.pieces.flatMap((piece) => axialSurface(piece, radialTolerance, minimumPieceLength));
  return layoutFacts(diameterSpans(surfaces, axisLength, radialTolerance), axis);
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
  const axialJoinGap = Math.max(axisLength * 1e-6, radiusTolerance * 4);
  return radialGroups.flatMap((radialGroup) => splitAxially(radialGroup, axialJoinGap))
    .flatMap((group) => diameterSpan(group, axisLength, radiusTolerance));
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

function diameterSpan(surfaces: AxialSurface[], axisLength: number, radiusTolerance: number): DiameterSpan[] {
  const positive = surfaces.filter(({ side }) => side === 1);
  const negative = surfaces.filter(({ side }) => side === -1);
  if (positive.length === 0 || negative.length === 0) return [];
  const positiveCoverage = coverage(positive);
  const negativeCoverage = coverage(negative);
  const strongPair = Math.min(positiveCoverage, negativeCoverage) >= Math.max(axisLength * 0.003, radiusTolerance * 4);
  const asymmetricSectionEdge = Math.max(positiveCoverage, negativeCoverage) >= radiusTolerance * 20
    && Math.min(positiveCoverage, negativeCoverage) >= radiusTolerance;
  if (!strongPair && !asymmetricSectionEdge) return [];
  const zStart = Math.max(Math.min(...positive.map(({ zStart }) => zStart)), Math.min(...negative.map(({ zStart }) => zStart)));
  const zEnd = Math.min(Math.max(...positive.map(({ zEnd }) => zEnd)), Math.max(...negative.map(({ zEnd }) => zEnd)));
  if (!(zEnd > zStart)) return [];
  return [{
    zStart,
    zEnd,
    radius: weightedRadius(surfaces),
    sourceIds: unique(surfaces.map(({ geometryNodeId }) => geometryNodeId)),
    measurementUncertainty: radiusTolerance * 2,
  }];
}

function layoutFacts(spans: DiameterSpan[], axis: ShaftAxis): ShaftDiameterFact[] {
  if (spans.length === 0) return [];
  const maximumRadius = Math.max(...spans.map(({ radius }) => radius));
  const placements = layoutDiameterSpans(
    spans.map((span, index) => ({
      ...span,
      id: `diameter-span:${index}`,
      labelWidth: diameterLabelWidth(span.radius * 2),
    })),
    { zMin: axis.zMin, zMax: axis.zMax, maximumRadius },
  );
  return placements
    .sort((a, b) => a.zStart - b.zStart || a.radius - b.radius)
    .map((span) => layoutFact(span, axis, span.dimensionZ, classifySpan(span, spans)));
}

function layoutFact(span: DiameterSpan, axis: ShaftAxis, layoutZ: number | undefined, featureClass: ShaftDiameterFact['featureClass']): ShaftDiameterFact {
  const sourceZ = (span.zStart + span.zEnd) / 2;
  const dimensionZ = layoutZ ?? sourceZ;
  const sourceLower = world(axis, sourceZ, -span.radius);
  const sourceUpper = world(axis, sourceZ, span.radius);
  const lower = world(axis, dimensionZ, -span.radius);
  const upper = world(axis, dimensionZ, span.radius);
  const diameter = span.radius * 2;
  return {
    key: `shaft-diameter:${numberKey(span.zStart)}:${numberKey(span.zEnd)}:${numberKey(diameter)}`,
    sourceIds: span.sourceIds,
    diameter,
    zStart: span.zStart,
    zEnd: span.zEnd,
    definitionPoints: [lower, upper, sourceLower, sourceUpper],
    textPosition: world(axis, dimensionZ, 0),
    featureClass,
    profileComponentIds: span.sourceIds,
    measurementUncertainty: span.measurementUncertainty,
  };
}

function classifySpan(span: DiameterSpan, all: DiameterSpan[]): ShaftDiameterFact['featureClass'] {
  const center = (span.zStart + span.zEnd) / 2;
  return all.some((candidate) => candidate !== span
    && candidate.radius > span.radius
    && candidate.zStart <= center && candidate.zEnd >= center)
    ? 'hole'
    : 'shaft';
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
function numberKey(value: number): string { return Number(value.toFixed(4)).toString(); }
