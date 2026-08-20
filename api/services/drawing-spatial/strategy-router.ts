import type {
  SemanticRegion,
  SpatialEditMode,
  SpatialEditStrategy,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import type { DrawingDocument } from '../../../src/drawing/index.js';

export function routeSpatialEditStrategy(input: {
  document: DrawingDocument;
  region: SemanticRegion;
  selection: SpatialSelection;
  protectedRegionIds?: string[];
  proposedMode?: SpatialEditMode;
}): SpatialEditStrategy {
  const targetNodeIds = new Set([
    ...input.selection.wholeNodes,
    ...input.selection.crossingNodes,
  ]);
  const hasLocalDimension = input.document.annotations.some((node) => (
    node.type === 'dimension'
    && node.targets.some((target) => targetNodeIds.has(target.geometryId))
  ));
  const hasLocalConstraint = input.document.relations.some((relation) => (
    relation.plane === 'constraint'
    && relation.geometryIds.some((id) => targetNodeIds.has(id))
  ));
  const hasHardGeometry = hasLocalDimension || hasLocalConstraint;
  const preserveRegionIds = [...new Set(input.protectedRegionIds ?? [])];
  const requestedMode = input.proposedMode ?? input.region.preferredEditMode;
  const mode: SpatialEditMode = hasHardGeometry ? 'geometric-edit' : requestedMode;

  return {
    mode,
    regionId: input.region.id,
    preserveRegionIds,
    boundaryAnchorIds: input.selection.boundaryAnchors.map((anchor) => anchor.id),
    requiredGuarantees: [
      'outside-region-unchanged',
      ...(preserveRegionIds.length > 0 ? ['protected-region-unchanged' as const] : []),
      ...(input.selection.boundaryAnchors.length > 0 ? ['maintain-connectivity' as const] : []),
      ...(mode === 'geometric-edit' ? ['preserve-analytic-geometry' as const] : []),
      ...(mode !== 'geometric-edit' ? ['avoid-visible-seams' as const] : []),
    ],
    primaryReason: reason(mode, hasHardGeometry),
    ...(mode === 'geometric-edit' ? {} : { fallbackMode: 'geometric-edit' as const }),
  };
}

function reason(
  mode: SpatialEditMode,
  hardGeometry: boolean,
): string {
  if (mode === 'hybrid-edit') return '语义规划要求结合确定性几何与局部重绘';
  if (mode === 'generative-redraw') return '语义规划要求局部重绘后重新矢量化';
  return hardGeometry
    ? '目标子图关联尺寸或几何约束，必须使用确定性几何编辑'
    : '语义规划选择确定性二维几何编辑';
}
