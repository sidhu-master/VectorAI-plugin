// SPDX-License-Identifier: Apache-2.0

import type {
  GeometricCharacteristic,
  PartitionDraft,
  PartitionRevision,
  ShaftSemanticGroup,
} from '@vectorai/engineering-annotation';
import type { SemanticRecommendation } from './gdt-reviewer';

type ShaftPartition = PartitionDraft | PartitionRevision;

export type ShaftFeatureFunction = 'axis-support' | 'rotary-functional' | 'axial-stop' | 'clocking';

export interface ReviewedShaftFeature {
  id: string;
  segmentIds: string[];
  function: ShaftFeatureFunction;
  confidence: number;
}

export interface GdtClarificationQuestion {
  code: 'GDT_FEATURE_CONFIDENCE_LOW' | 'GDT_AXIS_SUPPORT_PAIR_REQUIRED';
  prompt: string;
  segmentIds: string[];
}

export interface ShaftGdtRuleResolution {
  status: 'resolved' | 'needs-user-input';
  recommendation: SemanticRecommendation;
  questions: GdtClarificationQuestion[];
}

interface FunctionalFeature extends ReviewedShaftFeature {
  label: string;
}

const MIN_CONFIDENCE = 0.8;
const AXIS_SUPPORT_TYPES = new Set(['bearing', 'bearing-seat', 'bearing-journal', 'journal']);
const ROTARY_FUNCTIONAL_TYPES = new Set(['gear', 'gear-seat', 'spline', 'external-spline', 'internal-spline']);
const AXIAL_STOP_TYPES = new Set(['axial-stop', 'thrust-face']);
const CLOCKING_TYPES = new Set(['clocking', 'keyway', 'key-slot', 'flat']);

/**
 * Convert functional semantics into a minimum, non-overlapping GD&T set.
 *
 * The rule layer intentionally does not know drawing names, coordinates,
 * golden-sample IDs or tolerance values. Upstream semantic evidence identifies
 * feature functions; this layer decides which characteristics are sufficient.
 */
export function resolveShaftGdtRules(
  partition: ShaftPartition,
  reviewedFeatures: readonly ReviewedShaftFeature[] = [],
): ShaftGdtRuleResolution {
  const features = mergeFeatures(extractPartitionFeatures(partition), reviewedFeatures, partition);
  const questions = features
    .filter(({ confidence }) => confidence < MIN_CONFIDENCE)
    .map((feature): GdtClarificationQuestion => ({
      code: 'GDT_FEATURE_CONFIDENCE_LOW',
      prompt: `“${feature.label}”的功能识别置信度为 ${feature.confidence.toFixed(2)}；请确认它是否属于${functionLabel(feature.function)}。`,
      segmentIds: [...feature.segmentIds],
    }));
  const accepted = features.filter(({ confidence }) => confidence >= MIN_CONFIDENCE);
  const supports = accepted.filter(({ function: value }) => value === 'axis-support');
  const stableSupports = selectStableSupportPair(supports, partition);
  if (stableSupports.length < 2) {
    questions.push({
      code: 'GDT_AXIS_SUPPORT_PAIR_REQUIRED',
      prompt: `当前只识别到 ${supports.length} 个可靠轴线支承区域；请确认哪两个轴段共同建立旋转基准轴线。`,
      segmentIds: supports.flatMap(({ segmentIds }) => segmentIds),
    });
  }

  const orderedSupports = sortByShaftOrientation(stableSupports, partition);
  const datums = orderedSupports.flatMap((feature, index) => {
    const segmentId = representativeSegmentId(feature, partition);
    return segmentId === undefined ? [] : [{
      name: datumName(index),
      segmentId,
      role: index === 0 ? 'primary' as const : 'secondary' as const,
      confidence: feature.confidence,
    }];
  });
  const datumNames = datums.map(({ name }) => name);
  const controls: SemanticRecommendation['controls'] = [];
  const surfaceTextures: NonNullable<SemanticRecommendation['surfaceTextures']> = supports.map((feature) => ({
    id: `surface-texture:rule:${feature.function}:${feature.id}:ra`,
    segmentIds: [...feature.segmentIds],
    parameter: 'Ra',
    value: 0.8,
    materialRemoval: 'required',
    source: 'process-rule',
    confidence: feature.confidence,
    ruleRef: { id: 'shaft-axis-support-surface-texture', version: '1' },
  }));

  for (const feature of supports) {
    controls.push(
      control(feature, 'circularity', [], 'segment-surface'),
      control(feature, 'cylindricity', [], 'segment-surface'),
    );
    if (datumNames.length === 2) {
      controls.push(control(feature, 'total-runout', datumNames, 'segment-surface', minimumConfidence(feature, orderedSupports)));
    }
  }
  if (datumNames.length === 2) {
    for (const feature of accepted.filter(({ function: value }) => value === 'rotary-functional')) {
      controls.push(control(
        feature,
        'circular-runout',
        datumNames,
        'positive-locating-shoulder',
        minimumConfidence(feature, orderedSupports),
      ));
    }
  }

  return {
    status: questions.length === 0 ? 'resolved' : 'needs-user-input',
    recommendation: { datums, controls, surfaceTextures },
    questions: dedupeQuestions(questions),
  };
}

export function extractPartitionFeatures(partition: ShaftPartition): FunctionalFeature[] {
  const evidenceById = new Map(partition.evidence.map((item) => [item.id, item]));
  const covered = new Set<string>();
  const fromGroups = partition.semanticGroups.flatMap((group) => {
    const featureFunction = featureFunctionFor(group.semanticType);
    if (featureFunction === undefined || group.segmentIds.length === 0) return [];
    group.segmentIds.forEach((id) => covered.add(id));
    return [{
      id: group.id,
      segmentIds: [...group.segmentIds],
      function: featureFunction,
      confidence: groupConfidence(group, partition, evidenceById),
      label: group.name ?? group.semanticType,
    }];
  });
  const fromSegments = partition.segments.flatMap((segment) => {
    if (covered.has(segment.id)) return [];
    const featureFunction = featureFunctionFor(segment.semanticType);
    if (featureFunction === undefined) return [];
    return [{
      id: `segment-feature:${segment.id}`,
      segmentIds: [segment.id],
      function: featureFunction,
      confidence: clampConfidence(segment.semanticConfidence ?? segment.boundaryConfidence),
      label: segment.name ?? segment.semanticType ?? segment.id,
    }];
  });
  return [...fromGroups, ...fromSegments];
}

function control(
  feature: FunctionalFeature,
  characteristic: GeometricCharacteristic,
  datumNames: string[],
  surfaceRole: 'segment-surface' | 'positive-locating-shoulder',
  confidence = feature.confidence,
): SemanticRecommendation['controls'][number] {
  return {
    id: `gdt:rule:${feature.function}:${feature.id}:${characteristic}`,
    characteristic,
    segmentIds: [...feature.segmentIds],
    surfaceRole,
    datumNames: [...datumNames],
    toleranceZoneShape: 'linear',
    confidence,
  };
}

function featureFunctionFor(value: string | undefined): ShaftFeatureFunction | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (AXIS_SUPPORT_TYPES.has(normalized)) return 'axis-support';
  if (ROTARY_FUNCTIONAL_TYPES.has(normalized)) return 'rotary-functional';
  if (AXIAL_STOP_TYPES.has(normalized)) return 'axial-stop';
  if (CLOCKING_TYPES.has(normalized)) return 'clocking';
  return undefined;
}

function groupConfidence(
  group: ShaftSemanticGroup,
  partition: ShaftPartition,
  evidenceById: ReadonlyMap<string, ShaftPartition['evidence'][number]>,
): number {
  const evidenceConfidence = group.evidenceIds.map((id) => {
    switch (evidenceById.get(id)?.origin) {
      case 'manual': return 1;
      case 'document': return 0.99;
      case 'fused': return 0.95;
      case 'ai': return 0;
      case 'geometry': return 0;
      default: return 0;
    }
  });
  const segmentConfidence = group.segmentIds.map((id) => {
    const segment = partition.segments.find((item) => item.id === id);
    return segment?.semanticConfidence ?? segment?.boundaryConfidence ?? 0;
  });
  return clampConfidence(Math.max(0, ...evidenceConfidence, ...segmentConfidence));
}

function mergeFeatures(
  partitionFeatures: readonly FunctionalFeature[],
  reviewedFeatures: readonly ReviewedShaftFeature[],
  partition: ShaftPartition,
): FunctionalFeature[] {
  const segmentIds = new Set(partition.segments.map(({ id }) => id));
  const values = new Map<string, FunctionalFeature>();
  const add = (feature: FunctionalFeature) => {
    const key = `${feature.function}:${[...feature.segmentIds].sort().join('+')}`;
    const current = values.get(key);
    if (!current || feature.confidence > current.confidence) values.set(key, feature);
  };
  partitionFeatures.forEach((feature) => add(structuredClone(feature)));
  for (const feature of reviewedFeatures) {
    if (feature.segmentIds.length === 0 || feature.segmentIds.some((id) => !segmentIds.has(id))) continue;
    add({ ...structuredClone(feature), confidence: clampConfidence(feature.confidence), label: feature.id });
  }
  return [...values.values()];
}

function selectStableSupportPair(
  supports: readonly FunctionalFeature[],
  partition: ShaftPartition,
): FunctionalFeature[] {
  if (supports.length < 2) return [];
  let selected: [FunctionalFeature, FunctionalFeature] | undefined;
  let bestSeparation = -1;
  let bestConfidence = -1;
  for (let left = 0; left < supports.length; left += 1) {
    for (let right = left + 1; right < supports.length; right += 1) {
      const pair: [FunctionalFeature, FunctionalFeature] = [supports[left]!, supports[right]!];
      const separation = Math.abs(featureStation(pair[0], partition) - featureStation(pair[1], partition));
      const confidence = pair[0].confidence + pair[1].confidence;
      if (separation > bestSeparation || separation === bestSeparation && confidence > bestConfidence) {
        selected = pair;
        bestSeparation = separation;
        bestConfidence = confidence;
      }
    }
  }
  return selected ?? [];
}

function sortByShaftOrientation(features: readonly FunctionalFeature[], partition: ShaftPartition): FunctionalFeature[] {
  const direction = partition.axis.orientation === 'reversed' ? -1 : 1;
  return [...features].sort((left, right) => (
    (featureStation(left, partition) - featureStation(right, partition)) * direction || left.id.localeCompare(right.id)
  ));
}

function representativeSegmentId(feature: FunctionalFeature, partition: ShaftPartition): string | undefined {
  const segments = new Map(partition.segments.map((segment) => [segment.id, segment]));
  return [...feature.segmentIds].sort((left, right) => {
    const a = segments.get(left);
    const b = segments.get(right);
    return ((b?.zEnd ?? 0) - (b?.zStart ?? 0)) - ((a?.zEnd ?? 0) - (a?.zStart ?? 0)) || left.localeCompare(right);
  })[0];
}

function featureStation(feature: FunctionalFeature, partition: ShaftPartition): number {
  const segments = new Map(partition.segments.map((segment) => [segment.id, segment]));
  const stations = feature.segmentIds.flatMap((id) => {
    const segment = segments.get(id);
    return segment === undefined ? [] : [(segment.zStart + segment.zEnd) / 2];
  });
  return stations.length === 0 ? 0 : stations.reduce((sum, value) => sum + value, 0) / stations.length;
}

function minimumConfidence(feature: FunctionalFeature, references: readonly FunctionalFeature[]): number {
  return Math.min(feature.confidence, ...references.map(({ confidence }) => confidence));
}

function functionLabel(value: ShaftFeatureFunction): string {
  switch (value) {
    case 'axis-support': return '轴线支承面';
    case 'rotary-functional': return '旋转功能区';
    case 'axial-stop': return '轴向定位面';
    case 'clocking': return '周向定位特征';
  }
}

function dedupeQuestions(values: readonly GdtClarificationQuestion[]): GdtClarificationQuestion[] {
  const result = new Map<string, GdtClarificationQuestion>();
  for (const value of values) {
    const key = `${value.code}:${[...value.segmentIds].sort().join('+')}`;
    if (!result.has(key)) result.set(key, structuredClone(value));
  }
  return [...result.values()];
}

function clampConfidence(value: number): number { return Math.max(0, Math.min(1, value)); }
function datumName(index: number): string { return String.fromCharCode('A'.charCodeAt(0) + index); }
