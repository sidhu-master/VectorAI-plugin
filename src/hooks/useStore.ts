/**
 * 全局状态管理 - 连接 Spatial Core 与 UI
 */

import { create } from 'zustand';
import {
  validateIntent,
  compileIntent,
  validateModel,
  createEmptyModel,
  DXFAdapter,
  compileIntentToPatch,
  createHistory,
  commitPatch,
  undo as undoHistory,
  redo as redoHistory,
} from '@/core';
import type {
  GeometryEntity,
  SpatialIntent,
  SpatialModel,
  SpatialRelation,
} from '@/core/types';
import type { TaskPlan, StepResult } from '@/core/agent';
import type { SpatialHistory } from '@/core/history/types';
import type { EntityPatch } from '@/core/patch/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: SpatialIntent;
  confidence?: number;
  timestamp: number;
}

export interface PerceptionResult {
  resultId: string;
  entity: GeometryEntity;
  confidence: number;
  confirmed: boolean;
  rejected: boolean;
}

interface AppState {
  // 空间模型
  model: SpatialModel;
  history: SpatialHistory;
  selectedIds: string[];

  // AI 对话
  aiMessages: ChatMessage[];
  aiStatus: 'idle' | 'loading' | 'error';
  aiError: string | null;

  // 画布变换
  canvasTransform: {
    scale: number;
    offsetX: number;
    offsetY: number;
  };

  // 设置
  showGrid: boolean;
  showRelations: boolean;

  // 鼠标坐标
  mouseCoords: { x: number; y: number } | null;

  // 感知结果
  perceptionResults: PerceptionResult[];
  perceptionRelations: SpatialRelation[];
  perceptionStatus: 'idle' | 'loading' | 'error';

  // Agent 工作流
  taskPlan: TaskPlan | null;
  currentStepIndex: number;
  stepResults: StepResult[];
  agentStatus: 'idle' | 'planning' | 'executing' | 'complete' | 'error';

  // 操作方法
  applyIntent: (intent: SpatialIntent) => string[];
  updateEntity: (id: string, patch: Partial<GeometryEntity>) => void;
  deleteEntity: (id: string) => void;
  selectEntity: (id: string, ctrlKey: boolean) => void;
  selectEntities: (ids: string[]) => void;
  clearSelection: () => void;
  sendPrompt: (prompt: string) => Promise<void>;
  perceiveImage: (image: string, mimeType: string) => Promise<void>;
  confirmResults: (resultIds: string[]) => void;
  confirmAll: () => void;
  rejectResult: (resultId: string) => void;
  clearPerception: () => void;
  startAgent: (prompt?: string, image?: string, mimeType?: string) => Promise<void>;
  executeNextStep: () => Promise<void>;
  resetAgent: () => void;
  exportDXF: () => void;
  setCanvasTransform: (transform: Partial<AppState['canvasTransform']>) => void;
  setMouseCoords: (coords: { x: number; y: number } | null) => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
}

let msgIdCounter = 0;
function genId(prefix: string): string {
  msgIdCounter += 1;
  return `${prefix}_${msgIdCounter}_${Date.now()}`;
}

/**
 * 捕获当前 SVG 画布为 PNG base64（用于视觉反馈）
 * 找到 DOM 中的 SVG 元素，序列化为图片
 */
function captureCanvas(): Promise<string | undefined> {
  if (typeof document === 'undefined') return Promise.resolve(undefined);

  const svg = document.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return Promise.resolve(undefined);

  try {
    const rect = svg.getBoundingClientRect();
    const w = Math.max(rect.width, 100);
    const h = Math.max(rect.height, 100);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#0a0f1a');
    clone.insertBefore(bg, clone.firstChild);

    const svgStr = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(undefined);

    return new Promise<string | undefined>((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(svgUrl);
        const png = canvas.toDataURL('image/png');
        resolve(png.split(',')[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        resolve(undefined);
      };
      img.src = svgUrl;
    });
  } catch {
    return Promise.resolve(undefined);
  }
}

const initialModel = createEmptyModel('mm');

export const useStore = create<AppState>((set, get) => ({
  model: initialModel,
  history: createHistory(initialModel),
  selectedIds: [],

  aiMessages: [],
  aiStatus: 'idle',
  aiError: null,

  canvasTransform: {
    scale: 1,
    offsetX: 80,
    offsetY: 500,
  },

  showGrid: true,
  showRelations: true,

  mouseCoords: null,

  perceptionResults: [],
  perceptionRelations: [],
  perceptionStatus: 'idle',

  taskPlan: null,
  currentStepIndex: 0,
  stepResults: [],
  agentStatus: 'idle',

  applyIntent: (intent: SpatialIntent) => {
    const state = get();
    const compiled = compileIntentToPatch(intent, state.model);
    if (compiled.errors.length > 0) return compiled.errors;
    const result = commitPatch(state.history, {
      id: genId('commit'), runId: 'interactive', stepId: genId('step'),
      source: 'AI', patch: compiled.patch, confidence: intent.confidence,
      timestamp: Date.now(),
    });
    if ('errors' in result) return result.errors.map((error) => error.message);
    set({ history: result.history, model: result.history.model, selectedIds: [] });
    return [];
  },

  updateEntity: (id, patch) => {
    const state = get();
    const result = commitPatch(state.history, {
      id: genId('commit'), runId: 'interactive', stepId: genId('step'), source: 'user',
      patch: { operations: [{ type: 'entity.update', entityId: id, changes: patch as EntityPatch }] },
      timestamp: Date.now(),
    });
    if (result.success) set({ history: result.history, model: result.history.model });
  },

  deleteEntity: (id) => {
    const state = get();
    const result = commitPatch(state.history, {
      id: genId('commit'), runId: 'interactive', stepId: genId('step'), source: 'user',
      patch: { operations: [{ type: 'entity.delete', entityId: id }] }, timestamp: Date.now(),
    });
    if (result.success) {
      set({
        history: result.history,
        model: result.history.model,
        selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
      });
    }
  },

  undo: () => {
    const history = undoHistory(get().history);
    set({ history, model: history.model, selectedIds: [] });
  },

  redo: () => {
    const history = redoHistory(get().history);
    set({ history, model: history.model, selectedIds: [] });
  },

  selectEntity: (id, ctrlKey) =>
    set((state) => {
      if (ctrlKey) {
        // Ctrl+点击：切换选中状态
        const exists = state.selectedIds.includes(id);
        return {
          selectedIds: exists
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
        };
      }
      // 普通点击：只选这一个
      return { selectedIds: [id] };
    }),

  selectEntities: (ids) => set({ selectedIds: ids }),

  clearSelection: () => set({ selectedIds: [] }),

  perceiveImage: async (image, mimeType) => {
    console.log('[Perception] 开始图片感知，mimeType:', mimeType, '图片大小:', Math.round(image.length * 0.75 / 1024), 'KB');
    set({ perceptionStatus: 'loading' });

    try {
      console.log('[Perception] 发送请求到 /api/ai/perceive...');
      const response = await fetch('/api/ai/perceive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType }),
      });

      console.log('[Perception] 收到响应，状态:', response.status, response.statusText);

      const data = await response.json();
      console.log('[Perception] 响应数据:', data.success ? '成功' : '失败', data.error || '');

      if (!data.success || !data.intent) {
        throw new Error(data.error || '图片感知失败');
      }

      const intent = data.intent as SpatialIntent;
      console.log('[Perception] Intent 描述:', intent.description, '实体数:', intent.objects?.length);

      // 编译验证（但不应用到模型）
      const intentResult = validateIntent(intent);
      if (!intentResult.valid) {
        console.error('[Perception] Intent 验证失败:', intentResult.errors);
        throw new Error(intentResult.errors.join('; '));
      }

      const { model: compiled, errors: compileErrors } = compileIntent(intent);
      if (compileErrors.length > 0) {
        console.error('[Perception] 编译失败:', compileErrors);
        throw new Error(compileErrors.join('; '));
      }

      const modelResult = validateModel(compiled);
      if (!modelResult.valid) {
        console.error('[Perception] 几何验证失败:', modelResult.errors);
        throw new Error(modelResult.errors.join('; '));
      }

      console.log('[Perception] 编译验证通过，实体数:', compiled.entities.length);

      // 构建 PerceptionResult 列表
      const results: PerceptionResult[] = compiled.entities.map((entity, i) => ({
        resultId: `pr_${Date.now()}_${i}`,
        entity,
        confidence: (intent.objects[i]?.confidence ?? intent.confidence ?? 0.7) as number,
        confirmed: false,
        rejected: false,
      }));

      set({
        perceptionResults: results,
        perceptionRelations: compiled.relations,
        perceptionStatus: 'idle',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      set({ perceptionStatus: 'error' });
      console.error('[Perception]', message);
    }
  },

  confirmResults: (resultIds) => {
    const state = get();
    const toConfirm = state.perceptionResults.filter(
      (r) => resultIds.includes(r.resultId) && !r.rejected,
    );

    if (toConfirm.length === 0) return;

    const entityIds = new Set(toConfirm.map((result) => result.entity.id));
    const relations = state.perceptionRelations.filter((relation) =>
      relation.entities.every((entityId) => entityIds.has(entityId))
    );
    const commit = commitPatch(state.history, {
      id: genId('commit'), runId: 'perception', stepId: genId('step'), source: 'AI',
      patch: { operations: [
        ...toConfirm.map((result) => ({ type: 'entity.add' as const, entity: result.entity })),
        ...relations.map((relation) => ({ type: 'relation.add' as const, relation })),
      ] },
      timestamp: Date.now(),
    });
    if (commit.success) {
      set({
        history: commit.history,
        model: commit.history.model,
        perceptionResults: state.perceptionResults.filter((r) => !resultIds.includes(r.resultId)),
        perceptionRelations: state.perceptionRelations.filter((relation) => !relations.includes(relation)),
      });
    }
  },

  confirmAll: () => {
    const state = get();
    const valid = state.perceptionResults.filter((r) => !r.rejected);
    if (valid.length === 0) return;

    const commit = commitPatch(state.history, {
      id: genId('commit'), runId: 'perception', stepId: genId('step'), source: 'AI',
      patch: { operations: [
        ...valid.map((result) => ({ type: 'entity.add' as const, entity: result.entity })),
        ...state.perceptionRelations.map((relation) => ({ type: 'relation.add' as const, relation })),
      ] },
      timestamp: Date.now(),
    });
    if (commit.success) {
      set({ history: commit.history, model: commit.history.model, perceptionResults: [], perceptionRelations: [] });
    }
  },

  rejectResult: (resultId) => {
    set((state) => ({
      perceptionResults: state.perceptionResults.filter((r) => r.resultId !== resultId),
    }));
  },

  clearPerception: () => set({ perceptionResults: [], perceptionRelations: [], perceptionStatus: 'idle' }),

  // ============ Agent Workflow ============

  startAgent: async (prompt, image, mimeType) => {
    set({ agentStatus: 'planning', taskPlan: null, currentStepIndex: 0, stepResults: [] });

    try {
      const body: Record<string, string> = {};
      if (prompt) body.prompt = prompt;
      if (image) body.image = image;
      if (mimeType) body.mimeType = mimeType;

      const response = await fetch('/api/ai/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!data.success || !data.plan) {
        throw new Error(data.error || '任务规划失败');
      }

      set({ taskPlan: data.plan, agentStatus: 'idle' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      set({ agentStatus: 'error' });
      console.error('[Agent Plan]', message);
    }
  },

  executeNextStep: async () => {
    const state = get();
    if (!state.taskPlan || state.agentStatus === 'executing') return;

    const step = state.taskPlan.steps[state.currentStepIndex];
    if (!step) {
      set({ agentStatus: 'complete' });
      return;
    }

    set({ agentStatus: 'executing' });

    try {
      // 捕获当前画布截图（视觉反馈）
      const currentView = await captureCanvas();

      const response = await fetch('/api/ai/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          model: state.model,
          plan: state.taskPlan,
          currentView,
        }),
      });

      const data = await response.json();
      if (!data.success || !data.result) {
        throw new Error(data.error || '步骤执行失败');
      }

      const result = data.result as StepResult;

      // 如果成功，应用到模型
      let newModel = state.model;
      let newHistory = state.history;
      if (result.success) {
        const compiled = result.intent
          ? compileIntentToPatch(result.intent, state.model)
          : { patch: { operations: [] }, errors: [] };
        if (compiled.errors.length === 0) {
          const committed = commitPatch(state.history, {
            id: genId('commit'), runId: 'agent', stepId: String(step.id), source: 'AI',
            patch: compiled.patch, confidence: result.intent?.confidence, timestamp: Date.now(),
          });
          if (committed.success) {
            newHistory = committed.history;
            newModel = committed.history.model;
          }
        }
      }

      set({
        model: newModel,
        history: newHistory,
        stepResults: [...state.stepResults, result],
        currentStepIndex: state.currentStepIndex + 1,
        agentStatus: state.currentStepIndex + 1 >= state.taskPlan.steps.length ? 'complete' : 'idle',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      set({ agentStatus: 'error' });
      console.error('[Agent Execute]', message);
    }
  },

  resetAgent: () =>
    set({
      taskPlan: null,
      currentStepIndex: 0,
      stepResults: [],
      agentStatus: 'idle',
    }),

  sendPrompt: async (prompt) => {
    const msg: ChatMessage = {
      id: genId('msg'),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    set((state) => ({
      aiMessages: [...state.aiMessages, msg],
      aiStatus: 'loading',
      aiError: null,
    }));

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context: get().model,
          unit: get().model.metadata.unit,
          model: 'Doubao-Seed-2.0-lite',
          selectedEntities: get().model.entities.filter((e) =>
            get().selectedIds.includes(e.id),
          ),
        }),
      });

      const data = await response.json();

      if (!data.success || !data.intent) {
        throw new Error(data.error || 'AI 生成失败');
      }

      const intent = data.intent as SpatialIntent;
      const errors = get().applyIntent(intent);

      const aiMsg: ChatMessage = {
        id: genId('msg'),
        role: 'assistant',
        content: intent.description || (errors.length > 0 ? '生成失败' : '生成成功'),
        intent,
        confidence: intent.confidence,
        timestamp: Date.now(),
      };

      set((state) => ({
        aiMessages: [...state.aiMessages, aiMsg],
        aiStatus: errors.length > 0 ? 'error' : 'idle',
        aiError: errors.length > 0 ? errors.join('; ') : null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      const aiMsg: ChatMessage = {
        id: genId('msg'),
        role: 'assistant',
        content: `错误: ${message}`,
        timestamp: Date.now(),
      };

      set((state) => ({
        aiMessages: [...state.aiMessages, aiMsg],
        aiStatus: 'error',
        aiError: message,
      }));
    }
  },

  exportDXF: () => {
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(get().model);
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectorai_model_${Date.now()}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  setCanvasTransform: (transform) =>
    set((state) => ({
      canvasTransform: { ...state.canvasTransform, ...transform },
    })),

  setMouseCoords: (coords) => set({ mouseCoords: coords }),

  clearAll: () => {
    const model = createEmptyModel('mm');
    set({
      model,
      history: createHistory(model),
      selectedIds: [],
      aiMessages: [],
      aiStatus: 'idle',
      aiError: null,
      perceptionResults: [],
      perceptionRelations: [],
      perceptionStatus: 'idle',
      taskPlan: null,
      currentStepIndex: 0,
      stepResults: [],
      agentStatus: 'idle',
    });
  },
}));
