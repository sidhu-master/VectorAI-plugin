// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
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
import { createPartitionSemanticReviewer } from './semantic-reviewer';
import { RecognitionPipelineRunner } from './recognition-runtime';
import { createDshRecognitionModelAdapter } from './dsh-recognition-model-adapter';
import { createAnnotationRecognitionRunner } from './annotation-recognition-runtime';
import { createEngineeringAnnotationPlanner } from './deterministic-annotation-pipeline';
import { createAxialDimensionInference } from './axial-dimension-pipeline';
import { DimensionPlanStore, FileDimensionPlanStorage } from './dimension-plan-store';
import { DimensionInferenceService } from './dimension-inference-service';
import { GdtService } from './gdt-service';
import { createAutomaticGdtReviewer } from './gdt-reviewer';
import {
  requestAutomaticPartitionDecision,
} from './automatic-partition-question';
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
    this.recognition = createAnnotationRecognitionRunner(
      createDshRecognitionModelAdapter(ctx),
      ctx.drawingSpace,
    );
    const deterministicAnnotations = createEngineeringAnnotationPlanner(this.recognition);
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
      createAxialDimensionInference(this.recognition),
    );
    this.gdt = new GdtService(
      ctx.drawingSpace,
      this.dimensionPlans,
      createAutomaticGdtReviewer(this.recognition),
    );
    registerEngineeringDxfExport(ctx, ctx.drawingSpace, this.dimensionPlans);
    ctx.effect(() => ctx.tools.register(createEngineeringAnnotationTool(
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans, {
        planner: deterministicAnnotations,
        name: 'drawing_auto_annotate',
        description: 'Complete the engineering annotation workflow in one call when the user asks for the full drawing to be annotated. This creates deterministic opening-angle, diameter, centerline and radius annotations, then the axial dimension chain, datum/GD&T candidates and surface texture. Functional-feature recognition may locate candidate surfaces, but it MUST NOT invent datum precedence, GD&T characteristics, tolerance values, or roughness. Those design decisions require a documented requirement or explicit user confirmation. If completionStatus is needs-user-input, ask the returned clarificationQuestions verbatim. If completionStatus is complete and terminal=true, report the visible editable result and end this request; do not call generic drawing observation, selection, preview, evaluation or finalize tools afterward.',
        annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
        objective: '工程图纸自动标注集',
        preparePartition: (agent, signal) => this.partitionWorkflow.analyzeCurrent(agent, undefined, signal),
        resolvePartitionDecision: (agent, signal, partition) => this.resolveAutomaticPartitionDecision(
          ctx, agent, signal, partition,
        ),
        afterAnnotations: async (agent, signal, reportStage) => {
          reportStage('dimension-chain');
          await this.dimensionInference.start(agent, undefined, signal);
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
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans, deterministicAnnotations,
    )));
    ctx.effect(() => ctx.tools.register(createDiameterAnnotationTool(
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans, deterministicAnnotations,
    )));
    ctx.effect(() => ctx.tools.register(createPartitionStartTool({
      start: (agent, engineeringContext, signal) => this.partitionWorkflow.analyzeCurrent(agent, engineeringContext, signal),
    })));
    ctx.effect(() => ctx.tools.register(createPartitionStatusTool(this.partitions)));
    ctx.effect(() => ctx.tools.register(createDimensionChainStartTool(this.dimensionInference)));
    ctx.effect(() => ctx.tools.register(createGdtStartTool(this.gdt)));
    ctx.on('session/disposed', (session) => {
      const sessionId = String(session.id);
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
