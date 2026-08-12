import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  commitRepositoryState,
  createRepositoryState,
  randomIdFactory,
  replayDrawingCommits,
  revertRepositoryState,
  validateDrawingDocument,
  type DrawingCommit,
  type DrawingDocument,
  type DrawingId,
  type DrawingPatchOperation,
  type DrawingRepository,
  type DrawingRepositorySnapshot,
  type DrawingRepositoryState,
  type IdFactory,
  type RepositoryCommitResult,
  type RevisionId,
} from '../../../src/drawing/index.js';

const PATCH_OPERATION_TYPES = new Set<DrawingPatchOperation['type']>([
  'geometry.add', 'geometry.update', 'geometry.delete',
  'annotation.add', 'annotation.update', 'annotation.delete',
  'relation.add', 'relation.update', 'relation.delete',
  'feature.add', 'feature.update', 'feature.delete',
]);

const LINEAGE_OPERATIONS = new Set([
  'preserve', 'transform', 'split', 'merge', 'replace', 'redraw',
]);

export interface AtomicJsonWriter {
  write(targetPath: string, json: string): Promise<void>;
}

export class NodeAtomicJsonWriter implements AtomicJsonWriter {
  async write(targetPath: string, json: string): Promise<void> {
    const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporaryPath, 'wx');
      await handle.writeFile(json, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryPath, targetPath);
      const directoryHandle = await open(dirname(targetPath), 'r');
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

export class DrawingRepositoryLoadError extends Error {
  readonly code: 'CORRUPT_SNAPSHOT';
  readonly drawingId?: DrawingId;

  constructor(message: string, drawingId?: DrawingId) {
    super(message);
    this.name = 'DrawingRepositoryLoadError';
    this.code = 'CORRUPT_SNAPSHOT';
    this.drawingId = drawingId;
  }
}

export class FileDrawingRepository implements DrawingRepository {
  readonly #rootDirectory: string;
  readonly #idFactory: IdFactory;
  readonly #now: () => number;
  readonly #writer: AtomicJsonWriter;
  readonly #states = new Map<DrawingId, DrawingRepositoryState>();
  readonly #revisionOwners = new Map<RevisionId, DrawingId>();
  #loadPromise: Promise<void> | undefined;
  #writeTail: Promise<void> = Promise.resolve();

  constructor(input: {
    rootDirectory: string;
    idFactory?: IdFactory;
    now?: () => number;
    writer?: AtomicJsonWriter;
  }) {
    this.#rootDirectory = input.rootDirectory;
    this.#idFactory = input.idFactory ?? randomIdFactory;
    this.#now = input.now ?? Date.now;
    this.#writer = input.writer ?? new NodeAtomicJsonWriter();
  }

  create(document: DrawingDocument): Promise<{ document: DrawingDocument; revision: RevisionId }> {
    return this.serialize(async () => {
      await this.ensureLoaded();
      if (this.#states.has(document.id)) throw new Error(`Drawing ${document.id} already exists`);
      const revision = this.#idFactory.next('revision') as RevisionId;
      const state = createRepositoryState(document, revision);
      await this.persist(state);
      this.#states.set(document.id, clone(state));
      this.indexState(state);
      return { document: clone(state.document), revision };
    });
  }

  async getCurrent(drawingId: DrawingId): Promise<{
    document: DrawingDocument;
    revision: RevisionId;
  }> {
    await this.ensureLoaded();
    const state = this.requireState(drawingId);
    return { document: clone(state.document), revision: state.revision };
  }

  commit(transaction: Parameters<DrawingRepository['commit']>[0]): Promise<RepositoryCommitResult> {
    return this.serialize(async () => {
      await this.ensureLoaded();
      const drawingId = this.#revisionOwners.get(transaction.baseRevision);
      if (!drawingId) {
        return {
          status: 'rejected',
          errors: [{
            code: 'REVISION_NOT_FOUND', stage: 'revision', retryable: true, nodeIds: [],
            message: `版本 ${transaction.baseRevision} 不存在`, suggestedAction: 'requery',
          }],
        };
      }
      const current = this.requireState(drawingId);
      const transition = commitRepositoryState(current, transaction, {
        idFactory: this.#idFactory,
        now: this.#now,
      });
      if (transition.result.status !== 'committed') return clone(transition.result);
      await this.persist(transition.state);
      this.#states.set(drawingId, clone(transition.state));
      this.indexState(transition.state);
      return clone(transition.result);
    });
  }

  revert(input: Parameters<DrawingRepository['revert']>[0]): Promise<RepositoryCommitResult> {
    return this.serialize(async () => {
      await this.ensureLoaded();
      const current = this.#states.get(input.drawingId);
      if (!current) {
        return {
          status: 'rejected',
          errors: [{
            code: 'DRAWING_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
            message: `图纸 ${input.drawingId} 不存在`, suggestedAction: 'pause',
          }],
        };
      }
      const transition = revertRepositoryState(current, input, {
        idFactory: this.#idFactory,
        now: this.#now,
      });
      if (transition.result.status !== 'committed') return clone(transition.result);
      await this.persist(transition.state);
      this.#states.set(input.drawingId, clone(transition.state));
      this.indexState(transition.state);
      return clone(transition.result);
    });
  }

  async listCommits(drawingId: DrawingId): Promise<DrawingCommit[]> {
    await this.ensureLoaded();
    return clone(this.requireState(drawingId).commits);
  }

  private ensureLoaded(): Promise<void> {
    this.#loadPromise ??= this.loadAll();
    return this.#loadPromise;
  }

  private async loadAll(): Promise<void> {
    await mkdir(this.#rootDirectory, { recursive: true });
    const entries = await readdir(this.#rootDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const path = join(this.#rootDirectory, entry.name);
      const state = await readSnapshot(path);
      const expectedName = `${hashDrawingId(state.document.id)}.json`;
      if (entry.name !== expectedName) {
        throw new DrawingRepositoryLoadError('图纸快照文件名与内容不匹配', state.document.id);
      }
      if (this.#states.has(state.document.id)) {
        throw new DrawingRepositoryLoadError('图纸快照重复', state.document.id);
      }
      this.#states.set(state.document.id, clone(state));
      this.indexState(state);
    }
  }

  private indexState(state: DrawingRepositoryState): void {
    const revisions = [
      state.revision,
      ...state.commits.flatMap((commit) => [commit.parentRevision, commit.resultingRevision]),
    ];
    for (const revision of revisions) {
      const owner = this.#revisionOwners.get(revision);
      if (owner && owner !== state.document.id) {
        throw new DrawingRepositoryLoadError('版本 ID 被多个图纸使用', state.document.id);
      }
      this.#revisionOwners.set(revision, state.document.id);
    }
  }

  private async persist(state: DrawingRepositoryState): Promise<void> {
    await mkdir(this.#rootDirectory, { recursive: true });
    const snapshot: DrawingRepositorySnapshot = {
      schemaVersion: 1,
      initialDocument: clone(state.initialDocument),
      document: clone(state.document),
      revision: state.revision,
      commits: clone(state.commits),
    };
    await this.#writer.write(
      join(this.#rootDirectory, `${hashDrawingId(state.document.id)}.json`),
      JSON.stringify(snapshot, null, 2),
    );
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#writeTail.then(operation, operation);
    this.#writeTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private requireState(drawingId: DrawingId): DrawingRepositoryState {
    const state = this.#states.get(drawingId);
    if (!state) throw new Error(`Drawing ${drawingId} does not exist`);
    return state;
  }
}

async function readSnapshot(path: string): Promise<DrawingRepositoryState> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new DrawingRepositoryLoadError(`无法读取图纸快照 ${basename(path)}`);
  }
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.revision !== 'string'
    || !Array.isArray(value.commits)
    || !looksLikeDocument(value.initialDocument)
    || !looksLikeDocument(value.document)) {
    throw new DrawingRepositoryLoadError(`图纸快照结构无效 ${basename(path)}`);
  }
  const drawingId = value.document.id as DrawingId;
  if (value.initialDocument.id !== drawingId
    || !value.commits.every((commit) => looksLikeCommit(commit, drawingId))) {
    throw new DrawingRepositoryLoadError('图纸快照引用不一致', drawingId);
  }

  const initialDocument = clone(value.initialDocument as unknown as DrawingDocument);
  const document = clone(value.document as unknown as DrawingDocument);
  const commits = clone(value.commits as DrawingCommit[]);
  try {
    if (!validateDrawingDocument(initialDocument).valid || !validateDrawingDocument(document).valid) {
      throw new Error('invalid document');
    }
  } catch {
    throw new DrawingRepositoryLoadError('图纸快照文档无效', drawingId);
  }
  let replayed: ReturnType<typeof replayDrawingCommits>;
  try {
    replayed = replayDrawingCommits(initialDocument, commits);
  } catch {
    throw new DrawingRepositoryLoadError('图纸快照回放操作无效', drawingId);
  }
  if (!replayed.success
    || !isDeepStrictEqual(replayed.document, document)
    || (commits.length > 0 && replayed.revision !== value.revision)) {
    throw new DrawingRepositoryLoadError('图纸快照无法确定性回放', drawingId);
  }
  return {
    initialDocument,
    document,
    revision: value.revision as RevisionId,
    commits,
  };
}

function looksLikeDocument(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && value.protocol === 'VectorAI-Drawing'
    && value.schemaVersion === '1.0'
    && typeof value.id === 'string'
    && isRecord(value.metadata)
    && isRecord(value.unitSystem)
    && Array.isArray(value.coordinateFrames)
    && Array.isArray(value.geometry)
    && Array.isArray(value.annotations)
    && Array.isArray(value.relations)
    && Array.isArray(value.features);
}

function looksLikeCommit(value: unknown, drawingId: DrawingId): boolean {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.drawingId === drawingId
    && typeof value.parentRevision === 'string'
    && typeof value.resultingRevision === 'string'
    && isRecord(value.patch)
    && isRecord(value.inversePatch)
    && validOperations(value.patch.operations)
    && validOperations(value.inversePatch.operations)
    && Array.isArray(value.commands)
    && Array.isArray(value.evidenceRefs)
    && value.evidenceRefs.every((reference) => typeof reference === 'string')
    && looksLikeTransactionMetadata(value.metadata);
}

function looksLikeTransactionMetadata(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)
    || typeof value.episodeId !== 'string'
    || typeof value.summary !== 'string'
    || !optionalProbability(value.confidence)
    || !optionalStringArray(value.decisionGrantRefs)
    || !optionalStringArray(value.diagnosticAcknowledgements)) {
    return false;
  }
  if (value.lineage === undefined) return true;
  return Array.isArray(value.lineage) && value.lineage.every((record) => (
    isRecord(record)
    && stringArray(record.sourceIds)
    && stringArray(record.resultIds)
    && typeof record.operation === 'string'
    && LINEAGE_OPERATIONS.has(record.operation)
    && stringArray(record.evidenceRefs)
    && looksLikeSourceRanges(record.sourceRanges)
  ));
}

function looksLikeSourceRanges(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((range) => (
    isRecord(range)
    && typeof range.nodeId === 'string'
    && Array.isArray(range.range)
    && range.range.length === 2
    && range.range.every((coordinate) => (
      typeof coordinate === 'number' && Number.isFinite(coordinate)
    ))
  ));
}

function optionalProbability(value: unknown): boolean {
  return value === undefined
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
}

function optionalStringArray(value: unknown): boolean {
  return value === undefined || stringArray(value);
}

function stringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validOperations(value: unknown): boolean {
  return Array.isArray(value) && value.every((operation) => {
    if (!isRecord(operation)
      || typeof operation.type !== 'string'
      || !PATCH_OPERATION_TYPES.has(operation.type as DrawingPatchOperation['type'])) {
      return false;
    }
    if (operation.type.endsWith('.add')) {
      return isRecord(operation.value) && typeof operation.value.id === 'string';
    }
    if (typeof operation.id !== 'string') return false;
    return !operation.type.endsWith('.update') || isRecord(operation.changes);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hashDrawingId(drawingId: DrawingId): string {
  return createHash('sha256').update(drawingId).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
