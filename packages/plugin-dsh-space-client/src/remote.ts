// SPDX-License-Identifier: Apache-2.0

import type { DrawingCanvasProjection } from '@vectorai/plugin-space-contracts';
import type {
  RemoteResult,
  TypertRemoteContribution,
} from '@deepseek-ai/dsh-typert-protocol';

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    drawingSpace: {
      getProjection(sessionId: string): Promise<RemoteResult<DrawingCanvasProjection | null>>;
    };
  }

  interface TypertRemoteMap {
    'drawingSpace/getProjection': (
      sessionId: string,
    ) => Promise<RemoteResult<DrawingCanvasProjection | null>>;
  }
}

export const DRAWING_SPACE_REMOTE: TypertRemoteContribution = {
  package: '@vectorai/plugin-dsh-space-host',
  descriptors: [{
    id: '@vectorai/plugin-dsh-space-host#drawingSpace/getProjection',
    service: 'drawingSpace',
    namespace: 'drawingSpace',
    method: 'getProjection',
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'sessionId',
      wire: 'sessionId',
      source: 'json',
      codec: { mode: 'src-json' },
    }],
    result: { mode: 'src-json' },
  }],
};
