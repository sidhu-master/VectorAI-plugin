import type {
  DrawingCommand,
  DrawingDocument,
  DrawingId,
  PerceptionPreviewNode,
  RevisionId,
} from '../../../src/drawing/index.js';
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
import {
  projectFeedbackCandidates,
  type FeedbackSuggestedFit,
} from './preview-projector.js';

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
  | { kind: 'tool'; execution: CvToolExecution }
  | {
      kind: 'observation';
      regionId: string;
      slotIds: string[];
      nodes: PerceptionPreviewNode[];
      labelsByNodeId: Record<string, string>;
    }
  | { kind: 'preview'; slotIds: string[]; affectedNodeIds: string[] }
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
  }

  async *run(input: DrawingFeedbackRunInput): AsyncIterable<DrawingFeedbackOutput> {
    let revision = input.checkpoint?.revision ?? input.revision;
    let iteration = input.checkpoint?.iteration ?? 0;
    let recentReceipts = [...(input.checkpoint?.recentReceipts ?? [])];
    let requestedCrops = [...(input.checkpoint?.requestedCrops ?? [])];
    let controllerFeedback = input.checkpoint?.controllerFeedback;
    let nonImprovingBySlot = { ...(input.checkpoint?.nonImprovingBySlot ?? {}) };
    let residual: RegionResidualReport;
    let unresolvedRequired: number;
    if (input.checkpoint) {
      assertCheckpoint(input.checkpoint, input);
      residual = structuredClone(input.checkpoint.residual);
      unresolvedRequired = input.checkpoint.unresolvedRequired;
    } else {
      const workspace = await this.#application.open(input.drawingId);
      revision = workspace.revision;
      residual = await this.#compare(workspace.document, undefined, { sourceId: input.sourceId });
      unresolvedRequired = requiredResidualCount(residual);
      yield { kind: 'state', stage: 'OBSERVE', iteration };
      yield { kind: 'residual', report: structuredClone(residual), accepted: true };
    }

    while (iteration < this.#maxIterations) {
      if (input.signal.aborted) {
        yield { kind: 'stopped', revision };
        return;
      }
      const checkpoint = makeCheckpoint({
        input, revision, iteration, recentReceipts, residual,
        unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
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
        residual = await this.#compare(workspace.document, undefined, { sourceId: input.sourceId });
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
        slots: this.#slots.list(input.sourceId).slice(0, 32),
        drawingItems: summary.summary.items.slice(0, 100).map((item) => ({
          id: item.id,
          type: item.type,
          summary: item.summary,
        })),
        requestedCrops: structuredClone(requestedCrops.slice(-1)),
        residual: structuredClone(residual),
        modelName: selectDrawingFeedbackModel(input.modelProfile, escalation),
        signal: input.signal,
        deadlineAt: this.#now() + 120_000,
      };
      let decision: FeedbackAgentDecision;
      try {
        decision = await this.#model.decide(decisionInput);
      } catch (error) {
        if (!(error instanceof DrawingFeedbackProtocolError)) throw error;
        decision = await this.#model.decide({
          ...decisionInput,
          protocolFeedback: `上次输出不符合协议：${error.message}。请只返回一种合法 JSON 决策，并使用完整 DrawingCommand 包装。`,
        });
      }
      controllerFeedback = undefined;
      await this.#record('decision', safeDecisionAudit(decision));

      if (decision.type === 'finish') {
        if (unresolvedRequired !== 0) {
          yield {
            kind: 'failed',
            code: 'FEEDBACK_REQUIRED_RESIDUALS_REMAIN',
            message: `仍有 ${unresolvedRequired} 个必需残差`,
          };
          return;
        }
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
          yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
            input, revision, iteration, recentReceipts, residual,
            unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
          }) };
          continue;
        }
        if (input.shouldPause?.()) {
          yield { kind: 'paused', checkpoint: makeCheckpoint({
            input, revision, iteration, recentReceipts, residual,
            unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
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
        let observation: Extract<DrawingFeedbackOutput, { kind: 'observation' }> | undefined;
        if (decision.capability === 'cv_extract_evidence'
          && execution.receipt.status === 'succeeded') {
          const evidence = evidenceSummaries(execution.output);
          const slotIdsByEvidence: Record<string, string> = {};
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
            slotIdsByEvidence[item.handle] = slot.id;
          }
          const projected = projectFeedbackCandidates({
            evidence,
            suggestedFits: suggestedFits(execution.output),
            slotIdsByEvidence,
          });
          const regionId = execution.receipt.regionId ?? evidence[0]?.regionId;
          if (regionId && projected.nodes.length > 0) {
            observation = {
              kind: 'observation', regionId,
              slotIds: projected.nodes.map((node) => (
                slotIdsByEvidence[node.quality.evidenceRefs[0] ?? '']
              )).filter((slotId): slotId is string => Boolean(slotId)),
              nodes: projected.nodes,
              labelsByNodeId: projected.labelsByNodeId,
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
        if (observation) {
          await this.#record('observation', {
            regionId: observation.regionId,
            slotIds: [...observation.slotIds],
            nodeIds: observation.nodes.map((node) => node.id),
            nodeTypes: observation.nodes.map((node) => node.type),
          });
          yield observation;
        }
        const nextCheckpoint = makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
        });
        yield { kind: 'checkpoint', checkpoint: nextCheckpoint };
        continue;
      }

      const scopeFeedback = transactionScopeFeedback(
        input.sourceId,
        decision.slotIds,
        this.#slots.list(input.sourceId),
      );
      if (scopeFeedback) {
        controllerFeedback = scopeFeedback;
        yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
        }) };
        continue;
      }

      yield { kind: 'state', stage: 'PROPOSE_PATCH', iteration };
      if (input.shouldPause?.()) {
        yield { kind: 'paused', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
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
      const localBaseline = await this.#compare(current.document, undefined, {
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
      if (!preview.prepared || !preview.previewDocument) {
        if (preview.receipt.status === 'stale') {
          const current = await this.#application.open(input.drawingId);
          revision = current.revision;
          continue;
        }
        yield {
          kind: 'failed', code: 'FEEDBACK_PREVIEW_REJECTED',
          message: `预览失败: ${preview.receipt.status}`,
        };
        return;
      }
      yield { kind: 'state', stage: 'PREVIEW_AND_RENDER', iteration };
      yield {
        kind: 'preview',
        slotIds: [...decision.slotIds],
        affectedNodeIds: [...preview.receipt.affectedNodeIds],
      };
      const compared = await this.#compare(
        preview.previewDocument,
        localBaseline.geometry,
        { sourceId: input.sourceId, region: verificationRegion },
      );
      yield { kind: 'state', stage: 'COMPARE', iteration };
      const accepted = isLocallyVerified(compared);
      yield { kind: 'residual', report: structuredClone(compared), accepted };
      await this.#record('validation', {
        slotIds: [...decision.slotIds], accepted,
        geometry: structuredClone(compared.geometry),
        residualRegionCount: compared.residualRegions.length,
      });

      if (!accepted) {
        this.#drawingTools.discardPrepared(preview.prepared.handle);
        yield { kind: 'correction', action: 'reject', slotIds: [...decision.slotIds] };
        for (const slotId of decision.slotIds) {
          nonImprovingBySlot[slotId] = (nonImprovingBySlot[slotId] ?? 0) + 1;
          if (nonImprovingBySlot[slotId] >= 3) {
            yield { kind: 'slot_paused', slotId, reason: 'non_improving' };
            return;
          }
        }
        yield { kind: 'checkpoint', checkpoint: makeCheckpoint({
          input, revision, iteration, recentReceipts, residual,
          unresolvedRequired, nonImprovingBySlot, requestedCrops, controllerFeedback,
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
      residual = await this.#compare(
        preview.previewDocument,
        residual.geometry,
        { sourceId: input.sourceId },
      );
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
      }) };
    }

    yield {
      kind: 'failed', code: 'FEEDBACK_ITERATION_BUDGET_EXCEEDED',
      message: `反馈循环超过 ${this.#maxIterations} 轮`,
    };
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

function isLocallyVerified(report: RegionResidualReport): boolean {
  return report.topologyFailures.length === 0
    && report.associationMismatches.length === 0
    && (report.improved || report.geometry.edgeF1 >= 0.995);
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
): string | undefined {
  const selectedIds = new Set(selectedSlotIds);
  const selected = slots.filter((slot) => slot.sourceId === sourceId && selectedIds.has(slot.id));
  if (selected.length !== selectedIds.size) {
    return '事务引用了尚未建立证据的 slot；请先观察并提取对应区域。';
  }
  const partialClosed = selected.find((slot) => {
    const type = slot.candidateTypes[0]?.type;
    return (type === 'circle' || type === 'ellipse' || type === 'polyline')
      && slot.evidence.length > 0
      && slot.evidence.every((evidence) => evidence.touchesRegionEdge);
  });
  if (partialClosed) {
    return `槽位 ${partialClosed.id} 的闭合图元证据全部触碰裁剪边缘；请扩大重叠区域看到完整对象后再提交。`;
  }
  const unresolved = slots.filter((slot) => slot.sourceId === sourceId
    && slot.status !== 'committed' && slot.status !== 'rejected');
  const largestArea = Math.max(0, ...unresolved.map(slotEvidenceArea));
  const selectedArea = Math.max(0, ...selected.map(slotEvidenceArea));
  if (largestArea > 0 && selectedArea < largestArea * 0.2) {
    return `当前仍有尺度显著更大的主体候选（最大证据面积 ${largestArea}）；请按从大到小先完成轮廓，再处理当前 ${selectedArea} 面积的细节。`;
  }
  return undefined;
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
      confidence: decision.confidence,
    };
  }
  return { type: decision.type, summary: decision.summary };
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

function suggestedFits(output: unknown): FeedbackSuggestedFit[] {
  if (!output || typeof output !== 'object' || !('suggestedFits' in output)
    || !Array.isArray(output.suggestedFits)) return [];
  return output.suggestedFits.filter((item): item is FeedbackSuggestedFit => (
    Boolean(item && typeof item === 'object'
      && 'evidenceHandle' in item && typeof item.evidenceHandle === 'string'
      && 'primitiveType' in item && typeof item.primitiveType === 'string'
      && 'documentParameters' in item)
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
