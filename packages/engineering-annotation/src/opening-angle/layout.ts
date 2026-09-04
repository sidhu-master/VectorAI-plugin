// SPDX-License-Identifier: Apache-2.0

import type { GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type { OpeningAngleAxis, OpeningAngleFact, OpeningAngleLayout } from './types';

export function layoutOpeningAngles(input: {
  geometry: GeometryNode[];
  facts: OpeningAngleFact[];
  axis?: OpeningAngleAxis;
}): Record<string, OpeningAngleLayout> {
  const points = input.geometry.flatMap((node) => node.type === 'line' ? [node.start, node.end]
    : node.type === 'polyline' ? node.vertices.map(({ point }) => point) : []);
  if (points.length === 0) return {};
  const bounds = { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)) };
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const axialLength = input.axis === undefined ? bounds.maxX - bounds.minX : distance(input.axis.start, input.axis.end);
  const gap = Math.max(diagonal * 0.035, 1);
  const result: Record<string, OpeningAngleLayout> = {};
  const laneBySide = new Map<-1 | 1, number>();
  const previousBySide = new Map<-1 | 1, { textRadius: number; halfTextWidth: number; axisCoordinate: number }>();
  const facts = [...input.facts].sort((left, right) => {
    const side = openingSide(left, bounds) - openingSide(right, bounds);
    if (side !== 0) return side;
    return ((left.axialCoordinate ?? left.vertex[0]) - (right.axialCoordinate ?? right.vertex[0])) * openingSide(left, bounds)
      || left.value - right.value || left.key.localeCompare(right.key);
  });
  for (const fact of facts) {
    const side = openingSide(fact, bounds);
    const lane = laneBySide.get(side) ?? 0;
    laneBySide.set(side, lane + 1);
    const coordinate = fact.axialCoordinate ?? fact.vertex[0] - bounds.minX;
    const distToEdge = side === -1 ? coordinate : axialLength - coordinate;
    const firstAngle = Math.atan2(fact.rays[0][1] - fact.vertex[1], fact.rays[0][0] - fact.vertex[0]);
    const secondAngle = Math.atan2(fact.rays[1][1] - fact.vertex[1], fact.rays[1][0] - fact.vertex[0]);
    const sweep = angularSweep(firstAngle, secondAngle, fact.value);
    const middleAngle = firstAngle + sweep / 2;
    const halfSweep = Math.abs(sweep) / 2;
    const clearance = halfSweep >= Math.PI / 2 - 1e-6 ? distToEdge + gap : distToEdge / Math.cos(halfSweep) + gap * 0.3;
    const halfTextWidth = (String(Math.round(Math.abs(fact.value))).length + 1) * 11 * 0.55 / 2;
    let radius = Math.max(gap * (2.3 + lane * 2.3), clearance, distToEdge + halfTextWidth);
    const bisector: Vec2 = [Math.cos(middleAngle), Math.sin(middleAngle)];
    const axisCoordinate = fact.vertex[0] * bisector[0] + fact.vertex[1] * bisector[1];
    const previous = previousBySide.get(side);
    if (previous) {
      const separation = previous.halfTextWidth + halfTextWidth + gap * 0.3 - (axisCoordinate - previous.axisCoordinate);
      if (separation > 0) radius = Math.max(radius, previous.textRadius + separation - gap * 0.5);
    }
    const firstExtensionRadius = Math.max(radius + gap * 0.15, distance(fact.vertex, fact.rays[0]) + gap * 0.08);
    const secondExtensionRadius = Math.max(radius + gap * 0.15, distance(fact.vertex, fact.rays[1]) + gap * 0.08);
    const textRadius = Math.max(radius, firstExtensionRadius, secondExtensionRadius) + gap * 0.35;
    previousBySide.set(side, { textRadius, halfTextWidth, axisCoordinate });
    result[fact.key] = {
      textPosition: polar(fact.vertex, textRadius, middleAngle), lane,
      definitionPoints: [fact.vertex, polar(fact.vertex, firstExtensionRadius, firstAngle), polar(fact.vertex, secondExtensionRadius, secondAngle), polar(fact.vertex, radius, firstAngle), polar(fact.vertex, radius, secondAngle)],
    };
  }
  return result;
}

function openingSide(fact: OpeningAngleFact, bounds: { minX: number; maxX: number }): -1 | 1 {
  if (fact.axialSide !== undefined) return fact.axialSide === 'start' ? -1 : 1;
  return fact.vertex[0] <= (bounds.minX + bounds.maxX) / 2 ? -1 : 1;
}
function angularSweep(start: number, end: number, degrees: number): number { const ccw = modulo(end - start, Math.PI * 2); const cw = ccw - Math.PI * 2; const target = Math.abs(degrees) * Math.PI / 180; return Math.abs(Math.abs(ccw) - target) <= Math.abs(Math.abs(cw) - target) ? ccw : cw; }
function polar(center: Vec2, radius: number, angle: number): Vec2 { return [clean(center[0] + Math.cos(angle) * radius), clean(center[1] + Math.sin(angle) * radius)]; }
function distance(first: Vec2, second: Vec2): number { return Math.hypot(second[0] - first[0], second[1] - first[1]); }
function modulo(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor; }
function clean(value: number): number { const rounded = Math.round(value * 1_000_000) / 1_000_000; return Math.abs(rounded) <= 1e-12 ? 0 : rounded; }
