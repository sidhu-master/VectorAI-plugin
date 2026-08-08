/** Frontend workspace orchestration. DrawingDocument is the only drawing authority. */
import { create } from 'zustand';
import {
  randomIdFactory,
  type DrawingCommand,
  type DrawingCommit,
  type DrawingDocument,
  type IdFactory,
  type RevisionId,
} from '@/drawing';
import type { AgentTaskPlan, AgentStepResult, AgentRunView } from '@/services/agent-types';
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
export const AGENT_MIGRATION_MESSAGE = 'Agent Runtime 正在迁移到 Drawing Core';

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
  mouseCoords: { x: number; y: number } | null;

  taskPlan: AgentTaskPlan | null;
  currentStepIndex: number;
  stepResults: AgentStepResult[];
  agentStatus: AgentUiStatus;
  agentRunId: string | null;
  agentEvents: AgentProgressEvent[];
  agentError: string | null;

  initializeDrawing: () => Promise<void>;
  updateNode: (id: string, changes: Record<string, unknown>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  clearDrawing: () => Promise<void>;
  revertLatest: () => Promise<void>;
  selectEntity: (id: string, ctrlKey: boolean) => void;
  selectEntities: (ids: string[]) => void;
  clearSelection: () => void;
  setCanvasTransform: (transform: Partial<AppState['canvasTransform']>) => void;
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
      mouseCoords: null,

      taskPlan: null,
      currentStepIndex: 0,
      stepResults: [],
      agentStatus: 'idle',
      agentRunId: null,
      agentEvents: [],
      agentError: null,

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
        const document = get().document;
        if (!document) return;
        await executeCommands(buildClearCommands(document));
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
      setMouseCoords: (mouseCoords) => set({ mouseCoords }),

      submitAgentInput: async (prompt, image) => {
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
        const userText = text || (image ? '分析并重建二维工程图' : '');
        if (userText) {
          const userMessage = chatMessage('user', userText, now);
          const assistantMessage = chatMessage('assistant', AGENT_MIGRATION_MESSAGE, now);
          set((current) => ({
            aiMessages: [...current.aiMessages, userMessage, assistantMessage],
          }));
        }
        set({ agentStatus: 'error', agentError: AGENT_MIGRATION_MESSAGE });
      },

      startAgent: async () => {
        set({ agentStatus: 'error', agentError: AGENT_MIGRATION_MESSAGE });
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

function projectAgentRun(run: AgentRunView): Partial<AppState> {
  return {
    agentStatus: run.status === 'completed'
      ? 'complete'
      : run.status === 'failed' ? 'error' : run.status,
    taskPlan: run.plan,
    currentStepIndex: run.currentStepIndex,
    stepResults: run.stepResults ?? [],
  };
}
