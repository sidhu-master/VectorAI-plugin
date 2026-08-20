// SPDX-License-Identifier: Apache-2.0

import {
  drawingCanvasProjectionSchema,
  drawingSessionIdSchema,
} from '@vectorai/plugin-space-contracts';

export const TYPERT = {
  package: '@vectorai/plugin-dsh-space-host',
  face: 'host',
  schemas: [],
  invocations: [{
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getProjection',
    service: 'drawingSpace',
    namespace: 'drawingSpace',
    method: 'getProjection',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'sessionId',
      wire: 'sessionId',
      source: 'json',
      codec: {
        mode: 'strict',
        typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
        schema: drawingSessionIdSchema,
      },
    }],
    result: {
      mode: 'strict',
      typeSymbol: '@vectorai/plugin-space-contracts#DrawingCanvasProjection|null',
      schema: drawingCanvasProjectionSchema,
    },
    sourceLocation: {
      file: 'packages/plugin-dsh-space-host/src/service.ts',
      line: 36,
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
