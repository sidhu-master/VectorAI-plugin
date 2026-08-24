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
  it('binds the exact runtime-root identity and Host-extracted numeric evidence', async () => {
    const instructions: unknown[] = [];
    const message = createUserMessage({
      content: [{ type: 'text', text: '向上移动 80 mm' }],
      source: { kind: 'user' },
    });
    const intake = createPreStepIntake({
      bindPending() {},
      getSnapshot() {
        return {
          ref: { drawingId: 'drawing-1', revision: 3 },
          document: { unitSystem: { length: 'mm' as const } },
        };
      },
    }, {
      bindUserInstruction(_sessionId, instruction) {
        instructions.push(instruction);
      },
    });

    const result = await intake(payload([message]), async () => ({ kind: 'enter', messages: [message] }));

    expect(instructions).toEqual([expect.objectContaining({
      rootUserMessageId: String(message.id),
      objective: '向上移动 80 mm',
      numericConstraints: [expect.objectContaining({
        numericKey: 'n1', kind: 'distance', value: 80, unit: 'mm',
      })],
    })]);
    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    const injected = JSON.stringify(result.messages.at(-1));
    expect(injected).toContain('n1');
    expect(injected).toContain('80');
    expect(injected).not.toContain('userEvidenceSpan');
  });

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

  it('stages the accepted image without routing the turn into drawing import', async () => {
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
    expect(result.messages).toEqual([message]);
    expect(JSON.stringify(result.messages)).not.toContain('drawing_import');
  });

  it('keeps an uploaded reference image independent from the active Drawing capability', async () => {
    const repository = {
      bindPending() {},
      getSnapshot() {
        return { ref: { drawingId: 'old-drawing', revision: 9 } };
      },
    };
    const intake = createPreStepIntake(repository, { bindUserInstruction() {} });
    const message = imageMessage('new-drawing');

    const result = await intake(payload([message]), async () => ({ kind: 'enter', messages: [message] }));

    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    expect(result.messages).toHaveLength(2);
    const injected = JSON.stringify(result.messages.at(-1));
    expect(injected).not.toContain('drawing_import');
    expect(injected).toContain('drawing_observe');
    expect(injected).toContain('old-drawing');
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

  it('does not inject drawing workflow instructions into an unrelated direct turn', async () => {
    let binds = 0;
    const intake = createPreStepIntake(
      { bindPending: () => { binds += 1; } },
      { bindUserInstruction() {} },
    );
    const message = createUserMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { kind: 'user' },
    });

    const result = await intake(payload([message]), async () => ({
      kind: 'enter',
      messages: [message],
    }));

    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    expect(result.messages).toEqual([message]);
    expect(binds).toBe(0);
  });

  it('advertises drawing capability conditionally without injecting a fixed workflow', async () => {
    const message = createUserMessage({
      content: [{ type: 'text', text: 'hello' }],
      source: { kind: 'user' },
    });
    const repository = {
      bindPending() {},
      getSnapshot() {
        return { ref: { drawingId: 'drawing-1', revision: 3 } };
      },
    };
    const intake = createPreStepIntake(repository, { bindUserInstruction() {} });

    const result = await intake(payload([message]), async () => ({ kind: 'enter', messages: [message] }));

    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    expect(result.messages).toHaveLength(2);
    const text = result.messages.at(-1)?.content[0];
    expect(text).toMatchObject({ type: 'text' });
    if (text?.type !== 'text') throw new Error('expected text');
    expect(text.text).toMatch(/drawing-1@3[\s\S]*drawing_observe[\s\S]*only if[\s\S]*otherwise ignore/i);
    expect(text.text).toMatch(/selection candidates[\s\S]*cN[\s\S]*drawing_select_parts/i);
    expect(text.text).toMatch(/role=target[\s\S]*role=reference[\s\S]*fixed/i);
    expect(text.text).toMatch(/do not use drawing_query node ids or guessed coordinates/i);
    expect(text.text).not.toMatch(/drawing_build_context[\s\S]*drawing_ground[\s\S]*drawing_preview/i);
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
    expect(result.messages).toHaveLength(2);
    const injected = result.messages.at(-1)?.content[0];
    expect(injected).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/1 visible Drawing nodes[\s\S]*current_selection/i),
    });
    if (injected?.type !== 'text') throw new Error('expected text');
    expect(injected.text).not.toMatch(/selection-1|right-hand|selectionProjectionId|node ids:/i);
  });

  it('does not reactivate an image from an earlier direct user message', async () => {
    const bindings: ImageAttachmentRef[] = [];
    const intake = createPreStepIntake({
      bindPending(_sessionId, source) { bindings.push(source); },
    });
    const current = createUserMessage({
      content: [{ type: 'text', text: '现在聊一下别的事情' }],
      source: { kind: 'user' },
    });

    const result = await intake(payload([imageMessage('old-drawing'), current]), async () => ({
      kind: 'enter',
      messages: [imageMessage('old-drawing'), current],
    }));

    expect(bindings).toEqual([]);
    expect(result.kind).toBe('enter');
    if (result.kind !== 'enter') throw new Error('expected enter');
    expect(result.messages).toHaveLength(2);
  });

  it('does not inject or bind drawing context inside a child agent run', async () => {
    let binds = 0;
    let instructions = 0;
    const createScopedIntake = createPreStepIntake as unknown as (
      repository: { bindPending(): void },
      semantic: { bindUserInstruction(): void },
      scope: { isRuntimeRoot(agent: Agent): boolean },
    ) => ReturnType<typeof createPreStepIntake>;
    const intake = createScopedIntake(
      { bindPending: () => { binds += 1; } },
      { bindUserInstruction: () => { instructions += 1; } },
      { isRuntimeRoot: () => false },
    );
    const childPrompt = imageMessage('review-image');

    const result = await intake(payload([childPrompt]), async () => ({
      kind: 'enter',
      messages: [childPrompt],
    }));

    expect(result).toEqual({ kind: 'enter', messages: [childPrompt] });
    expect(binds).toBe(0);
    expect(instructions).toBe(0);
  });
});
