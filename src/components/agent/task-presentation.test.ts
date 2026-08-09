import { describe, expect, it } from 'vitest';
import type { DrawingAgentPlan } from '@/contracts/drawing-agent';
import type { AgentProgressEvent } from '@/services/agent-client';
import { presentAgentTask } from './task-presentation';

const reconstructPlan: DrawingAgentPlan = {
  goal: {
    id: 'goal_1', objective: '分析并重建二维工程图', scope: {},
    acceptanceCriteria: [{ type: 'document.valid' }],
    riskPolicy: { candidateAllowed: true, maxCommits: 12 },
  },
  summary: '分析并重建二维工程图',
  workflow: [
    { id: 'inspect', capability: 'inspect_entity', dependsOn: [], completionCriteria: [], status: 'running' },
    { id: 'verify', capability: 'verify_goal', dependsOn: ['inspect'], completionCriteria: [], status: 'pending' },
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
        event('model_finished', 12_340, '内部推理完成'),
      ],
    });
    const visibleText = JSON.stringify(presentation);

    expect(visibleText).not.toContain('doubao-seed-2.0-lite');
    expect(visibleText).not.toContain('planner');
    expect(visibleText).not.toContain('run_private_123');
    expect(visibleText).not.toContain('attempt');
    expect(visibleText).toContain('12s');
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

    expect(presentation.heading).toBe('正在应用修改');
    expect(presentation.stages.find((stage) => stage.status === 'current')?.id).toBe('modify');
  });

  it('presents live drawing deltas without exposing transport details', () => {
    const presentation = presentAgentTask({
      plan: reconstructPlan,
      status: 'running',
      currentStepIndex: 0,
      commitCount: 0,
      events: [event('perception_delta', 9_000)],
    });

    expect(presentation.details[0].title).toBe('底层事件 perception_delta');
  });

  it('derives feedback-loop stages from live evidence events when its workflow is dynamic', () => {
    const dynamicPlan = { ...reconstructPlan, workflow: [] };
    const perceiving = presentAgentTask({
      plan: dynamicPlan, status: 'running', currentStepIndex: 0, commitCount: 0,
      events: [event('tool_started', 4_000)],
    });
    const building = presentAgentTask({
      plan: dynamicPlan, status: 'running', currentStepIndex: 0, commitCount: 0,
      events: [event('perception_delta', 12_000)],
    });

    expect(perceiving.heading).toBe('正在解析图纸');
    expect(building.heading).toBe('正在构建空间模型');
  });

  it('moves image-only tasks (no goal plan) through perception then construction', () => {
    const perceiving = presentAgentTask({
      plan: null, status: 'running', currentStepIndex: 0, commitCount: 0,
      events: [event('perception_delta', 9_000)],
    });
    expect(perceiving.heading).toBe('正在解析图纸');
    expect(perceiving.stages.find((stage) => stage.status === 'current')?.id).toBe('perceive');

    const building = presentAgentTask({
      plan: null, status: 'running', currentStepIndex: 0, commitCount: 3,
      events: [event('perception_delta', 9_000), event('commit', 12_000)],
    });
    expect(building.stages.find((stage) => stage.status === 'current')?.id).toBe('build');
    expect(building.heading).toBe('正在构建空间模型');
  });

  it('summarizes completed incremental work', () => {
    const presentation = presentAgentTask({
      plan: reconstructPlan,
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
