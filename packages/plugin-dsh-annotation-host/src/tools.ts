// SPDX-License-Identifier: Apache-2.0

import { defineTool } from '@deepseek-ai/dsh-tools';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
import type { Agent } from '@deepseek-ai/dsh-agent';
import {
  DEFAULT_AUTOMATIC_ANNOTATION_KINDS,
  planEngineeringAnnotations,
  type AxialInferencePolicy,
  type DeterministicAnnotationKind,
} from '@vectorai/engineering-annotation';
import type {
  DrawingExtensionProgramWorkflow,
  DrawingSpaceExtensionHost,
  PartitionSessionSnapshot,
  DimensionPlanSessionSnapshot,
} from '@vectorai/plugin-space-contracts';
import type { AnnotationSessionStateStore, AnnotationWorkflowStage } from './session-state';
import type { PartitionSessionStore } from './partition-store';
import type { GdtRecommendation } from './gdt-grounding';

export function createEngineeringAnnotationTool(
  host: Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot' | 'runExtensionProgram'>,
  sessions: AnnotationSessionStateStore,
  partitions?: Pick<PartitionSessionStore, 'get' | 'advanceDrawingRevision'>,
  dimensionPlans?: Pick<import('./dimension-plan-store').DimensionPlanStore, 'get' | 'markNeedsRebase'>,
  options: {
    name: string;
    description: string;
    annotationKinds: readonly DeterministicAnnotationKind[];
    objective: string;
    afterAnnotations?: (
      agent: Agent,
      signal: AbortSignal | undefined,
      reportStage: (stage: AnnotationWorkflowStage) => void,
    ) => DimensionPlanSessionSnapshot | Promise<DimensionPlanSessionSnapshot>;
    requiresGdtRecommendation?: boolean;
  } = {
    name: 'drawing_auto_annotate',
    description: 'AUTHORITATIVE ROUTE for generic automatic or complete engineering annotation. Call it directly without drawing_observe or individual annotation tools. The registered set runs as one host-owned workflow.',
    annotationKinds: DEFAULT_AUTOMATIC_ANNOTATION_KINDS,
    objective: '工程图纸自动标注集',
  },
) {
  return defineTool({
    name: options.name,
    description: options.description,
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const sessionId = String(agent.id);
      const partition = partitions?.get(sessionId);
      if (partition?.phase === 'analyzing') {
        throw new Error('PARTITION_ANALYSIS_ACTIVE: wait until the editable partition draft is ready before opening-angle annotation');
      }
      const snapshot = host.getSnapshot(agent);
      if (!snapshot) throw new Error('DRAWING_REQUIRED');
      const workflowId = `annotation_${sessionId}_${Date.now()}`;
      sessions.start(sessionId, workflowId, 'deterministic');
      try {
        const plan = planEngineeringAnnotations({
          document: snapshot.document,
          ref: snapshot.ref,
          objective: options.objective,
          annotationKinds: options.annotationKinds,
        });
        let status = 'no-effect';
        let result: DrawingExtensionProgramWorkflow['result'] | undefined;
        if (plan.program) {
          const workflow = await host.runExtensionProgram(agent, {
            targetNodeIds: plan.targetNodeIds,
            program: plan.program,
          }, exec.signal);
          status = workflow.result.status;
          result = workflow.result;
          if (workflow.result.status === 'committed'
            && partition?.drawingRef?.drawingId === snapshot.ref.drawingId
            && partition.drawingRef.revision === snapshot.ref.revision) {
            partitions?.advanceDrawingRevision(sessionId, snapshot.ref, workflow.result.ref);
            if (dimensionPlans?.get(sessionId).draft?.axialScheme) {
              dimensionPlans.markNeedsRebase(sessionId, workflow.result.ref);
            }
          }
          if (workflow.result.status !== 'committed' && workflow.result.status !== 'already-satisfied') {
            sessions.finish(sessionId, terminalStatus(workflow.result.status));
            return {
              status,
              annotations: plan.annotations.map(({ id }) => id),
              pending: plan.pending,
              suppressed: plan.suppressed,
              result,
            } as unknown as JsonValue;
          }
        }
        const followup = await options.afterAnnotations?.(
          agent,
          exec.signal,
          (stage) => sessions.advance(sessionId, stage),
        );
        if (followup?.phase === 'editing') sessions.advance(sessionId, 'review', 'reviewing');
        else sessions.finish(sessionId, 'completed');
        const dimensionDraft = followup?.draft;
        const datumCount = dimensionDraft?.datums.length ?? 0;
        const gdtCount = dimensionDraft?.geometricTolerances.length ?? 0;
        const gdtCoverageComplete = dimensionDraft?.diagnostics.some(({ code }) => code === 'GDT_COVERAGE_COMPLETE') === true;
        const gdtNeedsUserInput = dimensionDraft?.diagnostics.some(({ code }) => code === 'GDT_USER_INPUT_REQUIRED') === true;
        const clarificationQuestions = dimensionDraft?.diagnostics
          .filter(({ code }) => code === 'GDT_FEATURE_CONFIDENCE_LOW' || code === 'GDT_AXIS_SUPPORT_PAIR_REQUIRED')
          .map(({ message }) => message) ?? [];
        const automaticSetReady = options.requiresGdtRecommendation !== true
          || dimensionDraft?.axialScheme !== undefined && datumCount > 0 && gdtCount > 0 && gdtCoverageComplete;
        const awaitingGdt = options.requiresGdtRecommendation === true && !automaticSetReady;
        return {
          status: gdtNeedsUserInput ? 'needs-user-input' : awaitingGdt ? 'awaiting-gdt-recommendation' : status,
          ...(awaitingGdt ? { deterministicStatus: status } : {}),
          annotations: plan.annotations.map(({ id }) => id),
          pending: plan.pending,
          suppressed: plan.suppressed,
          ...(result === undefined ? {} : { result }),
          ...(followup === undefined ? {} : {
            annotationSet: {
              deterministicKinds: [...options.annotationKinds],
              dimensionChainStatus: followup.phase,
              displayedDimensionCount: followup.draft?.axialScheme?.displayedCandidateIds.length ?? 0,
              closureCount: followup.draft?.axialScheme?.closureCandidateIds.length ?? 0,
              datumCount,
              geometricToleranceCount: gdtCount,
              ...(gdtNeedsUserInput ? {
                gdtStatus: 'needs-user-input',
                completionStatus: 'needs-user-input',
                completionClaimAllowed: false,
                clarificationQuestions,
                nextAction: 'ask-user-for-gdt-clarification',
              } : awaitingGdt ? {
                gdtStatus: 'required',
                completionStatus: 'incomplete',
                completionClaimAllowed: false,
                requiredNextTools: ['drawing_query', 'drawing_gdt_start'],
                nextAction: 'inspect-grounded-geometry-and-call-drawing_gdt_start',
              } : options.requiresGdtRecommendation === true ? {
                gdtStatus: followup.phase,
                completionStatus: 'preview-ready',
                completionClaimAllowed: true,
                nextAction: 'review-complete-automatic-annotation-preview',
              } : { nextAction: 'preview-or-confirm' }),
            },
          }),
        } as unknown as JsonValue;
      } catch (error) {
        sessions.finish(sessionId, 'failed', error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
  });
}

export function createOpeningAngleAnnotationTool(
  host: Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot' | 'runExtensionProgram'>,
  sessions: AnnotationSessionStateStore,
  partitions?: Pick<PartitionSessionStore, 'get' | 'advanceDrawingRevision'>,
  dimensionPlans?: Pick<import('./dimension-plan-store').DimensionPlanStore, 'get' | 'markNeedsRebase'>,
) {
  return createEngineeringAnnotationTool(host, sessions, partitions, dimensionPlans, {
    name: 'drawing_opening_angle_annotate',
    description: 'Create only deterministic axial opening-angle dimensions when the user explicitly asks for opening-angle annotation. This tool never creates diameters, radii, tolerances, GD&T, or dimension chains.',
    annotationKinds: ['opening-angle'],
    objective: '工程图纸开角标注',
  });
}

export function createDiameterAnnotationTool(
  host: Pick<DrawingSpaceExtensionHost<Agent>, 'getSnapshot' | 'runExtensionProgram'>,
  sessions: AnnotationSessionStateStore,
  partitions?: Pick<PartitionSessionStore, 'get' | 'advanceDrawingRevision'>,
  dimensionPlans?: Pick<import('./dimension-plan-store').DimensionPlanStore, 'get' | 'markNeedsRebase'>,
) {
  return createEngineeringAnnotationTool(host, sessions, partitions, dimensionPlans, {
    name: 'drawing_diameter_annotate',
    description: 'Create only deterministic simple shaft-diameter dimensions when the user explicitly asks to mark diameters or shaft diameters. Local geometry pairs opposite cylindrical profile edges and calculates every diameter. This tool never creates opening angles, radii, tolerances, GD&T, or dimension chains.',
    annotationKinds: ['diameter'],
    objective: '工程图纸直径标注',
  });
}

export function createPartitionStatusTool(
  partitions: Pick<PartitionSessionStore, 'get'>,
) {
  return defineTool({
    name: 'drawing_partition_status',
    description: 'Inspect the dedicated smart shaft-partition workflow after an explicit engineering DXF import. Use this for requests about partitioning or axis segments; do not create partition lines with generic drawing edit tools. Partition boundaries are calculated locally and edited in the engineering workspace.',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const snapshot = partitions.get(String(agent.id));
      return {
        phase: snapshot.phase,
        ...(snapshot.drawingRef === undefined ? {} : { drawingRef: snapshot.drawingRef }),
        segmentCount: snapshot.draft?.segments.length ?? snapshot.confirmed?.segments.length ?? 0,
        diagnostics: (snapshot.draft?.diagnostics ?? snapshot.confirmed?.diagnostics ?? []).map(({ code }) => code),
        nextAction: snapshot.phase === 'analyzing'
          ? 'wait-for-analysis'
          : snapshot.phase === 'editing'
            ? 'review-or-edit-partition-and-continue-opening-angle-annotation-without-confirming'
            : snapshot.phase === 'confirmed'
              ? 'ready-for-opening-angle-annotation'
              : snapshot.drawingRef === undefined
                ? 'import-engineering-dxf'
                : 'wait-for-explicit-partition-request',
      } as unknown as JsonValue;
    },
  });
}

export function createPartitionStartTool(workflow: {
  start(agent: Agent, engineeringContext: string | undefined, signal?: AbortSignal): Promise<PartitionSessionSnapshot>;
}) {
  return defineTool({
    name: 'drawing_partition_start',
    description: 'Start or refresh smart shaft partitioning for the active DXF only when the user explicitly asks to partition, segment, or identify functional shaft regions. Uploading a document alone is never intent. Documents staged by the VectorAI file bridge are consumed automatically; engineeringContext is only for concise partition evidence stated directly in the user message. Local geometry computes and snaps every boundary.',
    parameters: {
      engineeringContext: { type: 'string', description: 'Optional concise, verbatim partition-related evidence from the user-provided document. Omit when none is relevant.' },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      const agent = exec.agent;
      if (!agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const engineeringContext = typeof args.engineeringContext === 'string' ? args.engineeringContext.trim() : undefined;
      if (Buffer.byteLength(engineeringContext ?? '', 'utf8') > 32 * 1024) throw new Error('PARTITION_CONTEXT_SIZE_LIMIT');
      const snapshot = await workflow.start(agent, engineeringContext || undefined, exec.signal);
      return {
        status: snapshot.phase,
        segmentCount: snapshot.draft?.segments.length ?? snapshot.confirmed?.segments.length ?? 0,
        semanticGroupCount: snapshot.draft?.semanticGroups.length ?? snapshot.confirmed?.semanticGroups.length ?? 0,
        diagnostics: (snapshot.draft?.diagnostics ?? snapshot.confirmed?.diagnostics ?? []).map(({ code }) => code),
        nextAction: snapshot.phase === 'editing'
          ? 'review-or-edit-partition-and-continue-opening-angle-annotation-without-confirming'
          : snapshot.phase,
      } as unknown as JsonValue;
    },
  });
}

export function createDimensionChainStartTool(workflow: {
  start(agent: Agent, policyId?: AxialInferencePolicy['id']): DimensionPlanSessionSnapshot;
}) {
  return defineTool({
    name: 'drawing_dimension_chain_start',
    description: 'Start axial nominal dimension-chain inference only when the user explicitly asks for a dimension chain or a dimensioning workflow that requires one. Never call this merely because a DXF or engineering document was uploaded. Local geometry owns all coordinates, nominal values, and arithmetic.',
    parameters: {
      policy: {
        type: 'string',
        enum: ['shaft-hierarchical-dimensioning-v1'],
        description: 'Optional evidence-weighted hierarchical drafting policy. Omit it to use this default.',
      },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      if (!exec.agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const policy = 'shaft-hierarchical-dimensioning-v1';
      const snapshot = workflow.start(exec.agent, policy);
      return {
        status: snapshot.phase,
        schemeStatus: snapshot.draft?.axialScheme?.status,
        displayedDimensionCount: snapshot.draft?.axialScheme?.displayedCandidateIds.length ?? 0,
        closureCount: snapshot.draft?.axialScheme?.closureCandidateIds.length ?? 0,
        diagnostics: snapshot.draft?.axialScheme?.diagnostics.map(({ code }) => code) ?? [],
        nextAction: snapshot.draft?.axialScheme?.status === 'resolved' ? 'preview-or-confirm' : 'review-dimension-chain',
      } as unknown as JsonValue;
    },
  });
}

export function createGdtStartTool(workflow: {
  start(agent: Agent, recommendation: GdtRecommendation): DimensionPlanSessionSnapshot;
}) {
  return defineTool({
    name: 'drawing_gdt_start',
    description: 'Start datum and GD&T preview only when the user explicitly requests datum or geometric-tolerance annotation as a standalone task. NEVER call this tool for a generic automatic/complete annotation request; drawing_auto_annotate owns and executes that full workflow internally. For a standalone request, use drawing_query stable node IDs only—never drawing_observe cN candidate keys. Recommend identities and characteristic types only; never coordinates or tolerance values.',
    parameters: {
      datums: {
        type: 'array',
        required: true,
        description: 'Recommended datum features grounded to geometry IDs.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true }, geometryId: { type: 'string', required: true },
            role: { type: 'string', enum: ['primary', 'secondary', 'tertiary', 'origin'], required: true },
          },
        },
      },
      controls: {
        type: 'array',
        required: true,
        description: 'Recommended controlled features and GD&T characteristic identities.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            characteristic: { type: 'string', enum: ['straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface', 'parallelism', 'perpendicularity', 'angularity', 'position', 'coaxiality', 'symmetry', 'circular-runout', 'total-runout'], required: true },
            geometryIds: { type: 'array', items: { type: 'string' }, required: true },
            datumNames: { type: 'array', items: { type: 'string' }, required: true },
            toleranceZoneShape: { type: 'string', enum: ['linear', 'diametrical', 'spherical'], required: true },
            materialCondition: { type: 'string', enum: ['rfs', 'mmc', 'lmc'] },
          },
        },
      },
    },
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      if (!exec.agent) throw new Error('DRAWING_SESSION_REQUIRED');
      const snapshot = workflow.start(exec.agent, args as unknown as GdtRecommendation);
      const draft = snapshot.draft;
      const datumCount = draft?.datums.length ?? 0;
      const controlCount = draft?.geometricTolerances.length ?? 0;
      const dimensionChainAvailable = draft?.axialScheme !== undefined;
      const gdtCoverageComplete = draft?.diagnostics.some(({ code }) => code === 'GDT_COVERAGE_COMPLETE') === true;
      const automaticSetReady = dimensionChainAvailable && datumCount > 0 && controlCount > 0 && gdtCoverageComplete;
      return {
        status: snapshot.phase,
        datumCount,
        controlCount,
        pendingCalculationCount: draft?.geometricTolerances.filter(({ computed }) => computed.status === 'pending').length ?? 0,
        diagnostics: draft?.diagnostics.map(({ code }) => code) ?? [],
        nextAction: 'review-gdt-preview',
        annotationSet: {
          completionStatus: automaticSetReady ? 'preview-ready' : 'incomplete',
          completionClaimAllowed: automaticSetReady,
          dimensionChainStatus: dimensionChainAvailable ? snapshot.phase : 'missing',
          gdtStatus: datumCount > 0 && controlCount > 0 ? snapshot.phase : 'incomplete',
          nextAction: automaticSetReady ? 'review-complete-automatic-annotation-preview' : 'complete-missing-annotation-stages',
        },
      } as unknown as JsonValue;
    },
  });
}

function terminalStatus(
  status: DrawingExtensionProgramWorkflow['result']['status'],
): 'completed' | 'canceled' | 'failed' | 'needs-rebase' {
  if (status === 'committed' || status === 'already-satisfied') return 'completed';
  if (status === 'discarded') return 'canceled';
  if (status === 'needs-rebase') return 'needs-rebase';
  return 'failed';
}
