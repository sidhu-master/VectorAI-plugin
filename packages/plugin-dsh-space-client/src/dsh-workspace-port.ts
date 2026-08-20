// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type {
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspacePort,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';

export interface DshDrawingSpaceRemote {
  getSnapshot(sessionId: string): Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
  commit(
    sessionId: string,
    request: DrawingWorkspaceCommitRequest,
  ): Promise<RemoteResult<DrawingWorkspaceCommitResult>>;
}

export function createDshDrawingWorkspacePort(input: {
  sessionId: string;
  remote: DshDrawingSpaceRemote;
  resolveImage(sessionId: string, attachment: ImageAttachmentRef): Promise<string>;
}): DrawingWorkspacePort {
  const { sessionId, remote, resolveImage } = input;
  return {
    async load(signal) {
      signal?.throwIfAborted();
      const result = await remote.getSnapshot(sessionId);
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async commit(request, signal) {
      signal?.throwIfAborted();
      const result = await remote.commit(sessionId, request);
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async loadSource(source, signal) {
      signal?.throwIfAborted();
      const attachment: ImageAttachmentRef = {
        attachmentId: source.id as ImageAttachmentRef['attachmentId'],
        mediaType: source.mediaType as ImageMediaType,
        bytes: source.bytes ?? 0,
        width: source.width,
        height: source.height,
        ...(source.name === undefined ? {} : { name: source.name }),
      };
      const url = await resolveImage(sessionId, attachment);
      signal?.throwIfAborted();
      return { url, dispose() {} };
    },
  };
}

function unwrap<T>(result: RemoteResult<T>): T {
  if (result.ok === true) return result.value;
  throw new Error(result.error.message);
}
