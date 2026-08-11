import type {
  SemanticRegion,
  SpatialEditMode,
  SpatialEditStrategy,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  Bounds2D,
  DrawingCommand,
  DrawingDocument,
  EvidenceId,
  GeometryId,
  GeometryNode,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import {
  collectPreservedNodeHashes,
  drawingNodeContentHash,
  type PreservedNodeHashes,
} from '../drawing-edit/preserve-report.js';
import { roughGeometryBounds } from './geometry-sampling.js';
import { transformGeometryNode, type SpatialTransform } from './geometry-transform.js';
import type {
  MaterializedSplit,
  SplitLineageEntry,
} from './split-materializer.js';

export type SpatialEditDesign =
  | {
      kind: 'transform';
      transform: SpatialTransform;
      confidence: number;
      evidenceRefs: string[];
    }
  | {
      kind: 'replacement';
      geometry: GeometryNode[];
      confidence: number;
      evidenceRefs: string[];
    }
  | {
      kind: 'local-redraw';
      geometry: GeometryNode[];
      replaceTarget: boolean;
      confidence: number;
      evidenceRefs: string[];
    };

export interface CompiledSpatialEditCandidate {
  baseRevision: RevisionId;
  commands: DrawingCommand[];
  targetNodeIds: GeometryId[];
  preserveNodeHashes: PreservedNodeHashes;
  protectedFragmentHashes: PreservedNodeHashes;
  authorizedBounds: Bounds2D;
  lineage: SplitLineageEntry[];
  strategy: SpatialEditMode;
  fidelityWarnings: string[];
}

export function compileSpatialEdit(input: {
  document: DrawingDocument;
  selection: SpatialSelection;
  region: SemanticRegion;
  strategy: SpatialEditStrategy;
  split: MaterializedSplit;
  design: SpatialEditDesign;
}): CompiledSpatialEditCandidate {
  assertScope(input);
  if (input.design.kind === 'local-redraw') {
    return compileLocalRedraw({ ...input, design: input.design });
  }
  const targetFragmentIds = input.split.lineage
    .filter((entry) => entry.role === 'target')
    .map((entry) => entry.fragmentId);
  const targetNodeIds = [...new Set([
    ...input.selection.wholeNodes,
    ...targetFragmentIds,
  ])] as GeometryId[];
  const transformedFragments = new Map<string, GeometryNode>();
  for (const fragment of input.split.fragments) {
    const target = targetFragmentIds.includes(fragment.id);
    transformedFragments.set(fragment.id, target
      ? designedGeometry(fragment, input.design)
      : structuredClone(fragment));
  }
  const splitCommands = input.split.commands.map((command): DrawingCommand => {
    if (command.type !== 'geometry.create' || !command.value.id) return structuredClone(command);
    const replacement = transformedFragments.get(command.value.id);
    return replacement
      ? { type: 'geometry.create', value: withDesignQuality(replacement, input.design) }
      : structuredClone(command);
  });
  const wholeCommands = input.selection.wholeNodes.map((id) => {
    const before = input.document.geometry.find((node) => node.id === id);
    if (!before) throw new Error(`SPATIAL_TARGET_NOT_FOUND:${id}`);
    const after = withDesignQuality(designedGeometry(before, input.design), input.design);
    return updateGeometry(before, after);
  });
  const commands = [...splitCommands, ...wholeCommands];
  const affectedExistingIds = new Set<string>(commands.flatMap((command) => (
    'id' in command
      ? [command.id]
      : 'value' in command && command.value.id
        ? [command.value.id]
        : []
  )));
  const preservedIds = allNodeIds(input.document).filter((id) => !affectedExistingIds.has(id));
  const protectedFragmentHashes = Object.fromEntries(input.split.lineage
    .filter((entry) => entry.role === 'protected')
    .map((entry) => {
      const node = transformedFragments.get(entry.fragmentId);
      if (!node) throw new Error(`PROTECTED_FRAGMENT_MISSING:${entry.fragmentId}`);
      return [entry.fragmentId, drawingNodeContentHash(node)];
    }));
  const targetGeometry = [
    ...targetFragmentIds.map((id) => transformedFragments.get(id)).filter(isGeometry),
    ...input.selection.wholeNodes.map((id) => {
      const node = input.document.geometry.find((item) => item.id === id);
      return node ? designedGeometry(node, input.design) : undefined;
    }).filter(isGeometry),
  ];
  return {
    baseRevision: input.selection.revision,
    commands,
    targetNodeIds,
    preserveNodeHashes: collectPreservedNodeHashes(input.document, preservedIds),
    protectedFragmentHashes,
    authorizedBounds: authorizedBounds(input.region, targetGeometry),
    lineage: structuredClone(input.split.lineage),
    strategy: input.strategy.mode,
    fidelityWarnings: [...input.split.fidelityWarnings],
  };
}

function compileLocalRedraw(input: {
  document: DrawingDocument;
  selection: SpatialSelection;
  region: SemanticRegion;
  strategy: SpatialEditStrategy;
  split: MaterializedSplit;
  design: Extract<SpatialEditDesign, { kind: 'local-redraw' }>;
}): CompiledSpatialEditCandidate {
  if (input.design.geometry.length === 0) throw new Error('SPATIAL_REDRAW_EMPTY');
  const generatedIds = new Set<string>();
  for (const node of input.design.geometry) {
    if (generatedIds.has(node.id)) throw new Error(`SPATIAL_REDRAW_ID_DUPLICATE:${node.id}`);
    if (input.document.geometry.some((existing) => existing.id === node.id)) {
      throw new Error(`SPATIAL_REDRAW_ID_COLLISION:${node.id}`);
    }
    generatedIds.add(node.id);
  }
  const targetFragmentIds = new Set(input.split.lineage
    .filter((entry) => entry.role === 'target')
    .map((entry) => entry.fragmentId));
  const retainedSplitCommands = input.design.replaceTarget
    ? input.split.commands.filter((command) => !(
        command.type === 'geometry.create' && targetFragmentIds.has(command.value.id)
      ))
    : [];
  const deleteWholeTargets: DrawingCommand[] = input.design.replaceTarget
    ? input.selection.wholeNodes.map((id) => ({ type: 'geometry.delete' as const, id }))
    : [];
  const createGenerated: DrawingCommand[] = input.design.geometry.map((node) => ({
    type: 'geometry.create' as const,
    value: withDesignQuality(node, input.design),
  }));
  const commands = [...retainedSplitCommands, ...deleteWholeTargets, ...createGenerated];
  const affectedExistingIds = new Set<string>(commands.flatMap((command) => {
    if ('id' in command && input.document.geometry.some((node) => node.id === command.id)) {
      return [command.id];
    }
    return [];
  }));
  const preservedIds = allNodeIds(input.document).filter((id) => !affectedExistingIds.has(id));
  const protectedFragmentHashes = input.design.replaceTarget
    ? Object.fromEntries(input.split.lineage
        .filter((entry) => entry.role === 'protected')
        .map((entry) => {
          const node = input.split.fragments.find((fragment) => fragment.id === entry.fragmentId);
          if (!node) throw new Error(`PROTECTED_FRAGMENT_MISSING:${entry.fragmentId}`);
          return [entry.fragmentId, drawingNodeContentHash(node)];
        }))
    : {};
  return {
    baseRevision: input.selection.revision,
    commands,
    targetNodeIds: input.design.geometry.map((node) => node.id),
    preserveNodeHashes: collectPreservedNodeHashes(input.document, preservedIds),
    protectedFragmentHashes,
    authorizedBounds: authorizedBounds(input.region, []),
    lineage: input.design.replaceTarget ? structuredClone(input.split.lineage) : [],
    strategy: input.strategy.mode,
    fidelityWarnings: [...input.split.fidelityWarnings],
  };
}

function assertScope(input: {
  document: DrawingDocument;
  selection: SpatialSelection;
  region: SemanticRegion;
  strategy: SpatialEditStrategy;
}): void {
  if (input.document.id !== input.region.drawingId) throw new Error('SPATIAL_EDIT_DRAWING_MISMATCH');
  if (input.selection.revision !== input.region.revision) throw new Error('SPATIAL_EDIT_STALE');
  if (input.selection.regionId !== input.region.id || input.strategy.regionId !== input.region.id) {
    throw new Error('SPATIAL_EDIT_REGION_MISMATCH');
  }
}

function designedGeometry(node: GeometryNode, design: SpatialEditDesign): GeometryNode {
  if (design.kind === 'transform') return transformGeometryNode(node, design.transform);
  if (design.kind === 'local-redraw') throw new Error('SPATIAL_REDRAW_REQUIRES_LOCAL_COMPILER');
  const replacement = design.geometry.find((item) => item.id === node.id);
  if (!replacement) throw new Error(`SPATIAL_REPLACEMENT_MISSING:${node.id}`);
  return structuredClone(replacement);
}

function withDesignQuality(node: GeometryNode, design: SpatialEditDesign): GeometryNode {
  const clone = structuredClone(node);
  clone.quality = design.confidence < 0.6
    ? {
        status: 'candidate', confidence: design.confidence,
        evidenceRefs: design.evidenceRefs as EvidenceId[],
      }
    : {
        status: 'confirmed', confidence: design.confidence,
        evidenceRefs: design.evidenceRefs as EvidenceId[],
      };
  return clone;
}

function updateGeometry(before: GeometryNode, after: GeometryNode): DrawingCommand {
  if (before.type !== after.type) throw new Error(`SPATIAL_REPLACEMENT_TYPE_CHANGED:${before.id}`);
  const changes: Record<string, unknown> = {};
  const expected: Record<string, unknown> = {};
  const keys = Object.keys(before).filter((key) => !['id', 'type'].includes(key));
  for (const key of keys) {
    const oldValue = (before as unknown as Record<string, unknown>)[key];
    const newValue = (after as unknown as Record<string, unknown>)[key];
    if (canonical(oldValue) === canonical(newValue)) continue;
    changes[key] = structuredClone(newValue);
    expected[key] = structuredClone(oldValue);
  }
  return { type: 'geometry.update', id: before.id, changes, expected };
}

function authorizedBounds(region: SemanticRegion, targets: GeometryNode[]): Bounds2D {
  const points = region.worldContours.flatMap((contour) => contour);
  const targetBounds = targets.map(roughGeometryBounds).filter((item): item is Bounds2D => item !== null);
  const all: Bounds2D[] = [
    {
      minX: Math.min(...points.map((point) => point[0])),
      minY: Math.min(...points.map((point) => point[1])),
      maxX: Math.max(...points.map((point) => point[0])),
      maxY: Math.max(...points.map((point) => point[1])),
    },
    ...targetBounds,
  ];
  const bounds = {
    minX: Math.min(...all.map((item) => item.minX)),
    minY: Math.min(...all.map((item) => item.minY)),
    maxX: Math.max(...all.map((item) => item.maxX)),
    maxY: Math.max(...all.map((item) => item.maxY)),
  };
  const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1) * 0.02;
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding,
  };
}

function allNodeIds(document: DrawingDocument): string[] {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => node.id);
}

function isGeometry(node: GeometryNode | undefined): node is GeometryNode {
  return node !== undefined;
}

function canonical(value: unknown): string {
  return JSON.stringify(value);
}

export function pointInsideBounds(point: Vec2, bounds: Bounds2D, tolerance = 0): boolean {
  return point[0] >= bounds.minX - tolerance && point[0] <= bounds.maxX + tolerance
    && point[1] >= bounds.minY - tolerance && point[1] <= bounds.maxY + tolerance;
}
