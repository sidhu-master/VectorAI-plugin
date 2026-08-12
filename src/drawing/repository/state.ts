import type { IdFactory } from '../document/create';
import type {
  CommitId,
  DrawingDocument,
  DrawingId,
  RevisionId,
} from '../document/types';
import { applyDrawingPatch } from '../patch/apply';
import { previewTransaction } from '../transaction/execute';
import type {
  Actor,
  DrawingError,
  DrawingTransaction,
  GoalOutcomeReport,
} from '../transaction/types';
import { validateDrawingDocument } from '../validation/document';
import type {
  DrawingCommit,
  DrawingRepositoryState,
  RepositoryCommitResult,
} from './types';

export interface RepositoryTransitionDependencies {
  idFactory: IdFactory;
  now: () => number;
}

export interface RepositoryStateTransition {
  result: RepositoryCommitResult;
  state: DrawingRepositoryState;
}

export function createRepositoryState(
  document: DrawingDocument,
  revision: RevisionId,
): DrawingRepositoryState {
  const report = validateDrawingDocument(document);
  if (!report.valid) throw new Error(`Drawing ${document.id} is invalid`);
  return {
    initialDocument: clone(document),
    document: clone(document),
    revision,
    commits: [],
  };
}

export function commitRepositoryState(
  state: DrawingRepositoryState,
  transaction: DrawingTransaction,
  dependencies: RepositoryTransitionDependencies,
): RepositoryStateTransition {
  const preview = previewTransaction({
    document: state.document,
    currentRevision: state.revision,
  }, transaction, dependencies.idFactory);
  if (preview.status !== 'ready') {
    return { result: clone(preview), state: clone(state) };
  }

  const commitId = dependencies.idFactory.next('commit') as CommitId;
  const resultingRevision = dependencies.idFactory.next('revision') as RevisionId;
  const commit: DrawingCommit = {
    id: commitId,
    drawingId: state.document.id,
    parentRevision: state.revision,
    resultingRevision,
    actor: clone(transaction.actor),
    ...(transaction.goalId === undefined ? {} : { goalId: transaction.goalId }),
    commands: clone(transaction.commands),
    patch: clone(preview.preview.patch),
    inversePatch: clone(preview.preview.inversePatch),
    validationReport: clone(preview.preview.validationReport),
    outcomeReport: clone(preview.preview.outcomeReport),
    evidenceRefs: clone(transaction.evidenceRefs),
    ...(preview.preview.metadata === undefined
      ? {}
      : { metadata: clone(preview.preview.metadata) }),
    ...(preview.preview.metadata?.confidence === undefined
      ? {}
      : { confidence: preview.preview.metadata.confidence }),
    timestamp: dependencies.now(),
  };
  const nextState: DrawingRepositoryState = {
    initialDocument: clone(state.initialDocument),
    document: clone(preview.resultingDocument),
    revision: resultingRevision,
    commits: [...clone(state.commits), clone(commit)],
  };

  return {
    result: {
      status: 'committed',
      commit: clone(commit),
      document: clone(nextState.document),
      revision: resultingRevision,
    },
    state: clone(nextState),
  };
}

export function revertRepositoryState(
  state: DrawingRepositoryState,
  input: { drawingId: DrawingId; commitId: CommitId; actor: Actor },
  dependencies: RepositoryTransitionDependencies,
): RepositoryStateTransition {
  if (state.document.id !== input.drawingId) {
    return unchanged(state, {
      code: 'DRAWING_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
      message: `图纸 ${input.drawingId} 不存在`, suggestedAction: 'pause',
    });
  }
  const target = state.commits.find((commit) => commit.id === input.commitId);
  if (!target) {
    return unchanged(state, {
      code: 'COMMIT_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
      message: `提交 ${input.commitId} 不存在`, suggestedAction: 'pause',
    });
  }

  const applied = applyDrawingPatch(state.document, target.inversePatch);
  if ('errors' in applied) {
    return {
      result: {
        status: 'rejected',
        errors: applied.errors.map((error): DrawingError => ({
          code: error.code,
          stage: error.code === 'NODE_NOT_FOUND' || error.code === 'IMMUTABLE_FIELD'
            ? 'patch'
            : 'validation',
          retryable: false,
          nodeIds: [],
          message: error.message,
          suggestedAction: 'pause',
        })),
      },
      state: clone(state),
    };
  }

  const validationReport = validateDrawingDocument(applied.document);
  if (!validationReport.valid) {
    return {
      result: {
        status: 'rejected',
        errors: validationReport.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue): DrawingError => ({
            code: issue.code,
            stage: 'validation',
            retryable: false,
            nodeIds: issue.nodeIds,
            message: issue.message,
            suggestedAction: 'pause',
          })),
      },
      state: clone(state),
    };
  }

  const commitId = dependencies.idFactory.next('commit') as CommitId;
  const resultingRevision = dependencies.idFactory.next('revision') as RevisionId;
  const outcomeReport: GoalOutcomeReport = { satisfied: true, assertions: [] };
  const commit: DrawingCommit = {
    id: commitId,
    drawingId: input.drawingId,
    parentRevision: state.revision,
    resultingRevision,
    actor: clone(input.actor),
    commands: [{ type: 'history.revert', commitId: input.commitId }],
    patch: clone(target.inversePatch),
    inversePatch: clone(applied.inversePatch),
    validationReport,
    outcomeReport,
    evidenceRefs: [],
    timestamp: dependencies.now(),
  };
  const nextState: DrawingRepositoryState = {
    initialDocument: clone(state.initialDocument),
    document: clone(applied.document),
    revision: resultingRevision,
    commits: [...clone(state.commits), clone(commit)],
  };

  return {
    result: {
      status: 'committed',
      commit: clone(commit),
      document: clone(nextState.document),
      revision: resultingRevision,
    },
    state: clone(nextState),
  };
}

function unchanged(
  state: DrawingRepositoryState,
  error: DrawingError,
): RepositoryStateTransition {
  return {
    result: { status: 'rejected', errors: [clone(error)] },
    state: clone(state),
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
