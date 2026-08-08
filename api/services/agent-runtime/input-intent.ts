import type { TaskPlan } from '../../../src/core/agent.js';

export type InputIntentKind =
  | 'create'
  | 'inspect_drawing'
  | 'reconstruct_drawing'
  | 'modify_drawing';

export interface InputIntent {
  kind: InputIntentKind;
  summary: string;
  requiresDrawingPerception: boolean;
  requiresMutation: boolean;
  confidence: number;
}

export interface AttachmentIntentPlan {
  intent: InputIntent;
  plan: TaskPlan;
}

export function resolveInputIntent(
  plan: TaskPlan,
  goal: string,
  hasAttachment: boolean,
): InputIntent {
  const knownKind = normalizeKnownKind(plan.task, hasAttachment);
  const kind = knownKind ?? inferKind(goal, hasAttachment);
  return {
    kind,
    summary: plan.summary?.trim() || goal,
    requiresDrawingPerception: hasAttachment,
    requiresMutation: kind === 'create' || kind === 'modify_drawing',
    confidence: knownKind ? 0.9 : 0.65,
  };
}

export function fallbackAttachmentPlan(goal: string): AttachmentIntentPlan {
  const kind = inferKind(goal, true);
  const requiresMutation = kind === 'modify_drawing';
  const plan: TaskPlan = requiresMutation
    ? createModificationPlan(goal)
    : { task: kind, summary: goal, steps: [] };
  return {
    plan,
    intent: {
      kind,
      summary: goal,
      requiresDrawingPerception: true,
      requiresMutation,
      confidence: 0.5,
    },
  };
}

export function createModificationPlan(goal: string, summary = goal): TaskPlan {
  return {
    task: 'modify_drawing',
    summary,
    steps: [{ id: 1, action: 'modify_drawing', description: goal, status: 'pending' }],
  };
}

function normalizeKnownKind(task: string, hasAttachment: boolean): InputIntentKind | undefined {
  if (task === 'create_from_text' && !hasAttachment) return 'create';
  if (task === 'inspect_drawing' || task === 'reconstruct_drawing' || task === 'modify_drawing') {
    return task;
  }
  return undefined;
}

function inferKind(goal: string, hasAttachment: boolean): InputIntentKind {
  if (!hasAttachment) return 'create';
  if (hasMutationLanguage(goal)) return 'modify_drawing';
  if (/重建|转换|转成|复原|矢量化|建模|reconstruct|convert|vectorize/i.test(goal)) {
    return 'reconstruct_drawing';
  }
  if (/分析|识别|检查|查看|说明|告诉|inspect|analy[sz]e|explain/i.test(goal)) {
    return 'inspect_drawing';
  }
  return 'reconstruct_drawing';
}

function hasMutationLanguage(goal: string): boolean {
  return /修改|移动|删除|移除|增加|新增|添加|替换|调整|扩大|缩小|旋转|对齐|改成|改为|改到|更新|move|delete|remove|add|replace|resize|rotate|align|update/i.test(goal);
}
