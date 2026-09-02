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
import { canonicalMillimetres } from '@vectorai/drawing-core';
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
    const intent = requireEligibleIntent(plan, request.dimensionIntentId, request.featureClass);
    const basicSize = requireProviderBasicSize(intent);
    const requestedBands = this.provider.listBands({ basicSize, featureClass: request.featureClass });
    const internalBands = request.featureClass === 'internal'
      ? requestedBands
      : this.provider.listBands({ basicSize, featureClass: 'internal' });
    const externalBands = request.featureClass === 'external'
      ? requestedBands
      : this.provider.listBands({ basicSize, featureClass: 'external' });
    const matching = [...plan.tolerances].reverse().find(({ dimensionIntentId }) => dimensionIntentId === request.dimensionIntentId);
    const fit = matching === undefined ? undefined : activeFitHydration(plan, matching);
    const matingFit = matching?.matingFit === undefined ? undefined : {
      currentFeatureClass: request.featureClass,
      currentDesignation: matching.selection?.designation ?? String(matching.inputs.designation ?? ''),
      matingFeatureClass: matching.matingFit.matingFeatureClass,
      matingDesignation: matching.matingFit.matingDesignation,
      result: withFitToleranceMagnitudes(this.provider.resolveFit({
        basicSize,
        basis: request.featureClass === 'external' ? 'hole' : 'shaft',
        designation: matching.matingFit.designation,
      })),
    };
    const recommendation = matching?.source === 'ai-candidate'
      && matching.featureClass === request.featureClass
      && matching.selection?.source === 'ai-recommended'
      && matching.selection.evidenceRefs.length > 0
      && matching.selection.evidenceRefs.every((reference) => matching.evidenceIds.includes(reference))
      && this.provider.listBands({ basicSize, featureClass: request.featureClass })
        .some(({ designation, available }) => designation === matching.selection!.designation && available)
      ? {
        designation: matching.selection.designation,
        source: 'ai-recommended' as const,
        evidenceRefs: [...matching.selection.evidenceRefs],
      }
      : undefined;
    const recommendations = buildRecommendations(
      this.provider,
      basicSize,
      request.featureClass,
      requestedBands,
      recommendation,
    );
    return {
      drawingRef: plan.drawingRef,
      dimensionIntentId: request.dimensionIntentId,
      featureClass: request.featureClass,
      standardRef: { ...this.provider.standardRef },
      datasetMetadata: {
        ...this.provider.datasetMetadata,
        numericProvenance: this.provider.datasetMetadata.numericProvenance.map((item) => ({ ...item })),
      },
      bands: structuredClone(requestedBands),
      fitBands: {
        internal: structuredClone(internalBands),
        external: structuredClone(externalBands),
      },
      ...(matching?.source === 'standard' && matching.featureClass === request.featureClass && matching.selection
        && (matching.fitGroupId === undefined || fit !== undefined)
        ? { selection: {
          ...matching.selection,
          displayPreference: matching.displayPreference ?? 'deviations',
          ...(matching.override ? { override: { ...matching.override } } : {}),
          ...(fit === undefined ? {} : { fit }),
          ...(matingFit === undefined ? {} : { matingFit }),
        } }
        : {}),
      ...(recommendation === undefined ? {} : { recommendation }),
      recommendations,
    };
  }

  preview(sessionId: string, request: TolerancePreviewRequest): TolerancePreviewResult {
    const plan = requirePlan(this.plans.get(sessionId), request.expectedDrawingRef);
    if (request.type === 'single') {
      const intent = requireEligibleIntent(plan, request.dimensionIntentId, request.featureClass);
      const basicSize = requireProviderBasicSize(intent);
      return {
        type: 'single', drawingRef: plan.drawingRef, dimensionIntentId: request.dimensionIntentId, status: 'resolved',
        result: withToleranceMagnitude(this.provider.resolveBand({
          basicSize, featureClass: request.featureClass, designation: request.designation,
        })),
      };
    }
    if (request.type === 'mating-fit') {
      const intent = requireEligibleIntent(plan, request.dimensionIntentId, request.currentFeatureClass);
      const basicSize = requireProviderBasicSize(intent);
      const designation = request.currentFeatureClass === 'external'
        ? `${request.matingDesignation}/${request.currentDesignation}`
        : `${request.currentDesignation}/${request.matingDesignation}`;
      return {
        type: 'mating-fit', drawingRef: plan.drawingRef,
        dimensionIntentId: request.dimensionIntentId,
        currentFeatureClass: request.currentFeatureClass,
        status: 'resolved',
        result: withFitToleranceMagnitudes(this.provider.resolveFit({
          basicSize,
          basis: request.currentFeatureClass === 'external' ? 'hole' : 'shaft',
          designation,
        })),
      };
    }
    const { holeDimensionIntentId, shaftDimensionIntentId } = requireFitRoles(request);
    requireEligibleIntent(plan, request.primaryDimensionIntentId, request.primaryFeatureClass);
    requireEligibleIntent(plan, request.secondaryDimensionIntentId, request.secondaryFeatureClass);
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
      const basicSize = requireProviderBasicSize(requireEligibleIntent(plan, command.dimensionIntentId, command.featureClass));
      const result = this.provider.resolveBand({ basicSize, featureClass: command.featureClass, designation: command.designation });
      verifyProviderResult(result, {
        basicSize, featureClass: command.featureClass, designation: command.designation,
      }, this.provider);
      if (result.ruleRef.inputDigest !== command.expectedInputDigest) throw new Error('TOLERANCE_TARGET_STALE');
      resolved = result;
    } else if (command.type === 'standard.fit.apply') {
      const [holeDesignation, shaftDesignation] = command.designation.split('/');
      if (!holeDesignation || !shaftDesignation) throw new Error('TOLERANCE_PROVIDER_RESULT_MISMATCH');
      const holeBasicSize = requireProviderBasicSize(requireEligibleIntent(plan, command.holeDimensionIntentId, 'internal'));
      const shaftBasicSize = requireProviderBasicSize(requireEligibleIntent(plan, command.shaftDimensionIntentId, 'external'));
      if (command.expectedHoleInputDigest !== expectedProviderInputDigest(
        this.provider, holeBasicSize, 'internal', holeDesignation,
      ) || command.expectedShaftInputDigest !== expectedProviderInputDigest(
        this.provider, shaftBasicSize, 'external', shaftDesignation,
      )) throw new Error('TOLERANCE_TARGET_STALE');
      if (command.holeDimensionIntentId === command.shaftDimensionIntentId) throw new Error('TOLERANCE_FIT_INTENTS_DISTINCT');
      if (holeBasicSize !== shaftBasicSize) throw new Error('FIT_PAIR_BASIC_SIZE_MISMATCH');
      const result = this.provider.resolveFit({
        basicSize: holeBasicSize, basis: command.basis, designation: command.designation,
      });
      if (result.designation !== command.designation || result.basis !== command.basis
        || !holeDesignation || !shaftDesignation) throw new Error('TOLERANCE_PROVIDER_RESULT_MISMATCH');
      verifyProviderResult(result.hole, {
        basicSize: holeBasicSize, featureClass: 'internal', designation: holeDesignation,
      }, this.provider);
      verifyProviderResult(result.shaft, {
        basicSize: shaftBasicSize, featureClass: 'external', designation: shaftDesignation,
      }, this.provider);
      if (result.hole.ruleRef.inputDigest !== command.expectedHoleInputDigest
        || result.shaft.ruleRef.inputDigest !== command.expectedShaftInputDigest) throw new Error('TOLERANCE_TARGET_STALE');
      resolved = result;
    } else if (command.type === 'standard.mating-fit.apply') {
      const basicSize = requireProviderBasicSize(requireEligibleIntent(
        plan, command.dimensionIntentId, command.currentFeatureClass,
      ));
      const matingFeatureClass = command.currentFeatureClass === 'external' ? 'internal' : 'external';
      const designation = command.currentFeatureClass === 'external'
        ? `${command.matingDesignation}/${command.currentDesignation}`
        : `${command.currentDesignation}/${command.matingDesignation}`;
      const result = this.provider.resolveFit({
        basicSize,
        basis: command.currentFeatureClass === 'external' ? 'hole' : 'shaft',
        designation,
      });
      const current = command.currentFeatureClass === 'external' ? result.shaft : result.hole;
      const mating = command.currentFeatureClass === 'external' ? result.hole : result.shaft;
      verifyProviderResult(current, {
        basicSize, featureClass: command.currentFeatureClass, designation: command.currentDesignation,
      }, this.provider);
      verifyProviderResult(mating, {
        basicSize, featureClass: matingFeatureClass, designation: command.matingDesignation,
      }, this.provider);
      if (current.ruleRef.inputDigest !== command.expectedCurrentInputDigest
        || mating.ruleRef.inputDigest !== command.expectedMatingInputDigest) {
        throw new Error('TOLERANCE_TARGET_STALE');
      }
      resolved = result;
    }
    return this.plans.editTolerance(sessionId, command, resolved);
  }
}

function buildRecommendations(
  provider: ToleranceStandardProvider,
  basicSize: number,
  featureClass: 'internal' | 'external',
  bands: ReturnType<ToleranceStandardProvider['listBands']>,
  aiRecommendation: { designation: string; source: 'ai-recommended'; evidenceRefs: string[] } | undefined,
): NonNullable<ToleranceCatalogResult['recommendations']> {
  const ordered = [
    ...(aiRecommendation === undefined ? [] : [aiRecommendation.designation]),
    ...bands
      .filter(({ available, category }) => available && (category === 'preferred' || category === 'common'))
      .map(({ designation }) => designation),
  ];
  return [...new Set(ordered)].slice(0, 12).map((designation) => {
    const band = bands.find((candidate) => candidate.designation === designation);
    if (band === undefined || !band.available || band.category === 'unknown') {
      throw new Error('TOLERANCE_STANDARD_UNAVAILABLE');
    }
    const fromAi = aiRecommendation?.designation === designation;
    return {
      designation,
      category: band.category,
      source: fromAi ? 'ai-recommended' as const : 'standard-selection' as const,
      evidenceRefs: fromAi ? [...aiRecommendation.evidenceRefs] : [],
      result: withToleranceMagnitude(provider.resolveBand({ basicSize, featureClass, designation })),
    };
  });
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
    const changed = members.some((spec) => spec.inputs.basicSize !== requireProviderBasicSize(
      spec.dimensionIntentId === hole.id ? hole : shaft,
    ));
    if (!changed) continue;
    handled.add(identity.fitGroupId);
    const holeBasicSize = requireProviderBasicSize(hole);
    const shaftBasicSize = requireProviderBasicSize(shaft);
    if (holeBasicSize !== shaftBasicSize) {
      next = staleFit(next, identity, 'FIT_PAIR_BASIC_SIZE_MISMATCH');
      continue;
    }
    try {
      const result = provider.resolveFit({
        basicSize: holeBasicSize, basis: identity.basis, designation: identity.designation,
      });
      const [holeDesignation, shaftDesignation] = identity.designation.split('/');
      if (result.designation !== identity.designation || result.basis !== identity.basis
        || !holeDesignation || !shaftDesignation) throw new Error('TOLERANCE_PROVIDER_RESULT_MISMATCH');
      verifyProviderResult(result.hole, {
        basicSize: holeBasicSize, featureClass: 'internal', designation: holeDesignation,
      }, provider);
      verifyProviderResult(result.shaft, {
        basicSize: shaftBasicSize, featureClass: 'external', designation: shaftDesignation,
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
    if (!intent) continue;
    const basicSize = requireProviderBasicSize(intent);
    if (original.inputs.basicSize === basicSize) continue;
    try {
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
        ? staleSpec(spec, basicSize, errorCode(error))
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
      const intent = intents.get(spec.dimensionIntentId);
      const stale = staleSpec(spec, intent === undefined ? undefined : providerBasicSizeOrUndefined(intent), code);
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

function activeFitHydration(plan: AnnotationPlan, member: ToleranceSpec) {
  if (member.fitGroupId === undefined) return undefined;
  const assignment = plan.fitAssignments.find(({ fitGroupId }) => fitGroupId === member.fitGroupId);
  if (assignment === undefined
    || (member.dimensionIntentId !== assignment.holeDimensionId && member.dimensionIntentId !== assignment.shaftDimensionId)) {
    return undefined;
  }
  const hole = plan.tolerances.find((spec) => spec.fitGroupId === assignment.fitGroupId
    && spec.dimensionIntentId === assignment.holeDimensionId);
  const shaft = plan.tolerances.find((spec) => spec.fitGroupId === assignment.fitGroupId
    && spec.dimensionIntentId === assignment.shaftDimensionId);
  const active = (spec: ToleranceSpec | undefined, featureClass: 'internal' | 'external') => spec !== undefined
    && spec.source === 'standard'
    && spec.featureClass === featureClass
    && (spec.status === 'resolved' || spec.status === 'confirmed');
  const holeDesignation = hole?.inputs.designation;
  const shaftDesignation = shaft?.inputs.designation;
  const holeIntent = plan.intents.find(({ id }) => id === assignment.holeDimensionId);
  const shaftIntent = plan.intents.find(({ id }) => id === assignment.shaftDimensionId);
  if (!active(hole, 'internal') || !active(shaft, 'external')
    || holeIntent === undefined || shaftIntent === undefined
    || typeof holeDesignation !== 'string' || typeof shaftDesignation !== 'string'
    || `${holeDesignation}/${shaftDesignation}` !== assignment.designation) return undefined;
  const effectiveMember = (
    spec: ToleranceSpec,
    intent: AnnotationPlan['intents'][number],
    featureClass: 'internal' | 'external',
    designation: string,
  ) => {
    const basicSize = requireProviderBasicSize(intent);
    const upperDeviation = spec.override?.upperDeviation ?? spec.resolved?.upperDeviation;
    const lowerDeviation = spec.override?.lowerDeviation ?? spec.resolved?.lowerDeviation;
    if (!Number.isFinite(upperDeviation) || !Number.isFinite(lowerDeviation)
      || lowerDeviation! > upperDeviation! || spec.standardRef === undefined
      || spec.ruleRef === undefined || spec.resolved === undefined) return undefined;
    return {
      designation,
      featureClass,
      basicSize,
      unit: 'mm' as const,
      upperDeviation: upperDeviation!,
      lowerDeviation: lowerDeviation!,
      toleranceMagnitude: upperDeviation! - lowerDeviation!,
      upperLimitSize: basicSize + upperDeviation!,
      lowerLimitSize: basicSize + lowerDeviation!,
      standardRef: { ...spec.standardRef },
      ruleRef: {
        ...spec.ruleRef,
        inputDigest: spec.resolved.inputDigest,
      },
    };
  };
  const effectiveHole = effectiveMember(hole!, holeIntent, 'internal', holeDesignation);
  const effectiveShaft = effectiveMember(shaft!, shaftIntent, 'external', shaftDesignation);
  if (effectiveHole === undefined || effectiveShaft === undefined) return undefined;
  return {
    fitGroupId: assignment.fitGroupId,
    basis: assignment.basis,
    designation: assignment.designation,
    holeDimensionIntentId: assignment.holeDimensionId,
    holeFeatureClass: 'internal' as const,
    holeDesignation,
    shaftDimensionIntentId: assignment.shaftDimensionId,
    shaftFeatureClass: 'external' as const,
    shaftDesignation,
    holeTarget: hydrationTarget(holeIntent, 'internal'),
    shaftTarget: hydrationTarget(shaftIntent, 'external'),
    ...(hole!.override === undefined ? {} : { holeOverride: { ...hole!.override } }),
    ...(shaft!.override === undefined ? {} : { shaftOverride: { ...shaft!.override } }),
    result: {
      designation: assignment.designation,
      basis: assignment.basis,
      hole: effectiveHole,
      shaft: effectiveShaft,
      fitType: assignment.fitType,
      minimumClearance: assignment.minimumClearance,
      maximumClearance: assignment.maximumClearance,
    },
  };
}

function hydrationTarget<FeatureClass extends 'internal' | 'external'>(
  intent: AnnotationPlan['intents'][number],
  featureClass: FeatureClass,
) {
  return {
    dimensionIntentId: intent.id,
    label: `${intent.kind === 'diameter' ? '⌀' : ''}${intent.nominalValue} ${intent.unit}`,
    basicSize: requireProviderBasicSize(intent),
    unit: 'mm' as const,
    featureClass,
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

function requireEligibleIntent(
  plan: AnnotationPlan,
  id: string,
  requestedFeatureClass: 'internal' | 'external',
): AnnotationPlan['intents'][number] {
  const intent = requireIntent(plan, id);
  const persistedClass = intent.featureClass ?? [...plan.tolerances].reverse().find((spec) => (
    spec.dimensionIntentId === id
    && spec.featureClass !== undefined
    && spec.source !== 'ai-candidate'
  ))?.featureClass;
  if (!['linear', 'aligned', 'diameter'].includes(intent.kind)) {
    throw new Error('TOLERANCE_FEATURE_UNSUPPORTED');
  }
  if (persistedClass !== undefined && persistedClass !== requestedFeatureClass) {
    throw new Error('TOLERANCE_FEATURE_CLASS_MISMATCH');
  }
  return intent;
}

function requireProviderBasicSize(intent: { unit: string; nominalValue: number }): number {
  if (!['mm', 'cm', 'm', 'in'].includes(intent.unit) || !Number.isFinite(intent.nominalValue)) {
    throw new Error('TOLERANCE_BASIC_SIZE_INVALID');
  }
  try {
    return canonicalMillimetres(intent.nominalValue, intent.unit as 'mm' | 'cm' | 'm' | 'in');
  } catch {
    throw new Error('TOLERANCE_BASIC_SIZE_INVALID');
  }
}

function providerBasicSizeOrUndefined(intent: { unit: string; nominalValue: number }): number | undefined {
  try {
    return requireProviderBasicSize(intent);
  } catch {
    return undefined;
  }
}

function requireEqualFitSize(plan: AnnotationPlan, holeId: string, shaftId: string): number {
  if (holeId === shaftId) throw new Error('TOLERANCE_FIT_INTENTS_DISTINCT');
  const hole = requireProviderBasicSize(requireIntent(plan, holeId));
  const shaft = requireProviderBasicSize(requireIntent(plan, shaftId));
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
    && (command.type === 'standard.single.apply'
      ? spec.featureClass === command.featureClass
      : (spec.dimensionIntentId === command.holeDimensionIntentId && spec.featureClass === 'internal')
        || (spec.dimensionIntentId === command.shaftDimensionIntentId && spec.featureClass === 'external'))
    && sameStrings(spec.selection.evidenceRefs, command.evidenceRefs));
  if (!match && !matchesPersistedAiSelection(plan, command)) {
    throw new Error('TOLERANCE_AI_RECOMMENDATION_REQUIRED');
  }
}

function matchesPersistedAiSelection(
  plan: AnnotationPlan,
  command: Extract<ToleranceEditCommand, { type: 'standard.single.apply' | 'standard.fit.apply' }>,
): boolean {
  if (command.type === 'standard.single.apply') {
    const spec = [...plan.tolerances].reverse().find((candidate) => (
      candidate.dimensionIntentId === command.dimensionIntentId
      && candidate.fitGroupId === undefined
    ));
    return spec !== undefined
      && activePersistedAiSpec(spec, command.designation, command.evidenceRefs)
      && spec.featureClass === command.featureClass
      && spec.inputs.designation === command.designation
      && spec.inputs.featureClass === command.featureClass;
  }
  const assignment = plan.fitAssignments.find((candidate) => (
    candidate.holeDimensionId === command.holeDimensionIntentId
    && candidate.shaftDimensionId === command.shaftDimensionIntentId
    && candidate.basis === command.basis
    && candidate.designation === command.designation
  ));
  if (assignment === undefined) return false;
  const members = plan.tolerances.filter(({ fitGroupId }) => fitGroupId === assignment.fitGroupId);
  const hole = members.find(({ dimensionIntentId }) => dimensionIntentId === assignment.holeDimensionId);
  const shaft = members.find(({ dimensionIntentId }) => dimensionIntentId === assignment.shaftDimensionId);
  const [holeDesignation, shaftDesignation] = command.designation.split('/');
  return members.length === 2
    && hole !== undefined
    && shaft !== undefined
    && holeDesignation !== undefined
    && shaftDesignation !== undefined
    && activePersistedAiSpec(hole, command.designation, command.evidenceRefs)
    && activePersistedAiSpec(shaft, command.designation, command.evidenceRefs)
    && hole.featureClass === 'internal'
    && shaft.featureClass === 'external'
    && hole.inputs.designation === holeDesignation
    && shaft.inputs.designation === shaftDesignation
    && hole.standardRef?.id === assignment.standardRef.id
    && hole.standardRef.edition === assignment.standardRef.edition
    && shaft.standardRef?.id === assignment.standardRef.id
    && shaft.standardRef.edition === assignment.standardRef.edition;
}

function activePersistedAiSpec(
  spec: ToleranceSpec,
  designation: string,
  evidenceRefs: readonly string[],
): boolean {
  return spec.source === 'standard'
    && (spec.status === 'resolved' || spec.status === 'confirmed')
    && spec.selection?.source === 'ai-recommended'
    && spec.selection.designation === designation
    && spec.selection.evidenceRefs.length > 0
    && spec.selection.evidenceRefs.every((reference) => spec.evidenceIds.includes(reference))
    && sameStrings(spec.selection.evidenceRefs, evidenceRefs);
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

function expectedProviderInputDigest(
  provider: ToleranceStandardProvider,
  basicSize: number,
  featureClass: 'internal' | 'external',
  designation: string,
): string {
  return canonicalRuleInputDigest({
    nominalValue: basicSize,
    unit: 'mm',
    inputs: {
      standardId: provider.standardRef.id,
      edition: provider.standardRef.edition,
      featureClass,
      designation,
    },
  });
}

function errorCode(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : 'TOLERANCE_STANDARD_UNAVAILABLE';
}

function sameRef(first: DrawingRef, second: DrawingRef): boolean {
  return first.drawingId === second.drawingId && first.revision === second.revision;
}
