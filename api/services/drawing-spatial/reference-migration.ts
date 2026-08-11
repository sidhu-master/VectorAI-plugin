import type {
  DimensionTarget,
  DrawingCommand,
  DrawingDocument,
  GeometryId,
} from '../../../src/drawing/index.js';
import type { SplitLineageEntry } from './split-materializer.js';

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
      changed = true;
      return migrateDimensionTarget(target, fragments, annotation.id);
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
): DimensionTarget {
  const parameter = anchorParameter(target, fragments);
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

function anchorParameter(target: DimensionTarget, fragments: SplitLineageEntry[]): number {
  const minimum = Math.min(...fragments.map((entry) => entry.sourceRange[0]));
  const maximum = Math.max(...fragments.map((entry) => entry.sourceRange[1]));
  switch (target.anchor.kind) {
    case 'start': return minimum;
    case 'end': return maximum;
    case 'vertex': return target.anchor.index;
    case 'curve-parameter': return target.anchor.parameter;
    case 'center':
    case 'nearest':
      throw new Error('SPLIT_REFERENCE_AMBIGUOUS:dimension-anchor');
  }
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
