// SPDX-License-Identifier: Apache-2.0

import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';
import { createHash } from 'node:crypto';

const PLUGIN_NAME = '@vectorai/plugin-dsh-space-host';
const INSTRUCTION = [
  'A new drawing image is pending in the local VectorAI Space plugin.',
  'Call drawing_import before describing, inspecting, or modifying the drawing.',
  'Do not claim that the drawing was inspected until drawing_import succeeds.',
].join(' ');

interface PendingSourceWriter {
  bindPending(sessionId: string, attachment: ImageAttachmentRef): void;
}

interface UserInstructionWriter {
  bindUserInstruction(sessionId: string, instruction: {
    objective: string;
    rootUserMessageDigest: string;
  }): void;
  currentSelectionProjection?(sessionId: string): {
    selectionProjectionId: string;
    drawingRef: { drawingId: string; revision: number };
    nodeIds: string[];
    projectionDigest: string;
    expiresAt: number;
  } | null;
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
    const message = messages[messageIndex];
    if (message?.source.kind !== 'user') continue;
    const content = message.content;
    for (let blockIndex = content.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = content[blockIndex];
      if (block?.type === 'image') return structuredClone(block.attachment);
    }
  }
  return null;
}

export function createPreStepIntake(
  repository: PendingSourceWriter,
  semantic?: UserInstructionWriter,
) {
  return async (
    payload: PreStepPayload,
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next();
    if (decision.kind === 'reject' || payload.signal.aborted) return decision;
    const directUser = [...decision.messages].reverse().find((message) => message.source.kind === 'user');
    if (directUser && semantic) {
      const objective = directUser.content
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map(({ text }) => text)
        .join('\n')
        .trim();
      if (objective) semantic.bindUserInstruction(String(payload.agent.id), {
        objective,
        rootUserMessageDigest: `sha256:${createHash('sha256').update(JSON.stringify({
          id: String(directUser.id), objective,
          images: directUser.content.filter((block) => block.type === 'image').map((block) => ({
            attachmentId: String(block.attachment.attachmentId),
            mediaType: block.attachment.mediaType,
            bytes: block.attachment.bytes,
          })),
        })).digest('hex')}`,
      });
    }
    let messages = [...decision.messages];
    const selection = semantic?.currentSelectionProjection?.(String(payload.agent.id)) ?? null;
    if (selection !== null) {
      const instruction = [
        `Host-verified canvas selection ${selection.selectionProjectionId} is bound to ${selection.drawingRef.drawingId}@${selection.drawingRef.revision}.`,
        `Exact selected Drawing node ids: ${selection.nodeIds.join(', ')}.`,
        'When the user refers to the selected object, call drawing_observe, drawing_build_context, then drawing_ground with this selectionProjectionId, empty targetNodeIds, and empty interfaces so the Host resolves the exact target and contacted connectors.',
        'The selection is grounding evidence only and does not grant write authority.',
      ].join(' ');
      messages.push(createUserMessage({
        content: [{ type: 'text', text: instruction }],
        source: {
          kind: 'plugin', plugin: PLUGIN_NAME, form: 'snapshot',
          sections: [{ name: 'vectorai:verified-selection', text: instruction }],
        },
      }));
    }

    const attachment = findLatestImage(decision.messages);
    if (attachment === null) return { kind: 'enter', messages };

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
    return { kind: 'enter', messages: [...messages, context] };
  };
}
