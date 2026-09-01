// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationId,
  AnnotationNode,
  DimensionAnnotation,
  EvidenceId,
  ToleranceProjection,
} from '@vectorai/drawing-core';
import type {
  DimensionIntent,
  EngineeringAnnotationDraft,
  EngineeringDiagnostic,
  ToleranceSpec,
} from './types';
import { isResolvedToleranceValid } from './validate';

export interface EngineeringAnnotationProjection {
  annotations: DimensionAnnotation[];
  diagnostics: EngineeringDiagnostic[];
}

export function projectEngineeringAnnotations(input: {
  draft: EngineeringAnnotationDraft;
  orderedIntentIds: string[];
  existingAnnotations: AnnotationNode[];
}): EngineeringAnnotationProjection {
  const diagnostics: EngineeringDiagnostic[] = [];
  const annotations: DimensionAnnotation[] = [];
  const intentsById = new Map(input.draft.intents.map((intent) => [intent.id, intent]));
  const toleranceByIntentId = new Map(input.draft.tolerances.map((spec) => [spec.dimensionIntentId, spec]));
  const datumsById = new Map(input.draft.datums.map((datum) => [datum.id, datum]));
  const existingByIntentId = new Map(
    input.existingAnnotations
      .filter((node): node is DimensionAnnotation => node.type === 'dimension' && node.engineeringIntentId !== undefined)
      .map((node) => [node.engineeringIntentId!, node]),
  );

  for (const [generationOrder, intentId] of input.orderedIntentIds.entries()) {
    const intent = intentsById.get(intentId);
    if (!intent) {
      diagnostics.push(issue('ANNOTATION_INTENT_UNKNOWN', '标注顺序引用了不存在的尺寸意图。', [intentId]));
      continue;
    }
    const intentDiagnostics: EngineeringDiagnostic[] = [];
    if (!['resolved', 'confirmed'].includes(intent.status)) {
      intentDiagnostics.push(issue('ANNOTATION_INTENT_NOT_CONFIRMED', '只有已解析或已确认的尺寸意图可以投影到第一层。', [intent.id]));
    }

    const tolerance = toleranceByIntentId.get(intent.id);
    const toleranceProjection = tolerance === undefined
      ? undefined
      : projectTolerance(tolerance, intent, intentDiagnostics);
    const datumReferences = intent.datumIds.flatMap((datumId) => {
      const datum = datumsById.get(datumId);
      if (!datum || datum.status !== 'confirmed') {
        intentDiagnostics.push(issue('ANNOTATION_DATUM_NOT_CONFIRMED', '尺寸意图引用的基准不存在或尚未确认。', [intent.id, datumId]));
        return [];
      }
      return [{
        datumId: datum.id,
        role: datum.role,
        geometryId: datum.geometryId,
        anchor: structuredClone(datum.anchor),
      }];
    });
    diagnostics.push(...intentDiagnostics);
    if (intentDiagnostics.some(({ severity }) => severity === 'error')) continue;

    const chainIds = input.draft.chains
      .filter((chain) => chain.members.some((member) => member.dimensionIntentId === intent.id))
      .map(({ id }) => id)
      .sort();
    const evidenceRefs = unique([
      ...intent.evidenceIds,
      ...intent.datumIds.flatMap((datumId) => datumsById.get(datumId)?.evidenceIds ?? []),
      ...(tolerance?.evidenceIds ?? []),
    ]) as EvidenceId[];
    const existing = existingByIntentId.get(intent.id);
    const base = defaultAnnotation(intent);
    if (existing) {
      base.id = existing.id;
      base.visible = existing.visible;
      base.textPosition = structuredClone(existing.textPosition);
      base.definitionPoints = structuredClone(existing.definitionPoints);
      if (existing.sourceRef) base.sourceRef = structuredClone(existing.sourceRef);
    }
    annotations.push({
      ...base,
      dimensionKind: intent.kind,
      targets: structuredClone(intent.targets),
      associationStatus: 'resolved',
      computedValue: intent.nominalValue,
      unit: intent.unit,
      quality: { status: 'confirmed', confidence: 1, evidenceRefs },
      datumReferences,
      engineeringIntentId: intent.id,
      engineeringChainIds: chainIds,
      generationOrder,
      ...(toleranceProjection === undefined ? {} : { toleranceProjection }),
    });
  }

  return { annotations, diagnostics };
}

function projectTolerance(
  spec: ToleranceSpec,
  intent: DimensionIntent,
  diagnostics: EngineeringDiagnostic[],
): ToleranceProjection | undefined {
  if (spec.source === 'ai-candidate') {
    diagnostics.push(issue('TOLERANCE_AI_AUTHORITY_FORBIDDEN', 'AI 候选公差不能投影为确认数据。', [spec.id, intent.id]));
    return undefined;
  }
  if (!['resolved', 'confirmed'].includes(spec.status) || !spec.resolved) {
    diagnostics.push(issue('TOLERANCE_RESULT_REQUIRED', '公差投影需要已解析的确定性结果。', [spec.id, intent.id]));
    return undefined;
  }
  if (!isResolvedToleranceValid(spec)) {
    diagnostics.push(issue('TOLERANCE_RESULT_INVALID', '公差结果与声明模式不匹配。', [spec.id, intent.id]));
    return undefined;
  }
  if (spec.mode === 'formula') {
    diagnostics.push(issue('TOLERANCE_RESULT_INVALID', '公式模式必须先解析为可移植公差模式。', [spec.id, intent.id]));
    return undefined;
  }
  const resolved = spec.resolved;
  const effective = spec.override ?? resolved;
  return {
    mode: spec.mode,
    ...(effective.upperDeviation === undefined ? {} : { upperDeviation: effective.upperDeviation }),
    ...(effective.lowerDeviation === undefined ? {} : { lowerDeviation: effective.lowerDeviation }),
    ...(resolved.upperLimit === undefined ? {} : { upperLimit: resolved.upperLimit }),
    ...(resolved.lowerLimit === undefined ? {} : { lowerLimit: resolved.lowerLimit }),
    ...(spec.selection?.designation === undefined && resolved.fitDesignation === undefined ? {} : {
      fitDesignation: spec.selection?.designation ?? resolved.fitDesignation,
    }),
    unit: intent.unit,
    status: spec.status === 'confirmed' ? 'confirmed' : 'resolved',
    source: spec.source,
    ...(spec.ruleRef === undefined ? {} : {
      ruleRef: { ...spec.ruleRef, inputDigest: resolved.inputDigest },
    }),
    ...(spec.featureClass === undefined ? {} : { featureClass: spec.featureClass }),
    ...(spec.standardRef === undefined ? {} : { standardRef: { ...spec.standardRef } }),
    ...(spec.displayPreference === undefined ? {} : { displayPreference: spec.displayPreference }),
    evidenceRefs: [...spec.evidenceIds],
  };
}

function defaultAnnotation(intent: DimensionIntent): DimensionAnnotation {
  const prefix = intent.kind === 'diameter' ? 'Ø' : intent.kind === 'radius' ? 'R' : '';
  const suffix = intent.kind === 'angular' ? '°' : '';
  return {
    id: `annotation_engineering_${stableKey(intent.id)}` as AnnotationId,
    type: 'dimension',
    visible: true,
    quality: { status: 'confirmed', confidence: 1, evidenceRefs: [] },
    dimensionKind: intent.kind,
    associationStatus: 'resolved',
    targets: structuredClone(intent.targets),
    computedValue: intent.nominalValue,
    displayText: `${prefix}${format(intent.nominalValue)}${suffix}`,
    unit: intent.unit,
    textPosition: [0, 0],
    definitionPoints: [],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function issue(code: string, message: string, entityIds: string[]): EngineeringDiagnostic {
  return {
    id: `annotation-projection:${code}:${entityIds.join(',')}`,
    severity: 'error', code, message, entityIds,
  };
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function format(value: number): string {
  return Number(value.toFixed(6)).toString();
}
