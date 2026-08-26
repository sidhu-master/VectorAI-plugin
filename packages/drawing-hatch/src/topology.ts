// SPDX-License-Identifier: Apache-2.0

import type { ParametricHatch, Vec2 } from '@vectorai/drawing-core';
import { FillRule, union } from 'clipper2-ts';

import { flattenHatchEdge } from './flatten';

export interface Bounds2D { minX: number; minY: number; maxX: number; maxY: number }
export interface NormalizedHatchRegion {
  contours: Vec2[][];
  fillRule: 'evenodd' | 'nonzero';
  bounds: Bounds2D;
}
export type HatchRegionResult =
  | { status: 'ok'; region: NormalizedHatchRegion }
  | { status: 'invalid'; code: 'HATCH_BOUNDARY_OPEN' | 'HATCH_BOUNDARY_EMPTY' | 'HATCH_COORDINATE_OVERFLOW' };

interface Segment { start: Vec2; end: Vec2 }

export function normalizeHatchRegion(hatch: ParametricHatch, tolerance: number): HatchRegionResult {
  const safeTolerance = Math.max(1e-9, tolerance);
  const contours: Vec2[][] = [];
  for (const path of hatch.boundaryPaths) {
    const segments: Segment[] = [];
    for (const edge of path.edges) {
      const points = flattenHatchEdge(edge, safeTolerance);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1]!;
        const end = points[index]!;
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) > safeTolerance) segments.push({ start, end });
      }
    }
    const assembled = assembleContours(segments, safeTolerance);
    if (!assembled) return { status: 'invalid', code: 'HATCH_BOUNDARY_OPEN' };
    contours.push(...assembled);
  }
  if (contours.length === 0) return { status: 'invalid', code: 'HATCH_BOUNDARY_EMPTY' };

  const largest = Math.max(...contours.flatMap((contour) => contour.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])), 1);
  const requestedScale = Math.max(1, Math.ceil(1 / safeTolerance));
  const maxScale = Math.floor(Number.MAX_SAFE_INTEGER / 1024 / largest);
  const scale = Math.min(requestedScale, maxScale);
  if (!(scale >= 1)) return { status: 'invalid', code: 'HATCH_COORDINATE_OVERFLOW' };

  try {
    const paths = contours.map((contour) => contour.map(([x, y]) => ({ x: Math.round(x * scale), y: Math.round(y * scale) })));
    const normalized = union(paths, FillRule.EvenOdd)
      .map((path) => path.map(({ x, y }) => [x / scale, y / scale] as Vec2))
      .filter((path) => path.length >= 3);
    if (normalized.length === 0) return { status: 'invalid', code: 'HATCH_BOUNDARY_EMPTY' };
    const selected = selectByStyle(normalized, hatch.style);
    return {
      status: 'ok',
      region: { contours: selected, fillRule: hatch.style === 'normal' ? 'evenodd' : 'nonzero', bounds: boundsOf(selected) },
    };
  } catch {
    return { status: 'invalid', code: 'HATCH_COORDINATE_OVERFLOW' };
  }
}

function assembleContours(segments: Segment[], tolerance: number): Vec2[][] | null {
  if (segments.length < 3) return null;
  const key = ([x, y]: Vec2) => `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;
  const incidence = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    for (const point of [segment.start, segment.end]) {
      const bucket = incidence.get(key(point)) ?? [];
      bucket.push(index);
      incidence.set(key(point), bucket);
    }
  });
  if ([...incidence.values()].some((indices) => indices.length !== 2)) return null;

  const unused = new Set(segments.map((_, index) => index));
  const contours: Vec2[][] = [];
  while (unused.size > 0) {
    const firstIndex = unused.values().next().value as number;
    const first = segments[firstIndex]!;
    unused.delete(firstIndex);
    const contour: Vec2[] = [first.start, first.end];
    const startKey = key(first.start);
    let currentKey = key(first.end);
    while (currentKey !== startKey) {
      const nextIndex = (incidence.get(currentKey) ?? []).find((index) => unused.has(index));
      if (nextIndex === undefined) return null;
      const next = segments[nextIndex]!;
      unused.delete(nextIndex);
      const nextPoint = key(next.start) === currentKey ? next.end : next.start;
      contour.push(nextPoint);
      currentKey = key(nextPoint);
      if (contour.length > segments.length + 1) return null;
    }
    contour.pop();
    if (contour.length < 3) return null;
    contours.push(contour);
  }
  return contours;
}

function selectByStyle(contours: Vec2[][], style: ParametricHatch['style']): Vec2[][] {
  if (style === 'normal') return contours;
  const depths = contours.map((contour, index) => contours.reduce((depth, candidate, candidateIndex) => (
    candidateIndex !== index && pointInPolygon(contour[0]!, candidate) ? depth + 1 : depth
  ), 0));
  if (style === 'outer') return contours.filter((_, index) => (depths[index] ?? 0) <= 1);
  return contours.filter((_, index) => (depths[index] ?? 0) === 0);
}

function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]!;
    const b = polygon[previous]!;
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function boundsOf(contours: Vec2[][]): Bounds2D {
  const points = contours.flat();
  return {
    minX: Math.min(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)), maxY: Math.max(...points.map(([, y]) => y)),
  };
}
