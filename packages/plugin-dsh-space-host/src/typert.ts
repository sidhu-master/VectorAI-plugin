// SPDX-License-Identifier: Apache-2.0

import {
  drawingInteractiveStageResultSchema,
  drawingGroundingOverlaySchema,
  drawingMotionRigDiscardRequestSchema,
  drawingMotionRigDiscardResultSchema,
  drawingMotionRigProjectionSchema,
  drawingMotionRigRebuildRequestSchema,
  drawingMotionRigResultSchema,
  drawingPreviewSchema,
  drawingQueryRequestSchema,
  drawingQueryResultSchema,
  drawingSelectionProjectionRequestSchema,
  drawingSelectionProjectionResultSchema,
  drawingSessionIdSchema,
  drawingUndoStageRequestSchema,
  drawingUndoStageResultSchema,
  drawingRedoStageRequestSchema,
  drawingRedoStageResultSchema,
  drawingWorkspaceCommitRequestSchema,
  drawingWorkspaceSnapshotSchema,
  operationLookupResultSchema,
} from '@vectorai/plugin-space-contracts';
import { z } from 'zod';

const nonEmptyStringSchema = z.string().min(1);

const agentCodec = {
  mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
  schema: drawingSessionIdSchema,
} as const;
const agentParameter = {
  name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent', codec: agentCodec,
} as const;

export const TYPERT = {
  package: '@vectorai/plugin-dsh-space-host', face: 'host', schemas: [],
  invocations: [{
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getSnapshot',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getSnapshot',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspaceSnapshot|null', schema: drawingWorkspaceSnapshotSchema },
    sourceLocation: serviceLocation(66),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/query',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'query',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingQueryRequest', drawingQueryRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingQueryResult', schema: drawingQueryResultSchema },
    sourceLocation: serviceLocation(71),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/projectSelection',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'projectSelection',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingSelectionProjectionRequest', drawingSelectionProjectionRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingSelectionProjectionResult', schema: drawingSelectionProjectionResultSchema },
    sourceLocation: serviceLocation(76),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getGroundingOverlay',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getGroundingOverlay',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingGroundingOverlay|null',
      schema: drawingGroundingOverlaySchema.nullable(),
    },
    sourceLocation: serviceLocation(116),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getMotionRig',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getMotionRig',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: {
      mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingMotionRigProjection|null',
      schema: drawingMotionRigProjectionSchema.nullable(),
    },
    sourceLocation: serviceLocation(122),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/rebuildMotionRig',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'rebuildMotionRig',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest(
      '@vectorai/plugin-space-contracts#DrawingMotionRigRebuildRequest',
      drawingMotionRigRebuildRequestSchema,
    )],
    result: {
      mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingMotionRigResult',
      schema: drawingMotionRigResultSchema,
    },
    sourceLocation: serviceLocation(127),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/discardMotionRig',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'discardMotionRig',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest(
      '@vectorai/plugin-space-contracts#DrawingMotionRigDiscardRequest',
      drawingMotionRigDiscardRequestSchema,
    )],
    result: {
      mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingMotionRigDiscardResult',
      schema: drawingMotionRigDiscardResultSchema,
    },
    sourceLocation: serviceLocation(136),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/stageInteractiveEdit',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'stageInteractiveEdit',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingWorkspaceCommitRequest', drawingWorkspaceCommitRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingInteractiveStageResult', schema: drawingInteractiveStageResultSchema },
    sourceLocation: serviceLocation(76),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/stageUndo',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'stageUndo',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingUndoStageRequest', drawingUndoStageRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingUndoStageResult', schema: drawingUndoStageResultSchema },
    sourceLocation: serviceLocation(84),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/stageRedo',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'stageRedo',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, jsonRequest('@vectorai/plugin-space-contracts#DrawingRedoStageRequest', drawingRedoStageRequestSchema)],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingRedoStageResult', schema: drawingRedoStageResultSchema },
    sourceLocation: serviceLocation(89),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getOperation',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getOperation',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter, stringParameter('operationId'), stringParameter('operationBindingDigest')],
    result: { mode: 'strict', typeSymbol: '@vectorai/drawing-edit-protocol#OperationLookupResult', schema: operationLookupResultSchema },
    sourceLocation: serviceLocation(89),
  }, {
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getPreview',
    service: 'drawingSpace', namespace: 'drawingSpace', method: 'getPreview',
    invocation: { kind: 'direct' }, scope: { context: 'agent', wire: 'agentId' },
    parameters: [agentParameter],
    result: { mode: 'strict', typeSymbol: '@vectorai/plugin-space-contracts#DrawingWorkspacePreview|null', schema: drawingPreviewSchema.nullable() },
    sourceLocation: serviceLocation(103),
  }],
  model: { services: [], events: [], objects: [] },
} as const;

function jsonRequest(typeSymbol: string, schema: { parse(input: unknown): unknown }) {
  return { name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol, schema } } as const;
}

function stringParameter(name: string) {
  return {
    name, wire: name, source: 'json',
    codec: { mode: 'strict', typeSymbol: 'string', schema: nonEmptyStringSchema },
  } as const;
}

function serviceLocation(line: number) {
  return { file: 'packages/plugin-dsh-space-host/src/service.ts', line, column: 3 } as const;
}

export default TYPERT;
