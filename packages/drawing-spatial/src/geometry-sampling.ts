import {
  evaluateSpline,
  splineBounds,
  type GeometryNode,
  type Vec2,
} from '@vectorai/drawing-core';
import type { SpatialBounds2D } from './query';

export interface SampledGeometryRange {
  kind: 'whole-node' | 'vertex-range' | 'parameter-range';
  vertexRange?: readonly [number, number];
  parameterRange?: readonly [number, number];
  samples: Vec2[];
  start: Vec2;
  end: Vec2;
  bounds: SpatialBounds2D;
}

export function sampleGeometryRanges(
  node: GeometryNode,
  input: { curveSamples: number; localBounds: SpatialBounds2D },
): SampledGeometryRange[] {
  const curveSamples = Math.max(8, Math.min(512, Math.floor(input.curveSamples)));
  switch (node.type) {
    case 'point':
      return [range('whole-node', [[node.x, node.y]])];
    case 'line':
      return [range('parameter-range', [node.start, node.end], { parameterRange: [0, 1] })];
    case 'ray':
    case 'xline': {
      const length = Math.max(
        input.localBounds.maxX - input.localBounds.minX,
        input.localBounds.maxY - input.localBounds.minY,
        1,
      ) * 2;
      const magnitude = Math.hypot(node.direction[0], node.direction[1]);
      if (magnitude === 0) return [range('whole-node', [node.origin])];
      const direction: Vec2 = [node.direction[0] / magnitude, node.direction[1] / magnitude];
      const first = node.type === 'ray' ? 0 : -length;
      return [range('parameter-range', [
        pointAlong(node.origin, direction, first),
        pointAlong(node.origin, direction, length),
      ], { parameterRange: [first, length] })];
    }
    case 'polyline':
      return polylineRanges(node, curveSamples);
    case 'circle':
      return sampledParameterRanges(curveSamples, (parameter) => polar(
        node.center,
        node.radius,
        parameter * Math.PI * 2,
      ));
    case 'arc': {
      const sweep = arcSweepRadians(node.startAngle, node.endAngle, node.counterClockwise);
      const count = Math.max(2, Math.ceil(curveSamples * Math.abs(sweep) / (Math.PI * 2)));
      return sampledParameterRanges(count, (parameter) => polar(
        node.center,
        node.radius,
        degreesToRadians(node.startAngle) + sweep * parameter,
      ));
    }
    case 'ellipse': {
      const start = node.startParam ?? 0;
      const rawEnd = node.endParam ?? Math.PI * 2;
      const sweep = node.startParam === undefined && node.endParam === undefined
        ? Math.PI * 2
        : positiveSweep(rawEnd - start);
      const count = Math.max(2, Math.ceil(curveSamples * sweep / (Math.PI * 2)));
      return sampledParameterRanges(count, (parameter) => ellipsePoint(
        node.center,
        node.majorAxis,
        node.ratio,
        start + sweep * parameter,
      ));
    }
    case 'spline': {
      const count = Math.max(2, curveSamples);
      return sampledParameterRanges(count, (parameter) => evaluateSpline(node, parameter));
    }
  }
}

export function roughGeometryBounds(node: GeometryNode): SpatialBounds2D | null {
  switch (node.type) {
    case 'point': return boundsOf([[node.x, node.y]]);
    case 'line': return boundsOf([node.start, node.end]);
    case 'ray':
    case 'xline': return null;
    case 'circle':
    case 'arc':
      return {
        minX: node.center[0] - node.radius,
        minY: node.center[1] - node.radius,
        maxX: node.center[0] + node.radius,
        maxY: node.center[1] + node.radius,
      };
    case 'ellipse': {
      const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      return {
        minX: node.center[0] - major,
        minY: node.center[1] - major,
        maxX: node.center[0] + major,
        maxY: node.center[1] + major,
      };
    }
    case 'polyline': {
      if (node.vertices.length === 0) return null;
      const samples = polylineRanges(node, 64).flatMap((item) => item.samples);
      return boundsOf(samples);
    }
    case 'spline': return splineBounds(node);
  }
}

function polylineRanges(
  node: Extract<GeometryNode, { type: 'polyline' }>,
  curveSamples: number,
): SampledGeometryRange[] {
  const count = node.closed ? node.vertices.length : Math.max(0, node.vertices.length - 1);
  return Array.from({ length: count }, (_, index) => {
    const next = (index + 1) % node.vertices.length;
    const start = node.vertices[index].point;
    const end = node.vertices[next].point;
    const bulge = node.vertices[index].bulge ?? 0;
    const samples = Math.abs(bulge) < 1e-12
      ? [start, end]
      : sampleBulge(start, end, bulge, curveSamples);
    return range('vertex-range', samples, { vertexRange: [index, next] });
  });
}

function sampleBulge(start: Vec2, end: Vec2, bulge: number, curveSamples: number): Vec2[] {
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (chord === 0) return [start, end];
  const sweep = 4 * Math.atan(bulge);
  const midpoint: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const left: Vec2 = [-(end[1] - start[1]) / chord, (end[0] - start[0]) / chord];
  const offset = chord * (1 - bulge ** 2) / (4 * bulge);
  const center: Vec2 = [midpoint[0] + left[0] * offset, midpoint[1] + left[1] * offset];
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const count = Math.max(2, Math.ceil(curveSamples * Math.abs(sweep) / (Math.PI * 2)));
  return Array.from({ length: count + 1 }, (_, index) => (
    index === count ? end : polar(center, radius, startAngle + sweep * index / count)
  ));
}

function sampledParameterRanges(
  count: number,
  evaluate: (parameter: number) => Vec2,
): SampledGeometryRange[] {
  return Array.from({ length: count }, (_, index) => {
    const start = index / count;
    const end = (index + 1) / count;
    return range('parameter-range', [evaluate(start), evaluate(end)], {
      parameterRange: [start, end],
    });
  });
}

function ellipsePoint(center: Vec2, majorAxis: Vec2, ratio: number, parameter: number): Vec2 {
  const major = Math.hypot(majorAxis[0], majorAxis[1]);
  if (major === 0) return center;
  const unit: Vec2 = [majorAxis[0] / major, majorAxis[1] / major];
  const perpendicular: Vec2 = [-unit[1], unit[0]];
  return [
    center[0] + unit[0] * major * Math.cos(parameter)
      + perpendicular[0] * major * ratio * Math.sin(parameter),
    center[1] + unit[1] * major * Math.cos(parameter)
      + perpendicular[1] * major * ratio * Math.sin(parameter),
  ];
}

function range(
  kind: SampledGeometryRange['kind'],
  samples: Vec2[],
  identity: Pick<SampledGeometryRange, 'vertexRange' | 'parameterRange'> = {},
): SampledGeometryRange {
  return {
    kind,
    ...identity,
    samples,
    start: samples[0],
    end: samples.at(-1)!,
    bounds: boundsOf(samples),
  };
}

function boundsOf(points: Vec2[]): SpatialBounds2D {
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

function arcSweepRadians(start: number, end: number, counterClockwise: boolean): number {
  const raw = degreesToRadians(end - start);
  return counterClockwise ? positiveSweep(raw) : -positiveSweep(-raw);
}

function positiveSweep(value: number): number {
  const full = Math.PI * 2;
  const normalized = (value % full + full) % full;
  return Math.abs(normalized) < 1e-12 ? full : normalized;
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function polar(center: Vec2, radius: number, angle: number): Vec2 {
  return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
}

function pointAlong(origin: Vec2, direction: Vec2, parameter: number): Vec2 {
  return [origin[0] + direction[0] * parameter, origin[1] + direction[1] * parameter];
}
