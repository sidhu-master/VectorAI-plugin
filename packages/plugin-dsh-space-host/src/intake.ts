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
  getSnapshot?(sessionId: string): {
    ref: { drawingId: string; revision: number };
  } | null;
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

interface IntakeScope {
  isRuntimeRoot(agent: Agent): boolean;
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
  scope: IntakeScope = { isRuntimeRoot: () => true },
) {
  return async (
    payload: PreStepPayload,
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next();
    if (decision.kind === 'reject' || payload.signal.aborted) return decision;
    if (!scope.isRuntimeRoot(payload.agent)) return decision;
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
    const attachment = directUser ? findLatestImage([directUser]) : null;
    const snapshot = repository.getSnapshot?.(String(payload.agent.id)) ?? null;
    const selection = semantic?.currentSelectionProjection?.(String(payload.agent.id)) ?? null;
    const drawingRef = selection?.drawingRef ?? snapshot?.ref;
    if (directUser && drawingRef && attachment === null) {
      const capability = [
        `VectorAI drawing capability is available for ${drawingRef.drawingId}@${drawingRef.revision}.`,
        'To activate it, call drawing_observe only if the current user intent is to inspect or modify this drawing; otherwise ignore this capability and continue with other plugins.',
        ...(selection ? [
          `Host-verified canvas selection ${selection.selectionProjectionId} contains exact Drawing node ids: ${selection.nodeIds.join(', ')}.`,
          'Use the selection only if drawing_observe starts a drawing task; then pass its selectionProjectionId to drawing_ground with empty targetNodeIds and interfaces so the Host derives the exact target and contacted connectors.',
          'The selection is grounding evidence only and does not grant write authority.',
        ] : []),
      ].join(' ');
      messages.push(createUserMessage({
        content: [{ type: 'text', text: capability }],
        source: {
          kind: 'plugin', plugin: PLUGIN_NAME, form: 'snapshot',
          sections: [{ name: 'vectorai:drawing-capability', text: capability }],
        },
      }));
    }

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
