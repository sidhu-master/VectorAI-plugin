// SPDX-License-Identifier: Apache-2.0

import {
  drawingSessionIdSchema,
  drawingQueryRequestSchema,
  drawingQueryResultSchema,
  drawingPreviewControlRequestSchema,
  drawingPreviewCreateRequestSchema,
  drawingPreviewCreateResultSchema,
  drawingPreviewDiscardResultSchema,
  drawingPreviewSchema,
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
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/query',
    service: 'drawingSpace',
    namespace: 'drawingSpace',
    method: 'query',
    invocation: { kind: 'direct' },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, {
      name: 'request',
      wire: 'request',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: '@vectorai/plugin-space-contracts#DrawingQueryRequest',
        schema: drawingQueryRequestSchema,
      },
    }],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingQueryResult',
      schema: drawingQueryResultSchema,
    },
    sourceLocation: {
      file: 'packages/plugin-dsh-space-host/src/service.ts',
      line: 60,
      column: 3,
    },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getPreview',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getPreview',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspacePreview|null',
      schema: drawingPreviewSchema.nullable(),
    },
    sourceLocation: serviceLocation(65),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/createPreview',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'createPreview',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest(
      '@vectorai/plugin-space-contracts#DrawingWorkspacePreviewCreateRequest',
      drawingPreviewCreateRequestSchema,
    )],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspacePreviewCreateResult',
      schema: drawingPreviewCreateResultSchema,
    },
    sourceLocation: serviceLocation(70),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/commitPreview',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'commitPreview',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest(
      '@vectorai/plugin-space-contracts#DrawingWorkspacePreviewControlRequest',
      drawingPreviewControlRequestSchema,
    )],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspaceCommitResult',
      schema: drawingWorkspaceCommitResultSchema,
    },
    sourceLocation: serviceLocation(78),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/discardPreview',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'discardPreview',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest(
      '@vectorai/plugin-space-contracts#DrawingWorkspacePreviewControlRequest',
      drawingPreviewControlRequestSchema,
    )],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspacePreviewDiscardResult',
      schema: drawingPreviewDiscardResultSchema,
    },
    sourceLocation: serviceLocation(86),
  }],
  model: {
    services: [],
    events: [],
    objects: [],
  },
} as const;

function jsonRequest(typeSymbol: string, schema: { parse(input: unknown): unknown }) {
  return {
    name: 'request', wire: 'request', source: 'json',
    codec: { mode: 'strict', typeSymbol, schema },
  } as const;
}

function serviceLocation(line: number) {
  return { file: 'packages/plugin-dsh-space-host/src/service.ts', line, column: 3 } as const;
}

export default TYPERT;
