// SPDX-License-Identifier: Apache-2.0

import type { SessionEvent } from '@deepseek-ai/dsh-session';
import { describe, expect, it } from 'vitest';
import { isGenericAutoAnnotationEvent } from './auto-annotation-route';

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
});
