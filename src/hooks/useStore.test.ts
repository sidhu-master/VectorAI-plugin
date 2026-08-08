import { describe, expect, it, vi } from 'vitest';
import type {
  CommitId,
  DrawingCommit,
  DrawingDocument,
  DrawingId,
  DrawingTransaction,
  GeometryId,
  RepositoryCommitResult,
  RevisionId,
} from '@/drawing';
import type { AgentClient } from '@/services/agent-client';
import { DrawingClientError, type DrawingClient } from '@/services/drawing-client';
import {
  ACTIVE_DRAWING_STORAGE_KEY,
  createAppStore,
} from './useStore';

const drawingId = 'drawing_1' as DrawingId;
const geometryId = 'geometry_1' as GeometryId;
const revision1 = 'revision_1' as RevisionId;
const revision2 = 'revision_2' as RevisionId;

describe('canonical drawing workspace store', () => {
  it('opens the locally remembered drawing on initialization', async () => {
    const storage = memoryStorage({ [ACTIVE_DRAWING_STORAGE_KEY]: drawingId });
    const client = drawingClientDouble();
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage,
    });

    await store.getState().initializeDrawing();

    expect(client.open).toHaveBeenCalledWith(drawingId);
    expect(client.create).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      document: expect.objectContaining({ id: drawingId }),
      revision: revision1,
      commits: [],
      drawingStatus: 'ready',
      drawingError: null,
    });
  });

  it('creates a drawing only when no saved drawing exists', async () => {
    const storage = memoryStorage();
    const client = drawingClientDouble();
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage,
    });

    await store.getState().initializeDrawing();

    expect(client.open).not.toHaveBeenCalled();
    expect(client.create).toHaveBeenCalledWith('mm');
    expect(storage.getItem(ACTIVE_DRAWING_STORAGE_KEY)).toBe(drawingId);
  });

  it('coalesces concurrent initialization from React development effects', async () => {
    const client = drawingClientDouble();
    let release!: () => void;
    client.create.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      return workspace();
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
    });

    const first = store.getState().initializeDrawing();
    const second = store.getState().initializeDrawing();
    release();
    await Promise.all([first, second]);

    expect(client.create).toHaveBeenCalledOnce();
  });

  it('recreates a drawing after a remembered drawing was deleted', async () => {
    const storage = memoryStorage({ [ACTIVE_DRAWING_STORAGE_KEY]: 'drawing_gone' });
    const client = drawingClientDouble();
    client.open.mockRejectedValueOnce(
      new DrawingClientError('图纸不存在', 'DRAWING_NOT_FOUND', 404),
    );
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage,
    });

    await store.getState().initializeDrawing();

    expect(client.create).toHaveBeenCalledOnce();
    expect(store.getState().drawingStatus).toBe('ready');
  });

  it('does not hide corrupt local data by silently creating a replacement', async () => {
    const storage = memoryStorage({ [ACTIVE_DRAWING_STORAGE_KEY]: 'drawing_bad' });
    const client = drawingClientDouble();
    client.open.mockRejectedValueOnce(
      new DrawingClientError('本地图纸数据损坏', 'CORRUPT_SNAPSHOT', 409),
    );
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage,
    });

    await store.getState().initializeDrawing();

    expect(client.create).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      document: null,
      drawingStatus: 'error',
      drawingError: '本地图纸数据损坏',
    });
  });

  it('executes a typed optimistic update and adopts the committed snapshot', async () => {
    const client = drawingClientDouble();
    client.execute.mockImplementation(async (_id, transaction) => {
      const next = structuredClone(workspace().document);
      const circle = next.geometry[0];
      if (circle.type !== 'circle') throw new Error('fixture must be a circle');
      circle.radius = 8;
      return committed(next, transaction.baseRevision);
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
      idFactory: { next: (kind) => `${kind}_local` },
    });
    await store.getState().initializeDrawing();

    await store.getState().updateNode(geometryId, { radius: 8 });

    expect(client.execute).toHaveBeenCalledWith(
      drawingId,
      expect.objectContaining({
        id: 'transaction_local',
        baseRevision: revision1,
        actor: { type: 'user', id: 'local-user' },
        commands: [{
          type: 'geometry.update', id: geometryId,
          changes: { radius: 8 }, expected: { radius: 5 },
        }],
      }),
    );
    expect(store.getState().revision).toBe(revision2);
    expect(store.getState().commits).toHaveLength(1);
    expect(store.getState().document?.geometry[0]).toMatchObject({ radius: 8 });
  });

  it('retains the visible revision and document when a transaction is stale', async () => {
    const client = drawingClientDouble();
    client.execute.mockResolvedValueOnce({
      status: 'rejected',
      errors: [{
        code: 'STALE_REVISION', stage: 'revision', retryable: true, nodeIds: [],
        message: '版本已变化', suggestedAction: 'requery',
      }],
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    const before = store.getState().document;

    await store.getState().deleteNode(geometryId);

    expect(store.getState().document).toBe(before);
    expect(store.getState().revision).toBe(revision1);
    expect(store.getState().drawingError).toBe('版本已变化');
  });

  it('reverts the latest canonical commit through the repository', async () => {
    const existingCommit = { id: 'commit_existing' as CommitId } as DrawingCommit;
    const client = drawingClientDouble({ commits: [existingCommit] });
    client.revert.mockResolvedValueOnce({
      status: 'already_satisfied', outcome: { satisfied: true, assertions: [] },
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().revertLatest();

    expect(client.revert).toHaveBeenCalledWith(
      drawingId,
      existingCommit.id,
      { type: 'user', id: 'local-user' },
    );
  });
});

describe('Agent migration guard', () => {
  it('blocks new Agent drawing mutations before any legacy request is sent', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().submitAgentInput('创建一个圆', 'aW1hZ2U=', 'image/png');

    expect(agent.start).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      agentStatus: 'error',
      agentError: 'Agent Runtime 正在迁移到 Drawing Core',
    });
    expect(store.getState().document?.geometry).toHaveLength(1);
  });

  it('keeps controls for an already-running task presentation-only', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    const before = store.getState().document;
    store.setState({ agentRunId: 'run_active', agentStatus: 'running' });

    await store.getState().pauseAgent();

    expect(agent.pause).toHaveBeenCalledWith('run_active');
    expect(store.getState().agentStatus).toBe('pause_requested');
    expect(store.getState().document).toBe(before);
  });
});

function workspace(overrides: { commits?: DrawingCommit[] } = {}) {
  return {
    document: drawingDocument(),
    revision: revision1,
    commits: overrides.commits ?? [],
  };
}

function drawingDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: drawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry: [{
      id: geometryId, type: 'circle', center: [0, 0], radius: 5, visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }],
    annotations: [], relations: [], features: [],
  };
}

function committed(
  document: DrawingDocument,
  parentRevision: RevisionId,
): RepositoryCommitResult {
  return {
    status: 'committed',
    document,
    revision: revision2,
    commit: {
      id: 'commit_1' as CommitId,
      drawingId,
      parentRevision,
      resultingRevision: revision2,
      actor: { type: 'user', id: 'local-user' },
      commands: [], patch: { operations: [] }, inversePatch: { operations: [] },
      validationReport: { valid: true, issues: [] },
      outcomeReport: { satisfied: true, assertions: [] },
      evidenceRefs: [], timestamp: 2,
    },
  };
}

function drawingClientDouble(overrides: { commits?: DrawingCommit[] } = {}) {
  return {
    create: vi.fn<(unit?: 'mm' | 'cm' | 'm') => Promise<ReturnType<typeof workspace>>>(
      async () => workspace(overrides),
    ),
    open: vi.fn<(id: DrawingId) => Promise<ReturnType<typeof workspace>>>(
      async () => workspace(overrides),
    ),
    execute: vi.fn<(
      id: DrawingId,
      transaction: DrawingTransaction,
    ) => Promise<RepositoryCommitResult>>(async () => ({
      status: 'already_satisfied' as const,
      outcome: { satisfied: true, assertions: [] },
    })),
    revert: vi.fn<(
      id: DrawingId,
      commitId: CommitId,
      actor: { type: 'user' | 'AI' | 'system'; id: string },
    ) => Promise<RepositoryCommitResult>>(async () => ({
      status: 'already_satisfied' as const,
      outcome: { satisfied: true, assertions: [] },
    })),
  };
}

function agentClientDouble() {
  const run = { status: 'pause_requested' as const, plan: null, currentStepIndex: 0 };
  return {
    start: vi.fn(async () => ({ runId: 'run_1' })),
    subscribe: vi.fn(() => () => undefined),
    getRun: vi.fn(async () => run),
    pause: vi.fn(async () => run),
    resume: vi.fn(async () => ({ ...run, status: 'running' as const })),
    stop: vi.fn(async () => ({ ...run, status: 'stopping' as const })),
    addInstruction: vi.fn(async () => ({ ...run, status: 'running' as const })),
  };
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}
