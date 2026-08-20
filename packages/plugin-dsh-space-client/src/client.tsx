// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { DrawingCanvasProjection } from '@vectorai/plugin-space-contracts';
import { useCallback, useEffect, useState } from 'react';

import { DrawingCanvas } from './DrawingCanvas';
import { DRAWING_SPACE_REMOTE } from './remote';

export const inject = ['slots', 'remote'];

interface DrawingConversationViewProps extends ConvViewProps {
  loadDrawing: () => Promise<{
    readonly ok: true;
    readonly value: DrawingCanvasProjection | null;
  } | {
    readonly ok: false;
    readonly error: { readonly message: string };
  }>;
}

export function DrawingConversationView({
  useSession,
  loadDrawing,
}: DrawingConversationViewProps) {
  const runningCallCount = useSession((snapshot) => snapshot.runningCalls.length);
  const [projection, setProjection] = useState<DrawingCanvasProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadDrawing();
      if ('value' in result) {
        setProjection(result.value);
        setError(null);
      } else {
        setError(result.error.message);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [loadDrawing]);

  useEffect(() => {
    void reload();
  }, [reload, runningCallCount]);

  return <DrawingCanvas projection={projection} loading={loading} error={error} />;
}

export async function apply(ctx: Context) {
  const disposeRemote = await ctx.remote.$mount(DRAWING_SPACE_REMOTE);
  const disposeSlot = ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'drawing',
    order: 20,
    label: () => '图纸',
    inject: (sessionId) => ({
      loadDrawing: () => ctx.remote.drawingSpace.getProjection(String(sessionId)),
    }),
  }, DrawingConversationView));
  return async () => {
    await disposeSlot();
    await disposeRemote();
  };
}
