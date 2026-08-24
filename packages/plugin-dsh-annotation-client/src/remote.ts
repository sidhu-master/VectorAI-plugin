// SPDX-License-Identifier: Apache-2.0

import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import {
  annotationSessionStateSchema,
  drawingSessionIdSchema,
  type AnnotationSessionState,
} from '@vectorai/plugin-space-contracts';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    drawingAnnotation: {
      getSessionState(sessionId: string): Promise<RemoteResult<AnnotationSessionState>>;
    };
  }
  interface TypertRemoteMap {
    'drawingAnnotation/getSessionState': (
      sessionId: string,
    ) => Promise<RemoteResult<AnnotationSessionState>>;
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
  }],
};
