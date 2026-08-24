// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {
  AnnotationSessionState,
  DrawingSpaceExtensionHost,
} from '@vectorai/plugin-space-contracts';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import {
  AnnotationSessionStateStore,
  FileAnnotationSessionStorage,
} from './session-state';
import { createEngineeringAnnotationTool } from './tools';

declare module '@deepseek-ai/cordis' {
  interface Context {
    drawingAnnotation: DrawingAnnotationHostService;
    drawingSpace: DrawingSpaceExtensionHost<Agent>;
  }
}

export class DrawingAnnotationHostService extends TypertRemoteService {
  static inject = ['tools', 'drawingSpace'];

  readonly sessions: AnnotationSessionStateStore;

  constructor(ctx: Context) {
    super(ctx, 'drawingAnnotation');
    this.sessions = new AnnotationSessionStateStore(new FileAnnotationSessionStorage(
      resolve(homedir(), '.dsh/vectorai/annotation-sessions'),
    ));
    ctx.effect(() => ctx.tools.register(createEngineeringAnnotationTool(ctx.drawingSpace, this.sessions)));
    ctx.on('session/disposed', (session) => this.sessions.disposeSession(String(session.id)));
  }

  @Remote
  getSessionState(agent: Agent): AnnotationSessionState {
    return this.sessions.get(String(agent.id));
  }
}

export default DrawingAnnotationHostService;
