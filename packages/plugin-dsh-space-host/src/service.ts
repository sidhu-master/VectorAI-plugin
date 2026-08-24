// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceSnapshot,
  DrawingQueryRequest,
  DrawingQueryResult,
  DrawingSelectionProjectionRequest,
  DrawingSelectionProjectionResult,
  DrawingWorkspacePreview,
  DrawingGroundingOverlay,
  DrawingMotionRigProjection,
  DrawingMotionRigResult,
  DrawingMotionRigDiscardResult,
  DrawingMotionRigRebuildRequest,
  DrawingMotionRigDiscardRequest,
  DrawingUndoStageRequest,
  DrawingUndoStageResult,
  DrawingRedoStageRequest,
  DrawingRedoStageResult,
  ExtensionPreviewCreateRequest,
  ExtensionPreviewCreateResult,
  ExtensionPreviewReplaceRequest,
  ExtensionPreviewAssessmentResult,
  ExtensionPreviewControlRequest,
  ExtensionPreviewFinalizeResult,
  ExtensionPreviewDiscardResult,
} from '@vectorai/plugin-space-contracts';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { createPreStepIntake } from './intake';
import { InMemoryDrawingRepository } from './repository';
import { FileDrawingRepositoryStorage } from './repository-storage';
import {
  createDrawingAgentToolCatalog,
} from './tools';
import { LocalCleanLineVectorizer } from './vectorizer';
import { SemanticEditService } from './semantic-edit-service';
import type { ExtensionProgramRequest } from './semantic-edit-service';
import { InteractiveEditService } from './interactive-edit';
import { MotionRigService } from './motion-rig-service';
import { registerDrawingCommands } from './commands';
import { createDshReviewer } from './reviewer';
import { renderDrawingObservation } from './review-renderer';
import type { DrawingInteractiveStageResult } from '@vectorai/drawing-workspace';
import type { OperationLookupResult } from '@vectorai/drawing-edit-protocol';
import { ExtensionPreviewService } from './extension-preview-service';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingSpace: DrawingSpaceHostService;
  }
}

export class DrawingSpaceHostService extends TypertRemoteService {
  static inject = ['tools', 'attachments', 'userQuestions', 'commands', 'agents', 'subagents'];

  private readonly drawings: InMemoryDrawingRepository;
  private readonly semantic: SemanticEditService;
  private readonly interactive: InteractiveEditService;
  private readonly motionRigs: MotionRigService;
  private readonly extensionPreviews: ExtensionPreviewService;

  constructor(ctx: Context) {
    super(ctx, 'drawingSpace');
    this.drawings = new InMemoryDrawingRepository({
      vectorizer: new LocalCleanLineVectorizer(),
      storage: new FileDrawingRepositoryStorage(resolve(homedir(), '.dsh/vectorai/drawings')),
    });
    const editPorts = {
      id: (kind) => `${kind}_${randomUUID()}`,
      now: Date.now,
      digest: (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`,
      renderObservation: async (input) => {
        const rendered = await renderDrawingObservation(input);
        const attachment = await ctx.attachments.saveImage({
          data: rendered.png,
          mediaType: 'image/png',
          name: 'drawing-observation.png',
        });
        return {
          contentDigest: rendered.contentDigest,
          attachment,
          width: rendered.manifest.width,
          height: rendered.manifest.height,
          worldToImage: rendered.manifest.worldToImage,
        };
      },
      review: createDshReviewer(ctx),
    };
    this.semantic = new SemanticEditService(this.drawings, editPorts);
    this.extensionPreviews = new ExtensionPreviewService(this.drawings, this.semantic, editPorts);
    this.interactive = new InteractiveEditService(this.drawings, editPorts);
    this.motionRigs = new MotionRigService(this.drawings);
    ctx.effect(() => registerDrawingCommands(ctx.commands, this.interactive, this.semantic));
    for (const tool of createDrawingAgentToolCatalog(
      this.drawings,
      ctx.attachments,
      this.semantic,
      ctx.userQuestions,
      this.motionRigs,
    )) {
      ctx.tools.register(tool);
    }
    ctx.on('agent/pre-step', createPreStepIntake(this.drawings, this.semantic, {
      isRuntimeRoot: (agent) => ctx.agents.roots().includes(agent),
    }));
    ctx.on('session/disposed', (session) => {
      this.semantic.disposeSession(String(session.id));
      this.motionRigs.disposeSession(String(session.id));
      this.extensionPreviews.disposeSession(String(session.id));
      this.drawings.disposeSession(String(session.id));
    });
  }

  @Remote
  getSnapshot(agent: Agent): DrawingWorkspaceSnapshot | null {
    return this.drawings.getSnapshot(String(agent.id));
  }

  @Remote
  query(agent: Agent, request: DrawingQueryRequest): DrawingQueryResult {
    return this.drawings.query(String(agent.id), request);
  }

  @Remote
  projectSelection(
    agent: Agent,
    request: DrawingSelectionProjectionRequest,
  ): DrawingSelectionProjectionResult {
    return this.semantic.projectSelection(String(agent.id), request);
  }

  @Remote
  getGroundingOverlay(agent: Agent): DrawingGroundingOverlay | null {
    return this.semantic.currentGroundingOverlay(String(agent.id));
  }

  @Remote
  getMotionRig(agent: Agent): DrawingMotionRigProjection | null {
    return this.motionRigs.current(String(agent.id));
  }

  @Remote
  rebuildMotionRig(
    agent: Agent,
    request: DrawingMotionRigRebuildRequest,
  ): DrawingMotionRigResult {
    return this.motionRigs.rebuild(String(agent.id), request.ref, request.nodeIds);
  }

  @Remote
  discardMotionRig(
    agent: Agent,
    request: DrawingMotionRigDiscardRequest,
  ): DrawingMotionRigDiscardResult {
    return this.motionRigs.discard(String(agent.id), request.ref);
  }

  @Remote
  stageInteractiveEdit(
    agent: Agent,
    request: DrawingWorkspaceCommitRequest,
  ): DrawingInteractiveStageResult {
    return this.interactive.stage(String(agent.id), request);
  }

  @Remote
  stageUndo(agent: Agent, request: DrawingUndoStageRequest): DrawingUndoStageResult {
    return this.semantic.stageUndo(String(agent.id), request);
  }

  @Remote
  stageRedo(agent: Agent, request: DrawingRedoStageRequest): DrawingRedoStageResult {
    return this.semantic.stageRedo(String(agent.id), request);
  }

  @Remote
  getOperation(
    agent: Agent,
    operationId: string,
    operationBindingDigest: string,
  ): OperationLookupResult {
    return this.semantic.getOperation(String(agent.id), operationId, operationBindingDigest);
  }

  @Remote
  createExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewCreateRequest,
  ): Promise<ExtensionPreviewCreateResult> {
    return this.extensionPreviews.create(String(agent.id), request);
  }

  @Remote
  replaceExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewReplaceRequest,
  ): Promise<ExtensionPreviewCreateResult> {
    return this.extensionPreviews.replace(String(agent.id), request);
  }

  @Remote
  assessExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewControlRequest,
  ): Promise<ExtensionPreviewAssessmentResult> {
    return this.extensionPreviews.assess(String(agent.id), request);
  }

  @Remote
  finalizeExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewControlRequest,
  ): Promise<ExtensionPreviewFinalizeResult> {
    return this.extensionPreviews.finalize(String(agent.id), request);
  }

  @Remote
  discardExtensionPreview(
    agent: Agent,
    request: ExtensionPreviewControlRequest,
  ): Promise<ExtensionPreviewDiscardResult> {
    return this.extensionPreviews.discard(String(agent.id), request);
  }

  async runExtensionProgram(agent: Agent, request: ExtensionProgramRequest, signal?: AbortSignal) {
    const sessionId = String(agent.id);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (snapshot === null) throw new Error('DRAWING_REQUIRED');
    const extensionId = 'vectorai.one-shot-extension';
    const workflowId = `workflow_${randomUUID()}`;
    const preview = await this.extensionPreviews.create(sessionId, {
      extensionId,
      workflowId,
      ref: snapshot.ref,
      targetNodeIds: request.targetNodeIds,
      ...(request.interfaces === undefined ? {} : { interfaces: request.interfaces.map((binding) => ({
        interfaceId: binding.interfaceId,
        nodeId: binding.nodeId,
        endpoint: binding.endpoint,
      })) }),
      program: request.program,
    }, signal);
    if (preview.status !== 'previewed') return { preview, result: preview };
    const control = {
      extensionId,
      workflowId,
      ref: preview.ref,
      previewToken: preview.previewToken,
      candidateDigest: preview.candidateDigest,
    };
    const assessed = await this.extensionPreviews.assess(sessionId, control, signal);
    if (assessed.status !== 'assessed') return { preview, assessed, result: assessed };
    const finalized = await this.extensionPreviews.finalize(sessionId, control);
    return {
      preview,
      assessment: assessed.assessment,
      result: finalized.status === 'finalized' ? finalized.result : finalized,
    };
  }

  @Remote
  getPreview(agent: Agent): DrawingWorkspacePreview | null {
    return this.drawings.getPreview(String(agent.id));
  }

}

export default DrawingSpaceHostService;
