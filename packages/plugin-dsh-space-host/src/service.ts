// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { DrawingCanvasProjection } from '@vectorai/plugin-space-contracts';

import { createPreStepIntake } from './intake';
import { InMemoryDrawingRepository } from './repository';
import { createDrawingImportTool, createDrawingSummarizeTool } from './tools';
import { ProvisionalFootprintVectorizer } from './vectorizer';

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
      vectorizer: new ProvisionalFootprintVectorizer(),
    });
    ctx.tools.register(createDrawingImportTool(this.drawings, ctx.attachments));
    ctx.tools.register(createDrawingSummarizeTool(this.drawings));
    ctx.on('agent/pre-step', createPreStepIntake(this.drawings));
    ctx.on('session/disposed', (session) => {
      this.drawings.disposeSession(String(session.id));
    });
  }

  @Remote
  getProjection(sessionId: string): DrawingCanvasProjection | null {
    return this.drawings.getProjection(sessionId);
  }
}

export default DrawingSpaceHostService;
