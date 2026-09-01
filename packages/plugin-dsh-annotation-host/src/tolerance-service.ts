// SPDX-License-Identifier: Apache-2.0

import {
  applyFitTolerance,
  applySingleTolerance,
  canonicalRuleInputDigest,
  createGbt1800Provider,
  type EngineeringAnnotationDraft,
  type EngineeringDiagnostic,
  type ResolvedFit,
  type ResolvedStandardTolerance,
  type ToleranceSpec,
  type ToleranceStandardProvider,
} from '@vectorai/engineering-annotation';
import type {
  DimensionPlanSessionSnapshot,
  DrawingRef,
  ToleranceCatalogRequest,
  ToleranceCatalogResult,
  ToleranceEditCommand,
  TolerancePreviewRequest,
  TolerancePreviewResult,
} from '@vectorai/plugin-space-contracts';
import type { DimensionPlanStore, ToleranceEditResolution } from './dimension-plan-store';

type AnnotationPlan = NonNullable<DimensionPlanSessionSnapshot['draft'] | DimensionPlanSessionSnapshot['confirmed']>;

export class ToleranceService {
  constructor(
    private readonly plans: DimensionPlanStore,
    private readonly provider: ToleranceStandardProvider = createGbt1800Provider(),
  ) {}

  query(sessionId: string, request: ToleranceCatalogRequest): ToleranceCatalogResult {
    const plan = requirePlan(this.plans.get(sessionId), request.expectedDrawingRef);
    const intent = requireIntent(plan, request.dimensionIntentId);
    requireMillimetreSize(intent);
    const matching = [...plan.tolerances].reverse().find(({ dimensionIntentId }) => dimensionIntentId === request.dimensionIntentId);
    const recommendation = matching?.source === 'ai-candidate'
      && matching.featureClass === request.featureClass
      && matching.selection?.source === 'ai-recommended'
      && matching.selection.evidenceRefs.length > 0
      && matching.selection.evidenceRefs.every((reference) => matching.evidenceIds.includes(reference))
      && this.provider.listBands({ basicSize: intent.nominalValue, featureClass: request.featureClass })
        .some(({ designation, available }) => designation === matching.selection!.designation && available)
      ? {
        designation: matching.selection.designation,
        source: 'ai-recommended' as const,
        evidenceRefs: [...matching.selection.evidenceRefs],
      }
      : undefined;
    return {
      drawingRef: plan.drawingRef,
      dimensionIntentId: request.dimensionIntentId,
      featureClass: request.featureClass,
      standardRef: { ...this.provider.standardRef },
      datasetMetadata: {
        ...this.provider.datasetMetadata,
        numericProvenance: this.provider.datasetMetadata.numericProvenance.map((item) => ({ ...item })),
      },
      bands: structuredClone(this.provider.listBands({ basicSize: intent.nominalValue, featureClass: request.featureClass })),
      ...(matching?.source === 'standard' && matching.featureClass === request.featureClass && matching.selection
        ? { selection: {
          ...matching.selection,
          displayPreference: matching.displayPreference ?? 'deviations',
          ...(matching.override ? { override: { ...matching.override } } : {}),
        } }
        : {}),
      ...(recommendation === undefined ? {} : { recommendation }),
    };
  }

  preview(sessionId: string, request: TolerancePreviewRequest): TolerancePreviewResult {
    const plan = requirePlan(this.plans.get(sessionId), request.expectedDrawingRef);
    if (request.type === 'single') {
      const intent = requireIntent(plan, request.dimensionIntentId);
      const basicSize = requireMillimetreSize(intent);
      return {
        type: 'single', drawingRef: plan.drawingRef, dimensionIntentId: request.dimensionIntentId, status: 'resolved',
        result: withToleranceMagnitude(this.provider.resolveBand({
          basicSize, featureClass: request.featureClass, designation: request.designation,
        })),
      };
    }
    const { holeDimensionIntentId, shaftDimensionIntentId } = requireFitRoles(request);
    const basicSize = requireEqualFitSize(plan, holeDimensionIntentId, shaftDimensionIntentId);
    return {
      type: 'fit', drawingRef: plan.drawingRef,
      holeDimensionIntentId, shaftDimensionIntentId,
      status: 'resolved',
      result: withFitToleranceMagnitudes(this.provider.resolveFit({
        basicSize, basis: request.basis, designation: request.designation,
      })),
    };
  }

  edit(sessionId: string, command: ToleranceEditCommand): DimensionPlanSessionSnapshot {
    const plan = requirePlan(this.plans.get(sessionId), command.expectedDrawingRef);
    requireAiRecommendation(plan, command);
    let resolved: ToleranceEditResolution;
    if (command.type === 'standard.single.apply') {
      const basicSize = requireMillimetreSize(requireIntent(plan, command.dimensionIntentId));
      const result = this.provider.resolveBand({ basicSize, featureClass: command.featureClass, designation: command.designation });
      verifyProviderResult(result, {
        basicSize, featureClass: command.featureClass, designation: command.designation,
      }, this.provider);
      resolved = result;
    } else if (command.type === 'standard.fit.apply') {
      const basicSize = requireEqualFitSize(plan, command.holeDimensionIntentId, command.shaftDimensionIntentId);
      const result = this.provider.resolveFit({ basicSize, basis: command.basis, designation: command.designation });
      const [holeDesignation, shaftDesignation] = command.designation.split('/');
      if (result.designation !== command.designation || result.basis !== command.basis
        || !holeDesignation || !shaftDesignation) throw new Error('TOLERANCE_PROVIDER_RESULT_MISMATCH');
      verifyProviderResult(result.hole, { basicSize, featureClass: 'internal', designation: holeDesignation }, this.provider);
      verifyProviderResult(result.shaft, { basicSize, featureClass: 'external', designation: shaftDesignation }, this.provider);
      resolved = result;
    }
    return this.plans.editTolerance(sessionId, command, resolved);
  }
}

function requireFitRoles(request: Extract<TolerancePreviewRequest, { type: 'fit' }>): {
  holeDimensionIntentId: string;
  shaftDimensionIntentId: string;
} {
  if (request.primaryFeatureClass === request.secondaryFeatureClass) {
    throw new Error('FIT_PAIR_CLASS_INCOMPATIBLE');
  }
  return request.primaryFeatureClass === 'internal'
    ? {
      holeDimensionIntentId: request.primaryDimensionIntentId,
      shaftDimensionIntentId: request.secondaryDimensionIntentId,
    }
    : {
      holeDimensionIntentId: request.secondaryDimensionIntentId,
      shaftDimensionIntentId: request.primaryDimensionIntentId,
    };
}

function withToleranceMagnitude(result: ResolvedStandardTolerance) {
  return { ...result, toleranceMagnitude: result.upperDeviation - result.lowerDeviation };
}

function withFitToleranceMagnitudes(result: ResolvedFit) {
  return {
    ...result,
    hole: withToleranceMagnitude(result.hole),
    shaft: withToleranceMagnitude(result.shaft),
  };
}

export function createToleranceReconciler(provider: ToleranceStandardProvider = createGbt1800Provider()) {
  return (draft: EngineeringAnnotationDraft): EngineeringAnnotationDraft => reconcileTolerances(draft, provider);
}

function reconcileTolerances(
  draft: EngineeringAnnotationDraft,
  provider: ToleranceStandardProvider,
): EngineeringAnnotationDraft {
  let next = structuredClone(draft);
  const handled = new Set<string>();
  for (const identity of fitReconcileIdentities(draft)) {
    const members = draft.tolerances.filter(({ fitGroupId }) => fitGroupId === identity.fitGroupId);
    const hole = draft.intents.find(({ id }) => id === identity.holeDimensionId);
    const shaft = draft.intents.find(({ id }) => id === identity.shaftDimensionId);
    if (!hole || !shaft) continue;
    const changed = members.some((spec) => spec.inputs.basicSize !== requireMillimetreSize(
      spec.dimensionIntentId === hole.id ? hole : shaft,
    ));
    if (!changed) continue;
    handled.add(identity.fitGroupId);
    if (hole.unit !== 'mm' || shaft.unit !== 'mm' || hole.nominalValue !== shaft.nominalValue) {
      next = staleFit(next, identity, 'FIT_PAIR_BASIC_SIZE_MISMATCH');
      continue;
    }
    try {
      const result = provider.resolveFit({
        basicSize: hole.nominalValue, basis: identity.basis, designation: identity.designation,
      });
      const [holeDesignation, shaftDesignation] = identity.designation.split('/');
      if (result.designation !== identity.designation || result.basis !== identity.basis
        || !holeDesignation || !shaftDesignation) throw new Error('TOLERANCE_PROVIDER_RESULT_MISMATCH');
      verifyProviderResult(result.hole, {
        basicSize: hole.nominalValue, featureClass: 'internal', designation: holeDesignation,
      }, provider);
      verifyProviderResult(result.shaft, {
        basicSize: shaft.nominalValue, featureClass: 'external', designation: shaftDesignation,
      }, provider);
      const overrides = new Map(members.flatMap((spec) => spec.override ? [[spec.dimensionIntentId, spec.override] as const] : []));
      next = applyFitTolerance(next, result, {
        fitGroupId: identity.fitGroupId,
        holeDimensionIntentId: identity.holeDimensionId,
        shaftDimensionIntentId: identity.shaftDimensionId,
        selectionSource: members[0]?.selection?.source ?? 'manual',
        displayPreference: members[0]?.displayPreference ?? 'deviations',
        evidenceRefs: members[0]?.selection?.evidenceRefs ?? members[0]?.evidenceIds ?? [],
      });
      next.tolerances = next.tolerances.map((spec) => attachOverrideReview(spec, overrides.get(spec.dimensionIntentId)));
    } catch (error) {
      next = staleFit(next, identity, errorCode(error));
    }
  }

  for (const original of draft.tolerances) {
    if (original.fitGroupId && handled.has(original.fitGroupId)) continue;
    if (original.source !== 'standard' || original.fitGroupId || !original.selection || !original.featureClass) continue;
    const intent = draft.intents.find(({ id }) => id === original.dimensionIntentId);
    if (!intent || original.inputs.basicSize === intent.nominalValue) continue;
    try {
      const basicSize = requireMillimetreSize(intent);
      const result = provider.resolveBand({
        basicSize, featureClass: original.featureClass, designation: original.selection.designation,
      });
      verifyProviderResult(result, {
        basicSize, featureClass: original.featureClass, designation: original.selection.designation,
      }, provider);
      next = applySingleTolerance(next, result, {
        dimensionIntentId: original.dimensionIntentId,
        selectionSource: original.selection.source,
        displayPreference: original.displayPreference ?? 'deviations',
        evidenceRefs: original.selection.evidenceRefs,
      });
      next.tolerances = next.tolerances.map((spec) => spec.dimensionIntentId === original.dimensionIntentId
        ? attachOverrideReview(spec, original.override)
        : spec);
    } catch (error) {
      next.tolerances = next.tolerances.map((spec) => spec.dimensionIntentId === original.dimensionIntentId
        ? staleSpec(spec, intent.nominalValue, errorCode(error))
        : spec);
    }
  }
  return next;
}

interface FitReconcileIdentity {
  fitGroupId: string;
  holeDimensionId: string;
  shaftDimensionId: string;
  basis: 'hole' | 'shaft';
  designation: string;
}

function fitReconcileIdentities(draft: EngineeringAnnotationDraft): FitReconcileIdentity[] {
  const identities = new Map(draft.fitAssignments.map((assignment) => [assignment.fitGroupId, {
    fitGroupId: assignment.fitGroupId,
    holeDimensionId: assignment.holeDimensionId,
    shaftDimensionId: assignment.shaftDimensionId,
    basis: assignment.basis,
    designation: assignment.designation,
  }]));
  for (const spec of draft.tolerances) {
    if (!spec.fitGroupId || identities.has(spec.fitGroupId)) continue;
    const holeDimensionId = spec.inputs.fitHoleDimensionId;
    const shaftDimensionId = spec.inputs.fitShaftDimensionId;
    const basis = spec.inputs.fitBasis;
    const designation = spec.inputs.fitDesignation;
    if (typeof holeDimensionId === 'string' && typeof shaftDimensionId === 'string'
      && (basis === 'hole' || basis === 'shaft') && typeof designation === 'string') {
      identities.set(spec.fitGroupId, {
        fitGroupId: spec.fitGroupId, holeDimensionId, shaftDimensionId, basis, designation,
      });
    }
  }
  return [...identities.values()];
}

function staleFit(draft: EngineeringAnnotationDraft, identity: FitReconcileIdentity, code: string): EngineeringAnnotationDraft {
  const intents = new Map(draft.intents.map((intent) => [intent.id, intent]));
  return {
    ...draft,
    fitAssignments: draft.fitAssignments.filter((assignment) => assignment.fitGroupId !== identity.fitGroupId),
    tolerances: draft.tolerances.map((spec) => {
      if (spec.fitGroupId !== identity.fitGroupId) return spec;
      const stale = staleSpec(spec, intents.get(spec.dimensionIntentId)?.nominalValue, code);
      return {
        ...stale,
        inputs: {
          ...stale.inputs,
          fitHoleDimensionId: identity.holeDimensionId,
          fitShaftDimensionId: identity.shaftDimensionId,
          fitBasis: identity.basis,
          fitDesignation: identity.designation,
        },
      };
    }),
  };
}

function staleSpec(spec: ToleranceSpec, basicSize: number | undefined, code: string): ToleranceSpec {
  const withoutResolved = { ...spec };
  delete withoutResolved.resolved;
  const diagnostics = [diagnostic(spec.id, code), ...(spec.override ? [diagnostic(spec.id, 'TOLERANCE_OVERRIDE_REVIEW_REQUIRED')] : [])];
  return {
    ...withoutResolved,
    inputs: basicSize === undefined ? { ...spec.inputs } : { ...spec.inputs, basicSize },
    status: 'stale',
    diagnostics,
  };
}

function attachOverrideReview(spec: ToleranceSpec, override: ToleranceSpec['override']): ToleranceSpec {
  if (!override) return spec;
  return { ...spec, override: { ...override }, diagnostics: [diagnostic(spec.id, 'TOLERANCE_OVERRIDE_REVIEW_REQUIRED')] };
}

function diagnostic(entityId: string, code: string): EngineeringDiagnostic {
  return {
    id: `tolerance:${code}:${entityId}`, severity: 'warning', code, message: code, entityIds: [entityId],
  };
}

function requirePlan(snapshot: DimensionPlanSessionSnapshot, expected: DrawingRef): AnnotationPlan {
  if (!snapshot.drawingRef || !sameRef(snapshot.drawingRef, expected)) throw new Error('ANNOTATION_PLAN_DRAWING_STALE');
  const plan = snapshot.draft ?? snapshot.confirmed;
  if (!plan) throw new Error('ANNOTATION_PLAN_DRAFT_REQUIRED');
  if (!sameRef(plan.drawingRef, expected)) throw new Error('ANNOTATION_PLAN_DRAWING_STALE');
  return plan;
}

function requireIntent(plan: AnnotationPlan, id: string): AnnotationPlan['intents'][number] {
  const intent = plan.intents.find((candidate) => candidate.id === id);
  if (!intent) throw new Error('TOLERANCE_INTENT_UNKNOWN');
  return intent;
}

function requireMillimetreSize(intent: { unit: string; nominalValue: number }): number {
  if (intent.unit !== 'mm' || !Number.isFinite(intent.nominalValue)) throw new Error('TOLERANCE_BASIC_SIZE_INVALID');
  return intent.nominalValue;
}

function requireEqualFitSize(plan: AnnotationPlan, holeId: string, shaftId: string): number {
  if (holeId === shaftId) throw new Error('TOLERANCE_FIT_INTENTS_DISTINCT');
  const hole = requireMillimetreSize(requireIntent(plan, holeId));
  const shaft = requireMillimetreSize(requireIntent(plan, shaftId));
  if (hole !== shaft) throw new Error('FIT_PAIR_BASIC_SIZE_MISMATCH');
  return hole;
}

function requireAiRecommendation(plan: AnnotationPlan, command: ToleranceEditCommand): void {
  if ((command.type !== 'standard.single.apply' && command.type !== 'standard.fit.apply')
    || command.selectionSource !== 'ai-recommended') return;
  const targetIds = command.type === 'standard.single.apply'
    ? new Set([command.dimensionIntentId])
    : new Set([command.holeDimensionIntentId, command.shaftDimensionIntentId]);
  const match = plan.tolerances.some((spec) => spec.source === 'ai-candidate'
    && spec.status === 'candidate'
    && targetIds.has(spec.dimensionIntentId)
    && spec.selection?.source === 'ai-recommended'
    && spec.selection.designation === command.designation
    && spec.selection.evidenceRefs.length > 0
    && spec.selection.evidenceRefs.every((reference) => spec.evidenceIds.includes(reference))
    && (command.type !== 'standard.single.apply' || spec.featureClass === command.featureClass)
    && sameStrings(spec.selection.evidenceRefs, command.evidenceRefs));
  if (!match) throw new Error('TOLERANCE_AI_RECOMMENDATION_REQUIRED');
}

function sameStrings(first: readonly string[], second: readonly string[]): boolean {
  if (first.length !== second.length) return false;
  const right = new Set(second);
  return right.size === second.length && first.every((value) => right.has(value));
}

function verifyProviderResult(
  result: ResolvedStandardTolerance,
  request: { basicSize: number; featureClass: 'internal' | 'external'; designation: string },
  provider: ToleranceStandardProvider,
): void {
  if (result.basicSize !== request.basicSize || result.featureClass !== request.featureClass
    || result.designation !== request.designation || result.unit !== 'mm'
    || result.standardRef.id !== provider.standardRef.id
    || result.standardRef.edition !== provider.standardRef.edition) {
    throw new Error('TOLERANCE_PROVIDER_RESULT_MISMATCH');
  }
  const expected = canonicalRuleInputDigest({
    nominalValue: request.basicSize,
    unit: 'mm',
    inputs: {
      standardId: provider.standardRef.id,
      edition: provider.standardRef.edition,
      featureClass: request.featureClass,
      designation: request.designation,
    },
  });
  if (result.ruleRef.inputDigest !== expected) throw new Error('TOLERANCE_INPUT_DIGEST_MISMATCH');
}

function errorCode(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : 'TOLERANCE_STANDARD_UNAVAILABLE';
}

function sameRef(first: DrawingRef, second: DrawingRef): boolean {
  return first.drawingId === second.drawingId && first.revision === second.revision;
}
