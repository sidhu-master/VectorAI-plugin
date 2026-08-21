// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { CommandExecution } from '@deepseek-ai/dsh-commands';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type {
  DrawingInteractiveStageResult,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspacePreview,
  DrawingWorkspaceSnapshot,
  DrawingUndoStageRequest,
  DrawingUndoStageResult,
  OperationLookupResult,
} from '@vectorai/plugin-space-contracts';
import type { DrawingWorkspacePort } from '@vectorai/drawing-workspace';

export interface DshDrawingSpaceRemote {
  getSnapshot(sessionId: string): Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
  stageInteractiveEdit(sessionId: string, request: DrawingWorkspaceCommitRequest): Promise<RemoteResult<DrawingInteractiveStageResult>>;
  stageUndo(sessionId: string, request: DrawingUndoStageRequest): Promise<RemoteResult<DrawingUndoStageResult>>;
  getOperation(sessionId: string, operationId: string, operationBindingDigest: string): Promise<RemoteResult<OperationLookupResult>>;
  getPreview?(sessionId: string): Promise<RemoteResult<DrawingWorkspacePreview | null>>;
}

export interface DshCommandRemote {
  execute(sessionId: string, line: string, images: readonly [], signal?: AbortSignal): Promise<RemoteResult<CommandExecution | undefined>>;
}

export function createDshDrawingWorkspacePort(input: {
  sessionId: string;
  remote: DshDrawingSpaceRemote;
  commands: DshCommandRemote;
  resolveImage(sessionId: string, attachment: ImageAttachmentRef): Promise<string>;
}): DrawingWorkspacePort {
  const { sessionId, remote, commands, resolveImage } = input;
  return {
    async load(signal) {
      signal?.throwIfAborted();
      const result = await remote.getSnapshot(sessionId);
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async commit(request, signal) {
      signal?.throwIfAborted();
      const staged = unwrap(await remote.stageInteractiveEdit(sessionId, request));
      if (staged.status !== 'staged') return staged;
      let execution: RemoteResult<CommandExecution | undefined> | undefined;
      try {
        execution = await commands.execute(sessionId, staged.commandLine, [], signal);
      } catch {
        execution = undefined;
      }
      if (execution?.ok === true && execution.value?.result.kind === 'success') {
        return committedSnapshot(remote, sessionId);
      }
      return reconcileInteractive(remote, sessionId, staged);
    },
    async undoLast(snapshot, signal) {
      const last = snapshot.lastCommit;
      if (!last?.undoable) return { status: 'rejected', code: 'UNDO_UNAVAILABLE', message: 'No undoable Drawing commit is current.' };
      signal?.throwIfAborted();
      const staged = unwrap(await remote.stageUndo(sessionId, {
        targetCommitId: last.commitId,
        expectedCurrentRef: snapshot.ref,
      }));
      if (staged.status !== 'staged') return staged;
      let execution: RemoteResult<CommandExecution | undefined> | undefined;
      try {
        execution = await commands.execute(sessionId, staged.commandLine, [], signal);
      } catch {
        execution = undefined;
      }
      if (execution?.ok === true && execution.value?.result.kind === 'success') {
        return committedSnapshot(remote, sessionId);
      }
      const lookup = unwrap(await remote.getOperation(
        sessionId, staged.operationId, staged.operationBindingDigest,
      ));
      if (lookup.status === 'committed') return committedSnapshot(remote, sessionId);
      return { status: 'rejected', code: 'COMMIT_OUTCOME_UNKNOWN', message: 'Undo outcome is uncertain; refresh the Drawing before retrying.' };
    },
    async loadPreview(signal) {
      signal?.throwIfAborted();
      if (remote.getPreview === undefined) return null;
      const result = await remote.getPreview(sessionId);
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

async function reconcileInteractive(
  remote: DshDrawingSpaceRemote,
  sessionId: string,
  staged: Extract<DrawingInteractiveStageResult, { status: 'staged' }>,
): Promise<DrawingWorkspaceCommitResult> {
  const lookup = unwrap(await remote.getOperation(sessionId, staged.operationId, staged.operationBindingDigest));
  if (lookup.status === 'committed' || lookup.status === 'no-effect') return committedSnapshot(remote, sessionId);
  if (lookup.status === 'pending' || lookup.status === 'outcome-unknown' || lookup.status === 'recovering') return {
    status: 'rejected', code: 'COMMIT_OUTCOME_UNKNOWN',
    message: 'The local Drawing write outcome is still being reconciled. Refresh before retrying.',
  };
  return {
    status: 'rejected',
    code: lookup.status === 'digest-mismatch' ? 'IDEMPOTENCY_KEY_REUSED' : 'INTERACTIVE_COMMAND_FAILED',
    message: 'The staged Drawing gesture was not committed.',
  };
}

async function committedSnapshot(remote: DshDrawingSpaceRemote, sessionId: string): Promise<DrawingWorkspaceCommitResult> {
  const snapshot = unwrap(await remote.getSnapshot(sessionId));
  return snapshot === null
    ? { status: 'rejected', code: 'DRAWING_REQUIRED', message: 'The committed Drawing is unavailable.' }
    : { status: 'committed', snapshot };
}

function unwrap<T>(result: RemoteResult<T>): T {
  if (result.ok === true) return result.value;
  throw new Error(result.error.message);
}
