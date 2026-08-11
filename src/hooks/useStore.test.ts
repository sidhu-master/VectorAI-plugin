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
  it('toggles all canvas annotations as a view preference without changing Drawing IR', async () => {
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    const document = store.getState().document;

    expect(store.getState().showAnnotations).toBe(true);
    store.getState().toggleAnnotations();

    expect(store.getState().showAnnotations).toBe(false);
    expect(store.getState().document).toBe(document);
    store.getState().toggleAnnotations();
    expect(store.getState().showAnnotations).toBe(true);
  });

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

  it('clears against the latest repository revision instead of the visible stale revision', async () => {
    const client = drawingClientDouble();
    client.open.mockResolvedValueOnce({ ...workspace(), revision: revision2 });
    client.execute.mockImplementationOnce(async (_id, transaction) => {
      const empty = structuredClone(workspace().document);
      empty.geometry = [];
      return committed(empty, transaction.baseRevision);
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
      idFactory: { next: (kind) => `${kind}_clear` },
    });
    await store.getState().initializeDrawing();

    await store.getState().clearDrawing();

    expect(client.open).toHaveBeenCalledWith(drawingId);
    expect(client.execute).toHaveBeenCalledWith(
      drawingId,
      expect.objectContaining({
        id: 'transaction_clear',
        baseRevision: revision2,
        commands: [{ type: 'geometry.delete', id: geometryId }],
      }),
    );
    expect(store.getState().document?.geometry).toEqual([]);
    expect(store.getState().drawingBusy).toBe(false);
  });

  it('adopts an already empty latest workspace without submitting an empty transaction', async () => {
    const client = drawingClientDouble();
    const empty = structuredClone(workspace().document);
    empty.geometry = [];
    client.open.mockResolvedValueOnce({
      document: empty,
      revision: revision2,
      commits: [],
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().clearDrawing();

    expect(client.execute).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      document: empty,
      revision: revision2,
      drawingBusy: false,
      drawingError: null,
      selectedIds: [],
    });
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

describe('Drawing Agent workspace integration', () => {
  it('projects ordered perception deltas without mutating the canonical drawing', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');
    const canonical = store.getState().document;

    agent.emit(perceptionEvent(1, 4));
    expect(store.getState().perceptionPreview).toMatchObject({
      runId: 'run_1', lastSequence: 1,
      nodes: { node_preview_1: { type: 'circle', radius: 4 } },
    });
    expect(store.getState().document).toBe(canonical);
    expect(store.getState().revision).toBe(revision1);
    expect(store.getState().commits).toEqual([]);

    agent.emit(perceptionEvent(1, 9));
    expect(store.getState().perceptionPreview.nodes.node_preview_1).toMatchObject({ radius: 4 });
    agent.emit(perceptionEvent(2, 6));
    expect(store.getState().perceptionPreview.nodes.node_preview_1).toMatchObject({ radius: 6 });

    agent.emit({
      ...perceptionEvent(3, 6),
      perceptionDelta: {
        ...perceptionEvent(3, 6).perceptionDelta!,
        action: 'reject', upserts: [], removeIds: ['node_preview_1'],
      },
    });
    expect(store.getState().perceptionPreview.nodes).toEqual({});
  });

  it('retains preview while paused and clears it on terminal events', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');
    agent.emit(perceptionEvent(1, 4));
    agent.emit({
      id: 'event_paused', runId: 'run_1', type: 'paused', title: '暂停',
      timestamp: 2, elapsedMs: 1,
    });
    expect(store.getState().perceptionPreview.nodes).toHaveProperty('node_preview_1');

    agent.emit({
      id: 'event_stopped', runId: 'run_1', type: 'stopped', title: '停止',
      timestamp: 3, elapsedMs: 2,
    });
    expect(store.getState().perceptionPreview).toEqual({
      runId: null, lastSequence: 0, nodes: {}, labelsByNodeId: {},
      activeOverlay: null, previewVersionId: null,
    });
  });

  it('reconciles completed previews against the canonical drawing instead of blanking first', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');
    agent.emit(perceptionEvent(1, 4));

    agent.emit({
      id: 'event_completed', runId: 'run_1', type: 'completed', title: '完成',
      timestamp: 3, elapsedMs: 2,
    });

    expect(store.getState().perceptionPreview.runId).toBe('run_1');
    expect(store.getState().perceptionPreview.nodes).toHaveProperty('node_preview_1');
    expect(store.getState().perceptionPreview.activeOverlay).toBeNull();
  });

  it('clears the last rejected preview when a task fails', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');
    agent.emit(perceptionEvent(1, 4));
    agent.emit({
      id: 'event_failed', runId: 'run_1', type: 'failed', title: '未收敛',
      timestamp: 2, elapsedMs: 1,
    });

    expect(store.getState().perceptionPreview).toEqual({
      runId: null, lastSequence: 0, nodes: {}, labelsByNodeId: {},
      activeOverlay: null, previewVersionId: null,
    });
  });

  it('retries a failed run from the latest canonical revision without duplicating chat', async () => {
    const agent = agentClientDouble();
    agent.start
      .mockResolvedValueOnce({ runId: 'run_failed' })
      .mockResolvedValueOnce({ runId: 'run_retry' });
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('把右手抬起来');
    agent.emit({
      id: 'event_failed', runId: 'run_failed', type: 'failed', title: 'grounding timeout',
      timestamp: 2, elapsedMs: 1,
    });
    store.setState({ revision: revision2 });

    await store.getState().retryAgent();

    expect(agent.start).toHaveBeenLastCalledWith(expect.objectContaining({
      drawingId, goal: '把右手抬起来', baseRevision: revision2,
    }));
    expect(store.getState().agentRunId).toBe('run_retry');
    expect(store.getState().aiMessages.filter((message) => message.role === 'user'))
      .toHaveLength(1);
    expect(store.getState().perceptionPreview.nodes).toEqual({});
  });

  it('reuses the original image attachment when retrying a failed run', async () => {
    const agent = agentClientDouble();
    agent.start
      .mockResolvedValueOnce({ runId: 'run_failed' })
      .mockResolvedValueOnce({ runId: 'run_retry' });
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析这张图', 'aW1hZ2U=', 'image/png');
    agent.emit({
      id: 'event_failed', runId: 'run_failed', type: 'failed', title: 'vision timeout',
      timestamp: 2, elapsedMs: 1,
    });

    await store.getState().retryAgent();

    expect(agent.start).toHaveBeenLastCalledWith(expect.objectContaining({
      goal: '分析这张图',
      attachment: { data: 'aW1hZ2U=', mimeType: 'image/png', page: 1 },
    }));
  });
  it('starts text work from drawing ID and revision without serializing the document', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().submitAgentInput('创建一个圆');

    expect(agent.start).toHaveBeenCalledWith({
      drawingId, baseRevision: revision1, goal: '创建一个圆', selectedIds: [],
    });
    expect(store.getState()).toMatchObject({
      agentStatus: 'planning',
      agentRunId: 'run_1',
      agentError: null,
    });
    expect(JSON.stringify(agent.start.mock.calls[0][0])).not.toContain('document');
  });

  it('starts image analysis through the same Agent run contract', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');

    expect(agent.start).toHaveBeenCalledWith({
      drawingId, baseRevision: revision1, goal: '分析图纸', selectedIds: [],
      attachment: { data: 'aW1hZ2U=', mimeType: 'image/png', page: 1 },
    });
    expect(store.getState().agentError).toBeNull();
  });

  it('refreshes the canonical workspace on commit and ignores documents in Agent responses', async () => {
    const agent = agentClientDouble();
    const drawings = drawingClientDouble();
    const refreshed = workspace();
    refreshed.revision = revision2;
    const circle = refreshed.document.geometry[0];
    if (circle.type !== 'circle') throw new Error('expected circle');
    circle.radius = 8;
    drawings.open.mockResolvedValueOnce(workspace()).mockResolvedValueOnce(refreshed);
    const store = createAppStore({
      drawingClient: drawings as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage({ [ACTIVE_DRAWING_STORAGE_KEY]: drawingId }),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('半径改成 8');

    agent.emit({
      id: 'event_commit', runId: 'run_1', type: 'commit', title: '已提交',
      timestamp: 2, elapsedMs: 1,
    });
    await waitUntil(() => store.getState().revision === revision2);
    expect(store.getState().document?.geometry[0]).toMatchObject({ radius: 8 });

    agent.emit({
      id: 'event_done', runId: 'run_1', type: 'completed', title: '完成',
      timestamp: 3, elapsedMs: 2,
    });
    await waitUntil(() => store.getState().agentStatus === 'complete');
    expect(store.getState().document?.geometry[0]).toMatchObject({ radius: 8 });
  });

  it('keeps a promoted preview visible until its committed node arrives', async () => {
    const agent = agentClientDouble();
    const drawings = drawingClientDouble();
    const promotedId = 'geometry_promoted' as GeometryId;
    let resolveRefresh!: (value: ReturnType<typeof workspace>) => void;
    const refreshed = workspace();
    refreshed.revision = revision2;
    refreshed.document.geometry.push({
      id: promotedId, type: 'circle', center: [20, 20], radius: 5, visible: true,
      quality: { status: 'confirmed', confidence: 0.9, evidenceRefs: [] },
    });
    drawings.open
      .mockResolvedValueOnce(workspace())
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const store = createAppStore({
      drawingClient: drawings as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage({ [ACTIVE_DRAWING_STORAGE_KEY]: drawingId }),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');

    agent.emit(perceptionEventForId(1, promotedId, 'observe'));
    agent.emit({
      id: 'event_commit_atomic', runId: 'run_1', type: 'commit', title: '已提交',
      timestamp: 2, elapsedMs: 1,
    });
    agent.emit(perceptionEventForId(2, promotedId, 'promote'));

    expect(store.getState().perceptionPreview.nodes).toHaveProperty(promotedId);
    resolveRefresh(refreshed);
    await waitUntil(() => store.getState().revision === revision2);
    expect(store.getState().document?.geometry).toContainEqual(
      expect.objectContaining({ id: promotedId }),
    );
    expect(store.getState().perceptionPreview.nodes).not.toHaveProperty(promotedId);
  });

  it('routes new text to the active run as an instruction', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    store.setState({ agentRunId: 'run_active', agentStatus: 'running' });

    await store.getState().submitAgentInput('圆心不要移动');

    expect(agent.addInstruction).toHaveBeenCalledWith('run_active', '圆心不要移动');
    expect(agent.start).not.toHaveBeenCalled();
  });

  it('shows the terminal run error instead of the generic failed progress title', async () => {
    const agent = agentClientDouble();
    agent.getRun.mockResolvedValueOnce({
      ...agentRunView('failed'),
      error: 'plan.goal.acceptanceCriteria[0].selector: 未知字段',
    });
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('创建一个圆');

    agent.emit({
      id: 'event_failed', runId: 'run_1', type: 'failed', title: '任务执行失败',
      timestamp: 3, elapsedMs: 2,
    });
    await waitUntil(() => store.getState().agentError?.includes('未知字段') ?? false);

    expect(store.getState()).toMatchObject({
      agentStatus: 'error',
      agentError: 'plan.goal.acceptanceCriteria[0].selector: 未知字段',
    });
  });

  it('keeps run controls presentation-only', async () => {
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
  let listener: ((event: import('@/services/agent-client').AgentProgressEvent) => void) | undefined;
  const run = agentRunView('pause_requested');
  return {
    start: vi.fn<AgentClient['start']>(async () => ({ runId: 'run_1' })),
    subscribe: vi.fn((_runId, onEvent) => {
      listener = onEvent;
      return () => undefined;
    }),
    emit: (event: import('@/services/agent-client').AgentProgressEvent) => listener?.(event),
    getRun: vi.fn<AgentClient['getRun']>(async () => ({
      ...agentRunView('completed'), document: { malicious: true },
    } as never)),
    pause: vi.fn(async () => run),
    resume: vi.fn(async () => agentRunView('running')),
    stop: vi.fn(async () => agentRunView('stopping')),
    addInstruction: vi.fn(async () => agentRunView('running')),
  };
}

function agentRunView(status: import('@/contracts/drawing-agent').DrawingAgentRunStatus) {
  return {
    runId: 'run_1', drawingId, revision: revision1, status,
    goal: null, workflow: [], currentWorkflowNodeId: null,
    commitCount: 0, analysisSummary: null, pendingInstructions: [], error: null,
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
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

function perceptionEvent(sequence: number, radius: number) {
  return {
    id: `event_delta_${sequence}_${radius}`,
    runId: 'run_1',
    type: 'perception_delta' as const,
    title: '发现图元',
    timestamp: sequence + 1,
    elapsedMs: sequence,
    perceptionDelta: {
      runId: 'run_1', sequence, action: sequence === 1 ? 'observe' as const : 'refine' as const,
      slotIds: ['GEO-0001'], removeIds: [],
      upserts: [{
        id: 'node_preview_1' as GeometryId,
        type: 'circle' as const, center: [0, 0] as const, radius, visible: true,
        quality: { status: 'candidate' as const, confidence: 0.8, evidenceRefs: [] },
      }],
      source: { page: 1, viewId: 'view_1', stage: 'detail' as const },
    },
  };
}

function perceptionEventForId(
  sequence: number,
  id: GeometryId,
  action: 'observe' | 'promote',
) {
  return {
    id: `event_${action}_${sequence}`,
    runId: 'run_1',
    type: 'perception_delta' as const,
    title: action === 'observe' ? '发现图元' : '提交图元',
    timestamp: sequence + 1,
    elapsedMs: sequence,
    perceptionDelta: {
      runId: 'run_1', sequence, action,
      slotIds: [id],
      removeIds: action === 'promote' ? [id] : [],
      upserts: action === 'observe' ? [{
        id,
        type: 'circle' as const, center: [0, 0] as const, radius: 5, visible: true,
        quality: { status: 'candidate' as const, confidence: 0.8, evidenceRefs: [] },
      }] : [],
      source: { page: 1, viewId: 'view_1', stage: 'reconciliation' as const },
    },
  };
}
