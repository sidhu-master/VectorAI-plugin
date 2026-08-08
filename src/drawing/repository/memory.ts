import type { IdFactory } from '../document/create';
import { randomIdFactory } from '../document/create';
import type {
  DrawingDocument,
  DrawingId,
  RevisionId,
} from '../document/types';
import type { DrawingError } from '../transaction/types';
import {
  commitRepositoryState,
  createRepositoryState,
  revertRepositoryState,
} from './state';
import type {
  DrawingCommit,
  DrawingRepository,
  DrawingRepositoryState,
  RepositoryCommitResult,
} from './types';

export class MemoryDrawingRepository implements DrawingRepository {
  readonly #drawings = new Map<DrawingId, DrawingRepositoryState>();
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
    const revision = this.#idFactory.next('revision') as RevisionId;
    const stored = createRepositoryState(document, revision);
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
    const transition = commitRepositoryState(stored, transaction, {
      idFactory: this.#idFactory,
      now: this.#now,
    });
    if (transition.result.status !== 'committed') return clone(transition.result);
    this.#drawings.set(drawingId, clone(transition.state));
    this.#revisionOwners.set(transition.result.revision, drawingId);
    return clone(transition.result);
  }

  async revert(input: Parameters<DrawingRepository['revert']>[0]): Promise<RepositoryCommitResult> {
    const stored = this.#drawings.get(input.drawingId);
    if (!stored) {
      return rejected({
        code: 'DRAWING_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
        message: `图纸 ${input.drawingId} 不存在`, suggestedAction: 'pause',
      });
    }
    const transition = revertRepositoryState(stored, input, {
      idFactory: this.#idFactory,
      now: this.#now,
    });
    if (transition.result.status !== 'committed') return clone(transition.result);
    this.#drawings.set(input.drawingId, clone(transition.state));
    this.#revisionOwners.set(transition.result.revision, input.drawingId);
    return clone(transition.result);
  }

  async listCommits(drawingId: DrawingId): Promise<DrawingCommit[]> {
    return clone(this.requireDrawing(drawingId).commits);
  }

  private requireDrawing(drawingId: DrawingId): DrawingRepositoryState {
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
