// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import {
  drawingInteractiveStageResultSchema,
  drawingUndoStageRequestSchema,
  drawingUndoStageResultSchema,
  drawingPreviewSchema,
  drawingQueryRequestSchema,
  drawingQueryResultSchema,
  drawingSelectionProjectionRequestSchema,
  drawingSelectionProjectionResultSchema,
  drawingSessionIdSchema,
  drawingWorkspaceCommitRequestSchema,
  drawingWorkspaceSnapshotSchema,
  operationLookupResultSchema,
  type DrawingInteractiveStageResult,
  type DrawingUndoStageRequest,
  type DrawingUndoStageResult,
  type DrawingQueryRequest,
  type DrawingQueryResult,
  type DrawingSelectionProjectionRequest,
  type DrawingSelectionProjectionResult,
  type DrawingWorkspaceCommitRequest,
  type DrawingWorkspacePreview,
  type DrawingWorkspaceSnapshot,
  type OperationLookupResult,
} from '@vectorai/plugin-space-contracts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    drawingSpace: {
      getSnapshot(sessionId: string): Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
      query(sessionId: string, request: DrawingQueryRequest): Promise<RemoteResult<DrawingQueryResult>>;
      projectSelection(sessionId: string, request: DrawingSelectionProjectionRequest): Promise<RemoteResult<DrawingSelectionProjectionResult>>;
      getPreview(sessionId: string): Promise<RemoteResult<DrawingWorkspacePreview | null>>;
      stageInteractiveEdit(sessionId: string, request: DrawingWorkspaceCommitRequest): Promise<RemoteResult<DrawingInteractiveStageResult>>;
      stageUndo(sessionId: string, request: DrawingUndoStageRequest): Promise<RemoteResult<DrawingUndoStageResult>>;
      getOperation(sessionId: string, operationId: string, operationBindingDigest: string): Promise<RemoteResult<OperationLookupResult>>;
    };
  }
  interface TypertRemoteMap {
    'drawingSpace/getSnapshot': (sessionId: string) => Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
    'drawingSpace/query': (sessionId: string, request: DrawingQueryRequest) => Promise<RemoteResult<DrawingQueryResult>>;
    'drawingSpace/projectSelection': (sessionId: string, request: DrawingSelectionProjectionRequest) => Promise<RemoteResult<DrawingSelectionProjectionResult>>;
    'drawingSpace/getPreview': (sessionId: string) => Promise<RemoteResult<DrawingWorkspacePreview | null>>;
    'drawingSpace/stageInteractiveEdit': (sessionId: string, request: DrawingWorkspaceCommitRequest) => Promise<RemoteResult<DrawingInteractiveStageResult>>;
    'drawingSpace/stageUndo': (sessionId: string, request: DrawingUndoStageRequest) => Promise<RemoteResult<DrawingUndoStageResult>>;
    'drawingSpace/getOperation': (sessionId: string, operationId: string, operationBindingDigest: string) => Promise<RemoteResult<OperationLookupResult>>;
  }
}

const agentCodec = {
  mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: drawingSessionIdSchema,
} as const;
const agentParameter = {
  name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent', codec: agentCodec,
} as const;

export const DRAWING_SPACE_REMOTE: TypertRemoteContribution = {
  package: '@vectorai/plugin-dsh-space-host',
  descriptors: [{
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getSnapshot',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getSnapshot',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspaceSnapshot|null', schema: drawingWorkspaceSnapshotSchema },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/query',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'query',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingQueryRequest', drawingQueryRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingQueryResult', schema: drawingQueryResultSchema },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/projectSelection',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'projectSelection',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingSelectionProjectionRequest', drawingSelectionProjectionRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingSelectionProjectionResult', schema: drawingSelectionProjectionResultSchema },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getPreview',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getPreview',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspacePreview|null', schema: drawingPreviewSchema.nullable() },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/stageInteractiveEdit',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'stageInteractiveEdit',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingWorkspaceCommitRequest', drawingWorkspaceCommitRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingInteractiveStageResult', schema: drawingInteractiveStageResultSchema },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/stageUndo',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'stageUndo',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingUndoStageRequest', drawingUndoStageRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingUndoStageResult', schema: drawingUndoStageResultSchema },
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getOperation',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getOperation',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, stringParameter('operationId'), stringParameter('operationBindingDigest')],
    result: { mode: 'strict', typeSymbol: '@vectorai/drawing-edit-protocol#OperationLookupResult', schema: operationLookupResultSchema },
  }],
};

function jsonRequest(typeSymbol: string, schema: { parse(input: unknown): unknown }) {
  return { name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol, schema } } as const;
}

function stringParameter(name: string) {
  return {
    name, wire: name, source: 'json',
    codec: { mode: 'strict', typeSymbol: 'string', schema: { parse(input: unknown) {
      if (typeof input !== 'string' || input.length === 0) throw new Error('STRING_REQUIRED');
      return input;
    } } },
  } as const;
}
