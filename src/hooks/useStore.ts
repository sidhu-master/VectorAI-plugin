/** Frontend workspace orchestration. DrawingDocument is the only drawing authority. */
import { create } from 'zustand';
import {
  applyPerceptionPreviewDelta,
  emptyPerceptionPreview,
  randomIdFactory,
  reconcilePerceptionPreview,
  retainUncommittedPromotions,
  VECTOR_REVEAL_TOTAL_MS,
  type DrawingCommand,
  type DrawingCommit,
  type DrawingDocument,
  type IdFactory,
  type PerceptionPreviewState,
  type RevisionId,
} from '@/drawing';
import type {
  DrawingAgentCanvasOverlay,
  DrawingAgentPlan,
  DrawingAgentRunView,
  HumanDecisionRequest,
} from '@/contracts/drawing-agent';
import {
  agentClient as defaultAgentClient,
  type AgentClient,
  type AgentProgressEvent,
  type AgentWorkflow,
} from '@/services/agent-client';
import {
  drawingClient as defaultDrawingClient,
  DrawingClientError,
  type DrawingClient,
  type DxfUploadFile,
} from '@/services/drawing-client';
import {
  applyWorkspaceResult,
  buildDeleteCommand,
  buildUpdateCommand,
  createWorkspaceTransaction,
} from './drawing-store';

export const ACTIVE_DRAWING_STORAGE_KEY = 'vectorai.activeDrawingId';

/** 分区补充文档（按图纸持久化到 localStorage，重新分区时自动携带） */
export interface PartitionSupplementDoc {
  name: string;
  text: string;
}

function partitionSupplementKey(drawingId: string): string {
  return `vectorai.partitionSupplements.${drawingId}`;
}

function readPartitionSupplements(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  drawingId: string,
): PartitionSupplementDoc[] {
  try {
    const raw = storage?.getItem(partitionSupplementKey(drawingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PartitionSupplementDoc => (
      typeof item === 'object' && item !== null
      && typeof item.name === 'string' && typeof item.text === 'string'
    ));
  } catch {
    return [];
  }
}

function writePartitionSupplements(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  drawingId: string,
  docs: PartitionSupplementDoc[],
): void {
  try {
    if (docs.length === 0) storage?.removeItem(partitionSupplementKey(drawingId));
    else storage?.setItem(partitionSupplementKey(drawingId), JSON.stringify(docs));
  } catch { /* 存储不可用时仅保留内存态 */ }
}

/** 分区 goal 拼接补充文档（同名文档已在 goal 中则跳过，单文档截断 6000 字） */
function appendPartitionSupplements(goal: string, docs: PartitionSupplementDoc[]): string {
  const parts = [goal];
  for (const doc of docs) {
    if (goal.includes(`[补充文档 ${doc.name}]`)) continue;
    if (!doc.text.trim()) continue;
    parts.push(`[补充文档 ${doc.name}]\n${doc.text.slice(0, 6000)}`);
  }
  return parts.filter(Boolean).join('\n\n');
}

/** 合并分区补充文档：同名覆盖，其余追加 */
function mergePartitionSupplements(
  current: PartitionSupplementDoc[],
  incoming: PartitionSupplementDoc[],
): PartitionSupplementDoc[] {
  const merged = [...current];
  for (const doc of incoming) {
    const index = merged.findIndex((item) => item.name === doc.name);
    if (index >= 0) merged[index] = doc;
    else merged.push(doc);
  }
  return merged;
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  mimeType?: string;
  files?: Array<{ name: string; mimeType: string }>;
  confidence?: number;
  timestamp: number;
}

interface AgentSubmission {
  goal: string;
  userText: string;
  image?: string;
  mimeType?: string;
  workflow?: AgentWorkflow;
}

export type AgentUiStatus =
  | 'idle' | 'planning' | 'running' | 'waiting_for_user' | 'pause_requested' | 'paused'
  | 'stopping' | 'stopped' | 'complete' | 'error';

export interface AppState {
  document: DrawingDocument | null;
  revision: RevisionId | null;
  commits: DrawingCommit[];
  drawingStatus: 'loading' | 'ready' | 'error';
  drawingBusy: boolean;
  drawingError: string | null;
  selectedIds: string[];

  aiMessages: ChatMessage[];
  aiStatus: 'idle' | 'loading' | 'error';
  aiError: string | null;

  canvasTransform: { scale: number; offsetX: number; offsetY: number };
  viewportSize: { width: number; height: number };
  showGrid: boolean;
  showRelations: boolean;
  showAnnotations: boolean;
  mouseCoords: { x: number; y: number } | null;

  taskPlan: DrawingAgentPlan | null;
  currentStepIndex: number;
  stepResults: [];
  agentStatus: AgentUiStatus;
  agentRunId: string | null;
  agentEvents: AgentProgressEvent[];
  agentError: string | null;
  perceptionPreview: PerceptionPreviewState;
  agentCanvasOverlay: DrawingAgentCanvasOverlay | null;
  pendingAgentDecision: HumanDecisionRequest | null;
  decisionSubmitting: boolean;

  initializeDrawing: () => Promise<void>;
  commitDrawingCommands: (commands: DrawingCommand[]) => Promise<boolean>;
  updateNode: (id: string, changes: Record<string, unknown>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  clearDrawing: () => Promise<void>;
  revertLatest: () => Promise<void>;
  selectEntity: (id: string, ctrlKey: boolean) => void;
  selectEntities: (ids: string[]) => void;
  clearSelection: () => void;
  setCanvasTransform: (transform: Partial<AppState['canvasTransform']>) => void;
  setViewportSize: (size: { width: number; height: number }) => void;
  toggleAnnotations: () => void;
  setMouseCoords: (coords: { x: number; y: number } | null) => void;

  importDxf: (
    file: DxfUploadFile,
    engineeringDocument?: DxfUploadFile,
    prompt?: string,
  ) => Promise<void>;

  submitAgentInput: (
    prompt?: string,
    image?: string,
    mimeType?: string,
    workflow?: AgentWorkflow,
    displayText?: string,
  ) => Promise<void>;
  startAgent: (
    prompt?: string,
    image?: string,
    mimeType?: string,
    workflow?: AgentWorkflow,
    displayText?: string,
  ) => Promise<void>;
  /** 确认当前分区并按分区生成自动标注 */
  confirmPartitionAnnotations: () => Promise<void>;
  /** 分区补充文档（用户上传的 TXT 等）；分区/重新分区请求自动携带 */
  partitionSupplementDocs: PartitionSupplementDoc[];
  setPartitionSupplementDocs: (docs: PartitionSupplementDoc[]) => void;
  retryAgent: () => Promise<void>;
  pauseAgent: () => Promise<void>;
  resumeAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  addAgentInstruction: (instruction: string) => Promise<void>;
  respondToAgentDecision: (selectedOptionId: string, additionalInstruction?: string) => Promise<void>;
  resetAgent: () => void;
}

export interface AppStoreDependencies {
  drawingClient?: DrawingClient;
  agentClient?: AgentClient;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  idFactory?: IdFactory;
  now?: () => number;
  /** Minimum presentation time for a real canvas preview; never delays backend work. */
  previewSettleMs?: number;
}

let messageCounter = 0;

export function createAppStore(dependencies: AppStoreDependencies = {}) {
  const drawings = dependencies.drawingClient ?? defaultDrawingClient;
  const agents = dependencies.agentClient ?? defaultAgentClient;
  const storage = dependencies.storage ?? browserStorage();
  const idFactory = dependencies.idFactory ?? randomIdFactory;
  const now = dependencies.now ?? Date.now;
  const previewSettleMs = dependencies.previewSettleMs ?? VECTOR_REVEAL_TOTAL_MS;
  let unsubscribeAgent: (() => void) | null = null;
  let initializationPromise: Promise<void> | null = null;
  let lastAgentSubmission: AgentSubmission | null = null;
  const previewSettleTimers = new Set<ReturnType<typeof setTimeout>>();
  const clearPreviewSettleTimers = () => {
    previewSettleTimers.forEach((timer) => clearTimeout(timer));
    previewSettleTimers.clear();
  };

  return create<AppState>((set, get) => {
    const schedulePreviewSettlement = (runId: string) => {
      const current = get();
      const committedIds = new Set<string>(current.document
        ? [...current.document.geometry, ...current.document.annotations].map((node) => node.id)
        : []);
      const capturedNodes = Object.fromEntries(
        Object.entries(current.perceptionPreview.nodes)
          .filter(([id]) => committedIds.has(id)),
      );
      const ids = Object.keys(capturedNodes);
      if (ids.length === 0) return;
      const settle = () => {
        previewSettleTimers.delete(timer);
        if (get().agentRunId !== runId) return;
        set((latest) => {
          const unchangedIds = ids.filter((id) => (
            latest.perceptionPreview.nodes[id] === capturedNodes[id]
          ));
          if (unchangedIds.length === 0) return latest;
          return {
            perceptionPreview: reconcilePerceptionPreview(
              latest.perceptionPreview,
              latest.document,
              unchangedIds,
            ),
          };
        });
      };
      const timer = setTimeout(settle, Math.max(0, previewSettleMs));
      previewSettleTimers.add(timer);
    };

    const executeCommands = async (commands: DrawingCommand[]): Promise<boolean> => {
      const state = get();
      if (!state.document || !state.revision || state.drawingBusy || commands.length === 0) return false;
      set({ drawingBusy: true, drawingError: null });
      try {
        const transaction = createWorkspaceTransaction({
          revision: state.revision,
          commands,
          actor: { type: 'user', id: 'local-user' },
          idFactory,
        });
        const result = await drawings.execute(state.document.id, transaction);
        const latest = get();
        if (!latest.document || !latest.revision) {
          set({ drawingBusy: false, drawingError: '图纸在事务提交期间已关闭' });
          return false;
        }
        const applied = applyWorkspaceResult({
          document: latest.document,
          revision: latest.revision,
          commits: latest.commits,
        }, result);
        set({
          ...applied.workspace,
          drawingBusy: false,
          drawingError: applied.error,
          selectedIds: applied.error ? latest.selectedIds : [],
        });
        return applied.error === null;
      } catch (error) {
        set({ drawingBusy: false, drawingError: errorMessage(error) });
        return false;
      }
    };

    const launchAgent = async (
      submission: AgentSubmission,
      options: { appendUserMessage: boolean },
    ): Promise<void> => {
      const state = get();
      if (!state.document || !state.revision) {
        set({ agentError: '请先加载或创建图纸，再发送指令' });
        return;
      }
      unsubscribeAgent?.();
      unsubscribeAgent = null;
      clearPreviewSettleTimers();
      set((current) => ({
        ...(options.appendUserMessage ? {
          aiMessages: [
            ...current.aiMessages,
            chatMessage('user', submission.userText, now, {
              image: submission.image,
              mimeType: submission.mimeType,
            }),
          ],
        } : {}),
        taskPlan: null,
        currentStepIndex: 0,
        stepResults: [],
        agentStatus: 'planning',
        agentRunId: null,
        agentEvents: [],
        agentError: null,
        perceptionPreview: emptyPerceptionPreview(null),
        agentCanvasOverlay: null,
        pendingAgentDecision: null,
        decisionSubmitting: false,
      }));
      try {
        const started = await agents.start({
          drawingId: state.document.id,
          baseRevision: state.revision,
          goal: submission.goal,
          selectedIds: [...state.selectedIds],
          stableRules: [
            '除非用户明确要求，否则保持非目标内容、已有连接关系、轮廓连续性与原图样式不变',
            '不得产生新的悬空端点；标注是次要派生信息，不能阻止几何编辑',
          ],
          viewport: state.viewportSize.width > 0 && state.viewportSize.height > 0
            ? {
                scale: state.canvasTransform.scale,
                offsetX: state.canvasTransform.offsetX,
                offsetY: state.canvasTransform.offsetY,
                width: state.viewportSize.width,
                height: state.viewportSize.height,
              }
            : undefined,
          ...(submission.image ? {
            attachment: {
              data: submission.image,
              mimeType: submission.mimeType || 'image/png',
              page: 1,
            },
          } : {}),
          ...(submission.workflow ? { workflow: submission.workflow } : {}),
        });
        set({
          agentRunId: started.runId,
          perceptionPreview: emptyPerceptionPreview(started.runId),
        });
        unsubscribeAgent = agents.subscribe(
          started.runId,
          (event) => {
            if (get().agentRunId !== started.runId) return;
            set((current) => ({
              agentEvents: current.agentEvents.some((item) => item.id === event.id)
                ? current.agentEvents
                : [...current.agentEvents, event].slice(-100),
              agentStatus: progressStatus(event.type, current.agentStatus),
              agentError: event.type === 'failed' ? event.title : current.agentError,
              perceptionPreview: event.type === 'stopped'
                ? emptyPerceptionPreview(null)
                : event.type === 'failed'
                  ? terminalDiagnosticPreview(current.perceptionPreview)
                : event.type === 'completed'
                  ? {
                      ...current.perceptionPreview,
                      activeOverlay: null,
                      previewVersionId: null,
                    }
                  : event.perceptionDelta
                    ? applyPerceptionPreviewDelta(
                        current.perceptionPreview,
                        retainUncommittedPromotions(event.perceptionDelta, current.document),
                      )
                    : current.perceptionPreview,
              agentCanvasOverlay: event.type === 'stopped'
                || event.type === 'completed'
                || event.type === 'failed'
                || event.overlay?.kind === 'clear'
                ? null
                : event.overlay ?? current.agentCanvasOverlay,
            }));
            if (event.type === 'committed') {
              const drawingId = get().document?.id;
              if (drawingId) {
                void drawings.open(drawingId).then((workspace) => {
                  if (get().document?.id !== drawingId || get().agentRunId !== started.runId) return;
                  set((current) => ({
                    ...workspace,
                    selectedIds: [],
                    perceptionPreview: current.perceptionPreview,
                  }));
                  schedulePreviewSettlement(started.runId);
                }).catch((error) => set({ drawingError: errorMessage(error) }));
              }
            }
            if (['model_finished', 'validation', 'commit', 'committed'].includes(event.type)) {
              void agents.getRun(started.runId).then((run) => {
                if (get().agentRunId !== started.runId) return;
                set(projectAgentRun(run));
              }).catch((error) => {
                if (get().agentRunId === started.runId) set({ agentError: errorMessage(error) });
              });
            }
            if (['paused', 'stopped', 'completed', 'failed'].includes(event.type)) {
              void agents.getRun(started.runId).then((run) => {
                if (get().agentRunId !== started.runId) return;
                set(projectAgentRun(run));
                if (event.type === 'completed') {
                  set((current) => ({
                    aiMessages: [...current.aiMessages, chatMessage(
                      'assistant',
                      run.analysisSummary
                        ?? `已完成：${run.goal?.objective ?? submission.goal}`,
                      now,
                    )],
                  }));
                }
              }).catch((error) => {
                if (get().agentRunId === started.runId) set({ agentError: errorMessage(error) });
              });
            }
          },
          (error) => {
            if (get().agentRunId !== started.runId) return;
            set({
              agentStatus: 'error',
              agentError: error.message,
              perceptionPreview: emptyPerceptionPreview(null),
            });
          },
        );
      } catch (error) {
        set({
          agentStatus: 'error',
          agentError: errorMessage(error),
          perceptionPreview: emptyPerceptionPreview(null),
        });
      }
    };

    return {
      document: null,
      revision: null,
      commits: [],
      drawingStatus: 'loading',
      drawingBusy: false,
      drawingError: null,
      selectedIds: [],

      aiMessages: [],
      aiStatus: 'idle',
      aiError: null,
      canvasTransform: { scale: 1, offsetX: 80, offsetY: 500 },
      viewportSize: { width: 0, height: 0 },
      showGrid: true,
      showRelations: false,
      showAnnotations: true,
      mouseCoords: null,

      taskPlan: null,
      currentStepIndex: 0,
      stepResults: [],
      agentStatus: 'idle',
      agentRunId: null,
      agentEvents: [],
      agentError: null,
      perceptionPreview: emptyPerceptionPreview(null),
      agentCanvasOverlay: null,
      pendingAgentDecision: null,
      decisionSubmitting: false,
      partitionSupplementDocs: [],

      setPartitionSupplementDocs: (docs) => {
        const drawingId = get().document?.id;
        set({ partitionSupplementDocs: docs });
        if (drawingId) writePartitionSupplements(storage, drawingId, docs);
      },

      initializeDrawing: () => {
        if (get().drawingStatus === 'ready') return Promise.resolve();
        if (initializationPromise) return initializationPromise;
        initializationPromise = (async () => {
          set({ drawingStatus: 'loading', drawingError: null });
          try {
            const savedId = storage.getItem(ACTIVE_DRAWING_STORAGE_KEY);
            let workspace;
            if (savedId) {
              try {
                workspace = await drawings.open(savedId as DrawingDocument['id']);
              } catch (error) {
                if (!(error instanceof DrawingClientError) || error.code !== 'DRAWING_NOT_FOUND') {
                  throw error;
                }
                storage.removeItem(ACTIVE_DRAWING_STORAGE_KEY);
                workspace = await drawings.create('mm');
              }
            } else {
              workspace = await drawings.create('mm');
            }
            storage.setItem(ACTIVE_DRAWING_STORAGE_KEY, workspace.document.id);
            set({
              ...workspace,
              drawingStatus: 'ready',
              drawingBusy: false,
              drawingError: null,
              selectedIds: [],
              partitionSupplementDocs: readPartitionSupplements(storage, workspace.document.id),
            });
          } catch (error) {
            set({
              document: null,
              revision: null,
              commits: [],
              drawingStatus: 'error',
              drawingBusy: false,
              drawingError: errorMessage(error),
            });
          }
        })().finally(() => { initializationPromise = null; });
        return initializationPromise;
      },

      commitDrawingCommands: (commands) => executeCommands(commands),

      updateNode: async (id, changes) => {
        const document = get().document;
        if (!document) return;
        try {
          const command = buildUpdateCommand(document, id, changes);
          if (!command) {
            set({ drawingError: `节点 ${id} 不存在` });
            return;
          }
          await executeCommands([command]);
        } catch (error) {
          set({ drawingError: errorMessage(error) });
        }
      },

      deleteNode: async (id) => {
        const document = get().document;
        if (!document) return;
        const command = buildDeleteCommand(document, id);
        if (!command) {
          set({ drawingError: `节点 ${id} 不存在` });
          return;
        }
        await executeCommands([command]);
      },

      clearDrawing: async () => {
        const state = get();
        if (!state.document || state.drawingBusy) return;
        const drawingId = state.document.id;
        set({ drawingBusy: true, drawingError: null });
        try {
          unsubscribeAgent?.();
          unsubscribeAgent = null;
          clearPreviewSettleTimers();
          const workspace = await drawings.clear(drawingId);
          writePartitionSupplements(storage, drawingId, []);
          set({
            ...workspace,
            drawingBusy: false,
            drawingError: null,
            selectedIds: [],
            partitionSupplementDocs: [],
            agentStatus: 'idle',
            agentRunId: null,
            agentEvents: [],
            agentError: null,
            perceptionPreview: emptyPerceptionPreview(null),
            agentCanvasOverlay: null,
            pendingAgentDecision: null,
            decisionSubmitting: false,
          });
        } catch (error) {
          set({ drawingBusy: false, drawingError: errorMessage(error) });
        }
      },

      revertLatest: async () => {
        const state = get();
        const target = state.commits.at(-1);
        if (!state.document || !state.revision || !target || state.drawingBusy) return;
        set({ drawingBusy: true, drawingError: null });
        try {
          const result = await drawings.revert(
            state.document.id,
            target.id,
            { type: 'user', id: 'local-user' },
          );
          const latest = get();
          if (!latest.document || !latest.revision) return;
          const applied = applyWorkspaceResult({
            document: latest.document,
            revision: latest.revision,
            commits: latest.commits,
          }, result);
          set({
            ...applied.workspace,
            drawingBusy: false,
            drawingError: applied.error,
            selectedIds: applied.error ? latest.selectedIds : [],
          });
        } catch (error) {
          set({ drawingBusy: false, drawingError: errorMessage(error) });
        }
      },

      selectEntity: (id, ctrlKey) => set((state) => ({
        selectedIds: ctrlKey
          ? state.selectedIds.includes(id)
            ? state.selectedIds.filter((selectedId) => selectedId !== id)
            : [...state.selectedIds, id]
          : [id],
      })),
      selectEntities: (ids) => set({ selectedIds: [...ids] }),
      clearSelection: () => set({ selectedIds: [] }),
      setCanvasTransform: (transform) => set((state) => ({
        canvasTransform: { ...state.canvasTransform, ...transform },
      })),
      setViewportSize: (size) => set({ viewportSize: size }),
      toggleAnnotations: () => set((state) => ({
        showAnnotations: !state.showAnnotations,
        selectedIds: state.showAnnotations
          ? state.selectedIds.filter((id) => !state.document?.annotations.some((node) => node.id === id))
          : state.selectedIds,
      })),
      setMouseCoords: (mouseCoords) => set({ mouseCoords }),

      importDxf: async (file, engineeringDocument, prompt) => {
        const state = get();
        if (!state.document || state.drawingBusy) return;
        if (state.agentRunId && isAgentActiveStatus(state.agentStatus)) {
          set({ agentError: '当前任务仍在运行，请停止后再导入 DXF' });
          return;
        }
        const userText = prompt?.trim() ?? '';
        const files = [
          { name: file.fileName, mimeType: file.mimeType },
          ...(engineeringDocument
            ? [{ name: engineeringDocument.fileName, mimeType: engineeringDocument.mimeType }]
            : []),
        ];
        set((current) => ({
          drawingBusy: true,
          drawingError: null,
          aiMessages: [...current.aiMessages, chatMessage('user', userText, now, { files })],
        }));
        try {
          const result = await drawings.importDxf(
            state.document.id,
            file,
            engineeringDocument,
          );
          const summary = [
            `已导入 ${result.receipt.source.fileName}：`,
            `${result.receipt.projection.projectedGeometryCount} 个图元，`,
            `${result.receipt.annotation.generatedCount} 项源标注。`,
            '自动标注将在分区确认后生成--请发送补充信息（台阶说明、区域用途等，可上传文档），',
            'AI 将结合补充信息按台阶特征对图纸分区。',
          ].join('');
          set((current) => ({
            ...result.workspace,
            drawingBusy: false,
            drawingError: null,
            selectedIds: [],
            perceptionPreview: emptyPerceptionPreview(null),
            agentCanvasOverlay: null,
            aiMessages: [...current.aiMessages, chatMessage('assistant', summary, now)],
          }));
          if (userText) {
            lastAgentSubmission = { goal: userText, userText };
            await launchAgent(lastAgentSubmission, { appendUserMessage: false });
          }
        } catch (error) {
          const message = errorMessage(error);
          set((current) => ({
            drawingBusy: false,
            drawingError: message,
            aiMessages: [
              ...current.aiMessages,
              chatMessage('assistant', `DXF 导入失败：${message}`, now),
            ],
          }));
        }
      },

      submitAgentInput: async (prompt, image, mimeType, workflow, displayText) => {
        const text = prompt?.trim();
        const state = get();
        if (state.agentRunId && isAgentActiveStatus(state.agentStatus)) {
          if (image) {
            set({ agentError: '当前任务仍在运行，请停止后再上传新图纸' });
          } else if (text) {
            await state.addAgentInstruction(text);
          }
          return;
        }
        if (text || image) {
          await get().startAgent(text, image, mimeType, workflow, displayText);
        }
      },

      startAgent: async (prompt, image, mimeType, workflow, displayText) => {
        const requestedGoal = prompt?.trim() ?? '';
        let goal = requestedGoal;
        if (workflow === 'partition') {
          // 分区流自动携带已上传的补充文档，避免重新分区时丢失文档上下文
          const drawingId = get().document?.id;
          const docs = drawingId && get().partitionSupplementDocs.length === 0
            ? readPartitionSupplements(storage, drawingId)
            : get().partitionSupplementDocs;
          goal = appendPartitionSupplements(
            requestedGoal || '按图纸中的台阶特征对图纸分区',
            docs,
          );
        }
        if (!goal && !image) return;
        lastAgentSubmission = {
          goal,
          userText: displayText?.trim() || requestedGoal,
          ...(image ? { image, mimeType: mimeType || 'image/png' } : {}),
          ...(workflow ? { workflow } : {}),
        };
        await launchAgent(lastAgentSubmission, { appendUserMessage: true });
      },

      confirmPartitionAnnotations: async () => {
        await get().startAgent(
          '确认当前分区，按分区生成自动标注（分区边界尺寸 + 重点分区特征标注）',
          undefined,
          undefined,
          'partitioned-annotation',
        );
      },

      retryAgent: async () => {
        if (get().agentStatus !== 'error' || !lastAgentSubmission) return;
        await launchAgent(lastAgentSubmission, { appendUserMessage: false });
      },

      pauseAgent: async () => {
        const runId = get().agentRunId;
        if (!runId) return;
        try {
          set(projectAgentRun(await agents.pause(runId)));
        } catch (error) {
          set({ agentError: errorMessage(error) });
        }
      },
      resumeAgent: async () => {
        const runId = get().agentRunId;
        if (!runId) return;
        try {
          set(projectAgentRun(await agents.resume(runId)));
        } catch (error) {
          set({ agentError: errorMessage(error) });
        }
      },
      stopAgent: async () => {
        const runId = get().agentRunId;
        if (!runId) return;
        try {
          set(projectAgentRun(await agents.stop(runId)));
        } catch (error) {
          set({ agentError: errorMessage(error) });
        }
      },
      addAgentInstruction: async (instruction) => {
        const runId = get().agentRunId;
        const trimmed = instruction.trim();
        if (!runId || !trimmed) return;
        try {
          set(projectAgentRun(await agents.addInstruction(runId, trimmed)));
        } catch (error) {
          set({ agentError: errorMessage(error) });
        }
      },
      respondToAgentDecision: async (selectedOptionId, additionalInstruction) => {
        const state = get();
        const request = state.pendingAgentDecision;
        if (!state.agentRunId || !request || state.decisionSubmitting) return;
        set({ decisionSubmitting: true, agentError: null });
        try {
          const run = await agents.respondToDecision(state.agentRunId, request.id, {
            selectedOptionId,
            ...(additionalInstruction?.trim()
              ? { additionalInstruction: additionalInstruction.trim() }
              : {}),
          });
          set({ ...projectAgentRun(run), decisionSubmitting: false });
        } catch (error) {
          set({ decisionSubmitting: false, agentError: errorMessage(error) });
        }
      },
      resetAgent: () => {
        const state = get();
        if (state.agentRunId && isAgentActiveStatus(state.agentStatus)) {
          void agents.stop(state.agentRunId).catch(() => undefined);
        }
        unsubscribeAgent?.();
        unsubscribeAgent = null;
        clearPreviewSettleTimers();
        lastAgentSubmission = null;
        set({
          taskPlan: null,
          currentStepIndex: 0,
          stepResults: [],
          agentStatus: 'idle',
          agentRunId: null,
          agentEvents: [],
          agentError: null,
          perceptionPreview: emptyPerceptionPreview(null),
          agentCanvasOverlay: null,
          pendingAgentDecision: null,
          decisionSubmitting: false,
        });
      },
    };
  });
}

export const useStore = createAppStore();

function browserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof localStorage !== 'undefined') return localStorage;
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
}

function chatMessage(
  role: ChatMessage['role'],
  content: string,
  now: () => number,
  attachment: Pick<ChatMessage, 'image' | 'mimeType' | 'files'> = {},
): ChatMessage {
  messageCounter += 1;
  return {
    id: `message_${messageCounter}_${now()}`,
    role,
    content,
    ...(attachment.image ? {
      image: attachment.image,
      mimeType: attachment.mimeType || 'image/png',
    } : {}),
    ...(attachment.files?.length ? { files: structuredClone(attachment.files) } : {}),
    timestamp: now(),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAgentActiveStatus(status: AgentUiStatus): boolean {
  return status === 'planning' || status === 'running' || status === 'pause_requested'
    || status === 'waiting_for_user' || status === 'paused' || status === 'stopping';
}

function projectAgentRun(run: DrawingAgentRunView): Partial<AppState> {
  const plan = run.goal ? {
    goal: run.goal,
    workflow: run.workflow,
    summary: run.goal.objective,
  } : null;
  const runningIndex = run.workflow.findIndex((node) => node.status === 'running');
  const completedCount = run.workflow.filter((node) => node.status === 'completed').length;
  return {
    agentStatus: run.status === 'completed'
      ? 'complete'
      : run.status === 'failed' ? 'error' : run.status,
    agentError: run.status === 'failed' ? (run.error ?? '任务执行失败') : null,
    taskPlan: plan,
    currentStepIndex: runningIndex >= 0 ? runningIndex : completedCount,
    stepResults: [],
    pendingAgentDecision: run.pendingDecision,
  };
}

function progressStatus(
  type: AgentProgressEvent['type'],
  current: AgentUiStatus,
): AgentUiStatus {
  if (type === 'accepted' || type === 'planning') return 'planning';
  if (type === 'paused') return 'paused';
  if (type === 'resumed') return 'running';
  if (type === 'stopped') return 'stopped';
  if (type === 'completed') return 'complete';
  if (type === 'failed') return 'error';
  if (type === 'heartbeat') return current;
  return current === 'pause_requested' || current === 'stopping' ? current : 'running';
}

function terminalDiagnosticPreview(
  preview: PerceptionPreviewState,
): PerceptionPreviewState {
  const activeOverlay = preview.activeOverlay?.status === 'rejected'
    ? structuredClone(preview.activeOverlay)
    : null;
  return {
    runId: preview.runId,
    lastSequence: preview.lastSequence,
    nodes: {},
    labelsByNodeId: {},
    activeOverlay,
    previewVersionId: activeOverlay?.previewVersionId ?? null,
    stageByNodeId: {},
    hiddenCommittedIds: [],
  };
}
