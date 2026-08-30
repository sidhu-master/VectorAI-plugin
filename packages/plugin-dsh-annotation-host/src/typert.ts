// SPDX-License-Identifier: Apache-2.0

import {
  annotationSessionStateSchema,
  engineeringDocumentStageRequestSchema,
  drawingRefSchema,
  drawingSessionIdSchema,
  partitionEditCommandSchema,
  partitionDocumentSupplementRequestSchema,
  partitionImportRequestSchema,
  partitionSessionSnapshotSchema,
  dimensionPlanSessionSnapshotSchema,
  dimensionSchemeEditCommandSchema,
  geometricToleranceEditCommandSchema,
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
  }, ...partitionInvocations(), ...dimensionInvocations()],
  model: { services: [], events: [], objects: [] },
} as const;

function partitionInvocations() {
  return [
    invocation('importDrawing', [jsonParameter('request', '@vectorai/plugin-space-contracts#PartitionImportRequest.dxf', partitionImportRequestSchema.shape.dxf)]),
    invocation('stageDocuments', [jsonParameter('request', '@vectorai/plugin-space-contracts#EngineeringDocumentStageRequest', engineeringDocumentStageRequestSchema)]),
    invocation('clearDocuments', []),
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

function dimensionInvocations() {
  return [
    dimensionInvocation('getDimensionPlan', []),
    dimensionInvocation('editDimensionScheme', [jsonParameter('command', '@vectorai/plugin-space-contracts#DimensionSchemeEditCommand', dimensionSchemeEditCommandSchema)]),
    dimensionInvocation('editGeometricTolerance', [jsonParameter('command', '@vectorai/plugin-space-contracts#GeometricToleranceEditCommand', geometricToleranceEditCommandSchema)]),
    dimensionInvocation('confirmDimensionPlan', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    dimensionInvocation('cancelDimensionPlan', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    dimensionInvocation('undoDimensionPlan', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
    dimensionInvocation('redoDimensionPlan', [jsonParameter('expected', '@vectorai/drawing-edit-protocol#DrawingRef', drawingRefSchema)]),
  ] as const;
}

function dimensionInvocation(method: string, parameters: readonly unknown[]) {
  return {
    id: `@vectorai/plugin-dsh-annotation-host#drawingAnnotation/${method}`,
    service: 'drawingAnnotation', namespace: 'drawingAnnotation', method,
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, ...parameters],
    result: {
      mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DimensionPlanSessionSnapshot',
      schema: dimensionPlanSessionSnapshotSchema,
    },
    sourceLocation: { file: 'packages/plugin-dsh-annotation-host/src/service.ts', line: 120, column: 3 },
  } as const;
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
