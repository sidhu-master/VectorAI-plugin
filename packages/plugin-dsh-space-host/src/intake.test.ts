// SPDX-License-Identifier: Apache-2.0

import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';
import { describe, expect, it } from 'vitest';

import { createPreStepIntake, findLatestImage } from './intake';

function attachment(id: string): ImageAttachmentRef {
  return {
    attachmentId: id as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png',
    bytes: 4,
    width: 20,
    height: 10,
  };
}

function imageMessage(...ids: string[]): UserMessage {
  return createUserMessage({
    content: ids.map((id) => ({ type: 'image' as const, attachment: attachment(id) })),
    source: { kind: 'user' },
  });
}

function pluginImageMessage(id: string): UserMessage {
  return createUserMessage({
    content: [{ type: 'image', attachment: attachment(id) }],
    source: {
      kind: 'plugin',
      plugin: '@vectorai/reviewer',
      form: 'snapshot',
      sections: [],
    },
  });
}

function payload(messages: UserMessage[]) {
  return {
    agent: { id: 'session-a' } as unknown as Agent,
    messages,
    turn: 1,
    step: 1,
    signal: new AbortController().signal,
  };
}

describe('drawing image intake', () => {
  it('finds the last image in prompt order', () => {
    expect(findLatestImage([
      imageMessage('first', 'middle'),
      imageMessage('last'),
    ])).toEqual(attachment('last'));
  });

  it('ignores plugin and tool-produced images when choosing a pending import', () => {
    expect(findLatestImage([
      imageMessage('real-user-drawing'),
      pluginImageMessage('reviewer-render'),
    ])).toEqual(attachment('real-user-drawing'));
    expect(findLatestImage([pluginImageMessage('reviewer-render')])).toBeNull();
  });

  it('binds the accepted image and appends an import instruction', async () => {
    const bindings: Array<{ sessionId: string; attachment: ImageAttachmentRef }> = [];
    const intake = createPreStepIntake({
      bindPending(sessionId, source) {
        bindings.push({ sessionId, attachment: source });
      },
    });
    const message = imageMessage('drawing');

    const result = await intake(payload([message]), async () => ({
      kind: 'enter',
      messages: [message],
    }));

    expect(bindings).toEqual([{ sessionId: 'session-a', attachment: attachment('drawing') }]);
    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]?.source).toMatchObject({
      kind: 'plugin',
      plugin: '@vectorai/plugin-dsh-space-host',
      form: 'snapshot',
    });
    expect(result.messages[1]?.content).toEqual([{
      type: 'text',
      text: expect.stringContaining('drawing_import'),
    }]);
  });

  it('preserves a downstream rejection without binding the image', async () => {
    let binds = 0;
    const intake = createPreStepIntake({ bindPending: () => { binds += 1; } });

    const result = await intake(payload([imageMessage('drawing')]), async (): Promise<PreStepDecision> => ({
      kind: 'reject',
    }));

    expect(result).toEqual({ kind: 'reject' });
    expect(binds).toBe(0);
  });

  it('adds no context when the accepted batch has no image', async () => {
    let binds = 0;
    const intake = createPreStepIntake({ bindPending: () => { binds += 1; } });
    const message = createUserMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { kind: 'user' },
    });

    const result = await intake(payload([message]), async () => ({
      kind: 'enter',
      messages: [message],
    }));

    expect(result).toEqual({ kind: 'enter', messages: [message] });
    expect(binds).toBe(0);
  });

  it('injects only the Host-verified canvas selection as semantic grounding context', async () => {
    const message = createUserMessage({
      content: [{ type: 'text', text: '把选中的手抬起来打招呼' }],
      source: { kind: 'user' },
    });
    const intake = createPreStepIntake({ bindPending() {} }, {
      bindUserInstruction() {},
      currentSelectionProjection() {
        return {
          selectionProjectionId: 'selection-1',
          drawingRef: { drawingId: 'drawing-1', revision: 3 },
          nodeIds: ['right-hand'],
          projectionDigest: 'sha256:selection',
          expiresAt: 9999,
        };
      },
    });

    const result = await intake(payload([message]), async () => ({ kind: 'enter', messages: [message] }));

    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    expect(result.messages.at(-1)?.content).toEqual([{
      type: 'text',
      text: expect.stringMatching(/selection-1[\s\S]*right-hand[\s\S]*drawing_ground/),
    }]);
  });
});
