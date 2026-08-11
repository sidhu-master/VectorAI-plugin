import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PresentedAgentTask } from './agent/task-presentation';
import { ConstructionTimelineView } from './ConstructionTimeline';
import { commitsForAgentRun } from './agent/run-commits';

const presentation: PresentedAgentTask = {
  heading: '正在验证手臂连接',
  detail: '检查边界锚点与悬空端点',
  elapsed: '12s',
  attemptLabel: '第 2/3 次尝试',
  tone: 'active',
};

describe('ConstructionTimelineView', () => {
  it('counts commits by run identity instead of reusable model goal IDs', () => {
    const commits = [{
      id: 'commit_1', goalId: 'goal_create_circle', actor: { type: 'AI', id: 'run_old' },
    }, {
      id: 'commit_2', goalId: 'goal_create_circle', actor: { type: 'AI', id: 'run_current' },
    }];

    expect(commitsForAgentRun(commits as never, 'run_current').map((commit) => commit.id))
      .toEqual(['commit_2']);
  });

  it('renders one restrained live status without a duplicate composer', () => {
    const html = renderToStaticMarkup(
      <ConstructionTimelineView
        presentation={presentation}
        status="running"
        active
        canPause
        canResume={false}
        lowConfidence={false}
        error={null}
        onPauseOrResume={() => undefined}
        onStop={() => undefined}
        onRetry={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(html).toContain('正在验证手臂连接');
    expect(html).toContain('检查边界锚点与悬空端点');
    expect(html).toContain('第 2/3 次尝试');
    expect(html).toContain('暂停');
    expect(html).toContain('停止');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Agent 执行记录');
    expect(html).not.toContain('doubao');
  });

  it('renders the exact failure and a retry action without an event list', () => {
    const html = renderToStaticMarkup(
      <ConstructionTimelineView
        presentation={{
          heading: '任务执行失败',
          detail: 'grounding timeout：目标区域识别超时',
          elapsed: '31s',
          attemptLabel: null,
          tone: 'danger',
        }}
        status="error"
        active={false}
        canPause={false}
        canResume={false}
        lowConfidence={false}
        error="grounding timeout：目标区域识别超时"
        onPauseOrResume={() => undefined}
        onStop={() => undefined}
        onRetry={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(html).toContain('grounding timeout：目标区域识别超时');
    expect(html).toContain('重试');
    expect(html).not.toContain('执行详情');
    expect(html).not.toContain('理解需求');
  });
});
