import type { IdFactory } from '../document/create';
import { randomIdFactory } from '../document/create';
import type {
  CommitId,
  DrawingDocument,
  DrawingId,
  RevisionId,
} from '../document/types';
import { applyDrawingPatch } from '../patch/apply';
import { previewTransaction } from '../transaction/execute';
import type { DrawingError, GoalOutcomeReport } from '../transaction/types';
import { validateDrawingDocument } from '../validation/document';
import type {
  DrawingCommit,
  DrawingRepository,
  RepositoryCommitResult,
} from './types';

interface StoredDrawing {
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export class MemoryDrawingRepository implements DrawingRepository {
  readonly #drawings = new Map<DrawingId, StoredDrawing>();
  readonly #revisionOwners = new Map<RevisionId, DrawingId>();
  readonly #idFactory: IdFactory;
  readonly #now: () => number;

  constructor(options: { idFactory?: IdFactory; now?: () => number } = {}) {
    this.#idFactory = options.idFactory ?? randomIdFactory;
    this.#now = options.now ?? Date.now;
  }

  async create(document: DrawingDocument): Promise<{
    document: DrawingDocument;
    revision: RevisionId;
  }> {
    if (this.#drawings.has(document.id)) {
      throw new Error(`Drawing ${document.id} already exists`);
    }
    const report = validateDrawingDocument(document);
    if (!report.valid) throw new Error(`Drawing ${document.id} is invalid`);
    const revision = this.#idFactory.next('revision') as RevisionId;
    const stored: StoredDrawing = {
      document: clone(document),
      revision,
      commits: [],
    };
    this.#drawings.set(document.id, stored);
    this.#revisionOwners.set(revision, document.id);
    return { document: clone(stored.document), revision };
  }

  async getCurrent(drawingId: DrawingId): Promise<{
    document: DrawingDocument;
    revision: RevisionId;
  }> {
    const stored = this.requireDrawing(drawingId);
    return { document: clone(stored.document), revision: stored.revision };
  }

  async commit(transaction: Parameters<DrawingRepository['commit']>[0]): Promise<RepositoryCommitResult> {
    const drawingId = this.#revisionOwners.get(transaction.baseRevision);
    if (!drawingId) {
      return rejected({
        code: 'REVISION_NOT_FOUND',
        stage: 'revision',
        retryable: true,
        nodeIds: [],
        message: `版本 ${transaction.baseRevision} 不存在`,
        suggestedAction: 'requery',
      });
    }
    const stored = this.requireDrawing(drawingId);
    const preview = previewTransaction({
      document: stored.document,
      currentRevision: stored.revision,
    }, transaction, this.#idFactory);
    if (preview.status !== 'ready') return clone(preview);

    const commitId = this.#idFactory.next('commit') as CommitId;
    const resultingRevision = this.#idFactory.next('revision') as RevisionId;
    const commit: DrawingCommit = {
      id: commitId,
      drawingId,
      parentRevision: stored.revision,
      resultingRevision,
      actor: clone(transaction.actor),
      ...(transaction.goalId === undefined ? {} : { goalId: transaction.goalId }),
      commands: clone(transaction.commands),
      patch: clone(preview.preview.patch),
      inversePatch: clone(preview.preview.inversePatch),
      validationReport: clone(preview.preview.validationReport),
      outcomeReport: clone(preview.preview.outcomeReport),
      evidenceRefs: clone(transaction.evidenceRefs),
      timestamp: this.#now(),
    };

    stored.document = clone(preview.resultingDocument);
    stored.revision = resultingRevision;
    stored.commits.push(clone(commit));
    this.#revisionOwners.set(resultingRevision, drawingId);

    return {
      status: 'committed',
      commit: clone(commit),
      document: clone(stored.document),
      revision: resultingRevision,
    };
  }

  async revert(input: Parameters<DrawingRepository['revert']>[0]): Promise<RepositoryCommitResult> {
    const stored = this.#drawings.get(input.drawingId);
    if (!stored) {
      return rejected({
        code: 'DRAWING_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
        message: `图纸 ${input.drawingId} 不存在`, suggestedAction: 'pause',
      });
    }
    const target = stored.commits.find((commit) => commit.id === input.commitId);
    if (!target) {
      return rejected({
        code: 'COMMIT_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
        message: `提交 ${input.commitId} 不存在`, suggestedAction: 'pause',
      });
    }

    const applied = applyDrawingPatch(stored.document, target.inversePatch);
    if ('errors' in applied) {
      return {
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
      };
    }

    const validationReport = validateDrawingDocument(applied.document);
    if (!validationReport.valid) {
      return {
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
      };
    }

    const commitId = this.#idFactory.next('commit') as CommitId;
    const resultingRevision = this.#idFactory.next('revision') as RevisionId;
    const outcomeReport: GoalOutcomeReport = { satisfied: true, assertions: [] };
    const commit: DrawingCommit = {
      id: commitId,
      drawingId: input.drawingId,
      parentRevision: stored.revision,
      resultingRevision,
      actor: clone(input.actor),
      commands: [{ type: 'history.revert', commitId: input.commitId }],
      patch: clone(target.inversePatch),
      inversePatch: clone(applied.inversePatch),
      validationReport,
      outcomeReport,
      evidenceRefs: [],
      timestamp: this.#now(),
    };

    stored.document = clone(applied.document);
    stored.revision = resultingRevision;
    stored.commits.push(clone(commit));
    this.#revisionOwners.set(resultingRevision, input.drawingId);

    return {
      status: 'committed',
      commit: clone(commit),
      document: clone(stored.document),
      revision: resultingRevision,
    };
  }

  async listCommits(drawingId: DrawingId): Promise<DrawingCommit[]> {
    return clone(this.requireDrawing(drawingId).commits);
  }

  private requireDrawing(drawingId: DrawingId): StoredDrawing {
    const stored = this.#drawings.get(drawingId);
    if (!stored) throw new Error(`Drawing ${drawingId} does not exist`);
    return stored;
  }
}

function rejected(error: DrawingError): RepositoryCommitResult {
  return { status: 'rejected', errors: [error] };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
