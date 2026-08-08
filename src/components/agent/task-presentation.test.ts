import { describe, expect, it } from 'vitest';
import type { AgentTaskPlan } from '@/services/agent-types';
import type { AgentProgressEvent } from '@/services/agent-client';
import { presentAgentTask } from './task-presentation';

const reconstructPlan: AgentTaskPlan = {
  task: 'reconstruct_drawing',
  summary: '分析并重建二维工程图',
  steps: [
    { id: 1, action: 'extract_outline', description: '识别整体轮廓', status: 'executing' },
    { id: 2, action: 'verify_model', description: '验证二维模型', status: 'pending' },
  ],
};

function event(
  type: AgentProgressEvent['type'],
  elapsedMs: number,
  detail?: AgentProgressEvent['detail'],
): AgentProgressEvent {
  return {
    id: `${type}-${elapsedMs}`,
    runId: 'run_private_123',
    type,
    title: type === 'accepted' ? '任务已接收' : `底层事件 ${type}`,
    detail,
    timestamp: 1000 + elapsedMs,
    elapsedMs,
  };
}

describe('Agent task presentation', () => {
  it('keeps model routing metadata out of user-visible details', () => {
    const presentation = presentAgentTask({
      plan: reconstructPlan,
      status: 'running',
      currentStepIndex: 0,
      commitCount: 0,
      events: [
        event('accepted', 30),
        event('model_finished', 12_340, {
          role: 'planner', model: 'doubao-seed-2.0-lite', attempt: 2,
          durationMs: 12_300, status: 'success',
        }),
      ],
    });
    const visibleText = JSON.stringify(presentation);

    expect(visibleText).not.toContain('doubao-seed-2.0-lite');
    expect(visibleText).not.toContain('planner');
    expect(visibleText).not.toContain('run_private_123');
    expect(visibleText).not.toContain('attempt');
    expect(visibleText).toContain('12.3s');
    expect(visibleText).toContain('任务已接收');
  });

  it.each([
    ['planning', 'understand', '正在理解你的需求'],
    ['paused', 'perceive', '任务已暂停'],
    ['error', 'perceive', '任务遇到问题'],
  ] as const)('maps %s to a stable user-facing state', (status, currentStage, heading) => {
    const presentation = presentAgentTask({
      plan: status === 'planning' ? null : reconstructPlan,
      status,
      currentStepIndex: 0,
      commitCount: 0,
      events: [event(status === 'error' ? 'failed' : 'tool_started', 8_000)],
    });

    expect(presentation.heading).toBe(heading);
    expect(presentation.stages.find((stage) => stage.status === (status === 'error' ? 'failed' : 'current'))?.id)
      .toBe(currentStage);
  });

  it('moves reconstruct work from perception to model construction after a commit', () => {
    const presentation = presentAgentTask({
      plan: reconstructPlan,
      status: 'running',
      currentStepIndex: 0,
      commitCount: 4,
      events: [event('commit', 21_000)],
    });

    expect(presentation.heading).toBe('正在构建空间模型');
    expect(presentation.stages.find((stage) => stage.status === 'current')?.id).toBe('build');
  });

  it('summarizes completed incremental work', () => {
    const presentation = presentAgentTask({
      plan: { ...reconstructPlan, task: 'modify_drawing' },
      status: 'complete',
      currentStepIndex: 1,
      commitCount: 12,
      events: [event('completed', 42_000)],
    });

    expect(presentation.heading).toBe('任务已完成');
    expect(presentation.summary).toBe('已完成 12 次增量修改 · 用时 42s');
    expect(presentation.stages.every((stage) => stage.status === 'completed')).toBe(true);
  });
});
