// SPDX-License-Identifier: Apache-2.0

import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { PartitionSessionStore } from './partition-store';
import type { AnnotationSessionStateStore } from './session-state';

export function acceptPendingPartitionForEvent(
  sessionId: string,
  event: SessionEvent,
  partitions: PartitionSessionStore,
  sessions: AnnotationSessionStateStore,
  onConfirmed?: (drawingRef: NonNullable<ReturnType<PartitionSessionStore['get']>['drawingRef']>) => void,
): boolean {
  if (event.type !== 'user/message' || event.data.source.kind !== 'user') return false;
  const before = partitions.get(sessionId);
  if (before.phase !== 'editing' || before.draft === undefined) return false;
  const after = partitions.confirmPending(sessionId);
  if (after.phase !== 'confirmed') return false;
  if (after.drawingRef !== undefined) onConfirmed?.(after.drawingRef);
  const annotation = sessions.get(sessionId);
  if (annotation.workspaceClaimed && (annotation.workflow.status === 'running' || annotation.workflow.status === 'reviewing')) {
    sessions.finish(sessionId, 'completed');
  }
  return true;
}
