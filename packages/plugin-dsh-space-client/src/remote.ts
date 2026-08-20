// SPDX-License-Identifier: Apache-2.0

import type {
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol';
import {
  drawingSessionIdSchema,
  drawingWorkspaceCommitRequestSchema,
  drawingWorkspaceCommitResultSchema,
  drawingWorkspaceSnapshotSchema,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/plugin-space-contracts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    drawingSpace: {
      getSnapshot(sessionId: string): Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
      commit(
        sessionId: string,
        request: DrawingWorkspaceCommitRequest,
      ): Promise<RemoteResult<DrawingWorkspaceCommitResult>>;
    };
  }

  interface TypertRemoteMap {
    'drawingSpace/getSnapshot': (
      sessionId: string,
    ) => Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
    'drawingSpace/commit': (
      sessionId: string,
      request: DrawingWorkspaceCommitRequest,
    ) => Promise<RemoteResult<DrawingWorkspaceCommitResult>>;
  }
}

const agentCodec = {
  mode: 'strict',
  typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
  schema: drawingSessionIdSchema,
} as const;
const agentParameter = {
  name: 'agent',
  wire: 'agentId',
  source: 'lookup',
  lookup: 'agent',
  codec: agentCodec,
} as const;

export const DRAWING_SPACE_REMOTE: TypertRemoteContribution = {
  package: '@vectorai/plugin-dsh-space-host',
  descriptors: [{
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getSnapshot',
    service: 'drawingSpace',
    namespace: 'drawingSpace',
    method: 'getSnapshot',
    invocation: { kind: 'direct' },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspaceSnapshot|null',
      schema: drawingWorkspaceSnapshotSchema,
    },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/commit',
    service: 'drawingSpace',
    namespace: 'drawingSpace',
    method: 'commit',
    invocation: { kind: 'direct' },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, {
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspaceCommitRequest',
        schema: drawingWorkspaceCommitRequestSchema,
      },
    }],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspaceCommitResult',
      schema: drawingWorkspaceCommitResultSchema,
    },
  }],
};
