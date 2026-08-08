import {
  createEmptyDrawing,
  randomIdFactory,
  type Actor,
  type CommitId,
  type DrawingId,
  type DrawingRepository,
  type DrawingTransaction,
  type IdFactory,
  type RepositoryCommitResult,
} from '../../../src/drawing/index.js';
import type { DrawingWorkspaceSnapshot } from '../../../src/contracts/drawing-application.js';

export class DrawingApplicationError extends Error {
  readonly code: 'DRAWING_NOT_FOUND';

  constructor(code: 'DRAWING_NOT_FOUND', message: string) {
    super(message);
    this.name = 'DrawingApplicationError';
    this.code = code;
  }
}

export class DrawingApplication {
  readonly #repository: DrawingRepository;
  readonly #idFactory: IdFactory;
  readonly #now: () => number;

  constructor(input: {
    repository: DrawingRepository;
    idFactory?: IdFactory;
    now?: () => number;
  }) {
    this.#repository = input.repository;
    this.#idFactory = input.idFactory ?? randomIdFactory;
    this.#now = input.now ?? Date.now;
  }

  async create(input: { unit?: 'mm' | 'cm' | 'm' } = {}): Promise<DrawingWorkspaceSnapshot> {
    const document = createEmptyDrawing({
      unit: input.unit,
      idFactory: this.#idFactory,
      now: this.#now,
    });
    const created = await this.#repository.create(document);
    return { ...created, commits: [] };
  }

  async open(drawingId: DrawingId): Promise<DrawingWorkspaceSnapshot> {
    try {
      const [current, commits] = await Promise.all([
        this.#repository.getCurrent(drawingId),
        this.#repository.listCommits(drawingId),
      ]);
      return { ...current, commits };
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        throw new DrawingApplicationError('DRAWING_NOT_FOUND', '图纸不存在');
      }
      throw error;
    }
  }

  async execute(input: {
    drawingId: DrawingId;
    transaction: DrawingTransaction;
  }): Promise<RepositoryCommitResult> {
    const workspace = await this.open(input.drawingId);
    const knownRevisions = new Set([
      workspace.revision,
      ...workspace.commits.flatMap((commit) => [
        commit.parentRevision,
        commit.resultingRevision,
      ]),
    ]);
    if (!knownRevisions.has(input.transaction.baseRevision)) {
      return {
        status: 'rejected',
        errors: [{
          code: 'DRAWING_REVISION_MISMATCH',
          stage: 'revision',
          retryable: false,
          nodeIds: [],
          message: '事务版本不属于指定图纸',
          suggestedAction: 'requery',
        }],
      };
    }
    return this.#repository.commit(input.transaction);
  }

  revert(input: {
    drawingId: DrawingId;
    commitId: CommitId;
    actor: Actor;
  }): Promise<RepositoryCommitResult> {
    return this.#repository.revert(input);
  }
}
