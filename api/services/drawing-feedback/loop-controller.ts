import type {
  DrawingCommand,
  DrawingDocument,
  DrawingId,
  PerceptionPreviewNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import { parseDrawingToolCommands } from '../../../src/contracts/drawing-agent.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import {
  selectDrawingFeedbackModel,
  type DrawingFeedbackEscalationReason,
} from '../drawing-agent/model-adapters.js';
import type { DrawingToolRegistry } from '../drawing-agent/tool-registry.js';
import type {
  DrawingAgentModelProfile,
  DrawingToolExecution,
} from '../drawing-agent/types.js';
import type {
  CvToolExecution,
  DrawingCvToolRegistry,
} from '../drawing-cv/tool-registry.js';
import type { CvEvidenceSummary, CvPrimitiveType } from '../drawing-cv/types.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';
import type { RegionResidualReport } from './residual-comparator.js';
import type { MemoryObservationRegionStore } from './region-store.js';
import type { MemoryObservationSlotStore } from './slot-store.js';
import type {
  FeedbackAgentDecision,
  FeedbackDecisionInput,
  SlotLineageAction,
} from './types.js';
import { DrawingFeedbackProtocolError } from './model-adapter.js';
import { projectFeedbackTransactionPreview } from './preview-projector.js';
import { buildVectorizationSteps } from '../drawing-vectorization/build-steps.js';
import type { CleanLineVectorizationService } from '../drawing-vectorization/service.js';
import {
  buildAutomaticAnnotationSteps,
  withoutAutomaticAnnotations,
} from '../drawing-annotation/build-steps.js';

interface FeedbackApplication {
  open: DrawingApplication['open'];
  summarize: DrawingApplication['summarize'];
}

interface FeedbackDrawingTools {
  invoke: DrawingToolRegistry['invoke'];
  discardPrepared: DrawingToolRegistry['discardPrepared'];
}

interface FeedbackModel {
  decide(input: FeedbackDecisionInput): Promise<FeedbackAgentDecision>;
}

export interface DrawingFeedbackCheckpoint {
  schemaVersion: 1;
  runId: string;
  sourceId: string;
  revision: RevisionId;
  iteration: number;
  recentReceipts: unknown[];
  requestedCrops?: FeedbackDecisionInput['requestedCrops'];
  controllerFeedback?: string;
  residual: RegionResidualReport;
  unresolvedRequired: number;
  nonImprovingBySlot: Record<string, number>;
  vectorizationCompletedStepIds?: string[];
}

export interface DrawingFeedbackRunInput {
  runId: string;
  sourceId: string;
  drawingId: DrawingId;
  revision: RevisionId;
  goal: string;
  modelProfile: DrawingAgentModelProfile;
  signal: AbortSignal;
  checkpoint?: DrawingFeedbackCheckpoint;
  shouldPause?: () => boolean;
  readInstructions?: () => string[];
}

export type DrawingFeedbackOutput =
  | { kind: 'state'; stage: FeedbackStage; iteration: number }
  | { kind: 'audit'; type: 'state' | 'validation'; payload: Record<string, unknown> }
  | { kind: 'decision'; decision: Record<string, unknown> }
  | { kind: 'controller_feedback'; message: string }
  | { kind: 'protocol_retry'; attempt: number; maxAttempts: number; message: string }
  | { kind: 'tool'; execution: CvToolExecution }
  | { kind: 'drawing_tool'; execution: DrawingToolExecution }
  | {
      kind: 'inventory';
      regionId?: string;
      slotIds: string[];
      candidateCount: number;
    }
  | {
      kind: 'proposal';
      slotId: string;
      slotIds?: string[];
      regionId?: string;
      nodes: PerceptionPreviewNode[];
      labelsByNodeId: Record<string, string>;
    }
  | { kind: 'residual'; report: RegionResidualReport; accepted: boolean }
  | {
      kind: 'commit';
      commitId?: string;
      revision: RevisionId;
      slotIds: string[];
      execution: DrawingToolExecution;
    }
  | { kind: 'correction'; action: SlotLineageAction; slotIds: string[] }
  | { kind: 'checkpoint'; checkpoint: DrawingFeedbackCheckpoint }
  | { kind: 'paused'; checkpoint: DrawingFeedbackCheckpoint }
  | { kind: 'slot_paused'; slotId: string; reason: 'non_improving' }
  | { kind: 'completed'; revision: RevisionId; unresolvedRequired: 0; summary: string }
  | { kind: 'stopped'; revision: RevisionId }
  | { kind: 'failed'; code: string; message: string };

export type FeedbackStage =
  | 'OBSERVE'
  | 'VECTORIZE_SOURCE'
  | 'COMMIT_VECTOR_BATCH'
  | 'ANNOTATE_GEOMETRY'
  | 'SELECT_TARGET'
  | 'ACQUIRE_EVIDENCE'
  | 'PROPOSE_PATCH'
  | 'PREVIEW_AND_RENDER'
  | 'COMPARE'
  | 'COMMIT_LOCAL_RESULT';

export class DrawingFeedbackLoop {
  readonly #application: FeedbackApplication;
  readonly #drawingTools: FeedbackDrawingTools;
  readonly #cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
  readonly #model: FeedbackModel;
  readonly #regions: Pick<MemoryObservationRegionStore, 'list'>;
  readonly #slots: Pick<MemoryObservationSlotStore, 'list' | 'observe' | 'recordDrawingChange'>;
  readonly #compare: (
    document: DrawingDocument,
    previous?: RegionResidualReport['geometry'],
    context?: { sourceId: string; region?: SourcePixelRect },
  ) => Promise<RegionResidualReport>;
  readonly #maxIterations: number;
  readonly #now: () => number;
  readonly #audit?: (event: { type: string; payload: Record<string, unknown> }) => Promise<void> | void;
  readonly #vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;

  constructor(input: {
    application: FeedbackApplication;
    drawingTools: FeedbackDrawingTools;
    cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>;
    model: FeedbackModel;
    regions: Pick<MemoryObservationRegionStore, 'list'>;
    slots: Pick<MemoryObservationSlotStore, 'list' | 'observe' | 'recordDrawingChange'>;
    compare: (
      document: DrawingDocument,
      previous?: RegionResidualReport['geometry'],
      context?: { sourceId: string; region?: SourcePixelRect },
    ) => Promise<RegionResidualReport>;
    maxIterations?: number;
    now?: () => number;
    audit?: (event: { type: string; payload: Record<string, unknown> }) => Promise<void> | void;
    vectorization?: Pick<CleanLineVectorizationService, 'vectorizeSource'>;
  }) {
    this.#application = input.application;
    this.#drawingTools = input.drawingTools;
    this.#cvTools = input.cvTools;
    this.#model = input.model;
    this.#regions = input.regions;
    this.#slots = input.slots;
    this.#compare = input.compare;
    this.#maxIterations = input.maxIterations ?? 40;
    this.#now = input.now ?? Date.now;
    this.#audit = input.audit;
    this.#vectorization = input.vectorization;
  }

  async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
    let revision = input.checkpoint?.revision ?? input.revision;
    let iteration = input.checkpoint?.iteration ?? 0;
    let recentReceipts = [...(input.checkpoint?.recentReceipts ?? [])];
    let requestedCrops = [...(input.checkpoint?.requestedCrops ?? [])];
    let controllerFeedback = input.checkpoint?.controllerFeedback;
    const nonImprovingBySlot = { ...(input.checkpoint?.nonImprovingBySlot ?? {}) };
    let vectorizationCompletedStepIds = [
      ...(input.checkpoint?.vectorizationCompletedStepIds ?? []),
    ];
    let residual: RegionResidualReport;
    let unresolvedRequired: number;
    if (input.checkpoint) {
      assertCheckpoint(input.checkpoint, input);
      residual = structuredClone(input.checkpoint.residual);
      unresolvedRequired = input.checkpoint.unresolvedRequired;
    } else {
      const workspace = await this.#application.open(input.drawingId);
      revision = workspace.revision;
      residual = await this.#compareSource(workspace.document, undefined, { sourceId: input.sourceId });
      unresolvedRequired = requiredResidualCount(residual);
      yield { kind: 'state', stage: 'OBSERVE', iteration };
      yield { kind: 'residual', report: structuredClone(residual), accepted: true };
    }

    if (this.#vectorization) {
      const workspace = await this.#application.open(input.drawingId);
      const vectorDrawing = workspace.document.geometry.every((node) => node.id.startsWith('node_vec_'));
      if (workspace.document.geometry.length === 0
        || vectorDrawing || vectorizationCompletedStepIds.length > 0) {
        const bootstrapped = yield* this.#bootstrapVectorization({
          input,
          revision,
          iteration,
          recentReceipts,
          requestedCrops,
          controllerFeedback,
          nonImprovingBySlot,
          residual,
          unresolvedRequired,
          completedStepIds: vectorizationCompletedStepIds,
        });
        revision = bootstrapped.revision;
        vectorizationCompletedStepIds = bootstrapped.completedStepIds;
        if (bootstrapped.terminal) return;
        const updated = await this.#application.open(input.drawingId);
        residual = await this.#compareSource(updated.document, undefined, { sourceId: input.sourceId });
        unresolvedRequired = requiredResidualCount(residual);
        yield { kind: 'residual', report: structuredClone(residual), accepted: true };
        const highCoverageAccepted = isHighCoverageVectorResult(residual);
        if (unresolvedRequired === 0 || highCoverageAccepted) {
          if (highCoverageAccepted && unresolvedRequired > 0) {
            yield {
              kind: 'audit',
              type: 'validation',
              payload: {
                event: 'VECTORIZATION_HIGH_COVERAGE_ACCEPTED',
                geometry: structuredClone(residual.geometry),
                ignoredRasterResidualRegions: residual.residualRegions.length,
              },
            };
            await this.#record('vectorization_high_coverage_accepted', {
              geometry: structuredClone(residual.geometry),
              ignoredRasterResidualRegions: residual.residualRegions.length,
            });
          }
          unresolvedRequired = 0;
          const annotated = yield* this.#bootstrapAutomaticAnnotations({
            input,
            revision,
            iteration,
            recentReceipts,
            requestedCrops,
            controllerFeedback,
            nonImprovingBySlot,
            residual,
            unresolvedRequired,
            vectorizationCompletedStepIds,
          });
          revision = annotated.revision;
          if (annotated.terminal) return;
          yield {
            kind: 'completed', revision, unresolvedRequired: 0,
            summary: `已完成 ${vectorizationCompletedStepIds.length} 个可审计矢量化批次和 ${annotated.committedCount} 个自动标注`,
          };
          return;
        }
      }
    }

    while (iteration < this.#maxIterations) {
      if (input.signal.aborted) {
        yield { kind: 'stopped', revision };
        return;
      }
      const checkpoint = makeCheckpoint({
        input, revision, iteration, recentReceipts, residual,
        unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
        vectorizationCompletedStepIds,
      });
      if (input.shouldPause?.()) {
        await this.#record('checkpoint', checkpoint as unknown as Record<string, unknown>);
        yield { kind: 'paused', checkpoint };
        return;
      }

      iteration += 1;
      yield { kind: 'state', stage: 'SELECT_TARGET', iteration };
      const summary = await this.#application.summarize({ drawingId: input.drawingId, limit: 100 });
      if (summary.revision !== revision) {
        revision = summary.revision;
        const workspace = await this.#application.open(input.drawingId);
        residual = await this.#compareSource(workspace.document, undefined, { sourceId: input.sourceId });
        unresolvedRequired = requiredResidualCount(residual);
      }
      const escalation = escalationReason(nonImprovingBySlot);
      const decisionInput: FeedbackDecisionInput = {
        goal: input.goal,
        sourceId: input.sourceId,
        revision,
        unresolvedRequired,
        pendingInstructions: [...(input.readInstructions?.() ?? [])],
        ...(controllerFeedback ? { protocolFeedback: controllerFeedback } : {}),
        recentReceipts: recentReceipts.slice(-8),
        regions: this.#regions.list(input.sourceId).slice(0, 32),
        slots: this.#slots.list(input.sourceId)
          .filter((slot) => (nonImprovingBySlot[slot.id] ?? 0) < 3)
          .slice(0, 32),
        drawingItems: summary.summary.items.slice(0, 100).map((item) => ({
          id: item.id,
          type: item.type,
          summary: item.summary,
        })),
        requestedCrops: structuredClone(requestedCrops.slice(-1)),
        residual: structuredClone(residual),
        modelName: selectDrawingFeedbackModel(input.modelProfile, escalation),
        signal: input.signal,
        deadlineAt: this.#now() + 30_000,
      };
      let decision: FeedbackAgentDecision | undefined;
      let repairedDecisionInput = decisionInput;
      const maxProtocolAttempts = 3;
      for (let protocolAttempt = 1; protocolAttempt <= maxProtocolAttempts; protocolAttempt += 1) {
        try {
          decision = await this.#model.decide(repairedDecisionInput);
          break;
        } catch (error) {
          if (!(error instanceof DrawingFeedbackProtocolError)) throw error;
          await this.#record('protocol_error', {
            attempt: protocolAttempt,
            maxAttempts: maxProtocolAttempts,
            path: error.path,
            message: error.message,
          });
          if (protocolAttempt === maxProtocolAttempts) {
            yield {
              kind: 'failed',
              code: 'FEEDBACK_MODEL_PROTOCOL_RETRIES_EXHAUSTED',
              message: '模型连续三次未返回合法的单步决策',
            };
            return;
          }
          yield {
            kind: 'protocol_retry',
            attempt: protocolAttempt,
            maxAttempts: maxProtocolAttempts,
            message: error.message,
          };
          repairedDecisionInput = {
            ...decisionInput,
            modelName: input.modelProfile.repair,
            deadlineAt: this.#now() + 30_000,
            protocolFeedback: `上次输出不符合协议：${error.message}。请只返回一种合法 JSON 决策，并使用完整 DrawingCommand 包装。`,
          };
        }
      }
      if (!decision) throw new Error('FEEDBACK_DECISION_MISSING');
      controllerFeedback = undefined;
      const decisionAudit = safeDecisionAudit(decision);
      await this.#record('decision', decisionAudit);
      yield { kind: 'decision', decision: structuredClone(decisionAudit) };

      if (decision.type === 'finish') {
        if (unresolvedRequired !== 0) {
          yield {
            kind: 'failed',
            code: 'FEEDBACK_REQUIRED_RESIDUALS_REMAIN',
            message: `仍有 ${unresolvedRequired} 个必需残差`,
          };
          return;
        }
        const annotated = yield* this.#bootstrapAutomaticAnnotations({
          input,
          revision,
          iteration,
          recentReceipts,
          requestedCrops,
          controllerFeedback,
          nonImprovingBySlot,
          residual,
          unresolvedRequired,
          vectorizationCompletedStepIds,
        });
        revision = annotated.revision;
        if (annotated.terminal) return;
        yield { kind: 'completed', revision, unresolvedRequired: 0, summary: decision.summary };
        return;
      }

      if (decision.type === 'call_tool') {
        yield { kind: 'state', stage: 'ACQUIRE_EVIDENCE', iteration };
        if (!this.#cvTools) {
          yield {
            kind: 'failed', code: 'CV_CAPABILITY_UNAVAILABLE', message: 'CV 工具未配置',
          };
          return;
        }
        const requestedRegionId = decision.capability === 'cv_extract_evidence'
          ? toolInputRegionId(decision.input)
          : undefined;
        if (requestedRegionId
          && !requestedCrops.some((crop) => crop.sourceId === input.sourceId
            && crop.regionId === requestedRegionId)) {
          controllerFeedback = `区域 ${requestedRegionId} 尚未经过视觉观察。请先对同一区域调用 inspect_source_crop，再决定是否调用 cv_extract_evidence。`;
          yield { kind: 'controller_feedback', message: controllerFeedback };
          yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
            input, revision, iteration, recentReceipts, residual,
            unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
            vectorizationCompletedStepIds,
          }) };
          continue;
        }
        if (input.shouldPause?.()) {
          yield { kind: 'paused', checkpoint: makeCheckpoint({
            input, revision, iteration, recentReceipts, residual,
            unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
            vectorizationCompletedStepIds,
          }) };
          return;
        }
        const execution = await this.#cvTools.invoke({
          toolCallId: decision.toolCallId,
          capability: decision.capability,
          runId: input.runId,
          input: decision.input,
          signal: input.signal,
        });
        recentReceipts = [...recentReceipts, {
          receipt: execution.receipt,
          ...(execution.output === undefined ? {} : { output: execution.output }),
        }].slice(-8);
        if (execution.receipt.status !== 'succeeded'
          && repeatedToolFailureCount(recentReceipts, execution.receipt) >= 3) {
          yield {
            kind: 'failed',
            code: 'FEEDBACK_REPEATED_TOOL_FAILURE',
            message: `工具 ${execution.receipt.capability} 连续三次返回 ${execution.receipt.errorCodes.join(',')}`,
          };
          return;
        }
        let inventory: Extract<DrawingFeedbackOutput, { kind: 'inventory' }> | undefined;
        if (decision.capability === 'cv_extract_evidence'
          && execution.receipt.status === 'succeeded') {
          const evidence = evidenceSummaries(execution.output);
          const slotIds: string[] = [];
          for (const item of evidence) {
            const slot = this.#slots.observe({
              sourceId: item.sourceId,
              evidence: {
                handle: item.handle,
                kind: item.kind,
                bounds: { ...item.bounds },
                confidence: item.confidence,
                touchesRegionEdge: item.touchesRegionEdge,
              },
              candidateTypes: [{
                type: candidateType(item),
                score: item.confidence,
              }],
            });
            slotIds.push(slot.id);
          }
          const regionId = execution.receipt.regionId ?? evidence[0]?.regionId;
          if (slotIds.length > 0) {
            inventory = {
              kind: 'inventory',
              ...(regionId ? { regionId } : {}),
              slotIds,
              candidateCount: slotIds.length,
            };
          }
        }
        if (decision.capability === 'inspect_source_crop'
          && execution.receipt.status === 'succeeded') {
          const crop = cropReference(execution.output);
          if (crop) requestedCrops = [crop];
        }
        await this.#record('cv_tool', { receipt: structuredClone(execution.receipt) });
        yield { kind: 'tool', execution };
        if (inventory) {
          await this.#record('inventory', {
            ...(inventory.regionId ? { regionId: inventory.regionId } : {}),
            slotIds: [...inventory.slotIds],
            candidateCount: inventory.candidateCount,
          });
          yield inventory;
        }
        const nextCheckpoint = makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
          vectorizationCompletedStepIds,
        });
        yield { kind: 'checkpoint', checkpoint: nextCheckpoint };
        continue;
      }

      if (decision.type === 'transact_fit') {
        const materialized = materializeFitTransaction(
          decision,
          recentReceipts,
          this.#slots.list(input.sourceId),
        );
        if ('message' in materialized) {
          controllerFeedback = materialized.message;
          await this.#record('controller_feedback', { message: controllerFeedback });
          yield { kind: 'controller_feedback', message: controllerFeedback };
          yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
            input, revision, iteration, recentReceipts, residual,
            unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
            vectorizationCompletedStepIds,
          }) };
          continue;
        }
        decision = materialized.decision;
      }

      const scopeFeedback = transactionScopeFeedback(
        input.sourceId,
        decision.slotIds,
        this.#slots.list(input.sourceId),
        decision.commands,
        nonImprovingBySlot,
      );
      if (scopeFeedback) {
        const newlyDeferred = incrementRejectedSlots(
          decision.slotIds,
          nonImprovingBySlot,
        );
        controllerFeedback = newlyDeferred.length > 0
          ? `${scopeFeedback} 该槽位已暂缓，先继续处理其他对象，后续再重试。`
          : scopeFeedback;
        await this.#record('controller_feedback', { message: controllerFeedback });
        yield { kind: 'controller_feedback', message: controllerFeedback };
        for (const slotId of newlyDeferred) {
          yield { kind: 'slot_paused', slotId, reason: 'non_improving' };
        }
        yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
          vectorizationCompletedStepIds,
        }) };
        continue;
      }

      yield { kind: 'state', stage: 'PROPOSE_PATCH', iteration };
      if (input.shouldPause?.()) {
        yield { kind: 'paused', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
          vectorizationCompletedStepIds,
        }) };
        return;
      }
      const verificationRegion = resolveVerificationRegion({
        sourceId: input.sourceId,
        slotIds: decision.slotIds,
        slots: this.#slots.list(input.sourceId),
        regions: this.#regions.list(input.sourceId),
      });
      if (!verificationRegion) {
        yield {
          kind: 'failed',
          code: 'FEEDBACK_VERIFICATION_SCOPE_MISSING',
          message: '事务没有可验证的 slot 证据边界',
        };
        return;
      }
      const current = await this.#application.open(input.drawingId);
      if (current.revision !== revision) {
        revision = current.revision;
        continue;
      }
      const localBaseline = await this.#compareSource(current.document, undefined, {
        sourceId: input.sourceId,
        region: verificationRegion,
      });
      const preview = await this.#drawingTools.invoke({
        capability: 'preview_transaction',
        caller: 'model',
        toolCallId: decision.toolCallId,
        context: toolContext(input, revision),
        input: { commands: decision.commands, postconditions: [] },
      });
      recentReceipts = [...recentReceipts, preview.receipt].slice(-8);
      yield { kind: 'drawing_tool', execution: preview };
      if (!preview.prepared || !preview.previewDocument) {
        if (preview.receipt.status === 'stale') {
          const current = await this.#application.open(input.drawingId);
          revision = current.revision;
          continue;
        }
        const codes = preview.receipt.outcome.kind === 'error'
          ? preview.receipt.outcome.codes
          : [`PREVIEW_${preview.receipt.status.toUpperCase()}`];
        controllerFeedback = `单对象事务预览被拒绝（${codes.join(', ')}）；请修正 DrawingCommand 后重试同一 slot，或选择下一条兼容证据。`;
        const newlyDeferred = incrementRejectedSlots(
          decision.slotIds,
          nonImprovingBySlot,
        );
        if (newlyDeferred.length > 0) {
          controllerFeedback += ' 该槽位已暂缓，先继续处理其他对象，后续再重试。';
        }
        await this.#record('controller_feedback', {
          message: controllerFeedback,
          receipt: structuredClone(preview.receipt),
        });
        yield { kind: 'controller_feedback', message: controllerFeedback };
        yield { kind: 'correction', action: 'reject', slotIds: [...decision.slotIds] };
        for (const slotId of newlyDeferred) {
          yield { kind: 'slot_paused', slotId, reason: 'non_improving' };
        }
        yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
          vectorizationCompletedStepIds,
        }) };
        continue;
      }
      yield { kind: 'state', stage: 'PREVIEW_AND_RENDER', iteration };
      const selectedSlot = this.#slots.list(input.sourceId)
        .find((slot) => slot.id === decision.slotIds[0]);
      const proposal = projectFeedbackTransactionPreview({
        document: preview.previewDocument,
        affectedNodeIds: preview.receipt.affectedNodeIds,
        slotId: decision.slotIds[0],
        confidence: decision.confidence,
        evidenceRefs: selectedSlot?.evidenceRefs ?? [],
      });
      if (proposal.nodes.length > 0) {
        const regionId = this.#regions.list(input.sourceId).find((region) => (
          region.targetSlotIds.includes(decision.slotIds[0])
        ))?.id;
        yield {
          kind: 'proposal', slotId: decision.slotIds[0],
          ...(regionId ? { regionId } : {}),
          nodes: proposal.nodes,
          labelsByNodeId: proposal.labelsByNodeId,
        };
      }
      const compared = await this.#compareSource(
        preview.previewDocument,
        localBaseline.geometry,
        { sourceId: input.sourceId, region: verificationRegion },
      );
      yield { kind: 'state', stage: 'COMPARE', iteration };
      const locallyAccepted = isLocallyVerified(localBaseline, compared);
      const globalPreview = locallyAccepted
        ? await this.#compareSource(
          preview.previewDocument,
          residual.geometry,
          { sourceId: input.sourceId },
        )
        : undefined;
      const accepted = locallyAccepted
        && globalPreview !== undefined
        && isGloballyNonRegressive(residual, globalPreview);
      yield { kind: 'residual', report: structuredClone(compared), accepted };
      await this.#record('validation', {
        slotIds: [...decision.slotIds], accepted, locallyAccepted,
        local: {
          geometry: structuredClone(compared.geometry),
          residualRegionCount: compared.residualRegions.length,
        },
        ...(globalPreview ? { global: {
          geometry: structuredClone(globalPreview.geometry),
          requiredResidualCount: requiredResidualCount(globalPreview),
        } } : {}),
      });

      if (!accepted) {
        this.#drawingTools.discardPrepared(preview.prepared.handle);
        yield { kind: 'correction', action: 'reject', slotIds: [...decision.slotIds] };
        for (const slotId of decision.slotIds) {
          nonImprovingBySlot[slotId] = (nonImprovingBySlot[slotId] ?? 0) + 1;
          if (nonImprovingBySlot[slotId] >= 3) {
            yield { kind: 'slot_paused', slotId, reason: 'non_improving' };
          }
        }
        yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
          vectorizationCompletedStepIds,
        }) };
        continue;
      }

      yield { kind: 'state', stage: 'COMMIT_LOCAL_RESULT', iteration };
      const committed = await this.#drawingTools.invoke({
        capability: 'commit_transaction',
        caller: 'runtime',
        toolCallId: `${preview.prepared.handle}:commit`,
        context: toolContext(input, revision),
        input: { previewHandle: preview.prepared.handle },
      });
      recentReceipts = [...recentReceipts, committed.receipt].slice(-8);
      if (committed.receipt.status === 'stale') {
        const current = await this.#application.open(input.drawingId);
        revision = current.revision;
        continue;
      }
      if (committed.receipt.status !== 'succeeded'
        && committed.receipt.status !== 'already_satisfied') {
        yield {
          kind: 'failed', code: 'FEEDBACK_COMMIT_REJECTED',
          message: `提交失败: ${committed.receipt.status}`,
        };
        return;
      }
      revision = committed.receipt.revisionAfter;
      residual = globalPreview!;
      unresolvedRequired = requiredResidualCount(residual);
      const action = drawingAction(decision.commands);
      const changed = changedIds(decision.commands);
      for (const slotId of decision.slotIds) {
        nonImprovingBySlot[slotId] = 0;
        this.#slots.recordDrawingChange(slotId, {
          action,
          removedDrawingEntityIds: changed.removed,
          addedDrawingEntityIds: changed.added,
        });
      }
      reenableLargestDeferredSlot(
        input.sourceId,
        this.#slots.list(input.sourceId),
        nonImprovingBySlot,
      );
      await this.#record('commit', {
        commitId: committed.commit?.id,
        revision,
        slotIds: [...decision.slotIds],
        action,
      });
      yield {
        kind: 'commit', commitId: committed.commit?.id,
        revision, slotIds: [...decision.slotIds], execution: committed,
      };
      yield { kind: 'correction', action, slotIds: [...decision.slotIds] };
      yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
        input, revision, iteration, recentReceipts, residual,
        unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
        vectorizationCompletedStepIds,
      }) };
    }

    yield {
      kind: 'failed', code: 'FEEDBACK_ITERATION_BUDGET_EXCEEDED',
      message: `反馈循环超过 ${this.#maxIterations} 轮`,
    };
  }

  async *#bootstrapVectorization(state: {
    input: DrawingFeedbackRunInput;
    revision: RevisionId;
    iteration: number;
    recentReceipts: unknown[];
    requestedCrops: FeedbackDecisionInput['requestedCrops'];
    controllerFeedback?: string;
    nonImprovingBySlot: Record<string, number>;
    residual: RegionResidualReport;
    unresolvedRequired: number;
    completedStepIds: string[];
  }): AsyncGenerator<DrawingFeedbackOutput, {
    revision: RevisionId;
    completedStepIds: string[];
    terminal: boolean;
  }> {
    let revision = state.revision;
    const completed = new Set(state.completedStepIds);
    yield { kind: 'state', stage: 'VECTORIZE_SOURCE', iteration: state.iteration };
    let vectorized;
    try {
      vectorized = await this.#vectorization!.vectorizeSource({
        sourceId: state.input.sourceId,
        maxPixels: 4_000_000,
        signal: state.input.signal,
      });
    } catch (error) {
      const message = `中心线矢量化未完成，转入现有观察循环：${error instanceof Error ? error.message : String(error)}`;
      await this.#record('vectorization_fallback', { message });
      yield { kind: 'controller_feedback', message };
      return { revision, completedStepIds: [...completed], terminal: false };
    }
    const steps = buildVectorizationSteps(vectorized);
    const existing = await this.#application.open(state.input.drawingId);
    const replaceCommands = existing.document.geometry.length > 0
      && existing.document.geometry.every((node) => node.id.startsWith('node_vec_'))
      ? drawingReplacementCommands(existing.document)
      : [];
    const vectorNodeCount = steps.reduce((sum, step) => sum + step.previewNodes.length, 0);
    yield {
      kind: 'audit',
      type: 'state',
      payload: {
        event: 'VECTORIZATION_INVENTORY',
        pipelineVersion: vectorized.pipelineVersion,
        chainCount: vectorized.chains.length,
        batchCount: steps.length,
        vectorNodeCount,
        medianLineWidthPx: vectorized.medianLineWidthPx,
      },
    };
    await this.#record('vectorization_inventory', {
      pipelineVersion: vectorized.pipelineVersion,
      chainCount: vectorized.chains.length,
      batchCount: steps.length,
      vectorNodeCount,
      medianLineWidthPx: vectorized.medianLineWidthPx,
    });
    for (const step of steps) {
      const stepId = `final-batch:${step.batchIndex}`;
      if (completed.has(stepId)) continue;
      if (state.input.signal.aborted) {
        yield { kind: 'stopped', revision };
        return { revision, completedStepIds: [...completed], terminal: true };
      }
      if (state.input.shouldPause?.()) {
        const checkpoint = makeCheckpoint({
          input: state.input,
          revision,
          iteration: state.iteration,
          recentReceipts: state.recentReceipts,
          requestedCrops: state.requestedCrops,
          controllerFeedback: state.controllerFeedback,
          nonImprovingBySlot: state.nonImprovingBySlot,
          residual: state.residual,
          unresolvedRequired: state.unresolvedRequired,
          vectorizationCompletedStepIds: [...completed],
        });
        yield { kind: 'paused', checkpoint };
        return { revision, completedStepIds: [...completed], terminal: true };
      }
      yield {
        kind: 'state',
        stage: 'COMMIT_VECTOR_BATCH',
        iteration: state.iteration,
      };
      const slots = step.chains.map((chain) => this.#slots.observe(chain.slotObservation));
      const slotIds = slots.map((slot) => slot.id);
      yield {
        kind: 'inventory',
        slotIds,
        candidateCount: step.chains.length,
      };
      const preview = await this.#drawingTools.invoke({
        capability: 'preview_transaction',
        caller: 'model',
        toolCallId: `vectorize:${stepId}:preview`,
        context: toolContext(state.input, revision),
        input: {
          commands: step.batchIndex === 0
            ? [...replaceCommands, ...step.commands]
            : step.commands,
          postconditions: [],
        },
      });
      state.recentReceipts.push(preview.receipt);
      state.recentReceipts.splice(0, Math.max(0, state.recentReceipts.length - 8));
      yield { kind: 'drawing_tool', execution: preview };
      if (!preview.prepared || !preview.previewDocument) {
        yield {
          kind: 'audit',
          type: 'validation',
          payload: {
            event: 'VECTORIZATION_STEP_REJECTED',
            stepId,
            batchIndex: step.batchIndex,
            chainIds: [...step.chainIds],
            kind: step.kind,
            status: preview.receipt.status,
          },
        };
        await this.#record('vectorization_step_rejected', {
          stepId,
          batchIndex: step.batchIndex,
          chainIds: [...step.chainIds],
          kind: step.kind,
          status: preview.receipt.status,
        });
        yield { kind: 'correction', action: 'reject', slotIds };
        yield {
          kind: 'failed', code: 'VECTORIZATION_BATCH_REJECTED',
          message: `矢量化批次 ${step.batchIndex + 1} 未通过事务预览`,
        };
        return { revision, completedStepIds: [...completed], terminal: true };
      }
      const proposalNodeIds = new Set(step.previewNodes.map((node) => node.id));
      const proposalNodes = preview.previewDocument.geometry
        .filter((node) => proposalNodeIds.has(node.id))
        .map((node) => structuredClone(node));
      if (proposalNodes.length > 0) {
        yield {
          kind: 'proposal',
          slotId: slotIds[0] ?? `vector-batch:${step.batchIndex}`,
          nodes: proposalNodes,
          labelsByNodeId: {},
        };
      }
      const committed = await this.#drawingTools.invoke({
        capability: 'commit_transaction',
        caller: 'runtime',
        toolCallId: `vectorize:${stepId}:commit`,
        context: toolContext(state.input, revision),
        input: { previewHandle: preview.prepared.handle },
      });
      state.recentReceipts.push(committed.receipt);
      state.recentReceipts.splice(0, Math.max(0, state.recentReceipts.length - 8));
      if (committed.receipt.status !== 'succeeded'
        && committed.receipt.status !== 'already_satisfied') {
        yield { kind: 'correction', action: 'reject', slotIds };
        yield {
          kind: 'failed', code: 'VECTORIZATION_BATCH_COMMIT_FAILED',
          message: `矢量化批次 ${step.batchIndex + 1} 未能提交`,
        };
        return { revision, completedStepIds: [...completed], terminal: true };
      }
      revision = committed.receipt.revisionAfter ?? revision;
      step.chains.forEach((chain, index) => {
        const slot = slots[index];
        if (!slot) return;
        this.#slots.recordDrawingChange(slot.id, {
          action: 'create',
          addedDrawingEntityIds: [...chain.nodeIds],
        });
      });
      completed.add(stepId);
      await this.#record('vectorization_step_committed', {
        stepId,
        batchIndex: step.batchIndex,
        chainIds: [...step.chainIds],
        kind: step.kind,
        chainCount: step.chains.length,
        nodeIds: step.previewNodes.map((node) => node.id),
        nodeTypes: step.previewNodes.map((node) => node.type),
        validation: structuredClone(step.validation),
        chains: step.chains.map((chain) => ({
          chainId: chain.chainId,
          nodeIds: [...chain.nodeIds],
          confidence: chain.confidence,
          validation: structuredClone(chain.validation),
        })),
        commitId: committed.commit?.id,
        revision,
      });
      yield {
        kind: 'audit',
        type: 'validation',
        payload: {
          event: 'VECTORIZATION_STEP_COMMITTED',
          stepId,
          batchIndex: step.batchIndex,
          chainIds: [...step.chainIds],
          kind: step.kind,
          chainCount: step.chains.length,
          nodeIds: step.previewNodes.map((node) => node.id),
          nodeTypes: step.previewNodes.map((node) => node.type),
          validation: structuredClone(step.validation),
          chains: step.chains.map((chain) => ({
            chainId: chain.chainId,
            nodeIds: [...chain.nodeIds],
            confidence: chain.confidence,
            validation: structuredClone(chain.validation),
          })),
          commitId: committed.commit?.id,
          revision,
        },
      };
      yield {
        kind: 'commit',
        commitId: committed.commit?.id,
        revision,
        slotIds,
        execution: committed,
      };
      yield { kind: 'correction', action: 'create', slotIds };
      yield {
        kind: 'checkpoint',
        checkpoint: makeCheckpoint({
          input: state.input,
          revision,
          iteration: state.iteration,
          recentReceipts: state.recentReceipts,
          requestedCrops: state.requestedCrops,
          controllerFeedback: state.controllerFeedback,
          nonImprovingBySlot: state.nonImprovingBySlot,
          residual: state.residual,
          unresolvedRequired: state.unresolvedRequired,
          vectorizationCompletedStepIds: [...completed],
        }),
      };
    }
    return { revision, completedStepIds: [...completed], terminal: false };
  }

  async *#bootstrapAutomaticAnnotations(state: {
    input: DrawingFeedbackRunInput;
    revision: RevisionId;
    iteration: number;
    recentReceipts: unknown[];
    requestedCrops: FeedbackDecisionInput['requestedCrops'];
    controllerFeedback?: string;
    nonImprovingBySlot: Record<string, number>;
    residual: RegionResidualReport;
    unresolvedRequired: number;
    vectorizationCompletedStepIds: string[];
  }): AsyncGenerator<DrawingFeedbackOutput, {
    revision: RevisionId;
    committedCount: number;
    terminal: boolean;
  }> {
    let revision = state.revision;
    let committedCount = 0;
    const workspace = await this.#application.open(state.input.drawingId);
    const steps = buildAutomaticAnnotationSteps({
      drawingId: workspace.document.id,
      geometry: workspace.document.geometry,
      existingAnnotationIds: workspace.document.annotations.map((node) => node.id),
    });
    if (steps.length === 0) return { revision, committedCount, terminal: false };

    yield { kind: 'state', stage: 'ANNOTATE_GEOMETRY', iteration: state.iteration };
    yield {
      kind: 'audit',
      type: 'state',
      payload: {
        event: 'AUTOMATIC_ANNOTATION_INVENTORY',
        annotationCount: steps.length,
        geometryCount: workspace.document.geometry.length,
      },
    };
    await this.#record('automatic_annotation_inventory', {
      annotationCount: steps.length,
      geometryCount: workspace.document.geometry.length,
    });

    if (state.input.signal.aborted) {
      yield { kind: 'stopped', revision };
      return { revision, committedCount, terminal: true };
    }
    if (state.input.shouldPause?.()) {
      const checkpoint = makeCheckpoint({
        input: state.input,
        revision,
        iteration: state.iteration,
        recentReceipts: state.recentReceipts,
        requestedCrops: state.requestedCrops,
        controllerFeedback: state.controllerFeedback,
        nonImprovingBySlot: state.nonImprovingBySlot,
        residual: state.residual,
        unresolvedRequired: state.unresolvedRequired,
        vectorizationCompletedStepIds: state.vectorizationCompletedStepIds,
      });
      yield { kind: 'paused', checkpoint };
      return { revision, committedCount, terminal: true };
    }

    const slotIds = steps.map((step) => `annotation:${step.annotation.id}`);
    const preview = await this.#drawingTools.invoke({
      capability: 'preview_transaction',
      caller: 'model',
      toolCallId: 'auto-annotation:batch:preview',
      context: toolContext(state.input, revision),
      input: { commands: steps.flatMap((step) => step.commands), postconditions: [] },
    });
    state.recentReceipts.push(preview.receipt);
    state.recentReceipts.splice(0, Math.max(0, state.recentReceipts.length - 8));
    yield { kind: 'drawing_tool', execution: preview };
    if (!preview.prepared || !preview.previewDocument) {
      yield { kind: 'correction', action: 'reject', slotIds };
      await this.#record('automatic_annotation_batch_rejected', {
        annotationIds: steps.map((step) => step.annotation.id),
        status: preview.receipt.status,
      });
      return { revision, committedCount, terminal: false };
    }

    const proposalNodes = preview.previewDocument.annotations.filter((annotation) => (
      steps.some((step) => step.annotation.id === annotation.id)
    )).map((annotation) => structuredClone(annotation));
    if (proposalNodes.length > 0) {
      yield {
        kind: 'proposal',
        slotId: slotIds[0],
        slotIds,
        nodes: proposalNodes,
        labelsByNodeId: Object.fromEntries(steps.map((step) => [
          step.annotation.id,
          step.label,
        ])),
      };
    }

    const committed = await this.#drawingTools.invoke({
      capability: 'commit_transaction',
      caller: 'runtime',
      toolCallId: 'auto-annotation:batch:commit',
      context: toolContext(state.input, revision),
      input: { previewHandle: preview.prepared.handle },
    });
    state.recentReceipts.push(committed.receipt);
    state.recentReceipts.splice(0, Math.max(0, state.recentReceipts.length - 8));
    if (committed.receipt.status !== 'succeeded'
      && committed.receipt.status !== 'already_satisfied') {
      yield { kind: 'correction', action: 'reject', slotIds };
      return { revision, committedCount, terminal: false };
    }

    revision = committed.receipt.revisionAfter ?? revision;
    committedCount = steps.length;
    const annotationAudit = steps.map((step) => ({
      stepId: step.id,
      annotationId: step.annotation.id,
      dimensionKind: step.annotation.dimensionKind,
      displayText: step.annotation.displayText,
    }));
    await this.#record('automatic_annotation_batch_committed', {
      annotationCount: steps.length,
      annotations: structuredClone(annotationAudit),
      commitId: committed.commit?.id,
      revision,
    });
    yield {
      kind: 'audit',
      type: 'validation',
      payload: {
        event: 'AUTOMATIC_ANNOTATION_BATCH_COMMITTED',
        annotationCount: steps.length,
        annotations: structuredClone(annotationAudit),
        commitId: committed.commit?.id,
        revision,
      },
    };
    yield {
      kind: 'commit',
      commitId: committed.commit?.id,
      revision,
      slotIds,
      execution: committed,
    };
    yield { kind: 'correction', action: 'create', slotIds };
    yield {
      kind: 'checkpoint',
      checkpoint: makeCheckpoint({
        input: state.input,
        revision,
        iteration: state.iteration,
        recentReceipts: state.recentReceipts,
        requestedCrops: state.requestedCrops,
        controllerFeedback: state.controllerFeedback,
        nonImprovingBySlot: state.nonImprovingBySlot,
        residual: state.residual,
        unresolvedRequired: state.unresolvedRequired,
        vectorizationCompletedStepIds: state.vectorizationCompletedStepIds,
      }),
    };
    return { revision, committedCount, terminal: false };
  }

  async #compareSource(
    document: DrawingDocument,
    previous?: RegionResidualReport['geometry'],
    context?: { sourceId: string; region?: SourcePixelRect },
  ): Promise<RegionResidualReport> {
    return this.#compare(withoutAutomaticAnnotations(document), previous, context);
  }

  async #record(type: string, payload: Record<string, unknown>): Promise<void> {
    await this.#audit?.({ type, payload });
  }
}

function resolveVerificationRegion(input: {
  sourceId: string;
  slotIds: string[];
  slots: ReturnType<MemoryObservationSlotStore['list']>;
  regions: ReturnType<MemoryObservationRegionStore['list']>;
}): SourcePixelRect | undefined {
  const selected = new Set(input.slotIds);
  const evidenceBounds = input.slots
    .filter((slot) => selected.has(slot.id) && slot.sourceId === input.sourceId)
    .flatMap((slot) => slot.evidence.map((evidence) => evidence.bounds));
  const targetedRegionBounds = input.regions
    .filter((region) => region.sourceId === input.sourceId
      && region.targetSlotIds.some((slotId) => selected.has(slotId)))
    .map((region) => region.bounds);
  const bounds = evidenceBounds.length > 0 ? evidenceBounds : targetedRegionBounds;
  if (bounds.length === 0) return undefined;
  const left = Math.min(...bounds.map((item) => item.x));
  const top = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  const padding = Math.max(8, Math.ceil(Math.max(right - left, bottom - top) * 0.12));
  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  return {
    x,
    y,
    width: right + padding - x,
    height: bottom + padding - y,
  };
}

function toolContext(input: DrawingFeedbackRunInput, revision: RevisionId) {
  return {
    runId: input.runId,
    drawingId: input.drawingId,
    revision,
    actor: { type: 'AI' as const, id: input.runId },
  };
}

function requiredResidualCount(report: RegionResidualReport): number {
  return report.residualRegions.length
    + report.topologyFailures.length
    + report.associationMismatches.length;
}

function isHighCoverageVectorResult(report: RegionResidualReport): boolean {
  return report.geometry.edgePrecision >= 0.98
    && report.geometry.edgeRecall >= 0.98
    && report.geometry.edgeF1 >= 0.985
    && report.topologyFailures.length === 0
    && report.associationMismatches.length === 0;
}

function isLocallyVerified(
  baseline: RegionResidualReport,
  report: RegionResidualReport,
): boolean {
  const edgeGain = report.geometry.edgeF1 - baseline.geometry.edgeF1;
  const fitGain = Number.isFinite(baseline.geometry.fitP95)
    ? baseline.geometry.fitP95 - report.geometry.fitP95
    : Number.isFinite(report.geometry.fitP95) ? Number.POSITIVE_INFINITY : 0;
  return report.topologyFailures.length === 0
    && report.associationMismatches.length === 0
    && (edgeGain >= 0.002 || fitGain >= 0.5);
}

function isGloballyNonRegressive(
  baseline: RegionResidualReport,
  report: RegionResidualReport,
): boolean {
  return requiredResidualCount(report) <= requiredResidualCount(baseline)
    && report.geometry.edgeF1 >= baseline.geometry.edgeF1 - 0.001
    && report.topologyFailures.length <= baseline.topologyFailures.length
    && report.associationMismatches.length <= baseline.associationMismatches.length;
}

function escalationReason(
  nonImprovingBySlot: Record<string, number>,
): DrawingFeedbackEscalationReason | undefined {
  return Object.values(nonImprovingBySlot).some((count) => count >= 2)
    ? 'repeated_non_improvement'
    : undefined;
}

function drawingAction(commands: DrawingCommand[]): Exclude<SlotLineageAction, 'merge' | 'split'> {
  const creates = commands.filter((command) => command.type.endsWith('.create'));
  const deletes = commands.filter((command) => command.type.endsWith('.delete'));
  if (creates.length > 0 && deletes.length > 0) return 'retype';
  if (deletes.length > 0) return 'delete';
  if (creates.length > 0) return 'create';
  return 'update';
}

function changedIds(commands: DrawingCommand[]): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const command of commands) {
    if (command.type.endsWith('.create') && 'value' in command && command.value.id) {
      added.push(command.value.id);
    }
    if (command.type.endsWith('.delete') && 'id' in command) removed.push(command.id);
  }
  return { added, removed };
}

function makeCheckpoint(input: {
  input: DrawingFeedbackRunInput;
  revision: RevisionId;
  iteration: number;
  recentReceipts: unknown[];
  requestedCrops: FeedbackDecisionInput['requestedCrops'];
  controllerFeedback?: string;
  residual: RegionResidualReport;
  unresolvedRequired: number;
  nonImprovingBySlot: Record<string, number>;
  vectorizationCompletedStepIds?: string[];
}): DrawingFeedbackCheckpoint {
  return {
    schemaVersion: 1,
    runId: input.input.runId,
    sourceId: input.input.sourceId,
    revision: input.revision,
    iteration: input.iteration,
    recentReceipts: structuredClone(input.recentReceipts.slice(-8)),
    requestedCrops: structuredClone(input.requestedCrops.slice(-1)),
    ...(input.controllerFeedback ? { controllerFeedback: input.controllerFeedback } : {}),
    residual: structuredClone(input.residual),
    unresolvedRequired: input.unresolvedRequired,
    nonImprovingBySlot: { ...input.nonImprovingBySlot },
    vectorizationCompletedStepIds: [...(input.vectorizationCompletedStepIds ?? [])],
  };
}

function toolInputRegionId(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const regionId = (input as Record<string, unknown>).regionId;
  return typeof regionId === 'string' && regionId.length > 0 ? regionId : undefined;
}

function transactionScopeFeedback(
  sourceId: string,
  selectedSlotIds: string[],
  slots: ReturnType<MemoryObservationSlotStore['list']>,
  commands: DrawingCommand[],
  nonImprovingBySlot: Record<string, number>,
): string | undefined {
  if (selectedSlotIds.length !== 1) {
    return '每次只能处理一个 slot；请为单个对象提出局部事务，验证完成后再处理下一个。';
  }
  const selectedIds = new Set(selectedSlotIds);
  const selected = slots.filter((slot) => slot.sourceId === sourceId && selectedIds.has(slot.id));
  if (selected.length !== selectedIds.size) {
    return '事务引用了尚未建立证据的 slot；请先观察并提取对应区域。';
  }
  const deferred = selected.find((slot) => (nonImprovingBySlot[slot.id] ?? 0) >= 3);
  if (deferred) {
    return `槽位 ${deferred.id} 已因重复无效提案暂缓；请先选择上下文中仍可处理的其他 slot。`;
  }
  const partialClosed = selected.find((slot) => {
    const type = slot.candidateTypes[0]?.type;
    return (type === 'circle' || type === 'ellipse')
      && slot.evidence.length > 0
      && slot.evidence.every((evidence) => evidence.touchesRegionEdge);
  });
  if (partialClosed) {
    return `槽位 ${partialClosed.id} 的闭合图元证据全部触碰裁剪边缘；请扩大重叠区域看到完整对象后再提交。`;
  }
  const createdTypes = commands.flatMap((command) => (
    command.type === 'geometry.create' ? [command.value.type] : []
  ));
  const allowedTypes = new Set(selected.flatMap((slot) => (
    slot.candidateTypes.map((candidate) => candidate.type)
  )));
  const incompatibleType = createdTypes.find((type) => !allowedTypes.has(type));
  if (incompatibleType) {
    return `事务图元类型 ${incompatibleType} 与 slot 证据候选 ${[...allowedTypes].join(', ')} 不兼容；请先获取支持该类型的证据，或按现有候选类型提案。`;
  }
  const unresolved = slots.filter((slot) => slot.sourceId === sourceId
    && slot.status !== 'committed' && slot.status !== 'rejected'
    && (nonImprovingBySlot[slot.id] ?? 0) < 3);
  const largestArea = Math.max(0, ...unresolved.map(slotEvidenceArea));
  const selectedArea = Math.max(0, ...selected.map(slotEvidenceArea));
  if (largestArea > 0 && selectedArea < largestArea * 0.2) {
    return `当前仍有尺度显著更大的主体候选（最大证据面积 ${largestArea}）；请按从大到小先完成轮廓，再处理当前 ${selectedArea} 面积的细节。`;
  }
  return undefined;
}

function incrementRejectedSlots(
  slotIds: string[],
  nonImprovingBySlot: Record<string, number>,
): string[] {
  const newlyDeferred: string[] = [];
  for (const slotId of slotIds) {
    const previous = nonImprovingBySlot[slotId] ?? 0;
    const next = previous + 1;
    nonImprovingBySlot[slotId] = next;
    if (previous < 3 && next >= 3) newlyDeferred.push(slotId);
  }
  return newlyDeferred;
}

function reenableLargestDeferredSlot(
  sourceId: string,
  slots: ReturnType<MemoryObservationSlotStore['list']>,
  nonImprovingBySlot: Record<string, number>,
): void {
  const deferred = slots
    .filter((slot) => slot.sourceId === sourceId && (nonImprovingBySlot[slot.id] ?? 0) >= 3)
    .sort((left, right) => slotEvidenceArea(right) - slotEvidenceArea(left))[0];
  if (deferred) nonImprovingBySlot[deferred.id] = 2;
}

function slotEvidenceArea(slot: ReturnType<MemoryObservationSlotStore['list']>[number]): number {
  return Math.max(0, ...slot.evidence.map((evidence) => (
    evidence.bounds.width * evidence.bounds.height
  )));
}

function cropReference(output: unknown): FeedbackDecisionInput['requestedCrops'][number] | undefined {
  if (!output || typeof output !== 'object') return undefined;
  const value = output as Record<string, unknown>;
  if (typeof value.mediaHandle !== 'string'
    || typeof value.sourceId !== 'string'
    || typeof value.regionId !== 'string') return undefined;
  return {
    mediaHandle: value.mediaHandle,
    sourceId: value.sourceId,
    regionId: value.regionId,
  };
}

function assertCheckpoint(
  checkpoint: DrawingFeedbackCheckpoint,
  input: DrawingFeedbackRunInput,
): void {
  if (checkpoint.schemaVersion !== 1
    || checkpoint.runId !== input.runId
    || checkpoint.sourceId !== input.sourceId) {
    throw new Error('FEEDBACK_CHECKPOINT_SCOPE_MISMATCH');
  }
}

function safeDecisionAudit(decision: FeedbackAgentDecision): Record<string, unknown> {
  if (decision.type === 'call_tool') {
    return {
      type: decision.type,
      toolCallId: decision.toolCallId,
      capability: decision.capability,
    };
  }
  if (decision.type === 'transact') {
    return {
      type: decision.type,
      toolCallId: decision.toolCallId,
      slotIds: [...decision.slotIds],
      commandTypes: decision.commands.map((command) => command.type),
      commands: structuredClone(decision.commands),
      confidence: decision.confidence,
    };
  }
  if (decision.type === 'transact_fit') {
    return {
      type: decision.type,
      toolCallId: decision.toolCallId,
      slotId: decision.slotId,
      evidenceHandle: decision.evidenceHandle,
      primitiveType: decision.primitiveType,
      confidence: decision.confidence,
    };
  }
  return { type: decision.type, summary: decision.summary };
}

function materializeFitTransaction(
  decision: Extract<FeedbackAgentDecision, { type: 'transact_fit' }>,
  recentReceipts: unknown[],
  slots: ReturnType<MemoryObservationSlotStore['list']>,
): { decision: Extract<FeedbackAgentDecision, { type: 'transact' }> } | { message: string } {
  const slot = slots.find((candidate) => candidate.id === decision.slotId);
  if (!slot || !slot.evidenceRefs.includes(decision.evidenceHandle)) {
    return {
      message: `槽位 ${decision.slotId} 未绑定证据 ${decision.evidenceHandle}；请使用该 slot 的 evidenceRefs。`,
    };
  }
  const fit = [...recentReceipts].reverse().find((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    if (!record.receipt || typeof record.receipt !== 'object'
      || !record.output || typeof record.output !== 'object') return false;
    const receipt = record.receipt as Record<string, unknown>;
    const output = record.output as Record<string, unknown>;
    return receipt.capability === 'cv_fit_primitive'
      && receipt.status === 'succeeded'
      && Array.isArray(receipt.evidenceHandles)
      && receipt.evidenceHandles.includes(decision.evidenceHandle)
      && output.primitiveType === decision.primitiveType;
  }) as Record<string, unknown> | undefined;
  if (!fit) {
    return {
      message: `未找到证据 ${decision.evidenceHandle} 的 ${decision.primitiveType} 拟合回执；请先调用 cv_fit_primitive。`,
    };
  }
  const output = fit.output as Record<string, unknown>;
  const parameters = output.documentParameters;
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return { message: '拟合回执缺少可用的 documentParameters；请重新拟合该证据。' };
  }
  try {
    const commands = parseDrawingToolCommands([{
      type: 'geometry.create',
      value: {
        ...(parameters as Record<string, unknown>),
        type: decision.primitiveType,
        visible: true,
        quality: {
          status: 'candidate',
          confidence: decision.confidence,
          evidenceRefs: [decision.evidenceHandle],
        },
      },
    }], 'decision.commands');
    return {
      decision: {
        type: 'transact',
        toolCallId: decision.toolCallId,
        slotIds: [decision.slotId],
        commands,
        confidence: decision.confidence,
      },
    };
  } catch (error) {
    return {
      message: `拟合参数无法组装为显式 ${decision.primitiveType} 图元：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function evidenceSummaries(output: unknown): CvEvidenceSummary[] {
  if (!output || typeof output !== 'object' || !('evidence' in output)
    || !Array.isArray(output.evidence)) return [];
  return output.evidence.filter((item): item is CvEvidenceSummary => (
    Boolean(item && typeof item === 'object'
      && 'handle' in item && typeof item.handle === 'string'
      && 'sourceId' in item && typeof item.sourceId === 'string')
  ));
}

function candidateType(evidence: CvEvidenceSummary): CvPrimitiveType {
  switch (evidence.kind) {
    case 'point-candidate': return 'point';
    case 'line-candidate': return 'line';
    case 'circle-candidate': return 'circle';
    case 'arc-candidate': return 'arc';
    case 'ellipse-candidate': return 'ellipse';
    case 'spline-candidate': return 'spline';
    case 'polyline-candidate':
    case 'contour':
    case 'edge':
    case 'endpoint':
    case 'intersection':
    case 'primitive-candidate':
      return 'polyline';
  }
}

function repeatedToolFailureCount(receipts: unknown[], target: CvToolExecution['receipt']): number {
  return receipts.filter((value) => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    const receipt = (
      candidate.receipt && typeof candidate.receipt === 'object'
        ? candidate.receipt
        : candidate
    ) as Partial<CvToolExecution['receipt']>;
    return receipt.capability === target.capability
      && receipt.inputDigest === target.inputDigest
      && receipt.status === target.status
      && JSON.stringify(receipt.errorCodes) === JSON.stringify(target.errorCodes);
  }).length;
}

function drawingReplacementCommands(document: DrawingDocument): DrawingCommand[] {
  return [
    ...document.relations.map((node): DrawingCommand => ({
      type: 'relation.delete', id: node.id,
    })),
    ...document.features.map((node): DrawingCommand => ({
      type: 'feature.delete', id: node.id,
    })),
    ...document.annotations.map((node): DrawingCommand => ({
      type: 'annotation.delete', id: node.id,
    })),
    ...document.geometry.map((node): DrawingCommand => ({
      type: 'geometry.delete', id: node.id,
    })),
  ];
}
