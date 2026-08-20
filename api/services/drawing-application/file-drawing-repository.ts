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
  clearRepositoryState,
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
const HISTORY_SEGMENT_SIZE = 128;

interface DrawingCheckpointV2Payload {
  schemaVersion: 2;
  document: DrawingDocument;
  revision: RevisionId;
  history: {
    commitCount: number;
    baseRevision: RevisionId;
    headRevision: RevisionId;
    segmentSize: number;
  };
}

interface DrawingHistoryBasePayload {
  schemaVersion: 1;
  type: 'drawing-history-base';
  drawingId: DrawingId;
  initialDocument: DrawingDocument;
  baseRevision: RevisionId;
}

interface DrawingHistorySegmentPayload {
  schemaVersion: 1;
  type: 'drawing-history-segment';
  drawingId: DrawingId;
  startIndex: number;
  commits: DrawingCommit[];
}

interface LoadedDrawingState {
  state: DrawingRepositoryState;
  segmented: boolean;
}

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
  readonly #checkpoints = new Map<DrawingId, { document: DrawingDocument; revision: RevisionId }>();
  readonly #revisionOwners = new Map<RevisionId, DrawingId>();
  readonly #drawingLoads = new Map<DrawingId, Promise<DrawingRepositoryState>>();
  readonly #segmentedHistories = new Set<DrawingId>();
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
      await mkdir(this.#rootDirectory, { recursive: true });
      if (this.#states.has(document.id) || await fileExists(this.snapshotPath(document.id))) {
        throw new Error(`Drawing ${document.id} already exists`);
      }
      const revision = this.#idFactory.next('revision') as RevisionId;
      const state = createRepositoryState(document, revision);
      await this.persist(state, 0);
      this.#states.set(document.id, clone(state));
      this.setCheckpoint(state);
      this.indexState(state);
      return { document: clone(state.document), revision };
    });
  }

  async getCurrent(drawingId: DrawingId): Promise<{
    document: DrawingDocument;
    revision: RevisionId;
  }> {
    const state = await this.loadDrawing(drawingId);
    return { document: clone(state.document), revision: state.revision };
  }

  async getCurrentCheckpoint(drawingId: DrawingId): Promise<{
    document: DrawingDocument;
    revision: RevisionId;
  }> {
    const cached = this.#states.get(drawingId);
    if (cached) return { document: clone(cached.document), revision: cached.revision };
    const checkpointCached = this.#checkpoints.get(drawingId);
    if (checkpointCached) return clone(checkpointCached);
    const checkpoint = await readCurrentCheckpoint(this.snapshotPath(drawingId), drawingId);
    this.#checkpoints.set(drawingId, clone(checkpoint));
    return { document: clone(checkpoint.document), revision: checkpoint.revision };
  }

  commit(transaction: Parameters<DrawingRepository['commit']>[0]): Promise<RepositoryCommitResult> {
    return this.serialize(async () => {
      let drawingId = this.#revisionOwners.get(transaction.baseRevision);
      if (!drawingId) drawingId = this.findCachedCheckpointOwner(transaction.baseRevision);
      if (drawingId && !this.#states.has(drawingId)) await this.loadDrawing(drawingId);
      if (!drawingId) {
        await this.ensureLoaded();
        drawingId = this.#revisionOwners.get(transaction.baseRevision);
      }
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
      await this.persist(transition.state, current.commits.length);
      this.#states.set(drawingId, clone(transition.state));
      this.setCheckpoint(transition.state);
      this.indexState(transition.state);
      return clone(transition.result);
    });
  }

  revert(input: Parameters<DrawingRepository['revert']>[0]): Promise<RepositoryCommitResult> {
    return this.serialize(async () => {
      let current: DrawingRepositoryState;
      try {
        current = await this.loadDrawing(input.drawingId);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('does not exist')) throw error;
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
      await this.persist(transition.state, current.commits.length);
      this.#states.set(input.drawingId, clone(transition.state));
      this.setCheckpoint(transition.state);
      this.indexState(transition.state);
      return clone(transition.result);
    });
  }

  clear(input: Parameters<DrawingRepository['clear']>[0]): Promise<RepositoryCommitResult> {
    return this.serialize(async () => {
      let current: DrawingRepositoryState;
      try {
        current = await this.loadDrawing(input.drawingId);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('does not exist')) throw error;
        return {
          status: 'rejected',
          errors: [{
            code: 'DRAWING_NOT_FOUND', stage: 'revision', retryable: false, nodeIds: [],
            message: `图纸 ${input.drawingId} 不存在`, suggestedAction: 'pause',
          }],
        };
      }
      const transition = clearRepositoryState(current, input, {
        idFactory: this.#idFactory,
        now: this.#now,
      });
      if (transition.result.status !== 'committed') return clone(transition.result);
      await this.persist(transition.state, current.commits.length);
      this.#states.set(input.drawingId, clone(transition.state));
      this.setCheckpoint(transition.state);
      this.indexState(transition.state);
      return clone(transition.result);
    });
  }

  async listCommits(drawingId: DrawingId): Promise<DrawingCommit[]> {
    return clone((await this.loadDrawing(drawingId)).commits);
  }

  private loadDrawing(drawingId: DrawingId): Promise<DrawingRepositoryState> {
    const cached = this.#states.get(drawingId);
    if (cached) return Promise.resolve(cached);
    const pending = this.#drawingLoads.get(drawingId);
    if (pending) return pending;
    const loading = readSnapshot(this.snapshotPath(drawingId), this.historyDirectory(drawingId)).then((loaded) => {
      const { state } = loaded;
      if (state.document.id !== drawingId) {
        throw new DrawingRepositoryLoadError('图纸快照文件名与内容不匹配', drawingId);
      }
      this.#states.set(drawingId, clone(state));
      if (loaded.segmented) this.#segmentedHistories.add(drawingId);
      this.setCheckpoint(state);
      this.indexState(state);
      return this.requireState(drawingId);
    }).finally(() => {
      if (this.#drawingLoads.get(drawingId) === loading) this.#drawingLoads.delete(drawingId);
    });
    this.#drawingLoads.set(drawingId, loading);
    return loading;
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
      const loaded = await readSnapshot(path, this.historyDirectoryForSnapshotName(entry.name));
      const { state } = loaded;
      const expectedName = `${hashDrawingId(state.document.id)}.json`;
      if (entry.name !== expectedName) {
        throw new DrawingRepositoryLoadError('图纸快照文件名与内容不匹配', state.document.id);
      }
      if (this.#states.has(state.document.id)) {
        continue;
      }
      this.#states.set(state.document.id, clone(state));
      if (loaded.segmented) this.#segmentedHistories.add(state.document.id);
      this.setCheckpoint(state);
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

  private setCheckpoint(state: Pick<DrawingRepositoryState, 'document' | 'revision'>): void {
    this.#checkpoints.set(state.document.id, {
      document: clone(state.document), revision: state.revision,
    });
  }

  private findCachedCheckpointOwner(revision: RevisionId): DrawingId | undefined {
    for (const [drawingId, checkpoint] of this.#checkpoints) {
      if (checkpoint.revision === revision) return drawingId;
    }
    return undefined;
  }

  private snapshotPath(drawingId: DrawingId): string {
    return join(this.#rootDirectory, `${hashDrawingId(drawingId)}.json`);
  }

  private historyDirectory(drawingId: DrawingId): string {
    return join(this.#rootDirectory, `${hashDrawingId(drawingId)}.history`);
  }

  private historyDirectoryForSnapshotName(snapshotName: string): string {
    return join(this.#rootDirectory, `${basename(snapshotName, '.json')}.history`);
  }

  private async persist(state: DrawingRepositoryState, previousCommitCount: number): Promise<void> {
    await mkdir(this.#rootDirectory, { recursive: true });
    const historyDirectory = this.historyDirectory(state.document.id);
    await mkdir(historyDirectory, { recursive: true });
    const basePath = join(historyDirectory, 'base.json');
    const segmented = this.#segmentedHistories.has(state.document.id);
    if (!segmented) {
      const baseRevision = state.commits[0]?.parentRevision ?? state.revision;
      const basePayload: DrawingHistoryBasePayload = {
        schemaVersion: 1,
        type: 'drawing-history-base',
        drawingId: state.document.id,
        initialDocument: clone(state.initialDocument),
        baseRevision,
      };
      await this.#writer.write(basePath, withContentDigest(basePayload));
      for (let startIndex = 0; startIndex < state.commits.length; startIndex += HISTORY_SEGMENT_SIZE) {
        await this.persistHistorySegment(
          historyDirectory,
          state.document.id,
          startIndex,
          state.commits.slice(startIndex, startIndex + HISTORY_SEGMENT_SIZE),
        );
      }
    } else if (state.commits.length > previousCommitCount) {
      await this.persistHistorySegment(
        historyDirectory,
        state.document.id,
        previousCommitCount,
        state.commits.slice(previousCommitCount),
      );
    }
    const baseRevision = state.commits[0]?.parentRevision ?? state.revision;
    const payload: DrawingCheckpointV2Payload = {
      schemaVersion: 2,
      document: clone(state.document),
      revision: state.revision,
      history: {
        commitCount: state.commits.length,
        baseRevision,
        headRevision: state.revision,
        segmentSize: HISTORY_SEGMENT_SIZE,
      },
    };
    await this.#writer.write(
      this.snapshotPath(state.document.id),
      withContentDigest(payload),
    );
    this.#segmentedHistories.add(state.document.id);
  }

  private persistHistorySegment(
    historyDirectory: string,
    drawingId: DrawingId,
    startIndex: number,
    commits: DrawingCommit[],
  ): Promise<void> {
    const payload: DrawingHistorySegmentPayload = {
      schemaVersion: 1,
      type: 'drawing-history-segment',
      drawingId,
      startIndex,
      commits: clone(commits),
    };
    return this.#writer.write(
      join(historyDirectory, `${String(startIndex).padStart(12, '0')}.json`),
      withContentDigest(payload),
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

async function readSnapshot(path: string, historyDirectory: string): Promise<LoadedDrawingState> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      const name = basename(path, '.json');
      throw new Error(`Drawing ${name} does not exist`);
    }
    throw new DrawingRepositoryLoadError(`无法读取图纸快照 ${basename(path)}`);
  }
  if (isRecord(value) && value.schemaVersion === 2) {
    return readSegmentedSnapshot(value, path, historyDirectory);
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
  const hasVerifiedDigest = verifySnapshotContentDigest(value, drawingId);

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
  if (hasVerifiedDigest) {
    if (!hasValidRevisionChain(commits, value.revision as RevisionId)) {
      throw new DrawingRepositoryLoadError('图纸快照版本链无效', drawingId);
    }
  } else {
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
  }
  return {
    segmented: false,
    state: {
      initialDocument,
      document,
      revision: value.revision as RevisionId,
      commits,
    },
  };
}

async function readSegmentedSnapshot(
  value: Record<string, unknown>,
  path: string,
  historyDirectory: string,
): Promise<LoadedDrawingState> {
  if (typeof value.revision !== 'string'
    || !looksLikeDocument(value.document)
    || !looksLikeCheckpointHistory(value.history)) {
    throw new DrawingRepositoryLoadError(`图纸检查点结构无效 ${basename(path)}`);
  }
  const drawingId = value.document.id as DrawingId;
  verifyAnyContentDigest(value, drawingId);
  const history = value.history;
  if (history.headRevision !== value.revision) {
    throw new DrawingRepositoryLoadError('图纸检查点历史头版本不一致', drawingId);
  }
  const baseValue = await readJsonPayload(join(historyDirectory, 'base.json'), drawingId);
  if (baseValue.type !== 'drawing-history-base'
    || baseValue.drawingId !== drawingId
    || baseValue.baseRevision !== history.baseRevision
    || !looksLikeDocument(baseValue.initialDocument)
    || baseValue.initialDocument.id !== drawingId) {
    throw new DrawingRepositoryLoadError('图纸历史基础记录无效', drawingId);
  }
  const initialDocument = clone(baseValue.initialDocument as unknown as DrawingDocument);
  const document = clone(value.document as unknown as DrawingDocument);
  try {
    if (!validateDrawingDocument(initialDocument).valid || !validateDrawingDocument(document).valid) {
      throw new Error('invalid document');
    }
  } catch {
    throw new DrawingRepositoryLoadError('图纸检查点文档无效', drawingId);
  }
  const entries = (await readdir(historyDirectory))
    .filter((name) => /^\d{12}\.json$/.test(name))
    .sort()
    .filter((name) => Number.parseInt(name, 10) < history.commitCount);
  const commits: DrawingCommit[] = [];
  for (const name of entries) {
    const segment = await readJsonPayload(join(historyDirectory, name), drawingId);
    if (segment.type !== 'drawing-history-segment'
      || segment.drawingId !== drawingId
      || segment.startIndex !== commits.length
      || !Array.isArray(segment.commits)
      || !segment.commits.every((commit) => looksLikeCommit(commit, drawingId))) {
      throw new DrawingRepositoryLoadError(`图纸历史分段无效 ${name}`, drawingId);
    }
    const remaining = history.commitCount - commits.length;
    commits.push(...clone((segment.commits as DrawingCommit[]).slice(0, remaining)));
  }
  if (commits.length !== history.commitCount
    || !hasValidRevisionChain(commits, value.revision as RevisionId)
    || (commits[0]?.parentRevision ?? value.revision) !== history.baseRevision) {
    throw new DrawingRepositoryLoadError('图纸历史链与检查点不一致', drawingId);
  }
  return {
    segmented: true,
    state: {
      initialDocument,
      document,
      revision: value.revision as RevisionId,
      commits,
    },
  };
}

async function readJsonPayload(path: string, drawingId: DrawingId): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new DrawingRepositoryLoadError(`无法读取图纸历史 ${basename(path)}`, drawingId);
  }
  if (!isRecord(value)) {
    throw new DrawingRepositoryLoadError(`图纸历史结构无效 ${basename(path)}`, drawingId);
  }
  verifyAnyContentDigest(value, drawingId);
  return value;
}

async function readCurrentCheckpoint(
  path: string,
  expectedDrawingId: DrawingId,
): Promise<{ document: DrawingDocument; revision: RevisionId }> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Drawing ${expectedDrawingId} does not exist`);
    }
    throw new DrawingRepositoryLoadError(`无法读取图纸快照 ${basename(path)}`, expectedDrawingId);
  }
  if (!isRecord(value)
    || (value.schemaVersion !== 1 && value.schemaVersion !== 2)
    || typeof value.revision !== 'string'
    || !looksLikeDocument(value.document)
    || value.document.id !== expectedDrawingId
    || (value.schemaVersion === 1
      && (!Array.isArray(value.commits) || !looksLikeDocument(value.initialDocument)))
    || (value.schemaVersion === 2 && !looksLikeCheckpointHistory(value.history))) {
    throw new DrawingRepositoryLoadError('图纸当前检查点结构或引用无效', expectedDrawingId);
  }
  if (value.schemaVersion === 2) verifyAnyContentDigest(value, expectedDrawingId);
  else verifySnapshotContentDigest(value, expectedDrawingId);
  const document = clone(value.document as unknown as DrawingDocument);
  try {
    if (!validateDrawingDocument(document).valid) throw new Error('invalid document');
  } catch {
    throw new DrawingRepositoryLoadError('图纸当前检查点文档无效', expectedDrawingId);
  }
  return { document, revision: value.revision as RevisionId };
}

function snapshotContentDigest(
  snapshot: Omit<DrawingRepositorySnapshot, 'contentDigest'>,
): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}`;
}

function verifySnapshotContentDigest(
  value: Record<string, unknown>,
  drawingId: DrawingId,
): boolean {
  if (value.contentDigest === undefined) return false;
  if (typeof value.contentDigest !== 'string') {
    throw new DrawingRepositoryLoadError('图纸快照内容摘要无效', drawingId);
  }
  const payload = {
    schemaVersion: value.schemaVersion,
    initialDocument: value.initialDocument,
    document: value.document,
    revision: value.revision,
    commits: value.commits,
  } as Omit<DrawingRepositorySnapshot, 'contentDigest'>;
  if (snapshotContentDigest(payload) !== value.contentDigest) {
    throw new DrawingRepositoryLoadError('图纸快照内容摘要不匹配', drawingId);
  }
  return true;
}

function withContentDigest<T extends object>(payload: T): string {
  return JSON.stringify({
    ...payload,
    contentDigest: genericContentDigest(payload),
  }, null, 2);
}

function genericContentDigest(payload: object): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function verifyAnyContentDigest(value: Record<string, unknown>, drawingId: DrawingId): void {
  if (typeof value.contentDigest !== 'string') {
    throw new DrawingRepositoryLoadError('图纸持久化内容摘要无效', drawingId);
  }
  const { contentDigest, ...payload } = value;
  if (genericContentDigest(payload) !== contentDigest) {
    throw new DrawingRepositoryLoadError('图纸持久化内容摘要不匹配', drawingId);
  }
}

function looksLikeCheckpointHistory(value: unknown): value is {
  commitCount: number;
  baseRevision: RevisionId;
  headRevision: RevisionId;
  segmentSize: number;
} {
  return isRecord(value)
    && Number.isInteger(value.commitCount)
    && (value.commitCount as number) >= 0
    && typeof value.baseRevision === 'string'
    && typeof value.headRevision === 'string'
    && Number.isInteger(value.segmentSize)
    && (value.segmentSize as number) > 0;
}

function hasValidRevisionChain(commits: DrawingCommit[], revision: RevisionId): boolean {
  if (commits.length === 0) return true;
  for (let index = 1; index < commits.length; index += 1) {
    if (commits[index].parentRevision !== commits[index - 1].resultingRevision) return false;
  }
  return commits[commits.length - 1].resultingRevision === revision;
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
    || !optionalStringArray(value.decisionGrantRefs)) {
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, { encoding: null });
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function hashDrawingId(drawingId: DrawingId): string {
  return createHash('sha256').update(drawingId).digest('hex');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
