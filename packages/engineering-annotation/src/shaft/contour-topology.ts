// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import type { ShaftAxis } from '../partition/types';
import { sampleNode } from './axis';
import { createShaftCoordinateFrame } from './coordinate-frame';
import { isShaftProfileGeometry } from './geometry-filter';

export interface ShaftContourSpan {
  zStart: number;
  zEnd: number;
  radius: number;
  geometryNodeIds: string[];
  componentId: string;
  confidence: number;
}

export interface ShaftContourTransition {
  z: number;
  kind: 'shoulder' | 'chamfer' | 'fillet-or-groove';
  radialSpan: number;
  geometryNodeIds: string[];
  confidence: number;
}

export interface ShaftContourStation {
  z: number;
  radiusBefore?: number;
  radiusAfter?: number;
  evidenceIds: string[];
  confidence: number;
}

export interface ShaftContourTopology {
  positiveProfile: ShaftContourSpan[];
  negativeProfile: ShaftContourSpan[];
  stations: ShaftContourStation[];
  transitions: ShaftContourTransition[];
  confidence: number;
  evidenceIds: string[];
}

interface Piece {
  z1: number;
  r1: number;
  z2: number;
  r2: number;
  geometryNodeId: string;
  sourceType: DrawingDocument['geometry'][number]['type'];
}

export function buildShaftContourTopology(document: DrawingDocument, axis: ShaftAxis): ShaftContourTopology {
  const frame = createShaftCoordinateFrame(axis);
  const selected = axis.geometryNodeIds === undefined ? undefined : new Set(axis.geometryNodeIds);
  const pieces: Piece[] = [];
  for (const node of document.geometry) {
    if (!isShaftProfileGeometry(node) || selected && !selected.has(String(node.id))) continue;
    const points = sampleNode(node).map((point) => frame.toLocal(point));
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1]!;
      const second = points[index]!;
      pieces.push({
        z1: first[0],
        r1: first[1],
        z2: second[0],
        r2: second[1],
        geometryNodeId: String(node.id),
        sourceType: node.type,
      });
    }
  }
  const span = Math.max(axis.zMax - axis.zMin, 1e-9);
  const maxRadius = Math.max(0, ...pieces.flatMap(({ r1, r2 }) => [Math.abs(r1), Math.abs(r2)]));
  const zTolerance = Math.max(span * 1e-5, 1e-7);
  const rTolerance = Math.max(maxRadius * 5e-4, span * 1e-7, 1e-7);
  const axial = pieces.filter(({ z1, z2, r1, r2 }) => (
    Math.abs(z2 - z1) > zTolerance && Math.abs(r2 - r1) <= rTolerance && Math.abs((r1 + r2) / 2) > rTolerance
  ));
  const positiveProfile = stableSpans(axial.filter(({ r1, r2 }) => (r1 + r2) / 2 > 0), zTolerance, rTolerance, 'positive');
  const negativeProfile = stableSpans(axial.filter(({ r1, r2 }) => (r1 + r2) / 2 < 0), zTolerance, rTolerance, 'negative');
  const transitions = dedupeTransitions([
    ...pairedTransitions(pieces, positiveProfile, negativeProfile, zTolerance, rTolerance, maxRadius),
    ...pairedArcEndpoints(pieces, zTolerance, span),
  ], zTolerance);
  const stationValues = uniqueStations([
    axis.zMin,
    ...transitions.filter(({ kind, confidence }) => kind === 'shoulder' && confidence >= 0.55).map(({ z }) => z),
    axis.zMax,
  ], zTolerance);
  const stations = stationValues.map((z) => {
    const transition = nearestTransition(transitions, z, zTolerance);
    const before = radiusAt([...positiveProfile, ...negativeProfile], z - zTolerance * 2);
    const after = radiusAt([...positiveProfile, ...negativeProfile], z + zTolerance * 2);
    return {
      z: clean(z),
      ...(before === undefined ? {} : { radiusBefore: clean(before) }),
      ...(after === undefined ? {} : { radiusAfter: clean(after) }),
      evidenceIds: transition?.geometryNodeIds.map((id) => `geometry:${id}`) ?? [],
      confidence: transition?.confidence ?? 1,
    };
  });
  const evidenceIds = [...new Set([
    ...positiveProfile.flatMap(({ geometryNodeIds }) => geometryNodeIds.map((id) => `geometry:${id}`)),
    ...negativeProfile.flatMap(({ geometryNodeIds }) => geometryNodeIds.map((id) => `geometry:${id}`)),
    ...transitions.flatMap(({ geometryNodeIds }) => geometryNodeIds.map((id) => `geometry:${id}`)),
  ])].sort();
  const confidence = stations.length <= 2 ? 0.75 : average(stations.map(({ confidence: value }) => value));
  return { positiveProfile, negativeProfile, stations, transitions, confidence, evidenceIds };
}

function stableSpans(pieces: Piece[], zTolerance: number, rTolerance: number, side: string): ShaftContourSpan[] {
  const ordered = pieces.map((piece) => ({
    zStart: Math.min(piece.z1, piece.z2), zEnd: Math.max(piece.z1, piece.z2),
    radius: Math.abs((piece.r1 + piece.r2) / 2), geometryNodeIds: [piece.geometryNodeId],
  })).sort((a, b) => a.zStart - b.zStart || a.radius - b.radius);
  const output: ShaftContourSpan[] = [];
  for (const current of ordered) {
    const previous = output.at(-1);
    if (previous && current.zStart <= previous.zEnd + zTolerance && Math.abs(current.radius - previous.radius) <= rTolerance) {
      const previousLength = previous.zEnd - previous.zStart;
      const currentLength = current.zEnd - current.zStart;
      previous.radius = (previous.radius * previousLength + current.radius * currentLength) / Math.max(previousLength + currentLength, 1e-9);
      previous.zEnd = Math.max(previous.zEnd, current.zEnd);
      previous.geometryNodeIds = [...new Set([...previous.geometryNodeIds, ...current.geometryNodeIds])];
      continue;
    }
    output.push({ ...current, componentId: `${side}:${output.length}`, confidence: 0.98 });
  }
  return output.map((item) => ({ ...item, zStart: clean(item.zStart), zEnd: clean(item.zEnd), radius: clean(item.radius) }));
}

function pairedTransitions(
  pieces: Piece[], positive: ShaftContourSpan[], negative: ShaftContourSpan[], zTolerance: number,
  rTolerance: number, maxRadius: number,
): ShaftContourTransition[] {
  const candidates = pieces.filter(({ z1, z2, r1, r2, sourceType }) => (
    // A sampled arc/spline consists of short chords. Classifying those chords
    // independently creates fake vertical shoulders near curve tangencies.
    // Only source entities whose segments are exact may define a shoulder.
    (sourceType === 'line' || sourceType === 'polyline')
    && Math.abs(r2 - r1) > rTolerance && Math.abs(z2 - z1) <= Math.max(zTolerance * 8, Math.abs(r2 - r1) * 2)
    && r1 * r2 > 0
  )).map((piece) => ({
    z: (piece.z1 + piece.z2) / 2,
    positive: (piece.r1 + piece.r2) / 2 > 0,
    radialSpan: Math.abs(piece.r2 - piece.r1),
    axialSpan: Math.abs(piece.z2 - piece.z1),
    geometryNodeId: piece.geometryNodeId,
  }));
  const result: ShaftContourTransition[] = [];
  for (const upper of candidates.filter(({ positive: value }) => value)) {
    const lower = candidates.filter(({ positive: value }) => !value)
      .sort((a, b) => Math.abs(a.z - upper.z) - Math.abs(b.z - upper.z))[0];
    if (!lower || Math.abs(lower.z - upper.z) > Math.max(zTolerance * 12, Math.max(upper.axialSpan, lower.axialSpan) * 1.5)) continue;
    const z = (upper.z * upper.radialSpan + lower.z * lower.radialSpan) / (upper.radialSpan + lower.radialSpan);
    const correspondence = 1 - Math.min(1, Math.abs(upper.radialSpan - lower.radialSpan) / Math.max(upper.radialSpan, lower.radialSpan));
    const continuity = profileBoundaryConfidence(z, positive, negative, zTolerance);
    const radialChange = Math.min(1, (upper.radialSpan + lower.radialSpan) / Math.max(maxRadius * 0.2, rTolerance));
    const axialRatio = Math.max(upper.axialSpan, lower.axialSpan) / Math.max(upper.radialSpan, lower.radialSpan, rTolerance);
    const confidence = 0.4 * correspondence + 0.35 * continuity + 0.25 * radialChange;
    result.push({
      z: clean(z),
      kind: axialRatio <= 0.15 ? 'shoulder' : axialRatio <= 0.8 ? 'chamfer' : 'fillet-or-groove',
      radialSpan: clean(upper.radialSpan + lower.radialSpan),
      geometryNodeIds: [...new Set([upper.geometryNodeId, lower.geometryNodeId])],
      confidence: clean(confidence),
    });
  }
  return dedupeTransitions(result, zTolerance);
}

function pairedArcEndpoints(
  pieces: Piece[],
  zTolerance: number,
  axisSpan: number,
): ShaftContourTransition[] {
  const byNode = new Map<string, Piece[]>();
  for (const piece of pieces.filter(({ sourceType }) => sourceType === 'arc')) {
    const current = byNode.get(piece.geometryNodeId) ?? [];
    current.push(piece);
    byNode.set(piece.geometryNodeId, current);
  }
  const extents = [...byNode].flatMap(([geometryNodeId, items]) => {
    const radial = items.flatMap(({ r1, r2 }) => [r1, r2]);
    const meanRadius = average(radial);
    if (radial.some((radius) => radius * meanRadius <= 0)) return [];
    const axial = items.flatMap(({ z1, z2 }) => [z1, z2]);
    const zStart = Math.min(...axial);
    const zEnd = Math.max(...axial);
    return [{
      geometryNodeId,
      positive: meanRadius > 0,
      zStart,
      zEnd,
      radialSpan: Math.max(...radial) - Math.min(...radial),
      startRadius: endpointRadius(items, zStart, zTolerance),
      endRadius: endpointRadius(items, zEnd, zTolerance),
      startTangentRatio: endpointTangentRatio(items, zStart, zTolerance),
      endTangentRatio: endpointTangentRatio(items, zEnd, zTolerance),
    }];
  });
  const result: ShaftContourTransition[] = [];
  for (const upper of extents.filter(({ positive }) => positive)) {
    const candidates = extents.filter(({ positive }) => !positive)
      .map((lower) => ({
        lower,
        error: Math.abs(lower.zStart - upper.zStart) + Math.abs(lower.zEnd - upper.zEnd),
      }))
      .sort((left, right) => left.error - right.error);
    const match = candidates[0];
    if (!match) continue;
    const width = Math.max(
      upper.zEnd - upper.zStart,
      match.lower.zEnd - match.lower.zStart,
    );
    if (match.error > Math.max(zTolerance * 24, width * 0.05)) continue;
    const radialSpan = Math.abs(upper.radialSpan) + Math.abs(match.lower.radialSpan);
    for (const endpoint of [
      {
        z: (upper.zStart + match.lower.zStart) / 2,
        upperRadius: upper.startRadius,
        lowerRadius: match.lower.startRadius,
        tangentRatio: Math.max(upper.startTangentRatio, match.lower.startTangentRatio),
      },
      {
        z: (upper.zEnd + match.lower.zEnd) / 2,
        upperRadius: upper.endRadius,
        lowerRadius: match.lower.endRadius,
        tangentRatio: Math.max(upper.endTangentRatio, match.lower.endTangentRatio),
      },
    ]) {
      const shoulder = endpoint.tangentRatio <= 0.15
        && hasStableAxialResidence(
          endpoint.z,
          endpoint.upperRadius,
          endpoint.lowerRadius,
          pieces,
          axisSpan,
        );
      result.push({
        z: clean(endpoint.z),
        kind: shoulder ? 'shoulder' : 'fillet-or-groove',
        radialSpan: clean(radialSpan),
        geometryNodeIds: [upper.geometryNodeId, match.lower.geometryNodeId],
        confidence: 0.9,
      });
    }
  }
  return result;
}

function endpointTangentRatio(items: Piece[], z: number, tolerance: number): number {
  const adjacent = items.filter(({ z1, z2 }) => (
    Math.abs(z1 - z) <= tolerance * 12 || Math.abs(z2 - z) <= tolerance * 12
  ));
  return Math.min(...adjacent.map(({ z1, z2, r1, r2 }) => (
    Math.abs(z2 - z1) / Math.max(Math.abs(r2 - r1), tolerance)
  )), Number.POSITIVE_INFINITY);
}

function endpointRadius(items: Piece[], z: number, tolerance: number): number {
  const values = items.flatMap(({ z1, z2, r1, r2 }) => [
    ...(Math.abs(z1 - z) <= tolerance * 12 ? [Math.abs(r1)] : []),
    ...(Math.abs(z2 - z) <= tolerance * 12 ? [Math.abs(r2)] : []),
  ]);
  return average(values);
}

function hasStableAxialResidence(
  z: number,
  upperRadius: number,
  lowerRadius: number,
  pieces: Piece[],
  axisSpan: number,
): boolean {
  const minimumResidence = Math.max(axisSpan * 0.02, 1e-6);
  const proximity = Math.max(axisSpan * 0.012, 1e-6);
  const axial = pieces.filter(({ sourceType, z1, z2, r1, r2 }) => (
    (sourceType === 'line' || sourceType === 'polyline')
    && Math.abs(z2 - z1) >= minimumResidence
    && Math.abs(r2 - r1) <= Math.max(axisSpan * 1e-6, 1e-7)
  ));
  const radiusTolerance = Math.max(axisSpan * 0.002, 1e-6);
  const sideHasResidence = (positive: boolean, minimumRadius: number) => axial.some(({ z1, z2, r1, r2 }) => {
    if (((r1 + r2) / 2 > 0) !== positive) return false;
    if (Math.abs((r1 + r2) / 2) < minimumRadius - radiusTolerance) return false;
    const zStart = Math.min(z1, z2);
    const zEnd = Math.max(z1, z2);
    return (z < zStart ? zStart - z : z > zEnd ? z - zEnd : 0) <= proximity;
  });
  return sideHasResidence(true, upperRadius) && sideHasResidence(false, lowerRadius);
}

function profileBoundaryConfidence(z: number, positive: ShaftContourSpan[], negative: ShaftContourSpan[], tolerance: number): number {
  const touches = (items: ShaftContourSpan[]) => items.filter((item) => Math.abs(item.zStart - z) <= tolerance * 12 || Math.abs(item.zEnd - z) <= tolerance * 12).length;
  return Math.min(1, Math.min(touches(positive), touches(negative)) / 2);
}

function radiusAt(items: ShaftContourSpan[], z: number): number | undefined {
  const matches = items.filter((item) => item.zStart <= z && z <= item.zEnd);
  return matches.length === 0 ? undefined : Math.max(...matches.map(({ radius }) => radius));
}
function nearestTransition(items: ShaftContourTransition[], z: number, tolerance: number) {
  return items.find((item) => Math.abs(item.z - z) <= tolerance);
}
function dedupeTransitions(items: ShaftContourTransition[], tolerance: number): ShaftContourTransition[] {
  const output: ShaftContourTransition[] = [];
  for (const item of [...items].sort((a, b) => a.z - b.z)) {
    const previous = output.at(-1);
    if (previous && Math.abs(previous.z - item.z) <= tolerance * 12) {
      if (item.confidence > previous.confidence) Object.assign(previous, item);
    } else output.push(structuredClone(item));
  }
  return output;
}
function uniqueStations(values: number[], tolerance: number): number[] {
  const result: number[] = [];
  for (const value of [...values].sort((a, b) => a - b)) {
    if (result.length === 0 || Math.abs(result.at(-1)! - value) > tolerance) result.push(value);
  }
  return result;
}
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1); }
function clean(value: number): number { return Number(value.toFixed(9)); }
