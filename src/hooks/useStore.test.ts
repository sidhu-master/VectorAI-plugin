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
  it('keeps internal topology relation overlays hidden in the normal canvas view', () => {
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      storage: memoryStorage(),
    });

    expect(store.getState().showRelations).toBe(false);
  });

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

  it('imports a DXF deterministically, updates the workspace, and shows real file cards', async () => {
    const client = drawingClientDouble();
    const imported = workspace();
    imported.revision = revision2;
    client.importDxf.mockResolvedValueOnce({
      workspace: imported,
      receipt: {
        source: { sourceId: 'source_1', fileName: 'shaft.dxf' },
        projection: { projectedGeometryCount: 134, projectedAnnotationCount: 28 },
        annotation: {
          generatedCount: 24,
          pendingCount: 5,
          conflictCount: 2,
          coverage: { valid: true },
        },
        recognition: {
          regions: [
            { id: 'B01', status: 'confirmed' as const },
            { id: 'G01', status: 'conflict' as const },
          ],
        },
      },
    });
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    const file = { fileName: 'shaft.dxf', data: 'MApFT0Y=', mimeType: 'application/dxf' };
    const document = { fileName: 'shaft.txt', data: 'W2RyYXdpbmdd', mimeType: 'text/plain' };

    await store.getState().importDxf(file, document);

    expect(client.importDxf).toHaveBeenCalledWith(drawingId, file, document);
    expect(agent.start).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      revision: revision2,
      drawingBusy: false,
      drawingError: null,
    });
    expect(store.getState().aiMessages).toEqual([
      expect.objectContaining({
        role: 'user', content: '',
        files: [
          { name: 'shaft.dxf', mimeType: 'application/dxf' },
          { name: 'shaft.txt', mimeType: 'text/plain' },
        ],
      }),
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringMatching(/134 个图元.*24 项源标注.*自动标注将在分区确认后生成/),
      }),
    ]);
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

  it('commits an adapter-provided canonical command batch atomically', async () => {
    const client = drawingClientDouble();
    client.execute.mockImplementation(async (_id, transaction) => {
      const next = structuredClone(workspace().document);
      const circle = next.geometry[0];
      if (circle.type !== 'circle') throw new Error('fixture must be a circle');
      circle.radius = 11;
      return committed(next, transaction.baseRevision);
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
      idFactory: { next: (kind) => `${kind}_adapter` },
    });
    await store.getState().initializeDrawing();

    const result = await store.getState().commitDrawingCommands([{
      type: 'geometry.update', id: geometryId,
      changes: { radius: 11 }, expected: { radius: 5 },
    }]);

    expect(result).toBe(true);
    expect(client.execute).toHaveBeenCalledWith(drawingId, expect.objectContaining({
      id: 'transaction_adapter',
      commands: [{
        type: 'geometry.update', id: geometryId,
        changes: { radius: 11 }, expected: { radius: 5 },
      }],
    }));
    expect(store.getState().document?.geometry[0]).toMatchObject({ radius: 11 });
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

  it('clears through the server-owned atomic operation', async () => {
    const client = drawingClientDouble();
    const empty = structuredClone(workspace().document);
    empty.geometry = [];
    client.clear.mockResolvedValueOnce({
      document: empty, revision: revision2, commits: [],
    });
    const store = createAppStore({
      drawingClient: client as unknown as DrawingClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().clearDrawing();

    expect(client.clear).toHaveBeenCalledWith(drawingId);
    expect(client.execute).not.toHaveBeenCalled();
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
    client.clear.mockResolvedValueOnce({
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

    expect(client.clear).toHaveBeenCalledWith(drawingId);
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
  it('projects a pending Human Decision and resumes the same run after responding', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('修改受约束的图形');
    const pendingDecision = {
      id: 'decision_1', episodeId: 'episode_1', revision: revision1,
      kind: 'grant-permission' as const,
      question: '是否允许当前候选修改受保护内容？', reason: '需要一次性权限',
      options: [{ id: 'allow_once', label: '仅允许本次' }, { id: 'deny', label: '不允许' }],
      affectedResources: [{ plane: 'relation' as const, ids: ['constraint_1'], action: 'constraint.delete' }],
      previewHandle: 'preview_1', expiresWhenRevisionChanges: true as const,
    };
    agent.getRun.mockResolvedValueOnce({
      ...agentRunView('waiting_for_user'), pendingDecision,
    });

    agent.emit({
      id: 'event_waiting', runId: 'run_1', type: 'validation',
      title: '需要你确认后继续', timestamp: 2, elapsedMs: 1,
    });
    await waitUntil(() => store.getState().pendingAgentDecision?.id === 'decision_1');
    expect(store.getState()).toMatchObject({
      agentStatus: 'waiting_for_user', pendingAgentDecision: pendingDecision,
    });

    await store.getState().respondToAgentDecision('allow_once', '其他部分保持不变');

    expect(agent.respondToDecision).toHaveBeenCalledWith('run_1', 'decision_1', {
      selectedOptionId: 'allow_once', additionalInstruction: '其他部分保持不变',
    });
    expect(store.getState()).toMatchObject({
      agentStatus: 'running', pendingAgentDecision: null,
    });
  });

  it('keeps model tool overlays separate from user selection and clears them at terminal state', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();
    store.getState().selectEntity(geometryId, false);
    await store.getState().submitAgentInput('检查图形');
    agent.emit({
      id: 'event_overlay', runId: 'run_1', type: 'topology_resolved',
      title: '路径候选已找到', timestamp: 2, elapsedMs: 1,
      overlay: {
        kind: 'paths', role: 'candidate',
        paths: [{ id: 'path_1', nodeIds: [geometryId], points: [[0, 0], [5, 0]] }],
      },
    });

    expect(store.getState().agentCanvasOverlay).toMatchObject({ kind: 'paths' });
    expect(store.getState().selectedIds).toEqual([geometryId]);
    agent.emit({
      id: 'event_done_overlay', runId: 'run_1', type: 'completed',
      title: '完成', timestamp: 3, elapsedMs: 2,
    });
    expect(store.getState().agentCanvasOverlay).toBeNull();
  });

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

  it('retains the last rejected spatial evidence while clearing provisional geometry on failure', async () => {
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
      id: 'event_rejected_overlay', runId: 'run_1', type: 'search_envelope_rejected',
      title: '拓扑路径不完整', timestamp: 2, elapsedMs: 1,
      perceptionDelta: {
        runId: 'run_1', sequence: 2, action: 'preview', slotIds: [], upserts: [], removeIds: [],
        regionOverlay: {
          id: 'region_rejected', revision: revision1,
          previewVersionId: 'preview_rejected', label: '右手', attempt: 2,
          status: 'rejected', contours: [[[0, 0], [10, 0], [10, 10]]], holes: [],
          anchors: [{
            id: 'seed', role: 'target-seed', point: [5, 5], confidence: 0.8,
            snapStatus: 'missed',
          }],
          paths: [], issues: [{ code: 'TARGET_ANCHOR_MISSING', message: '目标点未吸附' }],
          confidence: 0.8,
        },
        source: { page: 1, viewId: 'view_1', regionId: 'region_rejected', stage: 'edit-preview' },
      },
    });
    agent.emit({
      id: 'event_failed', runId: 'run_1', type: 'failed', title: '未收敛',
      timestamp: 3, elapsedMs: 2,
    });

    expect(store.getState().perceptionPreview.nodes).toEqual({});
    expect(store.getState().perceptionPreview.labelsByNodeId).toEqual({});
    expect(store.getState().perceptionPreview.hiddenCommittedIds ?? []).toEqual([]);
    expect(store.getState().perceptionPreview.activeOverlay).toMatchObject({
      id: 'region_rejected', status: 'rejected', attempt: 2,
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

    expect(agent.start).toHaveBeenCalledWith(expect.objectContaining({
      drawingId, baseRevision: revision1, goal: '创建一个圆', selectedIds: [],
      stableRules: expect.arrayContaining([
        expect.stringContaining('保持非目标内容'),
        expect.stringContaining('不得产生新的悬空端点'),
      ]),
    }));
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

    expect(agent.start).toHaveBeenCalledWith(expect.objectContaining({
      drawingId, baseRevision: revision1, goal: '分析图纸', selectedIds: [],
      attachment: { data: 'aW1hZ2U=', mimeType: 'image/png', page: 1 },
      attachmentPurpose: 'reference',
      stableRules: expect.any(Array),
    }));
    expect(store.getState().agentError).toBeNull();
  });

  it('keeps the inferred reconstruction goal out of the user message for an image-only upload', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().submitAgentInput(undefined, 'aW1hZ2U=', 'image/png');

    expect(agent.start).toHaveBeenCalledWith(expect.objectContaining({
      drawingId, baseRevision: revision1,
      goal: '',
      attachment: { data: 'aW1hZ2U=', mimeType: 'image/png', page: 1 },
      attachmentPurpose: 'reference',
    }));
    expect(store.getState().aiMessages).toContainEqual(expect.objectContaining({
      role: 'user', content: '', image: 'aW1hZ2U=', mimeType: 'image/png',
    }));
    expect(store.getState().aiMessages).not.toContainEqual(expect.objectContaining({
      role: 'user', content: '解析并重建上传的二维图纸',
    }));
  });

  it('only marks an attachment as a drawing source through the explicit import option', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().submitAgentInput(
      undefined, 'aW1hZ2U=', 'image/png', undefined, undefined, 'drawing-source',
    );

    expect(agent.start).toHaveBeenCalledWith(expect.objectContaining({
      attachmentPurpose: 'drawing-source',
    }));
  });

  it('keeps user text and the uploaded image together in one user message', async () => {
    const agent = agentClientDouble();
    const store = createAppStore({
      drawingClient: drawingClientDouble() as unknown as DrawingClient,
      agentClient: agent as unknown as AgentClient,
      storage: memoryStorage(),
    });
    await store.getState().initializeDrawing();

    await store.getState().submitAgentInput('把这张图转成矢量图', 'aW1hZ2U=', 'image/png');

    expect(store.getState().aiMessages).toContainEqual(expect.objectContaining({
      role: 'user', content: '把这张图转成矢量图',
      image: 'aW1hZ2U=', mimeType: 'image/png',
    }));
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
      id: 'event_commit', runId: 'run_1', type: 'committed', title: '已提交',
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

  it('keeps a committed preview visible for the canvas transition before reconciling it', async () => {
    vi.useFakeTimers();
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
      previewSettleMs: 400,
    });
    await store.getState().initializeDrawing();
    await store.getState().submitAgentInput('分析图纸', 'aW1hZ2U=', 'image/png');

    agent.emit(perceptionEventForId(1, promotedId, 'observe'));
    agent.emit({
      id: 'event_commit_atomic', runId: 'run_1', type: 'committed', title: '已提交',
      timestamp: 2, elapsedMs: 1,
    });
    agent.emit(perceptionEventForId(2, promotedId, 'promote'));

    expect(store.getState().perceptionPreview.nodes).toHaveProperty(promotedId);
    resolveRefresh(refreshed);
    await waitUntil(() => store.getState().revision === revision2);
    expect(store.getState().document?.geometry).toContainEqual(
      expect.objectContaining({ id: promotedId }),
    );
    expect(store.getState().perceptionPreview.nodes).toHaveProperty(promotedId);

    await vi.advanceTimersByTimeAsync(399);
    expect(store.getState().perceptionPreview.nodes).toHaveProperty(promotedId);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.getState().perceptionPreview.nodes).not.toHaveProperty(promotedId);
    vi.useRealTimers();
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
    clear: vi.fn<(id: DrawingId) => Promise<ReturnType<typeof workspace>>>(
      async () => workspace(overrides),
    ),
    importDxf: vi.fn(async () => ({
      workspace: workspace(overrides),
      receipt: {
        source: { sourceId: 'source_default', fileName: 'drawing.dxf' },
        projection: { projectedGeometryCount: 0, projectedAnnotationCount: 0 },
        annotation: {
          generatedCount: 0,
          pendingCount: 0,
          conflictCount: 0,
          coverage: { valid: true },
        },
        recognition: { regions: [] },
      },
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
    respondToDecision: vi.fn(async () => agentRunView('running')),
  };
}

function agentRunView(status: import('@/contracts/drawing-agent').DrawingAgentRunStatus) {
  return {
    runId: 'run_1', drawingId, revision: revision1, status,
    goal: null, workflow: [], currentWorkflowNodeId: null,
    commitCount: 0, analysisSummary: null, pendingInstructions: [], error: null,
    pendingDecision: null,
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
