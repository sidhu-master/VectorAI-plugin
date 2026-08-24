// SPDX-License-Identifier: Apache-2.0

import {
  annotationSessionStateSchema,
  drawingSessionIdSchema,
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
  package: '@vectorai/plugin-dsh-annotation',
  face: 'host',
  schemas: [],
  invocations: [{
    id: '@vectorai/plugin-dsh-annotation#drawingAnnotation/getSessionState',
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
      file: 'packages/plugin-dsh-annotation/src/service.ts', line: 37, column: 3,
    },
  }],
  model: { services: [], events: [], objects: [] },
} as const;

export default TYPERT;
