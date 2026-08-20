import { createHash } from 'node:crypto';

import type {
  AnnotationId,
  AnnotationNode,
  DimensionAnnotation,
  DimensionTarget,
  DrawingId,
  EvidenceId,
  GeometryId,
  GeometryNode,
} from '../../../src/drawing/index.js';
import { geometryBounds, unionBounds } from '../../../src/drawing/query/bounds.js';
import type { EngineeringDocument, EngineeringRegion } from '../drawing-dxf/engineering-document.js';
import { layoutMeasurementFacts } from './layout.js';
import type {
  AxialLengthFact,
  MeasurementFact,
  MeasurementResult,
} from './types.js';

export type PendingAnnotationCategory =
  | 'tolerance'
  | 'roughness'
  | 'datum'
  | 'geometric-tolerance'
  | 'section-marker'
  | 'arbitrary-note'
  | 'dimension-confirmation'
  | 'conflict';

export interface PendingAnnotation {
  key: string;
  category: PendingAnnotationCategory;
  reason: string;
  requiredFields: string[];
}

export interface AnnotationPlan {
  annotations: AnnotationNode[];
  consumedFactKeys: string[];
  factKeysByAnnotationId: Record<string, string>;
  suppressedFactKeys: string[];
  suppressionReasons: Record<string, string>;
  pendingAnnotations: PendingAnnotation[];
  conflicts: PendingAnnotation[];
}

export function planDeterministicAnnotations(input: {
  drawingId: DrawingId;
  geometry: GeometryNode[];
  measurements: MeasurementResult;
  engineeringDocument?: EngineeringDocument;
  engineeringEvidenceRef?: EvidenceId;
}): AnnotationPlan {
  const drawingBounds = unionBounds(input.geometry.flatMap((node) => {
    const item = geometryBounds(node);
    return item ? [item] : [];
  }));
  const diagonal = drawingBounds
    ? Math.hypot(drawingBounds.maxX - drawingBounds.minX, drawingBounds.maxY - drawingBounds.minY)
    : 1;
  const selection = selectDisplayFacts(input.measurements.facts, diagonal, input.geometry);
  const facts = selection.selected.sort(compareFacts);
  const layout = layoutMeasurementFacts({ geometry: input.geometry, facts });
  const reconciliation = reconcileEngineeringDocument(
    input.measurements,
    input.engineeringDocument,
  );
  const geometryIds = new Set(input.geometry.map((node) => node.id));
  const annotations: AnnotationNode[] = [];
  const consumedFactKeys: string[] = [];
  const factKeysByAnnotationId: Record<string, string> = {};

  for (const fact of facts) {
    const sourceIds = fact.sourceIds.filter((id) => geometryIds.has(id));
    if (sourceIds.length === 0) continue;
    const annotationId = stableAnnotationId(input.drawingId, fact.key) as AnnotationId;
    const evidenceRefs = uniqueEvidence([
      ...fact.evidenceRefs,
      ...(input.engineeringEvidenceRef && reconciliation.corroboratedFactKeys.has(fact.key)
        ? [input.engineeringEvidenceRef]
        : []),
    ]);
    let annotation: AnnotationNode;
    if (fact.kind === 'centerline') {
      annotation = {
        id: annotationId,
        type: 'centerline',
        visible: true,
        quality: { status: 'confirmed', confidence: 1, evidenceRefs },
        targets: sourceIds,
        start: fact.start,
        end: fact.end,
        extension: clean(Math.max(diagonal * 0.018, 1)),
      };
    } else {
      const factLayout = layout[fact.key];
      if (!factLayout) continue;
      annotation = dimensionFromFact(
        annotationId,
        fact,
        sourceIds,
        evidenceRefs,
        factLayout.textPosition,
        factLayout.definitionPoints,
        input.engineeringDocument?.drawing.unit ?? 'mm',
      );
    }
    annotations.push(annotation);
    consumedFactKeys.push(fact.key);
    factKeysByAnnotationId[annotation.id] = fact.key;
  }

  return {
    annotations,
    consumedFactKeys,
    factKeysByAnnotationId,
    suppressedFactKeys: Object.keys(selection.suppressionReasons).sort((left, right) => left.localeCompare(right)),
    suppressionReasons: selection.suppressionReasons,
    pendingAnnotations: [...deferredDesignIntent(), ...reconciliation.pending],
    conflicts: reconciliation.conflicts,
  };
}

/**
 * 开角（角度）事实的展示筛选（此前调整过的规则）：
 * 仅保留与中心线端点对齐的轴端开角，抑制 90° 正交开角与中部斜线对。
 * 整图规划（selectDisplayFacts）与分区确认后的开角标注共用。
 */
export function selectOpeningAngleFacts(input: {
  facts: MeasurementFact[];
  geometry: GeometryNode[];
}): {
  selected: Array<Extract<MeasurementFact, { kind: 'angle' }>>;
  suppressionReasons: Record<string, string>;
} {
  const centerline = input.facts.find(
    (fact): fact is Extract<MeasurementFact, { kind: 'centerline' }> => fact.kind === 'centerline',
  );
  const bounds = unionBounds(input.geometry.flatMap((node) => {
    const item = geometryBounds(node);
    return item ? [item] : [];
  }));
  const diagonal = bounds
    ? Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
    : 1;
  const boundaryTolerance = Math.max(diagonal * 0.01, 0.05);
  const geometryById = new Map(input.geometry.map((node) => [node.id, node]));
  const selected: Array<Extract<MeasurementFact, { kind: 'angle' }>> = [];
  const suppressionReasons: Record<string, string> = {};

  for (const fact of input.facts) {
    if (fact.kind !== 'angle') continue;
    const atAxialEnd = centerline !== undefined && (
      fact.sourceIds.some((id) => {
        const source = geometryById.get(id);
        const sourceBounds = source ? geometryBounds(source) : null;
        if (!sourceBounds) return false;
        return [sourceBounds.minX, sourceBounds.maxX].some((x) => (
          Math.abs(x - centerline.start[0]) <= boundaryTolerance
          || Math.abs(x - centerline.end[0]) <= boundaryTolerance
        ));
      })
    );
    const orthogonalOpening = Math.abs(fact.value - 90) <= 0.5;
    if (!atAxialEnd || orthogonalOpening) {
      suppressionReasons[fact.key] = orthogonalOpening
        ? '正交开角由轮廓关系直接表达，不重复生成 90° 角度标注'
        : '该局部线段方向不是已确认的轴端角度，不升级为正式角度标注';
      continue;
    }
    selected.push(fact);
  }
  return { selected, suppressionReasons };
}

function selectDisplayFacts(
  facts: MeasurementFact[],
  diagonal: number,
  geometry: GeometryNode[],
): { selected: MeasurementFact[]; suppressionReasons: Record<string, string> } {
  const selected: MeasurementFact[] = [];
  const suppressionReasons: Record<string, string> = {};
  const significantRadius = Math.max(diagonal * 0.01, 0.01);
  const retainedRadiusValues = new Set<string>();
  const geometryById = new Map(geometry.map((node) => [node.id, node]));
  const selectedAxial = selectAxialDisplayFacts(facts, diagonal, geometryById, suppressionReasons);
  const openingAngleSelection = selectOpeningAngleFacts({ facts, geometry });
  const openingAngleKeys = new Set(openingAngleSelection.selected.map((fact) => fact.key));
  Object.assign(suppressionReasons, openingAngleSelection.suppressionReasons);

  for (const fact of [...facts].sort(compareFacts)) {
    if (fact.kind === 'axial-length' && !selectedAxial.has(fact.key)) {
      if (!suppressionReasons[fact.key]) {
        suppressionReasons[fact.key] = '当前尺寸链按规则保留整体标注，选择最大段为容差留白，跳过该段标注';
      }
      continue;
    }
    if (fact.kind === 'radius') {
      if (fact.value < significantRadius) {
        suppressionReasons[fact.key] = `圆角半径 ${format(fact.value)} 小于全图显著性阈值 ${format(significantRadius)}`;
        continue;
      }
      const valueKey = fact.value.toFixed(2);
      if (retainedRadiusValues.has(valueKey)) {
        suppressionReasons[fact.key] = `同值半径 R${format(fact.value)} 已由一个代表性圆弧表达`;
        continue;
      }
      retainedRadiusValues.add(valueKey);
      selected.push(fact);
      continue;
    }
    if (fact.kind === 'angle' && !openingAngleKeys.has(fact.key)) {
      continue;
    }
    selected.push(fact);
  }
  return { selected, suppressionReasons };
}

function selectAxialDisplayFacts(
  facts: MeasurementFact[],
  diagonal: number,
  geometryById: Map<string, GeometryNode>,
  suppressionReasons: Record<string, string>,
): Set<string> {
  const axialFacts = facts.filter((fact): fact is AxialLengthFact => fact.kind === 'axial-length');
  if (axialFacts.length === 0) return new Set();
  const chains = splitIntoAxialChains(axialFacts, diagonal);
  const selected = new Set<string>(axialFacts.map((fact) => fact.key));

  for (const chain of chains) {
    const profile = buildChainProfile(chain);
    const strict = isStrictChain(profile, geometryById);
    if (strict) continue;
    const omitted = pickOmittedChainSegment(profile);
    if (!omitted) continue;
    selected.delete(omitted.key);
    suppressionReasons[omitted.key] = `尺寸链 ${chain.label} 按行业链标注策略处理：保留一段中间尺寸作为容差留白，暂不输出长度 ${format(omitted.value)}`;
  }
  return selected;
}

interface AxialChain {
  label: string;
  facts: AxialLengthFact[];
}

interface AxialChainProfile {
  label: string;
  facts: AxialLengthFact[];
  innerFacts: AxialLengthFact[];
  hasOverall: boolean;
  mean: number;
  std: number;
  span: number;
}

function splitIntoAxialChains(facts: AxialLengthFact[], diagonal: number): Array<{
  label: string;
  facts: AxialLengthFact[];
}> {
  if (facts.length === 0) return [];
  const tolerance = Math.max(diagonal * 0.012, 0.5);
  const sorted = [...facts].sort((left, right) => left.value === right.value
    ? left.key.localeCompare(right.key)
    : left.first[0] - right.first[0]
  );
  const chains: Array<{ label: string; facts: AxialLengthFact[] }> = [];

  for (const fact of sorted) {
    const currentStart = Math.min(fact.first[0], fact.second[0]);
    const currentChain = chains.at(-1);
    if (!currentChain) {
      chains.push({ label: `chain-0`, facts: [fact] });
      continue;
    }

    const last = currentChain.facts.at(-1);
    if (!last) {
      currentChain.facts.push(fact);
      continue;
    }
    const lastEnd = Math.max(last.first[0], last.second[0]);
    if (currentStart <= lastEnd + tolerance) {
      currentChain.facts.push(fact);
      currentChain.label = `chain-${chains.length - 1}`;
      continue;
    }
    chains.push({ label: `chain-${chains.length}`, facts: [fact] });
  }
  return chains;
}

function buildChainProfile(chain: AxialChain): AxialChainProfile {
  const facts = [...chain.facts].sort((left, right) => {
    const leftStart = Math.min(left.first[0], left.second[0]);
    const rightStart = Math.min(right.first[0], right.second[0]);
    if (leftStart === rightStart) {
      return left.value - right.value;
    }
    return leftStart - rightStart;
  });
  const innerFacts = facts.length <= 2 ? [] : facts.slice(1, -1);
  const hasOverall = facts.some((fact) => fact.method.includes('overall'));
  const values = facts.map((fact) => fact.value);
  const mean = values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
  const std = values.length > 0 && mean > 0
    ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
    : 0;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return {
    label: chain.label,
    facts,
    innerFacts,
    hasOverall,
    mean,
    std,
    span: Math.max(0, maxValue - minValue),
  };
}

function isStrictChain(
  chain: AxialChainProfile,
  geometryById: Map<string, GeometryNode>,
): boolean {
  if (chain.facts.length <= 3) return true;
  if (chain.hasOverall && chain.facts.length >= 8) return true;
  if (chain.mean > 0 && chain.std / chain.mean <= 0.15 && chain.span <= chain.mean * 0.25) return true;
  const isUniform = chain.mean > 0
    ? chain.facts.every((fact) => Math.abs(fact.value - chain.mean) <= chain.mean * 0.18)
    : false;
  if (isUniform && chain.facts.length >= 5) return true;
  return chain.facts.some((fact) => fact.sourceIds.some((id) => {
    const source = geometryById.get(id);
    return source?.type === 'arc' || source?.type === 'circle' || source?.type === 'spline'
      || source?.type === 'ellipse';
  }));
}

function pickOmittedChainSegment(chain: AxialChainProfile): AxialChainProfile['facts'][number] | null {
  const interior = chain.innerFacts.filter((fact) => !fact.method.includes('overall'));
  const fallback = chain.facts.filter((fact) => !fact.method.includes('overall'));
  const candidates = interior.length > 0
    ? interior
    : fallback;
  let omitted: AxialLengthFact | null = null;
  for (const fact of candidates) {
    if (!omitted || fact.value > omitted.value) omitted = fact;
  }
  return omitted;
}

function dimensionFromFact(
  id: AnnotationId,
  fact: Exclude<MeasurementFact, { kind: 'centerline' }>,
  sourceIds: GeometryId[],
  evidenceRefs: EvidenceId[],
  textPosition: readonly [number, number],
  definitionPoints: Array<readonly [number, number]>,
  unit: 'mm' | 'cm' | 'm',
): DimensionAnnotation {
  const targets = targetsForFact(fact, sourceIds);
  const kind = fact.kind === 'axial-length'
    ? 'linear'
    : fact.kind === 'diameter'
      ? 'diameter'
      : fact.kind === 'radius'
        ? 'radius'
        : fact.kind === 'angle' ? 'angular' : 'aligned';
  const value = clean(fact.value);
  return {
    id,
    type: 'dimension',
    visible: true,
    quality: { status: 'confirmed', confidence: 1, evidenceRefs },
    dimensionKind: kind,
    associationStatus: 'resolved',
    targets,
    computedValue: value,
    displayText: fact.kind === 'diameter'
      ? `Ø${format(value)}`
      : fact.kind === 'radius'
        ? `R${format(value)}`
        : fact.kind === 'angle'
          ? `${format(value)}°`
          : fact.kind === 'chamfer'
            ? `${format(value)} × ${format(fact.angle)}°`
            : format(value),
    unit: fact.kind === 'angle' ? 'deg' : unit,
    textPosition,
    definitionPoints,
  };
}

function targetsForFact(
  fact: Exclude<MeasurementFact, { kind: 'centerline' }>,
  sourceIds: GeometryId[],
): DimensionTarget[] {
  if (fact.kind === 'radius') {
    return [{ geometryId: sourceIds[0], anchor: { kind: 'center' } }];
  }
  if (fact.kind === 'diameter') {
    return [
      { geometryId: sourceIds[0], anchor: { kind: 'nearest', point: fact.first } },
      { geometryId: sourceIds[1] ?? sourceIds[0], anchor: { kind: 'nearest', point: fact.second } },
    ];
  }
  if (fact.kind === 'axial-length') {
    return [
      { geometryId: sourceIds[0], anchor: { kind: 'nearest', point: fact.first } },
      { geometryId: sourceIds[1] ?? sourceIds[0], anchor: { kind: 'nearest', point: fact.second } },
    ];
  }
  if (fact.kind === 'angle') {
    return sourceIds.slice(0, 2).map((geometryId, index) => ({
      geometryId,
      anchor: { kind: 'nearest', point: fact.rays[index] ?? fact.vertex },
    }));
  }
  return [{ geometryId: sourceIds[0], anchor: { kind: 'nearest', point: fact.start } }];
}

function reconcileEngineeringDocument(
  measurements: MeasurementResult,
  document: EngineeringDocument | undefined,
): {
  corroboratedFactKeys: Set<string>;
  pending: PendingAnnotation[];
  conflicts: PendingAnnotation[];
} {
  const corroboratedFactKeys = new Set<string>();
  const pending: PendingAnnotation[] = [];
  const conflicts: PendingAnnotation[] = [];
  if (!document) return { corroboratedFactKeys, pending, conflicts };
  const axial = measurements.facts.filter(
    (fact): fact is Extract<MeasurementFact, { kind: 'axial-length' }> => fact.kind === 'axial-length',
  );
  const diameters = measurements.facts.filter(
    (fact): fact is Extract<MeasurementFact, { kind: 'diameter' }> => fact.kind === 'diameter',
  );
  const centerline = measurements.facts.find(
    (fact): fact is Extract<MeasurementFact, { kind: 'centerline' }> => fact.kind === 'centerline',
  );
  const left = centerline?.start[0]
    ?? Math.min(...axial.flatMap((fact) => [fact.first[0], fact.second[0]]));
  const overallLength = Math.max(0, ...axial.map((fact) => fact.value));
  const positionTolerance = Math.max(overallLength * 0.002, 0.05);
  const valueTolerance = Math.max(overallLength * 0.001, 0.05);

  for (const region of document.regions) {
    reconcileRegion({
      region,
      left,
      axial,
      diameters,
      positionTolerance,
      valueTolerance,
      corroboratedFactKeys,
      pending,
      conflicts,
    });
  }
  return { corroboratedFactKeys, pending, conflicts };
}

function reconcileRegion(input: {
  region: EngineeringRegion;
  left: number;
  axial: Array<Extract<MeasurementFact, { kind: 'axial-length' }>>;
  diameters: Array<Extract<MeasurementFact, { kind: 'diameter' }>>;
  positionTolerance: number;
  valueTolerance: number;
  corroboratedFactKeys: Set<string>;
  pending: PendingAnnotation[];
  conflicts: PendingAnnotation[];
}): void {
  const expectedLeft = input.left + input.region.centerZ - input.region.width / 2;
  const expectedRight = input.left + input.region.centerZ + input.region.width / 2;
  const matchingWidth = input.axial.find((fact) => (
    Math.abs(fact.value - input.region.width) <= input.valueTolerance
    && Math.abs(Math.min(fact.first[0], fact.second[0]) - expectedLeft) <= input.positionTolerance
    && Math.abs(Math.max(fact.first[0], fact.second[0]) - expectedRight) <= input.positionTolerance
  ));
  if (matchingWidth) {
    input.corroboratedFactKeys.add(matchingWidth.key);
  } else {
    const sameWidth = input.axial.find((fact) => Math.abs(fact.value - input.region.width) <= input.valueTolerance);
    const item: PendingAnnotation = {
      key: `region:${input.region.id}:width`,
      category: sameWidth ? 'conflict' : 'dimension-confirmation',
      reason: sameWidth
        ? `文档区域 ${input.region.id} 的宽度 ${format(input.region.width)} 位于 ${format(expectedLeft)}–${format(expectedRight)}，几何中的同值轴段位置不一致`
        : `文档区域 ${input.region.id} 的宽度 ${format(input.region.width)} 尚无唯一几何轴段核验`,
      requiredFields: ['区域起点', '区域终点'],
    };
    (sameWidth ? input.conflicts : input.pending).push(item);
  }

  if (input.region.outerDiameter === undefined) return;
  const local = input.diameters.filter((fact) => (
    fact.center[0] >= expectedLeft - input.positionTolerance
    && fact.center[0] <= expectedRight + input.positionTolerance
  ));
  const matchingDiameter = local.find((fact) => (
    Math.abs(fact.value - (input.region.outerDiameter ?? 0)) <= input.valueTolerance
  ));
  if (matchingDiameter) {
    input.corroboratedFactKeys.add(matchingDiameter.key);
    return;
  }
  const closest = [...local].sort((left, right) => (
    Math.abs(left.value - (input.region.outerDiameter ?? 0))
    - Math.abs(right.value - (input.region.outerDiameter ?? 0))
  ))[0];
  if (closest) {
    input.conflicts.push({
      key: `region:${input.region.id}:outer-diameter`,
      category: 'conflict',
      reason: `文档外径 ${format(input.region.outerDiameter)} 与几何外径 ${format(closest.value)} 不一致`,
      requiredFields: ['确认外径'],
    });
  } else {
    input.pending.push({
      key: `region:${input.region.id}:outer-diameter`,
      category: 'dimension-confirmation',
      reason: `文档区域 ${input.region.id} 的外径 ${format(input.region.outerDiameter)} 尚无唯一局部轮廓核验`,
      requiredFields: ['外径对应轮廓'],
    });
  }
}

function deferredDesignIntent(): PendingAnnotation[] {
  return [
    ['tolerance', '尺寸公差未由初始几何或工程文档给出', ['上偏差', '下偏差']],
    ['roughness', '表面粗糙度未由初始几何或工程文档给出', ['目标表面', '粗糙度值']],
    ['datum', '基准体系未由初始几何或工程文档给出', ['基准目标', '基准字母']],
    ['geometric-tolerance', '形位公差未由初始几何或工程文档给出', ['公差类型', '数值', '基准引用']],
    ['section-marker', '剖切位置、方向和编号未由初始几何或工程文档给出', ['剖切路径', '方向', '编号']],
  ].map(([category, reason, requiredFields]) => ({
    key: `deferred:${category}`,
    category: category as PendingAnnotationCategory,
    reason: reason as string,
    requiredFields: requiredFields as string[],
  }));
}

function compareFacts(left: MeasurementFact, right: MeasurementFact): number {
  const rank: Record<MeasurementFact['kind'], number> = {
    centerline: 0,
    diameter: 1,
    radius: 2,
    chamfer: 3,
    angle: 4,
    'axial-length': 5,
  };
  return rank[left.kind] - rank[right.kind] || left.key.localeCompare(right.key);
}

function stableAnnotationId(drawingId: DrawingId, factKey: string): string {
  return `annotation_auto_${createHash('sha256')
    .update(`${drawingId}\0${factKey}`)
    .digest('hex')
    .slice(0, 20)}`;
}

function uniqueEvidence(values: EvidenceId[]): EvidenceId[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function format(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function clean(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
