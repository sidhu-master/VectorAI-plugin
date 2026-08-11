import type {
  DimensionTarget,
  DrawingCommand,
  DrawingDocument,
  GeometryId,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type { SplitLineageEntry } from './split-materializer.js';
import { roughGeometryBounds, sampleGeometryRanges } from './geometry-sampling.js';

export function migrateSplitReferences(
  document: DrawingDocument,
  lineage: SplitLineageEntry[],
): DrawingCommand[] {
  const commands: DrawingCommand[] = [];
  const bySource = new Map<string, SplitLineageEntry[]>();
  for (const entry of lineage) {
    bySource.set(entry.sourceNodeId, [...(bySource.get(entry.sourceNodeId) ?? []), entry]);
  }

  for (const annotation of document.annotations) {
    if (annotation.type !== 'dimension') continue;
    let changed = false;
    const targets = annotation.targets.map((target) => {
      const fragments = bySource.get(target.geometryId);
      if (!fragments) return target;
      const source = document.geometry.find((node) => node.id === target.geometryId);
      if (!source) throw new Error(`SPLIT_SOURCE_NOT_FOUND:${target.geometryId}`);
      changed = true;
      return migrateDimensionTarget(target, fragments, annotation.id, source);
    });
    if (changed) commands.push({
      type: 'annotation.update',
      id: annotation.id,
      changes: { targets },
      expected: { targets: annotation.targets },
    });
  }

  for (const relation of document.relations) {
    if (relation.plane === 'constraint') {
      const source = relation.geometryIds.find((id) => bySource.has(id));
      if (source) throw new Error(`SPLIT_REFERENCE_AMBIGUOUS:${relation.id}`);
      continue;
    }
    if (relation.plane === 'association') {
      const geometryIds = expandIds(relation.geometryIds, bySource);
      if (!equalIds(geometryIds, relation.geometryIds)) commands.push({
        type: 'relation.update', id: relation.id,
        changes: { geometryIds }, expected: { geometryIds: relation.geometryIds },
      });
      continue;
    }
    const nodeIds = expandIds(relation.nodeIds, bySource);
    if (!equalIds(nodeIds, relation.nodeIds)) commands.push({
      type: 'relation.update', id: relation.id,
      changes: { nodeIds }, expected: { nodeIds: relation.nodeIds },
    });
  }

  for (const feature of document.features) {
    const geometryIds = expandIds(feature.geometryIds, bySource) as GeometryId[];
    if (!equalIds(geometryIds, feature.geometryIds)) commands.push({
      type: 'feature.update', id: feature.id,
      changes: { geometryIds }, expected: { geometryIds: feature.geometryIds },
    });
  }
  return commands;
}

function migrateDimensionTarget(
  target: DimensionTarget,
  fragments: SplitLineageEntry[],
  annotationId: string,
  source: GeometryNode,
): DimensionTarget {
  if (target.anchor.kind === 'center') {
    const selected = [...fragments].sort((left, right) => {
      const role = Number(right.role === 'protected') - Number(left.role === 'protected');
      if (role !== 0) return role;
      return rangeLength(right.sourceRange) - rangeLength(left.sourceRange);
    })[0];
    if (!selected) throw new Error(`SPLIT_REFERENCE_AMBIGUOUS:${annotationId}`);
    return { geometryId: selected.fragmentId, anchor: target.anchor };
  }
  const parameter = anchorParameter(target, fragments, source);
  const matching = fragments.filter((entry) => containsParameter(entry.sourceRange, parameter));
  if (matching.length !== 1) throw new Error(`SPLIT_REFERENCE_AMBIGUOUS:${annotationId}`);
  const selected = matching[0];
  const [start, end] = selected.sourceRange;
  const anchor = target.anchor.kind === 'vertex'
    ? { kind: 'vertex' as const, index: Math.round(parameter - start) }
    : target.anchor.kind === 'curve-parameter'
      ? {
          kind: 'curve-parameter' as const,
          parameter: end === start ? 0 : (parameter - start) / (end - start),
        }
      : target.anchor;
  return { geometryId: selected.fragmentId, anchor };
}

function rangeLength(range: readonly [number, number]): number {
  return range[1] - range[0];
}

function anchorParameter(
  target: DimensionTarget,
  fragments: SplitLineageEntry[],
  source: GeometryNode,
): number {
  const minimum = Math.min(...fragments.map((entry) => entry.sourceRange[0]));
  const maximum = Math.max(...fragments.map((entry) => entry.sourceRange[1]));
  switch (target.anchor.kind) {
    case 'start': return minimum;
    case 'end': return maximum;
    case 'vertex': return target.anchor.index;
    case 'curve-parameter': return target.anchor.parameter;
    case 'nearest': return nearestSourceParameter(source, target.anchor.point);
    case 'center':
      throw new Error('SPLIT_REFERENCE_AMBIGUOUS:dimension-anchor');
  }
}

function nearestSourceParameter(source: GeometryNode, point: Vec2): number {
  const bounds = roughGeometryBounds(source) ?? {
    minX: point[0] - 1, minY: point[1] - 1,
    maxX: point[0] + 1, maxY: point[1] + 1,
  };
  const ranges = sampleGeometryRanges(source, { curveSamples: 256, localBounds: bounds });
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestParameter = Number.NaN;
  for (const range of ranges) {
    const sourceRange = range.vertexRange ?? range.parameterRange ?? [0, 1];
    for (let index = 1; index < range.samples.length; index += 1) {
      const projected = projectToSegment(point, range.samples[index - 1], range.samples[index]);
      if (projected.distance >= bestDistance) continue;
      const local = (index - 1 + projected.parameter) / (range.samples.length - 1);
      bestDistance = projected.distance;
      bestParameter = sourceRange[0] + (sourceRange[1] - sourceRange[0]) * local;
    }
  }
  if (!Number.isFinite(bestParameter)) throw new Error('SPLIT_REFERENCE_AMBIGUOUS:dimension-anchor');
  return bestParameter;
}

function projectToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx ** 2 + dy ** 2;
  const parameter = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / lengthSquared));
  const projected: Vec2 = [start[0] + dx * parameter, start[1] + dy * parameter];
  return { parameter, distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]) };
}

function containsParameter(range: readonly [number, number], parameter: number): boolean {
  const epsilon = 1e-9;
  const atStart = Math.abs(parameter - range[0]) <= epsilon;
  const atEnd = Math.abs(parameter - range[1]) <= epsilon;
  if (atStart || atEnd) {
    const integerEndpoint = Math.abs(parameter - Math.round(parameter)) <= epsilon;
    if (integerEndpoint) return atStart ? parameter === 0 : atEnd && range[1] === parameter;
  }
  return parameter > range[0] + epsilon && parameter < range[1] - epsilon;
}

function expandIds(
  ids: readonly string[],
  bySource: Map<string, SplitLineageEntry[]>,
): string[] {
  return unique(ids.flatMap((id) => {
    const fragments = bySource.get(id);
    return fragments ? fragments.map((entry) => entry.fragmentId) : [id];
  }));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function equalIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
