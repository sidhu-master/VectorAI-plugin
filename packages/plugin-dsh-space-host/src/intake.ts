// SPDX-License-Identifier: Apache-2.0

import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';

const PLUGIN_NAME = '@vectorai/plugin-dsh-space-host';
const INSTRUCTION = [
  'A new drawing image is pending in the local VectorAI Space plugin.',
  'Call drawing_import before describing, inspecting, or modifying the drawing.',
  'Do not claim that the drawing was inspected until drawing_import succeeds.',
].join(' ');

interface PendingSourceWriter {
  bindPending(sessionId: string, attachment: ImageAttachmentRef): void;
}

interface PreStepPayload {
  agent: Agent;
  messages: UserMessage[];
  turn: number;
  step: number;
  signal: AbortSignal;
}

export function findLatestImage(messages: readonly UserMessage[]): ImageAttachmentRef | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const content = messages[messageIndex]?.content ?? [];
    for (let blockIndex = content.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = content[blockIndex];
      if (block?.type === 'image') return structuredClone(block.attachment);
    }
  }
  return null;
}

export function createPreStepIntake(repository: PendingSourceWriter) {
  return async (
    payload: PreStepPayload,
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next();
    if (decision.kind === 'reject' || payload.signal.aborted) return decision;
    const attachment = findLatestImage(decision.messages);
    if (attachment === null) return decision;

    repository.bindPending(String(payload.agent.id), attachment);
    const context = createUserMessage({
      content: [{ type: 'text', text: INSTRUCTION }],
      source: {
        kind: 'plugin',
        plugin: PLUGIN_NAME,
        form: 'snapshot',
        sections: [{ name: 'vectorai:drawing-intake', text: INSTRUCTION }],
      },
    });
    return { kind: 'enter', messages: [...decision.messages, context] };
  };
}
