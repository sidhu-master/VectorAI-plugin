// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import {
  annotationSessionStateSchema,
  engineeringDocumentStageRequestSchema,
  drawingRefSchema,
  drawingSessionIdSchema,
  partitionEditCommandSchema,
  partitionDocumentSupplementRequestSchema,
  partitionImportRequestSchema,
  partitionSessionSnapshotSchema,
  type AnnotationSessionState,
  type EngineeringDocumentStageRequest,
  type DrawingRef,
  type PartitionEditCommand,
  type PartitionDocumentSupplementRequest,
  type PartitionImportRequest,
  type PartitionSessionSnapshot,
} from '@vectorai/plugin-space-contracts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    drawingAnnotation: {
      getSessionState(sessionId: string): Promise<RemoteResult<AnnotationSessionState>>;
      importDrawing(sessionId: string, request: PartitionImportRequest['dxf']): Promise<RemoteResult<PartitionSessionSnapshot>>;
      stageDocuments(sessionId: string, request: EngineeringDocumentStageRequest): Promise<RemoteResult<PartitionSessionSnapshot>>;
      clearDocuments(sessionId: string): Promise<RemoteResult<PartitionSessionSnapshot>>;
      importAndAnalyze(sessionId: string, request: PartitionImportRequest): Promise<RemoteResult<PartitionSessionSnapshot>>;
      supplementDocuments(sessionId: string, request: PartitionDocumentSupplementRequest): Promise<RemoteResult<PartitionSessionSnapshot>>;
      getPartitionState(sessionId: string): Promise<RemoteResult<PartitionSessionSnapshot>>;
      editPartition(sessionId: string, command: PartitionEditCommand): Promise<RemoteResult<PartitionSessionSnapshot>>;
      confirmPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
      cancelPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
      reopenPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
      undoPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
      redoPartition(sessionId: string, expected: DrawingRef): Promise<RemoteResult<PartitionSessionSnapshot>>;
    };
  }
  interface TypertRemoteMap {
    'drawingAnnotation/getSessionState': (
      sessionId: string,
    ) => Promise<RemoteResult<AnnotationSessionState>>;
    'drawingAnnotation/importAndAnalyze': (sessionId: string, request: PartitionImportRequest) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/importDrawing': (sessionId: string, request: PartitionImportRequest['dxf']) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/stageDocuments': (sessionId: string, request: EngineeringDocumentStageRequest) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/clearDocuments': (sessionId: string) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/supplementDocuments': (sessionId: string, request: PartitionDocumentSupplementRequest) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/getPartitionState': (sessionId: string) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/editPartition': (sessionId: string, command: PartitionEditCommand) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/confirmPartition': (sessionId: string, expected: DrawingRef) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/cancelPartition': (sessionId: string, expected: DrawingRef) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/reopenPartition': (sessionId: string, expected: DrawingRef) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/undoPartition': (sessionId: string, expected: DrawingRef) => Promise<RemoteResult<PartitionSessionSnapshot>>;
    'drawingAnnotation/redoPartition': (sessionId: string, expected: DrawingRef) => Promise<RemoteResult<PartitionSessionSnapshot>>;
  }
}

const agentParameter = {
  name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
  codec: {
    mode: 'strict',
    typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    schema: drawingSessionIdSchema,
  },
} as const;

export const ANNOTATION_REMOTE: TypertRemoteContribution = {
  package: '@vectorai/plugin-dsh-annotation-host',
  descriptors: [{
    id: '@vectorai/plugin-dsh-annotation-host#drawingAnnotation/getSessionState',
    service: 'drawingAnnotation',
    namespace: 'drawingAnnotation',
    method: 'getSessionState',
    invocation: { kind: 'direct' },
    scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#AnnotationSessionState',
      schema: annotationSessionStateSchema,
    },
  }, ...partitionDescriptors()],
};

function partitionDescriptors() {
  return [
    descriptor('importDrawing', [jsonParameter('request', '@vectorai/plugin-space-contracts#PartitionImportRequest.dxf', partitionImportRequestSchema.shape.dxf)]),
    descriptor('stageDocuments', [jsonParameter('request', '@vectorai/plugin-space-contracts#EngineeringDocumentStageRequest', engineeringDocumentStageRequestSchema)]),
    descriptor('clearDocuments', []),
    descriptor('importAndAnalyze', [jsonParameter('request', '@vectorai/plugin-space-contracts#PartitionImportRequest', partitionImportRequestSchema)]),
    descriptor('supplementDocuments', [jsonParameter('request', '@vectorai/plugin-space-contracts#PartitionDocumentSupplementRequest', partitionDocumentSupplementRequestSchema)]),
    descriptor('getPartitionState', []),
    descriptor('editPartition', [jsonParameter('command', '@vectorai/plugin-space-contracts#PartitionEditCommand', partitionEditCommandSchema)]),
    descriptor('confirmPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    descriptor('cancelPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    descriptor('reopenPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    descriptor('undoPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    descriptor('redoPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
  ];
}

function descriptor(method: string, parameters: Array<ReturnType<typeof jsonParameter>>) {
  return {
    id: `@vectorai/plugin-dsh-annotation-host#drawingAnnotation/${method}`,
    service: 'drawingAnnotation', namespace: 'drawingAnnotation', method,
    invocation: { kind: 'direct' as const }, scope: { context: 'agent' as const, wire: 'agentId' },
    parameters: [agentParameter, ...parameters],
    result: { mode: 'strict' as const, typeSymbol: '@vectorai/plugin-space-contracts#PartitionSessionSnapshot', schema: partitionSessionSnapshotSchema },
  };
}

function jsonParameter(name: string, typeSymbol: string, schema: { parse(input: unknown): unknown }) {
  return { name, wire: name, source: 'json' as const, codec: { mode: 'strict' as const, typeSymbol, schema } };
}
