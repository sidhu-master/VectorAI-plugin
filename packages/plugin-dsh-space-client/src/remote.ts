// SPDX-License-Identifier: Apache-2.0

import type {
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol';
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
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspaceCommitResult,
  type DrawingWorkspaceSnapshot,
  type DrawingQueryRequest,
  type DrawingQueryResult,
  type DrawingWorkspacePreview,
  type DrawingWorkspacePreviewControlRequest,
  type DrawingWorkspacePreviewCreateRequest,
  type DrawingWorkspacePreviewCreateResult,
  type DrawingWorkspacePreviewDiscardResult,
} from '@vectorai/plugin-space-contracts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    drawingSpace: {
      getSnapshot(sessionId: string): Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
      commit(
        sessionId: string,
        request: DrawingWorkspaceCommitRequest,
      ): Promise<RemoteResult<DrawingWorkspaceCommitResult>>;
      query(
        sessionId: string,
        request: DrawingQueryRequest,
      ): Promise<RemoteResult<DrawingQueryResult>>;
      getPreview(sessionId: string): Promise<RemoteResult<DrawingWorkspacePreview | null>>;
      createPreview(
        sessionId: string,
        request: DrawingWorkspacePreviewCreateRequest,
      ): Promise<RemoteResult<DrawingWorkspacePreviewCreateResult>>;
      commitPreview(
        sessionId: string,
        request: DrawingWorkspacePreviewControlRequest,
      ): Promise<RemoteResult<DrawingWorkspaceCommitResult>>;
      discardPreview(
        sessionId: string,
        request: DrawingWorkspacePreviewControlRequest,
      ): Promise<RemoteResult<DrawingWorkspacePreviewDiscardResult>>;
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
    'drawingSpace/query': (
      sessionId: string,
      request: DrawingQueryRequest,
    ) => Promise<RemoteResult<DrawingQueryResult>>;
    'drawingSpace/getPreview': (
      sessionId: string,
    ) => Promise<RemoteResult<DrawingWorkspacePreview | null>>;
    'drawingSpace/createPreview': (
      sessionId: string,
      request: DrawingWorkspacePreviewCreateRequest,
    ) => Promise<RemoteResult<DrawingWorkspacePreviewCreateResult>>;
    'drawingSpace/commitPreview': (
      sessionId: string,
      request: DrawingWorkspacePreviewControlRequest,
    ) => Promise<RemoteResult<DrawingWorkspaceCommitResult>>;
    'drawingSpace/discardPreview': (
      sessionId: string,
      request: DrawingWorkspacePreviewControlRequest,
    ) => Promise<RemoteResult<DrawingWorkspacePreviewDiscardResult>>;
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
  }],
};

function jsonRequest(typeSymbol: string, schema: { parse(input: unknown): unknown }) {
  return {
    name: 'request',
    wire: 'request',
    source: 'json',
    codec: { mode: 'strict', typeSymbol, schema },
  } as const;
}
