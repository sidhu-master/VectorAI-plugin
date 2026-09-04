// SPDX-License-Identifier: Apache-2.0

import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { describe, expect, it, vi } from 'vitest';
import {
  classifyPartitionQuestionResult,
  isGenericAutoAnnotationEvent,
  requestAutomaticPartitionDecision,
} from './auto-annotation-route';

function event(text: string, kind: 'user' | 'plugin' = 'user'): SessionEvent {
  return {
    type: 'user/message', seq: 1, time: 1,
    data: {
      id: 'm', role: 'user', source: kind === 'user' ? { kind } : { kind, plugin: 'test' },
      content: [{ type: 'text', text }],
    },
  } as SessionEvent;
}

describe('generic automatic annotation routing', () => {
  it.each(['进行自动标注', '帮我进行自动标注', '请完成全部图纸标注', '全套工程图标注'])(
    'recognizes %s as the aggregate workflow',
    (text) => expect(isGenericAutoAnnotationEvent(event(text))).toBe(true),
  );

  it.each(['进行开角标注', '标注直径', '分析这张图纸', '自动分区'])(
    'does not capture the specific request %s',
    (text) => expect(isGenericAutoAnnotationEvent(event(text))).toBe(false),
  );

  it('ignores plugin-injected messages', () => {
    expect(isGenericAutoAnnotationEvent(event('进行自动标注', 'plugin'))).toBe(false);
  });

  it('classifies the selected partition intent without depending on the model-generated question id', () => {
    expect(classifyPartitionQuestionResult({
      answers: [{ id: 'arbitrary-model-question-id', selected: ['确认（推荐）'] }],
    })).toBe('confirm');
    expect(classifyPartitionQuestionResult({
      answers: [{ id: 'another-arbitrary-id', selected: ['不使用分区'] }],
    })).toBe('skip');
  });

  it('classifies a custom partition answer when the question UI returns no selected option', () => {
    expect(classifyPartitionQuestionResult({
      answers: [{ id: 'partition-confirm', selected: [], custom: '确认使用分区' }],
    })).toBe('confirm');
    expect(classifyPartitionQuestionResult({
      answers: [{ id: 'partition-confirm', selected: [], custom: '跳过分区' }],
    })).toBe('skip');
  });

  it('asks one fixed single-select question and returns the selected decision', async () => {
    const ask = vi.fn(async (_request: unknown) => ({
      answers: [{ id: 'vectorai-automatic-partition-confirmation', selected: ['使用分区（推荐）'] }],
    }));

    await expect(requestAutomaticPartitionDecision(
      { ask } as never,
      { id: 'session-1' } as Agent,
      undefined,
      13,
    )).resolves.toBe('confirm');
    expect(ask).toHaveBeenCalledOnce();
    expect(ask.mock.calls[0]?.[0]).toMatchObject({
      questions: [{
        id: 'vectorai-automatic-partition-confirmation',
        question: '已生成智能分区预览（13 个轴段），是否采用该分区并继续自动标注？',
        multiSelect: false,
        options: [
          { label: '使用分区（推荐）' },
          { label: '不使用分区' },
        ],
      }],
    });
  });
});
