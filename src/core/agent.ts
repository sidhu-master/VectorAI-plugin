/**
 * Spatial Agent Workflow - 空间智能工作流
 *
 * AI 不直接生成最终图纸，而是逐步构建 Spatial Model：
 * Task Planner -> 多阶段 Action Executor -> Verification Loop
 */

import type { SpatialIntent, SpatialModel } from './types';
import { createEmptyModel } from './model';
import { applyPatch } from './patch/apply';
import { compileIntentToPatch } from './patch/intent-to-patch';

// ============ Task Plan ============

export type StepStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';

export interface TaskStep {
  id: number;
  action: string;           // extract_outline, detect_features, etc.
  description: string;       // 人类可读描述
  status: StepStatus;
}

export interface TaskPlan {
  task: string;              // reconstruct_drawing, create_from_text, etc.
  steps: TaskStep[];
  summary: string;           // 整体摘要
}

// ============ Step Execution Result ============

export interface StepResult {
  stepId: number;
  success: boolean;
  intent?: SpatialIntent;    // LLM 返回的意图
  addedEntities: number;     // 新增实体数
  modifiedEntities: number;  // 修改实体数
  errors: string[];
  warnings: string[];        // 验证警告（低置信度等）
  description: string;       // 结果摘要
}

// ============ Verification Result ============

export interface VerificationResult {
  valid: boolean;
  intentErrors: string[];
  geometryErrors: string[];
}

// ============ Visual Feedback ============

/**
 * 视觉反馈：在每轮执行时附带当前渲染视图
 * LLM 能看到自己画了什么，自我修正
 */
export interface VisualFeedback {
  image: string;      // 当前画布截图 base64
  mimeType: string;
}

// ============ Task Planner ============

const PLANNER_PROMPT = `你是 VectorAI 空间任务规划器。分析用户请求或图片，将大目标拆解为分阶段任务。

## 输出格式

{
  "task": "inspect_drawing | reconstruct_drawing | modify_drawing | create_from_text",
  "summary": "整体任务摘要",
  "steps": [
    { "id": 1, "action": "extract_outline", "description": "识别整体轮廓" },
    { "id": 2, "action": "detect_features", "description": "识别孔/槽/圆角" },
    { "id": 3, "action": "apply_dimensions", "description": "识别尺寸标注" },
    { "id": 4, "action": "build_constraints", "description": "建立约束关系" },
    { "id": 5, "action": "verify_model", "description": "工程验证" }
  ]
}

## 标准阶段

- extract_outline: 识别/生成主体轮廓（矩形、外形线）
- detect_features: 增加特征（孔、槽、圆角）
- apply_dimensions: 应用尺寸（半径、距离、角度值）
- build_constraints: 建立关系约束（equal, distance, radius）
- verify_model: 最终验证（闭合检查、冲突检查）

## 规则

1. 只输出 JSON
2. 根据输入类型选择合适的阶段组合
3. 文字描述简单的可以只有 1-2 个步骤
4. 图片/PDF且用户只要求分析说明时，task 使用 inspect_drawing
5. 图片/PDF需要转为内部二维几何时，task 使用 reconstruct_drawing
6. 图片/PDF且用户要求移动、删除、添加、替换或调整图元时，task 使用 modify_drawing
7. modify_drawing 的 steps 只描述图纸重建完成后需要执行的增量修改，不要重复安排识图或重建阶段
8. 每个阶段的 description 用中文`;

// ============ Step Executor Prompt Builder ============

function buildStepPrompt(
  step: TaskStep,
  model: SpatialModel,
  plan: TaskPlan,
  hasVisual: boolean = false,
): string {
  const entityCount = model.entities.length;
  const entityList = model.entities.slice(0, 10).map((e) => {
    switch (e.type) {
      case 'point': return `${e.id}(point): x=${e.x},y=${e.y}`;
      case 'line': return `${e.id}(line): [${e.start[0]},${e.start[1]}]->[${e.end[0]},${e.end[1]}]`;
      case 'circle': return `${e.id}(circle): center=[${e.center[0]},${e.center[1]}],r=${e.radius}`;
    }
  }).join('\n  ');

  const list = entityList || '(空)';

  const lines = [
    '当前任务: ' + plan.summary,
    '当前阶段: ' + step.id + '. ' + step.description + ' (action: ' + step.action + ')',
    '当前模型已有 ' + entityCount + ' 个实体:',
    '  ' + list,
  ];

  if (hasVisual) {
    lines.push('', '【当前渲染视图】附带的图片是当前模型的渲染结果。请观察图片：');
    lines.push('- 确认之前阶段的实体是否正确渲染');
    lines.push('- 检查是否有明显的几何错误（重叠、错位、尺寸异常）');
    lines.push('- 基于视觉反馈生成本阶段的 Spatial Intent');
    lines.push('- 如果发现问题，可以在本阶段通过 modify 操作修正');
  }

  lines.push(
    '', '请执行当前阶段，输出此阶段的 Spatial Intent（增量操作）。',
    '', '## 阶段说明',
    '- extract_outline: 只生成主体轮廓，不要细节',
    '- detect_features: 在已有轮廓基础上增加孔/槽/圆角',
    '- apply_dimensions: 修改实体参数，应用从标注识别到的尺寸',
    '- build_constraints: 添加关系（equal, distance, radius 等）',
    '- verify_model: 不添加新实体，只检查并修正',
    '', '## 输出格式',
    '{"operation":"create|modify|replace","objects":[{"type":"circle","params":{...},"reference":"...","confidence":0.9}],"relations":[...],"description":"本阶段做了什么","confidence":0.85}',
    '', '只输出 JSON，不要 Markdown。',
  );

  return lines.join('\n');
}

// ============ Verification Loop ============

export function verifyIntent(
  intent: SpatialIntent,
  currentModel: SpatialModel = createEmptyModel(),
): VerificationResult {
  const compiled = compileIntentToPatch(intent, currentModel);
  if (compiled.errors.length > 0) {
    return { valid: false, intentErrors: compiled.errors, geometryErrors: [] };
  }

  const applied = applyPatch(currentModel, compiled.patch);
  if ('errors' in applied) {
    return {
      valid: false,
      intentErrors: [],
      geometryErrors: applied.errors.map((error) => error.message),
    };
  }

  return { valid: true, intentErrors: [], geometryErrors: [] };
}

// ============ Action Executor ============

export function executeStep(
  intent: SpatialIntent,
  currentModel: SpatialModel,
  step: TaskStep,
): StepResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verification Loop
  const verification = verifyIntent(intent, currentModel);
  if (!verification.valid) {
    return {
      stepId: step.id,
      success: false,
      addedEntities: 0,
      modifiedEntities: 0,
      errors: [...verification.intentErrors, ...verification.geometryErrors],
      warnings,
      description: `${step.description} - 验证失败`,
    };
  }

  const { patch } = compileIntentToPatch(intent, currentModel);

  // 统计变化
  let added = 0;
  let modified = 0;

  const operation = intent.operation || 'create';
  if (operation === 'replace') {
    added = patch.operations.filter((item) => item.type === 'entity.add').length;
  } else if (operation === 'modify') {
    modified = patch.operations.filter((item) => item.type === 'entity.update').length;
  } else {
    added = patch.operations.filter((item) => item.type === 'entity.add').length;
  }

  // 低置信度警告
  for (const obj of intent.objects) {
    const conf = obj.confidence ?? intent.confidence ?? 1;
    if (conf < 0.6) {
      warnings.push(`低置信度: ${obj.reference || obj.type} (${Math.round(conf * 100)}%)`);
    }
  }

  return {
    stepId: step.id,
    success: true,
    intent,
    addedEntities: added,
    modifiedEntities: modified,
    errors,
    warnings,
    description: intent.description || step.description,
  };
}

// ============ Apply Step Result to Model ============

export function applyStepToModel(
  result: StepResult,
  currentModel: SpatialModel,
): SpatialModel {
  if (!result.success || !result.intent) return currentModel;

  const compiled = compileIntentToPatch(result.intent, currentModel);
  if (compiled.errors.length > 0) return currentModel;
  const applied = applyPatch(currentModel, compiled.patch);
  return applied.success ? applied.model : currentModel;
}

// ============ Exports ============

export { PLANNER_PROMPT, buildStepPrompt };
