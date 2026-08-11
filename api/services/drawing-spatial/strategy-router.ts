import type {
  SemanticRegion,
  SpatialEditMode,
  SpatialEditStrategy,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import type { DrawingDocument } from '../../../src/drawing/index.js';

const CREATIVE_PATTERN = /发型|头发|卷发|刘海|表情|装饰|纹样|自然形|外观|创意|画一个|增加.*帽/;
const ENGINEERING_PATTERN = /工程图|孔|槽|尺寸|半径|直径|角度|对齐|平行|垂直|旋转|平移|缩放|精确/;
const PROTECTION_PATTERN = /不遮挡|不要改变|保持|保留|不能覆盖|避开|保护/;

export function routeSpatialEditStrategy(input: {
  goal: string;
  document: DrawingDocument;
  region: SemanticRegion;
  selection: SpatialSelection;
  protectedRegionIds?: string[];
  proposedMode?: SpatialEditMode;
}): SpatialEditStrategy {
  const creative = CREATIVE_PATTERN.test(input.goal);
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
  const hasHardGeometry = ENGINEERING_PATTERN.test(input.goal)
    || hasLocalDimension
    || hasLocalConstraint;
  const preserveRegionIds = [...new Set(input.protectedRegionIds ?? [])];
  const protectedIntent = preserveRegionIds.length > 0 || PROTECTION_PATTERN.test(input.goal);

  let mode: SpatialEditMode;
  if (creative && protectedIntent) mode = 'hybrid-edit';
  else if (creative) mode = 'generative-redraw';
  else if (hasHardGeometry) mode = 'geometric-edit';
  else mode = input.proposedMode ?? 'geometric-edit';
  if (hasHardGeometry && !creative) mode = 'geometric-edit';

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
    primaryReason: reason(mode, hasHardGeometry, protectedIntent),
    ...(mode === 'geometric-edit' ? {} : { fallbackMode: 'geometric-edit' as const }),
  };
}

function reason(
  mode: SpatialEditMode,
  hardGeometry: boolean,
  protectedIntent: boolean,
): string {
  if (mode === 'hybrid-edit') return '自由外观需要重绘，同时存在必须保持的保护区域';
  if (mode === 'generative-redraw') return '目标是自由形外观新增，局部重绘后矢量化更合适';
  return hardGeometry
    ? '任务包含工程几何或约束，必须使用确定性几何编辑'
    : protectedIntent
      ? '目标可由几何编辑完成，并需保持区域外内容'
      : '目标可由确定性二维几何变换完成';
}
