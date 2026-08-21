// SPDX-License-Identifier: Apache-2.0

import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';
import type { ExplicitNumericConstraint } from '@vectorai/drawing-edit-protocol';
import { createHash } from 'node:crypto';

import { extractNumericConstraints } from './numeric-instruction';

const PLUGIN_NAME = '@vectorai/plugin-dsh-space-host';
interface PendingSourceWriter {
  bindPending(sessionId: string, attachment: ImageAttachmentRef): void;
  getSnapshot?(sessionId: string): {
    ref: { drawingId: string; revision: number };
    document?: { unitSystem: { length: 'mm' | 'cm' | 'm' } };
  } | null;
}

interface UserInstructionWriter {
  bindUserInstruction(sessionId: string, instruction: {
    rootUserMessageId: string;
    objective: string;
    rootUserMessageDigest: string;
    numericConstraints: ExplicitNumericConstraint[];
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
    const sessionId = String(payload.agent.id);
    const snapshot = repository.getSnapshot?.(sessionId) ?? null;
    let numericConstraints: ExplicitNumericConstraint[] = [];
    if (directUser && semantic) {
      const objective = directUser.content
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map(({ text }) => text)
        .join('\n')
        .trim();
      numericConstraints = extractNumericConstraints(
        objective,
        snapshot?.document?.unitSystem.length ?? 'mm',
      );
      if (objective) semantic.bindUserInstruction(sessionId, {
        rootUserMessageId: String(directUser.id),
        objective,
        rootUserMessageDigest: `sha256:${createHash('sha256').update(JSON.stringify({
          id: String(directUser.id), objective,
          images: directUser.content.filter((block) => block.type === 'image').map((block) => ({
            attachmentId: String(block.attachment.attachmentId),
            mediaType: block.attachment.mediaType,
            bytes: block.attachment.bytes,
          })),
        })).digest('hex')}`,
        numericConstraints,
      });
    }
    let messages = [...decision.messages];
    const attachment = directUser ? findLatestImage([directUser]) : null;
    const selection = semantic?.currentSelectionProjection?.(sessionId) ?? null;
    const drawingRef = selection?.drawingRef ?? snapshot?.ref;
    if (directUser && drawingRef) {
      const capability = [
        `VectorAI drawing capability is available for ${drawingRef.drawingId}@${drawingRef.revision}.`,
        'To activate it, call drawing_observe only if the current user intent is to inspect or modify this drawing; otherwise ignore this capability and continue with other plugins.',
        ...(selection ? [
          `A Host-verified canvas selection exists and covers ${selection.nodeIds.length} visible Drawing nodes.`,
          'When the user asks to edit that selection, drawing_select_parts can reference it with { kind: "current_selection" }; the Host keeps its exact node ids and revision private.',
          'The selection is grounding evidence only and does not grant write authority.',
        ] : []),
        ...(numericConstraints.length > 0 ? [
          `Verified numeric evidence: ${JSON.stringify(numericConstraints.map(({ numericKey, kind, value, unit }) => ({ numericKey, kind, value, unit })))}.`,
          'A Drawing spatial intent may reference these values only by numericKey.',
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

    if (attachment !== null) repository.bindPending(sessionId, attachment);
    return { kind: 'enter', messages };
  };
}
