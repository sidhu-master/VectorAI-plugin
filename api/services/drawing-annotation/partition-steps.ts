/**
 * 分区确认后的自动标注步骤规划。
 *
 * === 自动标注暂停区（逐段调整期间） ===
 * 原逻辑（暂被注释，按段调整完成后逐项恢复）：
 *   1) 每个分区生成边界范围尺寸标注（宽/高，标注文本带分区名前缀）；
 *   2) 每个分区内生成圆/弧/椭圆特征标注（Ø / R）。
 * 当前仅生成开角（角度）标注，复用此前调整过的展示规则（planner.selectOpeningAngleFacts）：
 * 仅保留左右轴端的开角，抑制 90° 正交开角与中部斜线对；重跑时自动清理过期的自动角度标注。
 */
import type { DimensionAnnotation, DrawingDocument, DrawingId } from '../../../src/drawing/index.js';
import type { DrawingPartition } from '../../../src/contracts/drawing-partition.js';
import {
  formatNumber,
  isAutomaticAnnotationId,
  removalStep,
  step,
  type AutomaticAnnotationStep,
} from './build-steps.js';
import {
  layoutMeasurementFacts,
} from './layout.js';
import {
  measureDeterministicAnnotations,
} from './measurement.js';
import { selectOpeningAngleFacts } from './planner.js';

export function buildPartitionedAnnotationSteps(input: {
  drawingId: DrawingId;
  document: DrawingDocument;
  partitions: DrawingPartition[];
}): AutomaticAnnotationStep[] {
  // === 暂停的分区间隔尺寸与特征标注（恢复时取消注释） ===
  // const steps: AutomaticAnnotationStep[] = [];
  // for (const partition of input.partitions) {
  //   const members = input.document.geometry.filter((node) => (
  //     partition.geometryIds.includes(node.id)
  //   ));
  //   if (members.length === 0) continue;
  //   const keyPrefix = `partition:${partition.id}`;
  //   const labelPrefix = `${partition.name} `;
  //   steps.push(...partitionAnnotationSteps(
  //     input.drawingId, partition, members, keyPrefix, labelPrefix, steps.length,
  //   ));
  // }
  // const existing = withoutAutomaticAnnotations(input.document);
  // return steps.filter((step) => !existing.annotations.some((node) => node.id === step.annotation.id));

  // 当前：仅生成开角（角度）标注
  return openingAngleSteps(input.drawingId, input.document);
}

/** 开角（角度）标注：轴端开角事实 -> 复用既有布局规则生成角度标注，并清理过期标注 */
function openingAngleSteps(
  drawingId: DrawingId,
  document: DrawingDocument,
): AutomaticAnnotationStep[] {
  const measurements = measureDeterministicAnnotations({
    geometry: document.geometry,
    unit: 'mm',
  });
  const facts = selectOpeningAngleFacts({
    facts: measurements.facts,
    geometry: document.geometry,
  }).selected;
  const layouts = layoutMeasurementFacts({ geometry: document.geometry, facts });
  const existingById = new Map(
    document.annotations
      .filter((node): node is DimensionAnnotation => node.type === 'dimension')
      .map((node) => [node.id, node]),
  );
  const steps: AutomaticAnnotationStep[] = [];
  const keepIds = new Set<string>();
  for (const fact of facts) {
    const layout = layouts[fact.key];
    if (!layout) continue;
    const sources = document.geometry.filter((node) => fact.sourceIds.includes(node.id));
    if (sources.length === 0) continue;
    const annotationStep = step(drawingId, fact.key, {
      dimensionKind: 'angular',
      targets: fact.sourceIds.slice(0, 2).map((geometryId, index) => ({
        geometryId,
        anchor: { kind: 'nearest' as const, point: fact.rays[index] ?? fact.vertex },
      })),
      computedValue: fact.value,
      displayText: `${formatNumber(fact.value)}°`,
      unit: 'deg',
      textPosition: layout.textPosition,
      definitionPoints: layout.definitionPoints,
      sources,
    });
    keepIds.add(annotationStep.annotation.id);
    const existing = existingById.get(annotationStep.annotation.id);
    if (existing && sameAngularAnnotation(existing, annotationStep.annotation)) continue;
    // 布局或数值已过期的保留标注：先删后建，刷新到当前布局
    if (existing) steps.push(removalStep(existing));
    steps.push(annotationStep);
  }
  // 重跑自愈：移除不再保留的过期自动角度标注（如此前误标的 90° 正交开角）
  for (const node of document.annotations) {
    if (node.type !== 'dimension' || node.dimensionKind !== 'angular') continue;
    if (!isAutomaticAnnotationId(node.id) || keepIds.has(node.id)) continue;
    steps.push(removalStep(node));
  }
  return steps;
}

function sameAngularAnnotation(
  left: DimensionAnnotation,
  right: DimensionAnnotation,
): boolean {
  return left.displayText === right.displayText
    && left.computedValue === right.computedValue
    && JSON.stringify(left.targets) === JSON.stringify(right.targets)
    && JSON.stringify(left.textPosition) === JSON.stringify(right.textPosition)
    && JSON.stringify(left.definitionPoints) === JSON.stringify(right.definitionPoints);
}

// === 暂停的分区边界尺寸与特征标注实现（恢复时取消注释） ===

// function partitionAnnotationSteps(
//   drawingId: DrawingId,
//   partition: DrawingPartition,
//   members: GeometryNode[],
//   keyPrefix: string,
//   labelPrefix: string,
//   offset: number,
// ): AutomaticAnnotationStep[] {
//   const steps: AutomaticAnnotationStep[] = [];
//   const bounds = unionBounds(members.flatMap((node) => {
//     const value = geometryBounds(node);
//     return value ? [value] : [];
//   }));
//   if (!bounds || members.length === 0) {
//     return featureSteps(drawingId, members, keyPrefix, labelPrefix, 24);
//   }
//   const width = bounds.maxX - bounds.minX;
//   const height = bounds.maxY - bounds.minY;
//   const diagonal = Math.hypot(width, height);
//   if (diagonal <= EPSILON) {
//     return featureSteps(drawingId, members, keyPrefix, labelPrefix, 24);
//   }
//   const gap = Math.max(diagonal * 0.18, 1);
//   if (width > EPSILON) {
//     const belowY = bounds.minY - gap;
//     const widthSource = contributor(members, 'minX', bounds.minX)
//       ?? contributor(members, 'maxX', bounds.maxX)
//       ?? members[0];
//     steps.push(step(drawingId, `${keyPrefix}:w`, {
//       dimensionKind: 'linear',
//       targets: [
//         { geometryId: widthSource.id, anchor: { kind: 'nearest', point: [bounds.minX, bounds.minY] } },
//         { geometryId: widthSource.id, anchor: { kind: 'nearest', point: [bounds.maxX, bounds.minY] } },
//       ],
//       computedValue: width,
//       displayText: `${labelPrefix}W ${formatNumber(width)}`,
//       textPosition: [(bounds.minX + bounds.maxX) / 2, belowY],
//       definitionPoints: [
//         [bounds.minX, bounds.minY],
//         [bounds.maxX, bounds.minY],
//         [bounds.minX, belowY],
//         [bounds.maxX, belowY],
//       ],
//       sources: members,
//     }));
//   }
//   if (height > EPSILON) {
//     const rightX = bounds.maxX + gap;
//     const heightSource = contributor(members, 'minY', bounds.minY)
//       ?? contributor(members, 'maxY', bounds.maxY)
//       ?? members[0];
//     steps.push(step(drawingId, `${keyPrefix}:h`, {
//       dimensionKind: 'linear',
//       targets: [
//         { geometryId: heightSource.id, anchor: { kind: 'nearest', point: [bounds.maxX, bounds.minY] } },
//         { geometryId: heightSource.id, anchor: { kind: 'nearest', point: [bounds.maxX, bounds.maxY] } },
//       ],
//       computedValue: height,
//       displayText: `${labelPrefix}H ${formatNumber(height)}`,
//       textPosition: [rightX, (bounds.minY + bounds.maxY) / 2],
//       definitionPoints: [
//         [bounds.maxX, bounds.minY],
//         [bounds.maxX, bounds.maxY],
//         [rightX, bounds.minY],
//         [rightX, bounds.maxY],
//       ],
//       sources: members,
//     }));
//   }
//   steps.push(...featureSteps(drawingId, members, keyPrefix, labelPrefix, offset));
//   return steps;
// }

// function featureSteps(
//   drawingId: DrawingId,
//   members: GeometryNode[],
//   keyPrefix: string,
//   labelPrefix: string,
//   offset: number,
// ): AutomaticAnnotationStep[] {
//   return members.flatMap((node) => featureAnnotationSteps({
//     drawingId,
//     node,
//     offset,
//     keyPrefix,
//     labelPrefix,
//   }));
// }
