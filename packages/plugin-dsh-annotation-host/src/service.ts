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
} from '@vectorai/plugin-space-contracts';
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
import { DimensionPlanStore, FileDimensionPlanStorage } from './dimension-plan-store';
import { DimensionInferenceService } from './dimension-inference-service';
import { acceptPendingPartitionForEvent } from './partition-auto-confirm';
import { GdtService } from './gdt-service';
import { createAutomaticGdtReviewer } from './gdt-reviewer';
import {
  AUTO_ANNOTATION_CONFLICTING_TOOLS,
  isGenericAutoAnnotationEvent,
  isGenericAutoAnnotationText,
} from './auto-annotation-route';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingAnnotation: DrawingAnnotationHostService;
    drawingSpace: DrawingSpaceExtensionHost<Agent>;
  }
}

export class DrawingAnnotationHostService extends TypertRemoteService {
  static inject = ['tools', 'drawingSpace', 'attachments', 'agents', 'subagents'];

  readonly sessions: AnnotationSessionStateStore;
  readonly partitions: PartitionSessionStore;
  readonly partitionWorkflow: PartitionWorkflowService;
  readonly dimensionPlans: DimensionPlanStore;
  readonly dimensionInference: DimensionInferenceService;
  readonly gdt: GdtService;

  constructor(ctx: Context) {
    super(ctx, 'drawingAnnotation');
    this.sessions = new AnnotationSessionStateStore(new FileAnnotationSessionStorage(
      resolve(homedir(), '.dsh/vectorai/annotation-sessions'),
    ));
    this.partitions = new PartitionSessionStore(new FilePartitionStorage(
      resolve(homedir(), '.dsh/vectorai/annotation-partitions'),
    ));
    this.dimensionPlans = new DimensionPlanStore(new FileDimensionPlanStorage(
      resolve(homedir(), '.dsh/vectorai/dimension-plans'),
    ));
    this.partitionWorkflow = new PartitionWorkflowService(
      ctx.drawingSpace,
      this.partitions,
      this.sessions,
      createPartitionSemanticReviewer(ctx, ctx.drawingSpace),
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
      createAutomaticGdtReviewer(ctx, ctx.drawingSpace),
    );
    ctx.effect(() => ctx.tools.register(createEngineeringAnnotationTool(
      ctx.drawingSpace, this.sessions, this.partitions, this.dimensionPlans, {
        name: 'drawing_auto_annotate',
        description: 'AUTHORITATIVE ROUTE for a generic request such as “自动标注”, “进行自动标注”, or “全部标注”. Call this tool immediately and do not call drawing_observe, drawing_gdt_start, drawing_dimension_chain_start, or individual annotation tools first. One call creates opening angles and shaft diameters, starts the axial dimension-chain preview, and performs an isolated AI semantic review for datum and GD&T candidates; all coordinates and geometry grounding remain local. Report completion only from completionClaimAllowed.',
        annotationKinds: ['opening-angle', 'diameter'],
        objective: '工程图纸自动标注集',
        afterAnnotations: async (agent, signal) => {
          this.dimensionInference.start(agent);
          const partition = this.partitions.get(String(agent.id));
          const value = partition.draft ?? partition.confirmed;
          if (!value) throw new Error('GDT_PARTITION_REQUIRED');
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
    const automaticRouteDisposers = new Map<string, () => void>();
    ctx.on('agent/pre-step', async (payload, next) => {
      const decision = await next();
      if (decision.kind !== 'enter') return decision;
      const directUserObjective = [...decision.messages].reverse()
        .find((message) => message.source.kind === 'user')?.content
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map(({ text }) => text)
        .join('\n') ?? '';
      if (!automaticRouteDisposers.has(String(payload.agent.id))
        && !isGenericAutoAnnotationText(directUserObjective)) return decision;
      const instruction = [
        'The current direct user request activates VectorAI automatic annotation routing.',
        'Call drawing_auto_annotate now, even if an older turn shows a failure from a previous plugin build.',
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
      void result;
      if (execution.name !== 'drawing_auto_annotate' || !execution.agent) return;
      const sessionId = String(execution.agent.id);
      automaticRouteDisposers.get(sessionId)?.();
      automaticRouteDisposers.delete(sessionId);
    });
    ctx.on('session/event', (session, event) => {
      const sessionId = String(session.id);
      if (event.type === 'user/message' && event.data.source.kind === 'user') {
        automaticRouteDisposers.get(sessionId)?.();
        automaticRouteDisposers.delete(sessionId);
        if (isGenericAutoAnnotationEvent(event)) {
          const agent = ctx.agents.get(session.id);
          if (agent) {
            automaticRouteDisposers.set(sessionId, agent.ctx.tools.restrict({
              deny: AUTO_ANNOTATION_CONFLICTING_TOOLS,
            }));
          }
        }
      }
      acceptPendingPartitionForEvent(sessionId, event, this.partitions, this.sessions, (drawingRef) => {
        this.dimensionInference.markStaleSession(sessionId, drawingRef);
      });
    });
    ctx.on('session/disposed', (session) => {
      const sessionId = String(session.id);
      automaticRouteDisposers.get(sessionId)?.();
      automaticRouteDisposers.delete(sessionId);
      this.partitionWorkflow.disposeSession(sessionId);
      this.sessions.disposeSession(sessionId);
    });
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
    return this.dimensionInference.confirm(agent, expected);
  }

  @Remote
  cancelDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.dimensionInference.cancel(agent, expected);
  }

  @Remote
  undoDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.dimensionInference.undo(agent, expected);
  }

  @Remote
  redoDimensionPlan(agent: Agent, expected: DrawingRef): DimensionPlanSessionSnapshot {
    return this.dimensionInference.redo(agent, expected);
  }
}

export default DrawingAnnotationHostService;
