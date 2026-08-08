import { describe, expect, it } from 'vitest';
import type { TaskPlan, TaskStep } from '../../../src/core/agent';
import { fallbackAttachmentPlan, resolveInputIntent } from './input-intent';

const modifyStep: TaskStep = {
  id: 1,
  action: 'update_entity',
  description: '扩大左侧孔',
  status: 'pending',
};

describe('attachment input intent', () => {
  it.each([
    ['inspect_drawing', 'inspect_drawing', false],
    ['reconstruct_drawing', 'reconstruct_drawing', false],
    ['modify_drawing', 'modify_drawing', true],
  ] as const)('normalizes planner task %s', (task, kind, requiresMutation) => {
    const plan: TaskPlan = {
      task,
      summary: '用户任务',
      steps: task === 'modify_drawing' ? [modifyStep] : [],
    };

    expect(resolveInputIntent(plan, '用户任务', true)).toMatchObject({
      kind,
      requiresDrawingPerception: true,
      requiresMutation,
      confidence: 0.9,
    });
  });

  it('corrects an unknown planner task when the original request clearly modifies the drawing', () => {
    const plan: TaskPlan = { task: 'other', summary: '处理图纸', steps: [] };

    expect(resolveInputIntent(plan, '把左侧孔扩大到 20mm', true)).toMatchObject({
      kind: 'modify_drawing',
      requiresDrawingPerception: true,
      requiresMutation: true,
      confidence: 0.65,
    });
  });

  it('uses reconstruction for the attachment-only default goal', () => {
    const plan: TaskPlan = { task: 'other', summary: '处理图纸', steps: [] };

    expect(resolveInputIntent(plan, '分析并重建二维工程图', true)).toMatchObject({
      kind: 'reconstruct_drawing',
      requiresMutation: false,
    });
  });

  it('builds a safe one-step modification fallback when planning fails', () => {
    const result = fallbackAttachmentPlan('删除右侧圆孔');

    expect(result.intent).toMatchObject({
      kind: 'modify_drawing',
      requiresDrawingPerception: true,
      requiresMutation: true,
    });
    expect(result.plan).toEqual({
      task: 'modify_drawing',
      summary: '删除右侧圆孔',
      steps: [{
        id: 1,
        action: 'modify_drawing',
        description: '删除右侧圆孔',
        status: 'pending',
      }],
    });
  });
});
