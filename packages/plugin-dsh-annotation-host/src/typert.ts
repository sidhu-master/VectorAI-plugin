// SPDX-License-Identifier: Apache-2.0

import {
  annotationSessionStateSchema,
  drawingRefSchema,
  drawingSessionIdSchema,
  partitionEditCommandSchema,
  partitionDocumentSupplementRequestSchema,
  partitionImportRequestSchema,
  partitionSessionSnapshotSchema,
} from '@vectorai/plugin-space-contracts';

const agentParameter = {
  name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent',
  codec: {
    mode: 'strict',
    typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
    schema: drawingSessionIdSchema,
  },
} as const;

export const TYPERT = {
  package: '@vectorai/plugin-dsh-annotation-host',
  face: 'host',
  schemas: [],
  invocations: [{
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
    sourceLocation: {
      file: 'packages/plugin-dsh-annotation-host/src/service.ts', line: 41, column: 3,
    },
  }, ...partitionInvocations()],
  model: { services: [], events: [], objects: [] },
} as const;

function partitionInvocations() {
  return [
    invocation('importAndAnalyze', [jsonParameter('request', '@vectorai/plugin-space-contracts#PartitionImportRequest', partitionImportRequestSchema)]),
    invocation('supplementDocuments', [jsonParameter('request', '@vectorai/plugin-space-contracts#PartitionDocumentSupplementRequest', partitionDocumentSupplementRequestSchema)]),
    invocation('getPartitionState', []),
    invocation('editPartition', [jsonParameter('command', '@vectorai/plugin-space-contracts#PartitionEditCommand', partitionEditCommandSchema)]),
    invocation('confirmPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    invocation('cancelPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    invocation('reopenPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    invocation('undoPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    invocation('redoPartition', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
  ] as const;
}

function invocation(method: string, parameters: readonly unknown[]) {
  return {
    id: `@vectorai/plugin-dsh-annotation-host#drawingAnnotation/${method}`,
    service: 'drawingAnnotation', namespace: 'drawingAnnotation', method,
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, ...parameters],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#PartitionSessionSnapshot', schema: partitionSessionSnapshotSchema },
    sourceLocation: { file: 'packages/plugin-dsh-annotation-host/src/service.ts', line: 50, column: 3 },
  } as const;
}

function jsonParameter(name: string, typeSymbol: string, schema: { parse(input: unknown): unknown }) {
  return { name, wire: name, source: 'json', codec: { mode: 'strict', typeSymbol, schema } } as const;
}

export default TYPERT;
