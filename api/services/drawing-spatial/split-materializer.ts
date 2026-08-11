import { createHash } from 'node:crypto';

import type {
  SpatialSelection,
  VirtualSplitRange,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  DrawingCommand,
  DrawingDocument,
  GeometryId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import { roughGeometryBounds, sampleGeometryRanges } from './geometry-sampling.js';
import { migrateSplitReferences } from './reference-migration.js';

export interface SplitLineageEntry {
  sourceNodeId: GeometryId;
  fragmentId: GeometryId;
  sourceRange: readonly [number, number];
  role: VirtualSplitRange['role'];
}

export interface MaterializedSplit {
  commands: DrawingCommand[];
  fragments: GeometryNode[];
  lineage: SplitLineageEntry[];
  fidelityWarnings: string[];
}

export function materializeSpatialSplits(input: {
  document: DrawingDocument;
  selection: SpatialSelection;
}): MaterializedSplit {
  const fragments: GeometryNode[] = [];
  const lineage: SplitLineageEntry[] = [];
  const fidelityWarnings: string[] = [];
  const geometryCommands: DrawingCommand[] = [];

  for (const plan of input.selection.splitPlan) {
    if (plan.revision !== input.selection.revision) throw new Error('SPLIT_PLAN_STALE');
    const source = input.document.geometry.find((node) => node.id === plan.nodeId);
    if (!source) throw new Error(`SPLIT_SOURCE_NOT_FOUND:${plan.nodeId}`);
    validateRanges(plan.ranges, sourceDomain(source));
    const protectedIndex = preferredProtectedRange(plan.ranges);
    const materialized = plan.ranges.map((range, index) => {
      const id = index === protectedIndex
        ? source.id
        : fragmentId(source.id, input.selection.revision, range);
      const sliced = sliceGeometry(source, range, id);
      if (sliced.warning) fidelityWarnings.push(sliced.warning);
      const entry: SplitLineageEntry = {
        sourceNodeId: source.id,
        fragmentId: sliced.node.id,
        sourceRange: [...range.range],
        role: range.role,
      };
      fragments.push(sliced.node);
      lineage.push(entry);
      return sliced.node;
    });
    const retained = materialized[protectedIndex];
    if (retained.type === source.type) {
      geometryCommands.push({
        type: 'geometry.update',
        id: source.id,
        changes: mutableGeometryFields(retained),
        expected: mutableGeometryFields(source),
      });
    } else {
      geometryCommands.push(
        { type: 'geometry.delete', id: source.id },
        { type: 'geometry.create', value: retained },
      );
    }
    materialized.forEach((node, index) => {
      if (index !== protectedIndex) geometryCommands.push({ type: 'geometry.create', value: node });
    });
  }

  const referenceCommands = migrateSplitReferences(input.document, lineage);
  return {
    commands: [...geometryCommands, ...referenceCommands],
    fragments,
    lineage,
    fidelityWarnings: [...new Set(fidelityWarnings)],
  };
}

function sliceGeometry(
  source: GeometryNode,
  split: VirtualSplitRange,
  id: GeometryId,
): { node: GeometryNode; warning?: string } {
  const [start, end] = split.range;
  const common = {
    id,
    visible: source.visible,
    quality: structuredClone(source.quality),
  };
  switch (source.type) {
    case 'line':
      return { node: {
        ...common, type: 'line',
        start: mixPoint(source.start, source.end, start),
        end: mixPoint(source.start, source.end, end),
      } };
    case 'polyline':
      return { node: {
        ...common, type: 'polyline',
        vertices: slicePolylineVertices(source, start, end),
        closed: false,
      } };
    case 'arc': {
      const sweep = arcSweep(source.startAngle, source.endAngle, source.counterClockwise);
      return { node: {
        ...common, type: 'arc', center: source.center, radius: source.radius,
        startAngle: normalizeDegrees(source.startAngle + sweep * start),
        endAngle: normalizeDegrees(source.startAngle + sweep * end),
        counterClockwise: source.counterClockwise,
      } };
    }
    case 'circle':
      return { node: {
        ...common, type: 'arc', center: source.center, radius: source.radius,
        startAngle: normalizeDegrees(360 * start),
        endAngle: normalizeDegrees(360 * end),
        counterClockwise: true,
      } };
    case 'ellipse': {
      const base = source.startParam ?? 0;
      const finish = source.endParam ?? Math.PI * 2;
      const sweep = positiveRadians(finish - base);
      return { node: {
        ...common, type: 'ellipse', center: source.center,
        majorAxis: source.majorAxis, ratio: source.ratio,
        startParam: base + sweep * start,
        endParam: base + sweep * end,
      } };
    }
    case 'spline': {
      const bounds = roughGeometryBounds(source) ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
      const sampled = sampleGeometryRanges(source, { curveSamples: 64, localBounds: bounds });
      const points = [sampled[0]?.start, ...sampled.map((item) => item.end)]
        .filter((point): point is Vec2 => point !== undefined);
      return {
        node: {
          ...common,
          type: 'polyline',
          quality: {
            ...structuredClone(source.quality),
            status: 'candidate',
            confidence: Math.min(source.quality.confidence ?? 0.59, 0.59),
          },
          vertices: sliceSampledPoints(points, start, end).map((point) => ({ point })),
          closed: false,
        },
        warning: `SPLINE_SPLIT_APPROXIMATED_AS_POLYLINE:${source.id}`,
      };
    }
    case 'point':
    case 'ray':
    case 'xline':
      throw new Error(`SPLIT_GEOMETRY_UNSUPPORTED:${source.type}:${source.id}`);
  }
}

function slicePolylineVertices(
  source: Extract<GeometryNode, { type: 'polyline' }>,
  start: number,
  end: number,
) {
  const parameters = [
    start,
    ...Array.from(
      { length: Math.max(0, Math.ceil(end) - Math.floor(start) - 1) },
      (_, index) => Math.floor(start) + index + 1,
    ).filter((value) => value > start && value < end),
    end,
  ];
  return parameters.map((parameter, index) => {
    const point = polylinePoint(source, parameter);
    if (index === parameters.length - 1) return { point };
    const next = parameters[index + 1];
    const segmentIndex = Math.min(source.vertices.length - 2, Math.floor(parameter));
    const bulge = source.vertices[segmentIndex]?.bulge ?? 0;
    const fraction = next - parameter;
    const subBulge = Math.abs(bulge) < 1e-12
      ? undefined
      : Math.tan(4 * Math.atan(bulge) * fraction / 4);
    return { point, ...(subBulge === undefined ? {} : { bulge: subBulge }) };
  });
}

function polylinePoint(
  source: Extract<GeometryNode, { type: 'polyline' }>,
  parameter: number,
): Vec2 {
  const segmentCount = source.closed ? source.vertices.length : source.vertices.length - 1;
  if (parameter >= segmentCount) return source.vertices[source.closed ? 0 : source.vertices.length - 1].point;
  const index = Math.max(0, Math.floor(parameter));
  const local = parameter - index;
  const start = source.vertices[index].point;
  const end = source.vertices[(index + 1) % source.vertices.length].point;
  const bulge = source.vertices[index].bulge ?? 0;
  if (Math.abs(bulge) < 1e-12) return mixPoint(start, end, local);
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const sweep = 4 * Math.atan(bulge);
  const midpoint: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const left: Vec2 = [-(end[1] - start[1]) / chord, (end[0] - start[0]) / chord];
  const offset = chord * (1 - bulge ** 2) / (4 * bulge);
  const center: Vec2 = [midpoint[0] + left[0] * offset, midpoint[1] + left[1] * offset];
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  const angle = Math.atan2(start[1] - center[1], start[0] - center[0]) + sweep * local;
  return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
}

function sliceSampledPoints(points: Vec2[], start: number, end: number): Vec2[] {
  const count = points.length - 1;
  const values = [
    start,
    ...Array.from({ length: count - 1 }, (_, index) => (index + 1) / count)
      .filter((value) => value > start && value < end),
    end,
  ];
  return values.map((value) => sampledPoint(points, value));
}

function sampledPoint(points: Vec2[], parameter: number): Vec2 {
  const scaled = Math.max(0, Math.min(1, parameter)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  return mixPoint(points[index], points[index + 1], scaled - index);
}

function preferredProtectedRange(ranges: VirtualSplitRange[]): number {
  const candidates = ranges
    .map((range, index) => ({ range, index }))
    .filter((item) => item.range.role === 'protected')
    .sort((left, right) => (
      (right.range.range[1] - right.range.range[0])
      - (left.range.range[1] - left.range.range[0])
      || left.index - right.index
    ));
  if (candidates.length === 0) throw new Error('SPLIT_PROTECTED_FRAGMENT_REQUIRED');
  return candidates[0].index;
}

function validateRanges(ranges: VirtualSplitRange[], domain: readonly [number, number]): void {
  if (ranges.length < 2) throw new Error('SPLIT_RANGES_INCOMPLETE');
  const ordered = [...ranges].sort((left, right) => left.range[0] - right.range[0]);
  if (Math.abs(ordered[0].range[0] - domain[0]) > 1e-9
    || Math.abs(ordered.at(-1)!.range[1] - domain[1]) > 1e-9) {
    throw new Error('SPLIT_RANGES_INCOMPLETE');
  }
  ordered.forEach((range, index) => {
    if (range.range[1] <= range.range[0]
      || index > 0 && Math.abs(ordered[index - 1].range[1] - range.range[0]) > 1e-9) {
      throw new Error('SPLIT_RANGES_OVERLAP_OR_GAP');
    }
  });
}

function sourceDomain(source: GeometryNode): readonly [number, number] {
  return source.type === 'polyline'
    ? [0, source.closed ? source.vertices.length : Math.max(0, source.vertices.length - 1)]
    : [0, 1];
}

function fragmentId(
  sourceId: GeometryId,
  revision: string,
  range: VirtualSplitRange,
): GeometryId {
  return `node_split_${createHash('sha256').update(JSON.stringify({
    sourceId, revision, range,
  })).digest('hex').slice(0, 20)}` as GeometryId;
}

function mutableGeometryFields(node: GeometryNode): Record<string, unknown> {
  const changes = structuredClone(node) as GeometryNode & Record<string, unknown>;
  delete changes.id;
  delete changes.type;
  return changes;
}

function arcSweep(start: number, end: number, counterClockwise: boolean): number {
  return counterClockwise ? positiveDegrees(end - start) : -positiveDegrees(start - end);
}

function positiveDegrees(value: number): number {
  const normalized = (value % 360 + 360) % 360;
  return normalized === 0 ? 360 : normalized;
}

function positiveRadians(value: number): number {
  const full = Math.PI * 2;
  const normalized = (value % full + full) % full;
  return Math.abs(normalized) < 1e-12 ? full : normalized;
}

function normalizeDegrees(value: number): number {
  return (value % 360 + 360) % 360;
}

function mixPoint(start: Vec2, end: Vec2, parameter: number): Vec2 {
  return [
    start[0] + (end[0] - start[0]) * parameter,
    start[1] + (end[1] - start[1]) * parameter,
  ];
}
