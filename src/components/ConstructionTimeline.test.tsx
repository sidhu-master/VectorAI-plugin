import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PresentedAgentTask } from './agent/task-presentation';
import { ConstructionTimelineView } from './ConstructionTimeline';

const presentation: PresentedAgentTask = {
  heading: '正在解析图纸',
  summary: '已运行 12s',
  elapsed: '12s',
  stages: [
    { id: 'understand', label: '理解需求', status: 'completed' },
    { id: 'perceive', label: '解析图纸', status: 'current' },
    { id: 'build', label: '构建模型', status: 'pending' },
    { id: 'modify', label: '应用修改', status: 'pending' },
    { id: 'verify', label: '验证完成', status: 'pending' },
  ],
  details: [{ id: 'safe', title: '推理完成', elapsed: '12s', duration: '11.5s', tone: 'neutral' }],
};

describe('ConstructionTimelineView', () => {
  it('renders a restrained task card with one details disclosure and no duplicate composer', () => {
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
        onReset={() => undefined}
      />,
    );

    expect(html).toContain('正在解析图纸');
    expect(html).toContain('执行详情');
    expect(html).toContain('暂停');
    expect(html).toContain('停止');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Agent 执行记录');
    expect(html).not.toContain('doubao');
  });
});
