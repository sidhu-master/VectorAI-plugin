// SPDX-License-Identifier: Apache-2.0

import type { EvidenceId, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { isShaftAxisLine, isShaftProfileGeometry } from '../shaft/geometry-filter';
import type { OpeningAngleAxis, OpeningAngleFact } from './types';

const MINIMUM_TOLERANCE = 1e-5;

interface SegmentSample { source: GeometryNode; start: Vec2; end: Vec2 }
interface NormalizedSlopedSegment {
  segment: SegmentSample;
  left: Vec2;
  right: Vec2;
  midpoint: Vec2;
  length: number;
}

export function measureOpeningAngles(geometryInput: GeometryNode[]): {
  axis: OpeningAngleAxis;
  facts: OpeningAngleFact[];
} {
  const geometry = geometryInput.filter(({ visible, quality }) => visible && quality.status === 'confirmed');
  const worldSegments = collectSegments(geometry);
  const frame = resolveOpeningFrame(geometry, worldSegments);
  if (!frame) return { axis: { start: [0, 0], end: [0, 0], status: 'conflict' }, facts: [] };
  const segments = worldSegments.map((segment) => ({
    ...segment, start: toLocal(frame, segment.start), end: toLocal(frame, segment.end),
  }));
  const profileSegments = segments.filter(({ source }) => isShaftProfileGeometry(source));
  const bounds = segmentBounds(profileSegments);
  if (!bounds) return { axis: { start: [0, 0], end: [0, 0], status: 'conflict' }, facts: [] };
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const tolerance = Math.max(diagonal * 1e-6, MINIMUM_TOLERANCE);
  const axisY = frame.axisRadialCoordinate ?? reflectedAxisY(profileSegments, bounds, tolerance);
  const axis: OpeningAngleAxis = axisY === null
    ? { start: toWorld(frame, bounds.minX, (bounds.minY + bounds.maxY) / 2), end: toWorld(frame, bounds.maxX, (bounds.minY + bounds.maxY) / 2), status: 'conflict' }
    : { start: cleanPoint(toWorld(frame, bounds.minX, axisY)), end: cleanPoint(toWorld(frame, bounds.maxX, axisY)), status: 'confirmed' };
  if (axis.status === 'conflict') return { axis, facts: [] };
  const localFacts = openingAngleFacts(profileSegments, axisY!, diagonal, tolerance);
  return { axis, facts: localFacts.map((fact) => ({
    ...fact,
    key: `${fact.key}:${numberKey(frame.angle)}`,
    vertex: cleanPoint(toWorld(frame, fact.vertex[0], fact.vertex[1])),
    rays: [cleanPoint(toWorld(frame, fact.rays[0][0], fact.rays[0][1])), cleanPoint(toWorld(frame, fact.rays[1][0], fact.rays[1][1]))],
    axialCoordinate: fact.vertex[0] - bounds.minX,
    axialSide: fact.vertex[0] <= (bounds.minX + bounds.maxX) / 2 ? 'start' : 'end',
  })) };
}

interface OpeningFrame {
  origin: Vec2;
  axis: Vec2;
  normal: Vec2;
  angle: number;
  axisRadialCoordinate?: number;
}

function resolveOpeningFrame(geometry: GeometryNode[], segments: SegmentSample[]): OpeningFrame | null {
  const explicit = geometry.find((node) => (
    node.type === 'xline' && Math.hypot(...node.direction) > MINIMUM_TOLERANCE
  ) || isShaftAxisLine(node));
  let angle: number;
  let axisPoint: Vec2 | undefined;
  if (explicit?.type === 'xline') {
    angle = Math.atan2(explicit.direction[1], explicit.direction[0]);
    axisPoint = explicit.origin;
  } else if (explicit?.type === 'line') {
    angle = Math.atan2(explicit.end[1] - explicit.start[1], explicit.end[0] - explicit.start[0]);
    axisPoint = explicit.start;
  }
  else {
    const lengths = segments.map(({ start, end }) => Math.hypot(end[0] - start[0], end[1] - start[1]));
    const maximum = Math.max(0, ...lengths);
    const dominant = segments.filter((_, index) => lengths[index]! >= maximum * 0.45);
    if (dominant.length === 0) return null;
    let x = 0; let y = 0;
    for (const segment of dominant) {
      const dx = segment.end[0] - segment.start[0]; const dy = segment.end[1] - segment.start[1];
      const weight = Math.hypot(dx, dy); const candidate = Math.atan2(dy, dx);
      x += Math.cos(candidate * 2) * weight; y += Math.sin(candidate * 2) * weight;
    }
    angle = Math.atan2(y, x) / 2;
  }
  let axis: Vec2 = [Math.cos(angle), Math.sin(angle)];
  if (Math.abs(axis[0]) >= Math.abs(axis[1]) ? axis[0] < 0 : axis[1] < 0) axis = [-axis[0], -axis[1]];
  const normal: Vec2 = [-axis[1], axis[0]];
  return {
    origin: [0, 0],
    axis,
    normal,
    angle: Math.atan2(axis[1], axis[0]),
    ...(axisPoint === undefined ? {} : { axisRadialCoordinate: dot(axisPoint, normal) }),
  };
}

function toLocal(frame: OpeningFrame, point: Vec2): Vec2 {
  return [point[0] * frame.axis[0] + point[1] * frame.axis[1], point[0] * frame.normal[0] + point[1] * frame.normal[1]];
}
function toWorld(frame: OpeningFrame, z: number, r: number): Vec2 {
  return [frame.origin[0] + frame.axis[0] * z + frame.normal[0] * r, frame.origin[1] + frame.axis[1] * z + frame.normal[1] * r];
}
function segmentBounds(segments: SegmentSample[]) {
  const points = segments.flatMap(({ start, end }) => [start, end]);
  return points.length === 0 ? null : { minX: Math.min(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)), maxX: Math.max(...points.map(([x]) => x)), maxY: Math.max(...points.map(([, y]) => y)) };
}

function collectSegments(geometry: GeometryNode[]): SegmentSample[] {
  const segments: SegmentSample[] = [];
  for (const node of geometry) {
    if (node.type === 'line') {
      segments.push({ source: node, start: node.start, end: node.end });
      continue;
    }
    if (node.type !== 'polyline' || node.vertices.length < 2) continue;
    const count = node.closed ? node.vertices.length : node.vertices.length - 1;
    for (let index = 0; index < count; index += 1) {
      const first = node.vertices[index];
      const second = node.vertices[(index + 1) % node.vertices.length];
      if (!first || !second || Math.abs(first.bulge ?? 0) > MINIMUM_TOLERANCE) continue;
      segments.push({ source: node, start: first.point, end: second.point });
    }
  }
  return segments;
}

function reflectedAxisY(
  segments: SegmentSample[],
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  tolerance: number,
): number | null {
  const axisY = (bounds.minY + bounds.maxY) / 2;
  const horizontal = segments.filter(({ start, end }) => (
    Math.abs(end[1] - start[1]) <= tolerance && Math.abs(end[0] - start[0]) > tolerance
  ));
  for (let firstIndex = 0; firstIndex < horizontal.length; firstIndex += 1) {
    const first = horizontal[firstIndex]!;
    const firstRadius = first.start[1] - axisY;
    if (Math.abs(firstRadius) <= tolerance) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < horizontal.length; secondIndex += 1) {
      const second = horizontal[secondIndex]!;
      const secondRadius = second.start[1] - axisY;
      if (firstRadius * secondRadius >= 0) continue;
      if (Math.abs(firstRadius + secondRadius) > tolerance * 10) continue;
      if (Math.min(Math.max(first.start[0], first.end[0]), Math.max(second.start[0], second.end[0]))
        < Math.max(Math.min(first.start[0], first.end[0]), Math.min(second.start[0], second.end[0])) - tolerance) continue;
      return clean(axisY);
    }
  }
  return null;
}

function openingAngleFacts(
  segments: SegmentSample[], axisY: number, diagonal: number, tolerance: number,
): OpeningAngleFact[] {
  const maximumLength = Math.max(diagonal * 0.12, tolerance * 100);
  const mirrorTolerance = Math.max(diagonal * 0.002, tolerance * 10);
  const intersectionLimit = Math.max(diagonal * 0.15, tolerance * 100);
  const candidates = segments.map(normalizedSlopedSegment).filter((segment): segment is NormalizedSlopedSegment => (
    segment !== null && segment.length <= maximumLength && Math.abs(segment.midpoint[1] - axisY) > mirrorTolerance
  ));
  const upper = candidates.filter(({ midpoint }) => midpoint[1] > axisY);
  const lower = candidates.filter(({ midpoint }) => midpoint[1] < axisY);
  const facts: OpeningAngleFact[] = [];
  for (const first of upper) {
    for (const second of lower) {
      const endpointError = Math.max(
        Math.abs(first.left[0] - second.left[0]), Math.abs(first.right[0] - second.right[0]),
        Math.abs(first.left[1] + second.left[1] - axisY * 2),
        Math.abs(first.right[1] + second.right[1] - axisY * 2),
      );
      if (endpointError > mirrorTolerance) continue;
      const vertex = lineIntersection(first.left, first.right, second.left, second.right, tolerance);
      if (!vertex || Math.abs(vertex[1] - axisY) > mirrorTolerance) continue;
      if (Math.max(
        distanceToSegmentRange(vertex[0], first.left[0], first.right[0]),
        distanceToSegmentRange(vertex[0], second.left[0], second.right[0]),
      ) > intersectionLimit) continue;
      const paired = [
        { source: first.segment.source, ray: cleanPoint(first.midpoint) },
        { source: second.segment.source, ray: cleanPoint(second.midpoint) },
      ].sort((left, right) => String(left.source.id).localeCompare(String(right.source.id)));
      const value = normalizedAngleValue(includedAngle(vertex, paired[0]!.ray, paired[1]!.ray));
      if (value <= 0.5 || value >= 179.5) continue;
      const sourceIds = [paired[0]!.source.id, paired[1]!.source.id] as const;
      facts.push({
        key: `opening-angle:${sourceIds.join(':')}:${numberKey(vertex[0])}:${numberKey(value)}`,
        value, vertex: [clean(vertex[0]), clean(axisY)], rays: [paired[0]!.ray, paired[1]!.ray],
        sourceIds, evidenceRefs: uniqueEvidence([paired[0]!.source, paired[1]!.source]),
        method: 'mirrored-line-pair-opening', error: clean(Math.max(endpointError, Math.abs(vertex[1] - axisY))),
      });
    }
  }
  return [...new Map(facts.map((fact) => [fact.key, fact])).values()].sort((a, b) => a.key.localeCompare(b.key));
}

function normalizedSlopedSegment(segment: SegmentSample): NormalizedSlopedSegment | null {
  const dx = segment.end[0] - segment.start[0];
  const dy = segment.end[1] - segment.start[1];
  const length = Math.hypot(dx, dy);
  if (length <= MINIMUM_TOLERANCE || Math.abs(dx) <= MINIMUM_TOLERANCE || Math.abs(dy) <= MINIMUM_TOLERANCE) return null;
  const [left, right] = segment.start[0] <= segment.end[0] ? [segment.start, segment.end] : [segment.end, segment.start];
  return { segment, left, right, midpoint: [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2], length };
}

function lineIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2, tolerance: number): Vec2 | null {
  const first = [b[0] - a[0], b[1] - a[1]] as const;
  const second = [d[0] - c[0], d[1] - c[1]] as const;
  const denominator = cross(first, second);
  if (Math.abs(denominator) <= tolerance) return null;
  const between = [c[0] - a[0], c[1] - a[1]] as const;
  const scale = cross(between, second) / denominator;
  return [a[0] + first[0] * scale, a[1] + first[1] * scale];
}
function includedAngle(vertex: Vec2, first: Vec2, second: Vec2): number {
  const a = [first[0] - vertex[0], first[1] - vertex[1]] as const;
  const b = [second[0] - vertex[0], second[1] - vertex[1]] as const;
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  if (denominator <= MINIMUM_TOLERANCE) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / denominator))) * 180 / Math.PI;
}
function uniqueEvidence(nodes: GeometryNode[]): EvidenceId[] { return [...new Set(nodes.flatMap(({ quality }) => quality.evidenceRefs))].sort(); }
function distanceToSegmentRange(x: number, first: number, second: number): number { const min = Math.min(first, second); const max = Math.max(first, second); return x < min ? min - x : x > max ? x - max : 0; }
function normalizedAngleValue(value: number): number { const integer = Math.round(value); return Math.abs(value - integer) <= 0.01 ? integer : clean(value); }
function dot(left: Vec2, right: Vec2): number { return left[0] * right[0] + left[1] * right[1]; }
function cross(a: Vec2, b: Vec2): number { return a[0] * b[1] - a[1] * b[0]; }
function cleanPoint(point: Vec2): Vec2 { return [clean(point[0]), clean(point[1])]; }
function numberKey(value: number): string { return clean(value).toFixed(6); }
function clean(value: number): number { const rounded = Math.round(value * 1_000_000) / 1_000_000; return Math.abs(rounded) <= 1e-12 ? 0 : rounded; }
