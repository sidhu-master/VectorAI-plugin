/** Frontend workspace orchestration. DrawingDocument is the only drawing authority. */
import { create } from 'zustand';
import {
  applyPerceptionPreviewDelta,
  emptyPerceptionPreview,
  randomIdFactory,
  reconcilePerceptionPreview,
  retainUncommittedPromotions,
  type DrawingCommand,
  type DrawingCommit,
  type DrawingDocument,
  type IdFactory,
  type PerceptionPreviewState,
  type RevisionId,
} from '@/drawing';
import type {
  DrawingAgentPlan,
  DrawingAgentRunView,
} from '@/contracts/drawing-agent';
import {
  agentClient as defaultAgentClient,
  type AgentClient,
  type AgentProgressEvent,
} from '@/services/agent-client';
import {
  drawingClient as defaultDrawingClient,
  DrawingClientError,
  type DrawingClient,
} from '@/services/drawing-client';
import {
  applyWorkspaceResult,
  buildClearCommands,
  buildDeleteCommand,
  buildUpdateCommand,
  createWorkspaceTransaction,
} from './drawing-store';

export const ACTIVE_DRAWING_STORAGE_KEY = 'vectorai.activeDrawingId';
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  timestamp: number;
}

export type AgentUiStatus =
  | 'idle' | 'planning' | 'running' | 'pause_requested' | 'paused'
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

  initializeDrawing: () => Promise<void>;
  updateNode: (id: string, changes: Record<string, unknown>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  clearDrawing: () => Promise<void>;
  revertLatest: () => Promise<void>;
  selectEntity: (id: string, ctrlKey: boolean) => void;
  selectEntities: (ids: string[]) => void;
  clearSelection: () => void;
  setCanvasTransform: (transform: Partial<AppState['canvasTransform']>) => void;
  toggleAnnotations: () => void;
  setMouseCoords: (coords: { x: number; y: number } | null) => void;

  submitAgentInput: (prompt?: string, image?: string, mimeType?: string) => Promise<void>;
  startAgent: (prompt?: string, image?: string, mimeType?: string) => Promise<void>;
  pauseAgent: () => Promise<void>;
  resumeAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  addAgentInstruction: (instruction: string) => Promise<void>;
  resetAgent: () => void;
}

export interface AppStoreDependencies {
  drawingClient?: DrawingClient;
  agentClient?: AgentClient;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  idFactory?: IdFactory;
  now?: () => number;
}

let messageCounter = 0;

export function createAppStore(dependencies: AppStoreDependencies = {}) {
  const drawings = dependencies.drawingClient ?? defaultDrawingClient;
  const agents = dependencies.agentClient ?? defaultAgentClient;
  const storage = dependencies.storage ?? browserStorage();
  const idFactory = dependencies.idFactory ?? randomIdFactory;
  const now = dependencies.now ?? Date.now;
  let unsubscribeAgent: (() => void) | null = null;
  let initializationPromise: Promise<void> | null = null;

  return create<AppState>((set, get) => {
    const executeCommands = async (commands: DrawingCommand[]) => {
      const state = get();
      if (!state.document || !state.revision || state.drawingBusy || commands.length === 0) return;
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
      showGrid: true,
      showRelations: true,
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
          const latest = await drawings.open(drawingId);
          const commands = buildClearCommands(latest.document);
          if (commands.length === 0) {
            set({
              ...latest,
              drawingBusy: false,
              drawingError: null,
              selectedIds: [],
              perceptionPreview: emptyPerceptionPreview(null),
            });
            return;
          }
          const transaction = createWorkspaceTransaction({
            revision: latest.revision,
            commands,
            actor: { type: 'user', id: 'local-user' },
            idFactory,
          });
          const result = await drawings.execute(drawingId, transaction);
          const applied = applyWorkspaceResult(latest, result);
          set({
            ...applied.workspace,
            drawingBusy: false,
            drawingError: applied.error,
            selectedIds: applied.error ? get().selectedIds : [],
            perceptionPreview: applied.error
              ? get().perceptionPreview
              : emptyPerceptionPreview(null),
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
      toggleAnnotations: () => set((state) => ({
        showAnnotations: !state.showAnnotations,
        selectedIds: state.showAnnotations
          ? state.selectedIds.filter((id) => !state.document?.annotations.some((node) => node.id === id))
          : state.selectedIds,
      })),
      setMouseCoords: (mouseCoords) => set({ mouseCoords }),

      submitAgentInput: async (prompt, image, mimeType) => {
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
        if (text || image) await get().startAgent(text, image, mimeType);
      },

      startAgent: async (prompt, image, mimeType) => {
        const goal = prompt?.trim() ?? '';
        const state = get();
        if ((!goal && !image) || !state.document || !state.revision) return;
        unsubscribeAgent?.();
        unsubscribeAgent = null;
        const userMessage = chatMessage('user', goal || '上传图纸并重建', now);
        set((current) => ({
          aiMessages: [...current.aiMessages, userMessage],
          taskPlan: null,
          currentStepIndex: 0,
          stepResults: [],
          agentStatus: 'planning',
          agentRunId: null,
          agentEvents: [],
          agentError: null,
          perceptionPreview: emptyPerceptionPreview(null),
        }));
        try {
          const started = await agents.start({
            drawingId: state.document.id,
            baseRevision: state.revision,
            goal,
            selectedIds: [...state.selectedIds],
            ...(image ? {
              attachment: { data: image, mimeType: mimeType || 'image/png', page: 1 },
            } : {}),
          });
          set({
            agentRunId: started.runId,
            perceptionPreview: emptyPerceptionPreview(started.runId),
          });
          unsubscribeAgent = agents.subscribe(
            started.runId,
            (event) => {
              set((current) => ({
                agentEvents: current.agentEvents.some((item) => item.id === event.id)
                  ? current.agentEvents
                  : [...current.agentEvents, event].slice(-100),
                agentStatus: progressStatus(event.type, current.agentStatus),
                agentError: event.type === 'failed' ? event.title : current.agentError,
                perceptionPreview: ['stopped', 'completed'].includes(event.type)
                  ? emptyPerceptionPreview(null)
                  : event.perceptionDelta
                    ? applyPerceptionPreviewDelta(
                      current.perceptionPreview,
                      retainUncommittedPromotions(event.perceptionDelta, current.document),
                    )
                    : current.perceptionPreview,
              }));
              if (event.type === 'commit') {
                const drawingId = get().document?.id;
                if (drawingId) {
                  void drawings.open(drawingId).then((workspace) => {
                    if (get().document?.id !== drawingId) return;
                    set((current) => ({
                      ...workspace,
                      selectedIds: [],
                      perceptionPreview: reconcilePerceptionPreview(
                        current.perceptionPreview,
                        workspace.document,
                      ),
                    }));
                  }).catch((error) => set({ drawingError: errorMessage(error) }));
                }
              }
              if (['model_finished', 'validation', 'commit'].includes(event.type)) {
                void agents.getRun(started.runId).then((run) => {
                  set(projectAgentRun(run));
                }).catch((error) => set({ agentError: errorMessage(error) }));
              }
              if (['paused', 'stopped', 'completed', 'failed'].includes(event.type)) {
                void agents.getRun(started.runId).then((run) => {
                  set(projectAgentRun(run));
                  if (event.type === 'completed') {
                    set((current) => ({
                      aiMessages: [...current.aiMessages, chatMessage(
                        'assistant',
                        run.analysisSummary
                          ?? `已完成：${run.goal?.objective ?? goal}`,
                        now,
                      )],
                    }));
                  }
                }).catch((error) => set({ agentError: errorMessage(error) }));
              }
            },
            (error) => set({ agentStatus: 'error', agentError: error.message }),
          );
        } catch (error) {
          set({ agentStatus: 'error', agentError: errorMessage(error) });
        }
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
      resetAgent: () => {
        const state = get();
        if (state.agentRunId && isAgentActiveStatus(state.agentStatus)) {
          void agents.stop(state.agentRunId).catch(() => undefined);
        }
        unsubscribeAgent?.();
        unsubscribeAgent = null;
        set({
          taskPlan: null,
          currentStepIndex: 0,
          stepResults: [],
          agentStatus: 'idle',
          agentRunId: null,
          agentEvents: [],
          agentError: null,
          perceptionPreview: emptyPerceptionPreview(null),
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
): ChatMessage {
  messageCounter += 1;
  return { id: `message_${messageCounter}_${now()}`, role, content, timestamp: now() };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAgentActiveStatus(status: AgentUiStatus): boolean {
  return status === 'planning' || status === 'running' || status === 'pause_requested'
    || status === 'paused' || status === 'stopping';
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
