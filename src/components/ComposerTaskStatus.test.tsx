import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PresentedAgentTask } from './agent/task-presentation';
import { composerPrimaryAction } from './agent/composer-primary-action';
import { ComposerTaskStatusView } from './ComposerTaskStatus';

const presentation: PresentedAgentTask = {
  heading: '正在确认需要修改的精确轮廓片段',
  detail: '7 个候选',
  elapsed: '18s',
  attemptLabel: '第 1/3 次尝试',
  tone: 'active',
};

describe('composerPrimaryAction', () => {
  it.each([
    [{ status: 'running', hasRun: true, hasContent: false }, 'pause'],
    [{ status: 'running', hasRun: true, hasContent: true }, 'send'],
    [{ status: 'pause_requested', hasRun: true, hasContent: false }, 'waiting'],
    [{ status: 'pause_requested', hasRun: true, hasContent: true }, 'waiting'],
    [{ status: 'paused', hasRun: true, hasContent: false }, 'resume'],
    [{ status: 'paused', hasRun: true, hasContent: true }, 'send'],
    [{ status: 'error', hasRun: true, hasContent: false }, 'retry'],
    [{ status: 'error', hasRun: true, hasContent: true }, 'send'],
    [{ status: 'planning', hasRun: false, hasContent: true }, 'waiting'],
    [{ status: 'waiting_for_user', hasRun: true, hasContent: false }, 'disabled'],
    [{ status: 'waiting_for_user', hasRun: true, hasContent: true }, 'send'],
    [{ status: 'idle', hasRun: false, hasContent: false }, 'disabled'],
    [{ status: 'idle', hasRun: false, hasContent: true }, 'send'],
  ] as const)('maps %o to %s', (input, expected) => {
    expect(composerPrimaryAction(input)).toBe(expected);
  });
});

describe('ComposerTaskStatusView', () => {
  it('renders only the latest real status as a compact composer attachment', () => {
    const html = renderToStaticMarkup(
      <ComposerTaskStatusView
        presentation={presentation}
        status="running"
        lowConfidence={false}
        onStop={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(html).toContain('正在确认需要修改的精确轮廓片段');
    expect(html).toContain('7 个候选');
    expect(html).toContain('第 1/3 次尝试');
    expect(html).toContain('停止');
    expect(html).not.toContain('暂停');
    expect(html).not.toContain('Agent 执行记录');
    expect(html).not.toContain('doubao');
  });

  it('keeps a task awaiting a user decision attached to the active run', () => {
    const html = renderToStaticMarkup(
      <ComposerTaskStatusView
        presentation={{ ...presentation, heading: '等待你的确认', tone: 'paused' }}
        status="waiting_for_user"
        lowConfidence={false}
        onStop={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(html).toContain('等待你的确认');
    expect(html).toContain('停止');
    expect(html).not.toContain('清除任务状态');
  });
});
