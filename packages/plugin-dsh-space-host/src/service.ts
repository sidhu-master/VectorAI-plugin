// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspaceSnapshot,
  DrawingQueryRequest,
  DrawingQueryResult,
  DrawingWorkspacePreview,
  DrawingWorkspacePreviewControlRequest,
  DrawingWorkspacePreviewCreateRequest,
  DrawingWorkspacePreviewCreateResult,
  DrawingWorkspacePreviewDiscardResult,
} from '@vectorai/plugin-space-contracts';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { createPreStepIntake } from './intake';
import { InMemoryDrawingRepository } from './repository';
import { FileDrawingRepositoryStorage } from './repository-storage';
import {
  createDrawingImportTool,
  createDrawingCommitPreviewTool,
  createDrawingDiscardPreviewTool,
  createDrawingPreviewTool,
  createDrawingQueryTool,
  createDrawingSummarizeTool,
} from './tools';
import { LocalCleanLineVectorizer } from './vectorizer';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingSpace: DrawingSpaceHostService;
  }
}

export class DrawingSpaceHostService extends TypertRemoteService {
  static inject = ['tools', 'attachments'];

  private readonly drawings: InMemoryDrawingRepository;

  constructor(ctx: Context) {
    super(ctx, 'drawingSpace');
    this.drawings = new InMemoryDrawingRepository({
      vectorizer: new LocalCleanLineVectorizer(),
      storage: new FileDrawingRepositoryStorage(resolve(homedir(), '.dsh/vectorai/drawings')),
    });
    ctx.tools.register(createDrawingImportTool(this.drawings, ctx.attachments));
    ctx.tools.register(createDrawingSummarizeTool(this.drawings));
    ctx.tools.register(createDrawingQueryTool(this.drawings));
    ctx.tools.register(createDrawingPreviewTool(this.drawings));
    ctx.tools.register(createDrawingCommitPreviewTool(this.drawings));
    ctx.tools.register(createDrawingDiscardPreviewTool(this.drawings));
    ctx.on('agent/pre-step', createPreStepIntake(this.drawings));
    ctx.on('session/disposed', (session) => {
      this.drawings.disposeSession(String(session.id));
    });
  }

  @Remote
  getSnapshot(agent: Agent): DrawingWorkspaceSnapshot | null {
    return this.drawings.getSnapshot(String(agent.id));
  }

  @Remote
  commit(agent: Agent, request: DrawingWorkspaceCommitRequest): DrawingWorkspaceCommitResult {
    return this.drawings.commit(String(agent.id), request);
  }

  @Remote
  query(agent: Agent, request: DrawingQueryRequest): DrawingQueryResult {
    return this.drawings.query(String(agent.id), request);
  }

  @Remote
  getPreview(agent: Agent): DrawingWorkspacePreview | null {
    return this.drawings.getPreview(String(agent.id));
  }

  @Remote
  createPreview(
    agent: Agent,
    request: DrawingWorkspacePreviewCreateRequest,
  ): DrawingWorkspacePreviewCreateResult {
    return this.drawings.createPreview(String(agent.id), request);
  }

  @Remote
  commitPreview(
    agent: Agent,
    request: DrawingWorkspacePreviewControlRequest,
  ): DrawingWorkspaceCommitResult {
    return this.drawings.commitPreview(String(agent.id), request);
  }

  @Remote
  discardPreview(
    agent: Agent,
    request: DrawingWorkspacePreviewControlRequest,
  ): DrawingWorkspacePreviewDiscardResult {
    return this.drawings.discardPreview(String(agent.id), request);
  }
}

export default DrawingSpaceHostService;
