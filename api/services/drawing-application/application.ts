import {
  createEmptyDrawing,
  inspectNode,
  previewTransaction,
  queryDrawing,
  randomIdFactory,
  type Actor,
  type CommitId,
  type DrawingId,
  type DrawingRepository,
  type DrawingSelector,
  type DrawingTransaction,
  type IdFactory,
  type RepositoryCommitResult,
  type TransactionResult,
} from '../../../src/drawing/index.js';
import type {
  DrawingInspectWorkspaceResult,
  DrawingQueryWorkspaceResult,
  DrawingRevisionValidation,
  DrawingSummaryWorkspaceResult,
  DrawingWorkspaceSnapshot,
} from '../../../src/contracts/drawing-application.js';
import {
  renderGroundingSnapshot,
  type GroundingSnapshot,
} from '../drawing-vision/grounding-renderer.js';

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
    if (!ownsRevision(workspace, input.transaction.baseRevision)) return revisionMismatch();
    return this.#repository.commit(input.transaction);
  }

  async query(input: {
    drawingId: DrawingId;
    selector: DrawingSelector;
  }): Promise<DrawingQueryWorkspaceResult> {
    const workspace = await this.open(input.drawingId);
    return {
      revision: workspace.revision,
      result: queryDrawing(workspace.document, structuredClone(input.selector)),
    };
  }

  async renderForVision(input: {
    drawingId: DrawingId;
    viewport: { scale: number; offsetX: number; offsetY: number; width: number; height: number };
    selectedIds?: string[];
    maxDimension?: number;
  }): Promise<GroundingSnapshot> {
    const workspace = await this.open(input.drawingId);
    return renderGroundingSnapshot({
      document: workspace.document,
      scale: input.viewport.scale,
      offsetX: input.viewport.offsetX,
      offsetY: input.viewport.offsetY,
      width: input.viewport.width,
      height: input.viewport.height,
      selectedIds: input.selectedIds,
      maxDimension: input.maxDimension,
    });
  }

  async summarize(input: {
    drawingId: DrawingId;
    limit?: number;
  }): Promise<DrawingSummaryWorkspaceResult> {
    const workspace = await this.open(input.drawingId);
    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 100)));
    const result = queryDrawing(workspace.document, { limit });
    const bounds = result.items.reduce<{
      minX: number; minY: number; maxX: number; maxY: number;
    } | undefined>((current, item) => {
      if (!item.bounds) return current;
      if (!current) return { ...item.bounds };
      return {
        minX: Math.min(current.minX, item.bounds.minX),
        minY: Math.min(current.minY, item.bounds.minY),
        maxX: Math.max(current.maxX, item.bounds.maxX),
        maxY: Math.max(current.maxY, item.bounds.maxY),
      };
    }, undefined);
    return {
      revision: workspace.revision,
      summary: {
        unit: workspace.document.unitSystem.length,
        counts: {
          geometry: workspace.document.geometry.length,
          annotation: workspace.document.annotations.length,
          relation: workspace.document.relations.length,
          feature: workspace.document.features.length,
        },
        ...(bounds ? { bounds } : {}),
        items: result.items,
        truncated: result.truncated,
      },
    };
  }

  async validateRevision(input: {
    drawingId: DrawingId;
    revision: DrawingTransaction['baseRevision'];
  }): Promise<DrawingRevisionValidation> {
    const workspace = await this.open(input.drawingId);
    return {
      owned: ownsRevision(workspace, input.revision),
      currentRevision: workspace.revision,
    };
  }

  async inspect(input: {
    drawingId: DrawingId;
    nodeId: string;
  }): Promise<DrawingInspectWorkspaceResult> {
    const workspace = await this.open(input.drawingId);
    return {
      revision: workspace.revision,
      result: inspectNode(workspace.document, input.nodeId),
    };
  }

  async preview(input: {
    drawingId: DrawingId;
    transaction: DrawingTransaction;
  }): Promise<TransactionResult> {
    const workspace = await this.open(input.drawingId);
    if (!ownsRevision(workspace, input.transaction.baseRevision)) return revisionMismatch();
    return previewTransaction({
      document: workspace.document,
      currentRevision: workspace.revision,
    }, structuredClone(input.transaction), this.#idFactory);
  }

  revert(input: {
    drawingId: DrawingId;
    commitId: CommitId;
    actor: Actor;
  }): Promise<RepositoryCommitResult> {
    return this.#repository.revert(input);
  }
}

function ownsRevision(
  workspace: DrawingWorkspaceSnapshot,
  revision: DrawingTransaction['baseRevision'],
): boolean {
  return new Set([
    workspace.revision,
    ...workspace.commits.flatMap((commit) => [
      commit.parentRevision,
      commit.resultingRevision,
    ]),
  ]).has(revision);
}

function revisionMismatch(): Extract<TransactionResult, { status: 'rejected' }> {
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
