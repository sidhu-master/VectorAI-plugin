// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {
  AnnotationSessionState,
  DrawingSpaceExtensionHost,
  DrawingRef,
  PartitionDocumentSupplementRequest,
  PartitionEditCommand,
  PartitionImportRequest,
  PartitionSessionSnapshot,
} from '@vectorai/plugin-space-contracts';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import {
  AnnotationSessionStateStore,
  FileAnnotationSessionStorage,
} from './session-state';
import { createEngineeringAnnotationTool, createPartitionStartTool, createPartitionStatusTool } from './tools';
import { FilePartitionStorage, PartitionSessionStore } from './partition-store';
import { PartitionWorkflowService } from './partition-service';
import { createPartitionSemanticReviewer } from './semantic-reviewer';
import { DimensionPlanStore, FileDimensionPlanStorage } from './dimension-plan-store';

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
    ctx.effect(() => ctx.tools.register(createEngineeringAnnotationTool(ctx.drawingSpace, this.sessions, this.partitions)));
    ctx.effect(() => ctx.tools.register(createPartitionStartTool({
      start: (agent, engineeringContext, signal) => this.partitionWorkflow.analyzeCurrent(agent, engineeringContext, signal),
    })));
    ctx.effect(() => ctx.tools.register(createPartitionStatusTool(this.partitions)));
    ctx.on('session/disposed', (session) => this.sessions.disposeSession(String(session.id)));
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
    return this.partitionWorkflow.edit(agent, command);
  }

  @Remote
  confirmPartition(agent: Agent, expected: DrawingRef): PartitionSessionSnapshot {
    return this.partitionWorkflow.confirm(agent, expected);
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
}

export default DrawingAnnotationHostService;
