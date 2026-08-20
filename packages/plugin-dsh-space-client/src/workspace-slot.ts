// SPDX-License-Identifier: Apache-2.0

import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.workspace': {
      kind: 'single';
      scope: 'session';
    };
  }
}

export type DrawingWorkspaceSlotProps = PropsRuntime<'conversation.workspace'>;

