import type {
  CommitId,
  DrawingDocument,
  RevisionId,
} from '../document/types';
import { applyDrawingPatch } from '../patch/apply';
import { validateDrawingDocument } from '../validation/document';
import type { DrawingCommit } from './types';

export interface DrawingReplayError {
  code: string;
  commitIndex: number;
  commitId?: CommitId;
  message: string;
}

export type DrawingReplayResult =
  | { success: true; document: DrawingDocument; revision?: RevisionId }
  | { success: false; document: DrawingDocument; error: DrawingReplayError };

export function replayDrawingCommits(
  initialDocument: DrawingDocument,
  commits: DrawingCommit[],
): DrawingReplayResult {
  let document = structuredClone(initialDocument);
  let expectedRevision = commits[0]?.parentRevision;

  const initialReport = validateDrawingDocument(document);
  if (!initialReport.valid) {
    const issue = initialReport.issues.find((item) => item.severity === 'error');
    return {
      success: false,
      document,
      error: {
        code: issue?.code ?? 'INITIAL_DOCUMENT_INVALID',
        commitIndex: -1,
        message: issue?.message ?? '初始图纸无效',
      },
    };
  }

  for (const [commitIndex, commit] of commits.entries()) {
    if (commit.drawingId !== initialDocument.id) {
      return replayFailure(
        document,
        commitIndex,
        commit.id,
        'DRAWING_ID_MISMATCH',
        `提交 ${commit.id} 不属于图纸 ${initialDocument.id}`,
      );
    }
    if (commit.parentRevision !== expectedRevision) {
      return replayFailure(
        document,
        commitIndex,
        commit.id,
        'REVISION_CHAIN_BROKEN',
        `提交 ${commit.id} 的父版本不是预期版本 ${expectedRevision}`,
      );
    }

    const applied = applyDrawingPatch(document, commit.patch);
    if ('errors' in applied) {
      const error = applied.errors[0];
      return replayFailure(
        document,
        commitIndex,
        commit.id,
        error.code,
        error.message,
      );
    }

    const report = validateDrawingDocument(applied.document);
    if (!report.valid) {
      const issue = report.issues.find((item) => item.severity === 'error');
      return replayFailure(
        document,
        commitIndex,
        commit.id,
        issue?.code ?? 'REPLAY_VALIDATION_FAILED',
        issue?.message ?? '回放结果无效',
      );
    }

    document = applied.document;
    expectedRevision = commit.resultingRevision;
  }

  return {
    success: true,
    document,
    ...(expectedRevision === undefined ? {} : { revision: expectedRevision }),
  };
}

function replayFailure(
  document: DrawingDocument,
  commitIndex: number,
  commitId: CommitId,
  code: string,
  message: string,
): DrawingReplayResult {
  return {
    success: false,
    document,
    error: { code, commitIndex, commitId, message },
  };
}
