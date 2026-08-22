// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import type { CommandExecution } from '@deepseek-ai/dsh-commands';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type {
  DrawingInteractiveStageResult,
  DrawingGroundingOverlay,
  DrawingMotionRigProjection,
  DrawingMotionRigRebuildRequest,
  DrawingMotionRigResult,
  DrawingMotionRigDiscardRequest,
  DrawingMotionRigDiscardResult,
  DrawingSelectionProjectionRequest,
  DrawingSelectionProjectionResult,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspacePreview,
  DrawingWorkspaceSnapshot,
  DrawingUndoStageRequest,
  DrawingUndoStageResult,
  DrawingRedoStageRequest,
  DrawingRedoStageResult,
  OperationLookupResult,
} from '@vectorai/plugin-space-contracts';
import type { DrawingWorkspacePort } from '@vectorai/drawing-workspace';

export interface DshDrawingSpaceRemote {
  getSnapshot(sessionId: string): Promise<RemoteResult<DrawingWorkspaceSnapshot | null>>;
  getGroundingOverlay?(sessionId: string): Promise<RemoteResult<DrawingGroundingOverlay | null>>;
  getMotionRig?(sessionId: string): Promise<RemoteResult<DrawingMotionRigProjection | null>>;
  rebuildMotionRig?(sessionId: string, request: DrawingMotionRigRebuildRequest): Promise<RemoteResult<DrawingMotionRigResult>>;
  discardMotionRig?(sessionId: string, request: DrawingMotionRigDiscardRequest): Promise<RemoteResult<DrawingMotionRigDiscardResult>>;
  projectSelection(sessionId: string, request: DrawingSelectionProjectionRequest): Promise<RemoteResult<DrawingSelectionProjectionResult>>;
  stageInteractiveEdit(sessionId: string, request: DrawingWorkspaceCommitRequest): Promise<RemoteResult<DrawingInteractiveStageResult>>;
  stageUndo(sessionId: string, request: DrawingUndoStageRequest): Promise<RemoteResult<DrawingUndoStageResult>>;
  stageRedo?(sessionId: string, request: DrawingRedoStageRequest): Promise<RemoteResult<DrawingRedoStageResult>>;
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
    async projectSelection(ref, nodeIds, signal) {
      signal?.throwIfAborted();
      const result = await remote.projectSelection(sessionId, {
        expectedRef: ref,
        nodeIds,
      });
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async loadGroundingOverlay(signal) {
      signal?.throwIfAborted();
      if (remote.getGroundingOverlay === undefined) return null;
      const result = await remote.getGroundingOverlay(sessionId);
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async loadMotionRig(signal) {
      signal?.throwIfAborted();
      if (remote.getMotionRig === undefined) return null;
      const result = await remote.getMotionRig(sessionId);
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async rebuildMotionRig(ref, nodeIds, signal) {
      signal?.throwIfAborted();
      if (remote.rebuildMotionRig === undefined) {
        return { status: 'rejected', code: 'MOTION_RIG_UNAVAILABLE', message: 'Motion rig correction is unavailable.' };
      }
      const result = await remote.rebuildMotionRig(sessionId, { ref, nodeIds });
      signal?.throwIfAborted();
      return unwrap(result);
    },
    async discardMotionRig(ref, signal) {
      signal?.throwIfAborted();
      if (remote.discardMotionRig === undefined) {
        return { status: 'rejected', code: 'MOTION_RIG_UNAVAILABLE', message: 'Motion rig discard is unavailable.' };
      }
      const result = await remote.discardMotionRig(sessionId, { ref });
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
    async redoLast(snapshot, signal) {
      const last = snapshot.lastCommit;
      if (!last?.redoable || remote.stageRedo === undefined) {
        return { status: 'rejected', code: 'REDO_UNAVAILABLE', message: 'No redoable Drawing Undo is current.' };
      }
      signal?.throwIfAborted();
      const staged = unwrap(await remote.stageRedo(sessionId, {
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
      return { status: 'rejected', code: 'COMMIT_OUTCOME_UNKNOWN', message: 'Redo outcome is uncertain; refresh the Drawing before retrying.' };
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
