// SPDX-License-Identifier: Apache-2.0

import { sampleSpline, type DrawingDocument, type GeometryNode, type Vec2 } from '@vectorai/drawing-core';
import type { EngineeringRegionEvidence } from '../engineering-document/parser';
import type { ShaftAxis } from '../partition/types';
import { isShaftAxisLine, isShaftProfileGeometry } from './geometry-filter';

export interface ShaftAxisHints {
  axisOrigin?: 'left_end' | 'right_end';
  orientation?: 'auto' | 'forward' | 'reversed';
  regions: EngineeringRegionEvidence[];
}

interface NodeSample { id: string; points: Vec2[]; bounds: [number, number, number, number] }

export function resolveShaftAxis(document: DrawingDocument, hints: ShaftAxisHints): ShaftAxis | null {
  const nodes: NodeSample[] = document.geometry
    .filter(isShaftProfileGeometry)
    .map((node) => {
      const points = sampleNode(node);
      return { id: String(node.id), points, bounds: bounds(points) };
    })
    .filter(({ points }) => points.length >= 2);
  if (nodes.length === 0) return null;
  const explicit = resolveExplicitCenterline(document, nodes, hints);
  if (explicit) return explicit;
  const global = bounds(nodes.flatMap(({ points }) => points));
  const tolerance = Math.max(global[2] - global[0], global[3] - global[1], 1) * 1e-5;
  const candidates = connectedComponents(nodes, tolerance)
    .map((component) => principalCandidate(component, hints))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  if (!selected) return null;

  const useReverse = hints.orientation === 'reversed' || hints.axisOrigin === 'right_end';
  const direction: Vec2 = useReverse ? [-selected.direction[0], -selected.direction[1]] : selected.direction;
  const normal: Vec2 = [-direction[1], direction[0]];
  const axial = selected.points.map((point) => dot(point, direction));
  const radial = selected.points.map((point) => dot(point, normal));
  const zMinWorld = Math.min(...axial);
  const zMaxWorld = Math.max(...axial);
  const radialCenter = (Math.min(...radial) + Math.max(...radial)) / 2;
  const origin: Vec2 = [
    direction[0] * zMinWorld + normal[0] * radialCenter,
    direction[1] * zMinWorld + normal[1] * radialCenter,
  ];
  return {
    origin,
    direction,
    normal,
    zMin: 0,
    zMax: zMaxWorld - zMinWorld,
    orientation: useReverse ? 'reversed' : 'forward',
    geometryNodeIds: selected.nodeIds,
  };
}

function resolveExplicitCenterline(
  document: DrawingDocument,
  nodes: NodeSample[],
  hints: ShaftAxisHints,
): ShaftAxis | null {
  const profilePoints = nodes.flatMap(({ points }) => points);
  const candidates = document.geometry
    .filter(isShaftAxisLine)
    .map((node) => ({
      node,
      length: Math.hypot(node.end[0] - node.start[0], node.end[1] - node.start[1]),
    }))
    .sort((left, right) => right.length - left.length);

  for (const { node, length } of candidates) {
    if (length <= 1e-9) continue;
    let direction: Vec2 = [
      (node.end[0] - node.start[0]) / length,
      (node.end[1] - node.start[1]) / length,
    ];
    if (Math.abs(direction[0]) >= Math.abs(direction[1]) ? direction[0] < 0 : direction[1] < 0) {
      direction = [-direction[0], -direction[1]];
    }
    const normal: Vec2 = [-direction[1], direction[0]];
    const axial = profilePoints.map((point) => dot(point, direction));
    const radial = profilePoints.map((point) => dot(point, normal));
    const zMinWorld = Math.min(...axial);
    const zMaxWorld = Math.max(...axial);
    const profileLength = zMaxWorld - zMinWorld;
    const radialMin = Math.min(...radial);
    const radialMax = Math.max(...radial);
    const radialMidpoint = (radialMin + radialMax) / 2;
    const centerlineRadial = average([dot(node.start, normal), dot(node.end, normal)]);
    const radialTolerance = Math.max((radialMax - radialMin) * 0.05, profileLength * 1e-5, 1e-6);
    if (length < profileLength * 0.75 || Math.abs(centerlineRadial - radialMidpoint) > radialTolerance) continue;

    const useReverse = hints.orientation === 'reversed' || hints.axisOrigin === 'right_end';
    if (useReverse) direction = [-direction[0], -direction[1]];
    const resolvedNormal: Vec2 = [-direction[1], direction[0]];
    const resolvedAxial = profilePoints.map((point) => dot(point, direction));
    const resolvedZMin = Math.min(...resolvedAxial);
    const resolvedZMax = Math.max(...resolvedAxial);
    const resolvedCenterlineRadial = average([
      dot(node.start, resolvedNormal),
      dot(node.end, resolvedNormal),
    ]);
    return {
      origin: [
        direction[0] * resolvedZMin + resolvedNormal[0] * resolvedCenterlineRadial,
        direction[1] * resolvedZMin + resolvedNormal[1] * resolvedCenterlineRadial,
      ],
      direction,
      normal: resolvedNormal,
      zMin: 0,
      zMax: resolvedZMax - resolvedZMin,
      orientation: useReverse ? 'reversed' : 'forward',
      geometryNodeIds: [...nodes.map(({ id }) => id), String(node.id)],
    };
  }
  return null;
}

function connectedComponents(nodes: NodeSample[], tolerance: number): NodeSample[][] {
  const remaining = new Set(nodes.map((_, index) => index));
  const output: NodeSample[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as number;
    remaining.delete(first);
    const queue = [first];
    const component: NodeSample[] = [];
    while (queue.length > 0) {
      const current = queue.pop()!;
      component.push(nodes[current]!);
      for (const candidate of [...remaining]) {
        if (!overlaps(nodes[current]!.bounds, nodes[candidate]!.bounds, tolerance)) continue;
        remaining.delete(candidate);
        queue.push(candidate);
      }
    }
    output.push(component);
  }
  return output;
}

function principalCandidate(component: NodeSample[], hints: ShaftAxisHints) {
  const points = component.flatMap(({ points }) => points);
  if (points.length < 2) return null;
  const mean: Vec2 = [average(points.map(([x]) => x)), average(points.map(([, y]) => y))];
  const xx = average(points.map(([x]) => (x - mean[0]) ** 2));
  const yy = average(points.map(([, y]) => (y - mean[1]) ** 2));
  const xy = average(points.map(([x, y]) => (x - mean[0]) * (y - mean[1])));
  const angle = dominantEdgeAngle(component) ?? Math.atan2(2 * xy, xx - yy) / 2;
  let direction: Vec2 = [Math.cos(angle), Math.sin(angle)];
  if (Math.abs(direction[0]) >= Math.abs(direction[1]) ? direction[0] < 0 : direction[1] < 0) direction = [-direction[0], -direction[1]];
  const normal: Vec2 = [-direction[1], direction[0]];
  const axial = points.map((point) => dot(point, direction));
  const radial = points.map((point) => dot(point, normal));
  const length = Math.max(...axial) - Math.min(...axial);
  const diameter = Math.max(...radial) - Math.min(...radial);
  if (!(length > 0 && diameter > length * 1e-4)) return null;
  const elongation = length / Math.max(diameter, length * 1e-4);
  const expectedDiameters = hints.regions.flatMap(({ outerDiameter }) => outerDiameter === undefined ? [] : [outerDiameter]);
  const diameterFit = expectedDiameters.length === 0 ? 1 : 1 / (1 + Math.min(...expectedDiameters.map((expected) => Math.abs(diameter - expected) / Math.max(expected, 1e-9))) * 12);
  const intervalEnds = hints.regions.flatMap(({ interval }) => interval === undefined ? [] : [interval.end]);
  const lengthFit = intervalEnds.length === 0 ? 1 : 1 / (1 + Math.max(0, Math.max(...intervalEnds) - length) / Math.max(length, 1e-9) * 4);
  const score = Math.log1p(elongation) * Math.sqrt(component.length) * length * diameterFit * lengthFit;
  return { score, direction, points, nodeIds: component.map(({ id }) => id) };
}

function dominantEdgeAngle(component: NodeSample[]): number | null {
  const binCount = 1800;
  const bins = Array.from({ length: binCount }, () => 0);
  for (const { points } of component) {
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1]!;
      const second = points[index]!;
      const length = Math.hypot(second[0] - first[0], second[1] - first[1]);
      if (length <= 1e-9) continue;
      const angle = ((Math.atan2(second[1] - first[1], second[0] - first[0]) % Math.PI) + Math.PI) % Math.PI;
      bins[Math.min(binCount - 1, Math.floor(angle / Math.PI * binCount))]! += length;
    }
  }
  const smoothed = bins.map((_, index) => [-2, -1, 0, 1, 2].reduce((sum, offset) => sum + bins[(index + offset + binCount) % binCount]!, 0));
  const best = smoothed.indexOf(Math.max(...smoothed));
  if (smoothed[best] === 0) return null;
  let x = 0;
  let y = 0;
  for (const { points } of component) {
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1]!;
      const second = points[index]!;
      const length = Math.hypot(second[0] - first[0], second[1] - first[1]);
      if (length <= 1e-9) continue;
      const angle = ((Math.atan2(second[1] - first[1], second[0] - first[0]) % Math.PI) + Math.PI) % Math.PI;
      const bin = Math.min(binCount - 1, Math.floor(angle / Math.PI * binCount));
      const distance = Math.min(Math.abs(bin - best), binCount - Math.abs(bin - best));
      if (distance > 2) continue;
      x += Math.cos(angle * 2) * length;
      y += Math.sin(angle * 2) * length;
    }
  }
  return Math.atan2(y, x) / 2;
}

export function sampleNode(node: GeometryNode): Vec2[] {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'polyline': return node.vertices.map(({ point }) => point);
    case 'spline': return sampleSpline(node, { maxError: 0.02, maxDepth: 14 });
    case 'circle': return sampleAngles(64).map((angle) => polar(node.center, node.radius, angle));
    case 'arc': {
      const span = positiveSpan(node.startAngle, node.endAngle);
      return sampleCount(Math.max(8, Math.ceil(span / 4))).map((t) => polar(node.center, node.radius, node.startAngle + span * t));
    }
    case 'ellipse': {
      const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]);
      return sampleCount(64).map((t) => {
        const angle = t * Math.PI * 2;
        const x = major * Math.cos(angle);
        const y = major * node.ratio * Math.sin(angle);
        return [node.center[0] + x * Math.cos(rotation) - y * Math.sin(rotation), node.center[1] + x * Math.sin(rotation) + y * Math.cos(rotation)];
      });
    }
    default: return [];
  }
}

function bounds(points: Vec2[]): [number, number, number, number] {
  return [Math.min(...points.map(([x]) => x)), Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([x]) => x)), Math.max(...points.map(([, y]) => y))];
}
function overlaps(a: [number, number, number, number], b: [number, number, number, number], t: number): boolean {
  return a[0] <= b[2] + t && a[2] >= b[0] - t && a[1] <= b[3] + t && a[3] >= b[1] - t;
}
function dot(point: Vec2, direction: Vec2): number { return point[0] * direction[0] + point[1] * direction[1]; }
function average(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function sampleAngles(count: number): number[] { return sampleCount(count).map((t) => t * 360); }
function sampleCount(count: number): number[] { return Array.from({ length: count + 1 }, (_, index) => index / count); }
function polar(center: Vec2, radius: number, degrees: number): Vec2 { const angle = degrees * Math.PI / 180; return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]; }
function positiveSpan(start: number, end: number): number { const span = ((end - start) % 360 + 360) % 360; return span === 0 ? 360 : span; }
