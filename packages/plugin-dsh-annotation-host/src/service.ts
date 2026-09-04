// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {
  AnnotationSessionState,
  EngineeringDocumentStageRequest,
  DrawingSpaceExtensionHost,
  DrawingRef,
  PartitionDocumentSupplementRequest,
  PartitionEditCommand,
  PartitionImportRequest,
  PartitionSessionSnapshot,
  DimensionPlanSessionSnapshot,
  DimensionSchemeEditCommand,
  GeometricToleranceEditCommand,
  ToleranceCatalogRequest,
  ToleranceCatalogResult,
  ToleranceEditCommand,
  TolerancePreviewRequest,
  TolerancePreviewResult,
} from '@vectorai/plugin-space-contracts';
import { createGbt1800Provider } from '@vectorai/engineering-annotation';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import {
  AnnotationSessionStateStore,
  FileAnnotationSessionStorage,
} from './session-state';
import {
  createDimensionChainStartTool,
  createDiameterAnnotationTool,
  createEngineeringAnnotationTool,
  createOpeningAngleAnnotationTool,
  createPartitionStartTool,
  createPartitionStatusTool,
  createGdtStartTool,
} from './tools';
import { FilePartitionStorage, PartitionSessionStore } from './partition-store';
import { PartitionWorkflowService } from './partition-service';
import { createPartitionSemanticPipeline, createPartitionSemanticReviewer } from './semantic-reviewer';
import { RecognitionPipelineRunner } from './recognition-runtime';
import { createDshRecognitionModelAdapter } from './dsh-recognition-model-adapter';
import { DimensionPlanStore, FileDimensionPlanStorage } from './dimension-plan-store';
import { DimensionInferenceService } from './dimension-inference-service';
import { acceptPendingPartitionForEvent } from './partition-auto-confirm';
import { GdtService } from './gdt-service';
import { createAutomaticGdtPipeline, createAutomaticGdtReviewer } from './gdt-reviewer';
import {
  AUTO_ANNOTATION_CONFLICTING_TOOLS,
  classifyPartitionDecisionEvent,
  isGenericAutoAnnotationEvent,
  isGenericAutoAnnotationText,
  requestAutomaticPartitionDecision,
} from './auto-annotation-route';
import { registerEngineeringDxfExport } from './drawing-export';
import { createToleranceReconciler, ToleranceService } from './tolerance-service';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingAnnotation: DrawingAnnotationHostService;
    drawingSpace: DrawingSpaceExtensionHost<Agent>;
  }
}

export class DrawingAnnotationHostService extends TypertRemoteService {
  static inject = ['tools', 'drawingSpace', 'attachments', 'userQuestions', 'agents', 'llm', 'subagents', 'connection'];

  private readonly automaticRouteDisposers = new Map<string, () => void>();
  private readonly automaticPartitionContinuations = new Map<string, 'confirmed' | 'skipped'>();
  private readonly automaticPartitionQuestions = new Map<string, Promise<'confirm' | 'skip'>>();
  readonly sessions: AnnotationSessionStateStore;
  readonly partitions: PartitionSessionStore;
  readonly partitionWorkflow: PartitionWorkflowService;
  readonly dimensionPlans: DimensionPlanStore;
  readonly dimensionInference: DimensionInferenceService;
  readonly gdt: GdtService;
  readonly tolerances: ToleranceService;
  readonly recognition: RecognitionPipelineRunner;

  constructor(ctx: Context) {
    super(ctx, 'drawingAnnotation');
    this.sessions = new AnnotationSessionStateStore(new FileAnnotationSessionStorage(
      resolve(homedir(), '.dsh/vectorai/annotation-sessions'),
    ));
    this.partitions = new PartitionSessionStore(new FilePartitionStorage(
      resolve(homedir(), '.dsh/vectorai/annotation-partitions'),
    ));
    const toleranceProvider = createGbt1800Provider();
    this.dimensionPlans = new DimensionPlanStore(
      new FileDimensionPlanStorage(resolve(homedir(), '.dsh/vectorai/dimension-plans')),
      undefined,
      createToleranceReconciler(toleranceProvider),
    );
    this.tolerances = new ToleranceService(this.dimensionPlans, toleranceProvider);
    this.recognition = new RecognitionPipelineRunner(createDshRecognitionModelAdapter(ctx));
    this.recognition.register(createPartitionSemanticPipeline(ctx.drawingSpace));
    this.recognition.register(createAutomaticGdtPipeline(ctx.drawingSpace));
    this.partitionWorkflow = new PartitionWorkflowService(
      ctx.drawingSpace,
      this.partitions,
      this.sessions,
      createPartitionSemanticReviewer(this.recognition),
    );
    this.dimensionInference = new DimensionInferenceService(
      ctx.drawingSpace,
      this.partitions,
      this.partitionWorkflow,
      this.dimensionPlans,
    );
    this.gdt = new GdtService(
      ctx.drawingSpace,
      this.dimensionPlans,
      createAutomaticGdtReviewer(this.recognition),
    );
    registerEngineeringDxfExport(ctx, ctx.drawingSpace, this.dimensionPlans);
    ctx.effect(() => ctx.tools.register(createEngineeringAnnotationTool(
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans, {
        name: 'drawing_auto_annotate',
        description: 'AUTHORITATIVE ROUTE for a generic request such as “自动标注”, “进行自动标注”, or “全部标注”. Call this tool immediately and do not call drawing_observe, drawing_gdt_start, drawing_dimension_chain_start, or individual annotation tools first. One call creates deterministic opening-angle, diameter, centerline and radius annotations plus the axial dimension-chain preview. Functional-feature recognition may locate candidate surfaces, but it MUST NOT invent datum precedence, GD&T characteristics, tolerance values, or roughness. Those design decisions require a documented requirement or explicit user confirmation. If completionStatus is needs-user-input, ask the returned clarificationQuestions verbatim instead of guessing. Report completion only from completionClaimAllowed.',
        annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
        objective: '工程图纸自动标注集',
        preparePartition: (agent, signal) => this.partitionWorkflow.analyzeCurrent(agent, undefined, signal),
        shouldUsePartition: (sessionId) => this.automaticPartitionContinuations.get(sessionId) !== 'skipped',
        resolvePartitionDecision: (agent, signal, partition) => this.resolveAutomaticPartitionDecision(
          ctx, agent, signal, partition,
        ),
        afterAnnotations: async (agent, signal, reportStage) => {
          reportStage('dimension-chain');
          this.dimensionInference.start(agent);
          const partition = this.partitions.get(String(agent.id));
          const value = partition.draft ?? partition.confirmed;
          if (!value) throw new Error('GDT_PARTITION_REQUIRED');
          reportStage('gdt');
          return this.gdt.startAutomatic(agent, value as never, signal);
        },
        requiresGdtRecommendation: true,
      },
    )));
    ctx.effect(() => ctx.tools.register(createOpeningAngleAnnotationTool(
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans,
    )));
    ctx.effect(() => ctx.tools.register(createDiameterAnnotationTool(
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans,
    )));
    ctx.effect(() => ctx.tools.register(createPartitionStartTool({
      start: (agent, engineeringContext, signal) => this.partitionWorkflow.analyzeCurrent(agent, engineeringContext, signal),
    })));
    ctx.effect(() => ctx.tools.register(createPartitionStatusTool(this.partitions)));
    ctx.effect(() => ctx.tools.register(createDimensionChainStartTool(this.dimensionInference)));
    ctx.effect(() => ctx.tools.register(createGdtStartTool(this.gdt)));
    ctx.on('agent/pre-step', async (payload, next) => {
      const decision = await next();
      if (decision.kind !== 'enter') return decision;
      const directUserObjective = [...decision.messages].reverse()
        .find((message) => message.source.kind === 'user')?.content
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map(({ text }) => text)
        .join('\n') ?? '';
      const sessionId = String(payload.agent.id);
      const continuation = this.automaticPartitionContinuations.get(sessionId);
      const annotation = this.sessions.get(sessionId);
      const awaitingPartitionDecision = continuation === undefined
        && annotation.workflow.status === 'reviewing'
        && annotation.workflow.workflowId?.startsWith('annotation_') === true
        && this.partitions.get(sessionId).phase === 'editing';
      if (awaitingPartitionDecision) return decision;
      if (!this.automaticRouteDisposers.has(sessionId)
        && continuation === undefined
        && !isGenericAutoAnnotationText(directUserObjective)) return decision;
      const instruction = [
        'The current direct user request activates VectorAI automatic annotation routing.',
        continuation === 'skipped'
          ? 'The user explicitly declined the partition preview. Call drawing_auto_annotate now; the plugin has recorded that partitioning must be skipped for this continuation.'
          : 'Call drawing_auto_annotate now with partitioning enabled, even if an older turn shows a failure from a previous plugin build.',
        'Do not substitute drawing_observe, an individual annotation tool, a guessed tool name, or a summary of existing state.',
        'Only a successful drawing_auto_annotate result with completionClaimAllowed=true permits a completion claim.',
      ].join(' ');
      return {
        kind: 'enter',
        messages: [...decision.messages, createUserMessage({
          content: [{ type: 'text', text: instruction }],
          source: {
            kind: 'plugin', plugin: '@vectorai/plugin-dsh-annotation-host', form: 'snapshot',
            sections: [{ name: 'vectorai:auto-annotation-route', text: instruction }],
          },
        })],
      };
    });
    ctx.on('tools/result', (execution, result) => {
      if (execution.name !== 'drawing_auto_annotate' || !execution.agent) return;
      const sessionId = String(execution.agent.id);
      this.automaticRouteDisposers.get(sessionId)?.();
      this.automaticRouteDisposers.delete(sessionId);
      this.automaticPartitionContinuations.delete(sessionId);
      this.automaticPartitionQuestions.delete(sessionId);
    });
    ctx.on('session/event', (session, event) => {
      const sessionId = String(session.id);
      const genericAutoRequest = isGenericAutoAnnotationEvent(event);
      if (event.type === 'user/message' && event.data.source.kind === 'user') {
        this.automaticRouteDisposers.get(sessionId)?.();
        this.automaticRouteDisposers.delete(sessionId);
        if (genericAutoRequest) {
          const agent = ctx.agents.get(session.id);
          if (agent) {
            this.automaticRouteDisposers.set(sessionId, agent.ctx.tools.restrict({
              deny: AUTO_ANNOTATION_CONFLICTING_TOOLS,
            }));
          }
        }
      }
      const annotation = this.sessions.get(sessionId);
      const awaitingAutomaticPartition = annotation.workflow.status === 'reviewing'
        && annotation.workflow.workflowId?.startsWith('annotation_') === true
        && this.partitions.get(sessionId).phase === 'editing';
      const partitionDecision = awaitingAutomaticPartition ? classifyPartitionDecisionEvent(event) : null;
      if (partitionDecision !== null) {
        const before = this.partitions.get(sessionId);
        if (before.drawingRef !== undefined) {
          if (partitionDecision === 'confirm') {
            this.partitions.confirmPending(sessionId);
            this.dimensionInference.markStaleSession(sessionId, before.drawingRef);
            this.automaticPartitionContinuations.set(sessionId, 'confirmed');
          } else {
            this.partitions.cancel(sessionId, before.drawingRef);
            this.automaticPartitionContinuations.set(sessionId, 'skipped');
          }
          const agent = ctx.agents.get(session.id);
          if (agent) this.automaticRouteDisposers.set(sessionId, agent.ctx.tools.restrict({
            deny: AUTO_ANNOTATION_CONFLICTING_TOOLS,
          }));
        }
      } else if (!awaitingAutomaticPartition && !genericAutoRequest) {
        acceptPendingPartitionForEvent(sessionId, event, this.partitions, this.sessions, (drawingRef) => {
          this.dimensionInference.markStaleSession(sessionId, drawingRef);
        });
      }
    });
    ctx.on('session/disposed', (session) => {
      const sessionId = String(session.id);
      this.automaticRouteDisposers.get(sessionId)?.();
      this.automaticRouteDisposers.delete(sessionId);
      this.automaticPartitionContinuations.delete(sessionId);
      this.automaticPartitionQuestions.delete(sessionId);
      this.partitionWorkflow.disposeSession(sessionId);
      this.sessions.disposeSession(sessionId);
    });
  }

  private async resolveAutomaticPartitionDecision(
    ctx: Context,
    agent: Agent,
    signal: AbortSignal | undefined,
    partition: PartitionSessionSnapshot,
  ): Promise<'confirm' | 'skip'> {
    const sessionId = String(agent.id);
    const inFlight = this.automaticPartitionQuestions.get(sessionId);
    if (inFlight) return await inFlight;
    const pending = (async () => {
      const decision = await requestAutomaticPartitionDecision(
        ctx.userQuestions, agent, signal, partition.draft?.segments.length ?? 0,
      );
      const current = this.partitions.get(sessionId);
      if (current.phase !== 'editing' || current.draft === undefined || current.drawingRef === undefined) {
        throw new Error('PARTITION_DECISION_STALE');
      }
      if (decision === 'confirm') {
        this.partitions.confirmPending(sessionId);
        this.dimensionInference.markStaleSession(sessionId, current.drawingRef);
      } else {
        this.partitions.cancel(sessionId, current.drawingRef);
      }
      return decision;
    })();
    this.automaticPartitionQuestions.set(sessionId, pending);
    try {
      return await pending;
    } finally {
      if (this.automaticPartitionQuestions.get(sessionId) === pending) {
        this.automaticPartitionQuestions.delete(sessionId);
      }
    }
  }

  @Remote
  getSessionState(agent: Agent): AnnotationSessionState {
    return this.sessions.get(String(agent.id));
  }

  @Remote
  importDrawing(agent: Agent, request: PartitionImportRequest['dxf']): Promise<PartitionSessionSnapshot> {
    return this.partitionWorkflow.importDrawing(agent, request);
  }

  @Remote
  stageDocuments(agent: Agent, request: EngineeringDocumentStageRequest): Promise<PartitionSessionSnapshot> {
    return this.partitionWorkflow.stageDocuments(agent, request.engineeringDocuments);
  }

  @Remote
  clearDocuments(agent: Agent): PartitionSessionSnapshot {
    return this.partitionWorkflow.clearDocuments(agent);
  }

  @Remote
  importAndAnalyze(agent: Agent, request: PartitionImportRequest): Promise<PartitionSessionSnapshot> {
    return this.partitionWorkflow.importAndAnalyze(agent, request);
  }

  @Remote
  supplementDocuments(agent: Agent, request: PartitionDocumentSupplementRequest): Promise<PartitionSessionSnapshot> {
    return this.partitionWorkflow.supplementDocuments(agent, request);
  }

  @Remote
  getPartitionState(agent: Agent): PartitionSessionSnapshot {
    return this.partitionWorkflow.getState(agent);
  }

  @Remote
  editPartition(agent: Agent, command: PartitionEditCommand): PartitionSessionSnapshot {
    const result = this.partitionWorkflow.edit(agent, command);
    this.dimensionInference.markStale(agent, result.drawingRef ?? command.expectedDrawingRef);
    return result;
  }

  @Remote
  confirmPartition(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    const result = this.partitionWorkflow.confirm(agent, expected);
    this.dimensionInference.markStale(agent, result.drawingRef ?? expected);
    return result;
  }

  @Remote
  cancelPartition(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    return this.partitionWorkflow.cancel(agent, expected);
  }

  @Remote
  reopenPartition(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    return this.partitionWorkflow.reopen(agent, expected);
  }

  @Remote
  undoPartition(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    return this.partitionWorkflow.undo(agent, expected);
  }

  @Remote
  redoPartition(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    return this.partitionWorkflow.redo(agent, expected);
  }

  @Remote
  getDimensionPlan(agent: Agent): DimensionPlanSessionSnapshot {
    return this.dimensionInference.getState(agent);
  }

  @Remote
  editDimensionScheme(agent: Agent, command: DimensionSchemeEditCommand): DimensionPlanSessionSnapshot {
    return this.dimensionInference.edit(agent, command);
  }

  @Remote
  editGeometricTolerance(agent: Agent, command: GeometricToleranceEditCommand): DimensionPlanSessionSnapshot {
    return this.gdt.edit(agent, command);
  }

  @Remote
  confirmDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const result = this.dimensionInference.confirm(agent, expected);
    const sessionId = String(agent.id);
    if (this.sessions.get(sessionId).workflow.status === 'reviewing') this.sessions.finish(sessionId, 'completed');
    return result;
  }

  @Remote
  cancelDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    const result = this.dimensionInference.cancel(agent, expected);
    const sessionId = String(agent.id);
    if (this.sessions.get(sessionId).workflow.status === 'reviewing') this.sessions.finish(sessionId, 'canceled');
    return result;
  }

  @Remote
  undoDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.dimensionInference.undo(agent, expected);
  }

  @Remote
  redoDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.dimensionInference.redo(agent, expected);
  }

  @Remote
  queryToleranceCatalog(agent: Agent, request: ToleranceCatalogRequest): ToleranceCatalogResult {
    return this.tolerances.query(String(agent.id), request);
  }

  @Remote
  previewTolerance(agent: Agent, request: TolerancePreviewRequest): TolerancePreviewResult {
    return this.tolerances.preview(String(agent.id), request);
  }

  @Remote
  editTolerance(agent: Agent, command: ToleranceEditCommand): DimensionPlanSessionSnapshot {
    return this.tolerances.edit(String(agent.id), command);
  }
}

export default DrawingAnnotationHostService;
