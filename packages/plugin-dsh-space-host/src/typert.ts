// SPDX-License-Identifier: Apache-2.0

import {
  drawingSessionIdSchema,
  drawingWorkspaceCommitRequestSchema,
  drawingWorkspaceCommitResultSchema,
  drawingWorkspaceSnapshotSchema,
} from '@vectorai/plugin-space-contracts';

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

export const TYPERT = {
  package: '@vectorai/plugin-dsh-space-host',
  face: 'host',
  schemas: [],
  invocations: [{
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
    sourceLocation: {
      file: 'packages/plugin-dsh-space-host/src/service.ts',
      line: 40,
      column: 3,
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
    sourceLocation: {
      file: 'packages/plugin-dsh-space-host/src/service.ts',
      line: 45,
      column: 3,
    },
  }],
  model: {
    services: [],
    events: [],
    objects: [],
  },
} as const;

export default TYPERT;
