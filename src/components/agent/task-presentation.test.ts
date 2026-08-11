import { describe, expect, it } from 'vitest';
import type { AgentProgressEvent } from '@/services/agent-client';
import { presentAgentTask } from './task-presentation';

function event(
  type: AgentProgressEvent['type'],
  title: string,
  elapsedMs: number,
  overrides: Partial<AgentProgressEvent> = {},
): AgentProgressEvent {
  return {
    id: `${type}-${elapsedMs}`,
    runId: 'run_private_123',
    type,
    title,
    timestamp: 101_000 + elapsedMs,
    elapsedMs,
    ...overrides,
  };
}

describe('Agent task presentation', () => {
  it('keeps the latest real domain status visible across generic model and heartbeat events', () => {
    const presentation = presentAgentTask({
      status: 'running',
      error: null,
      nowMs: 131_000,
      events: [
        event('accepted', '任务已接收', 0),
        event('verifying', '正在验证手臂连接', 9_000, {
          detail: '检查边界锚点与悬空端点',
          candidateAttempt: 2,
          maxCandidateAttempts: 3,
        }),
        event('model_started', '正在决定下一步', 10_000),
        event('heartbeat', '仍在处理', 12_000),
      ],
    });

    expect(presentation.heading).toBe('正在验证手臂连接');
    expect(presentation.detail).toBe('检查边界锚点与悬空端点');
    expect(presentation.attemptLabel).toBe('第 2/3 次尝试');
    expect(presentation.elapsed).toBe('30s');
    expect(presentation.tone).toBe('active');
    expect(presentation).not.toHaveProperty('stages');
    expect(presentation).not.toHaveProperty('details');
    expect(JSON.stringify(presentation)).not.toContain('model');
    expect(JSON.stringify(presentation)).not.toContain('run_private_123');
  });

  it('shows the exact terminal error supplied by the audited run', () => {
    const presentation = presentAgentTask({
      status: 'error',
      error: 'grounding timeout：目标区域识别超时',
      nowMs: 120_000,
      events: [event('failed', '任务执行失败', 18_000)],
    });

    expect(presentation.heading).toBe('任务执行失败');
    expect(presentation.detail).toBe('grounding timeout：目标区域识别超时');
    expect(presentation.elapsed).toBe('18s');
    expect(presentation.tone).toBe('danger');
  });

  it.each([
    ['planning', '正在准备任务', 'active'],
    ['paused', '任务已暂停', 'paused'],
    ['complete', '任务已完成', 'success'],
    ['stopped', '任务已停止', 'neutral'],
  ] as const)('presents %s without a fabricated stage list', (status, heading, tone) => {
    const presentation = presentAgentTask({ status, error: null, nowMs: 1_000, events: [] });

    expect(presentation).toEqual({
      heading,
      detail: null,
      elapsed: '0s',
      attemptLabel: null,
      tone,
    });
  });
});
