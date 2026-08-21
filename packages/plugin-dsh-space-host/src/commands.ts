// SPDX-License-Identifier: Apache-2.0

import type { CommandRuntime } from '@deepseek-ai/dsh-commands';

import type { InteractiveEditService } from './interactive-edit';
import type { SemanticEditService } from './semantic-edit-service';

export function registerDrawingCommands(
  commands: Pick<CommandRuntime, 'register'>,
  interactive: InteractiveEditService,
  semantic: SemanticEditService,
): () => void {
  const disposeApply = commands.register({
    name: 'drawing-apply-intent',
    description: 'Apply one Host-staged Drawing gesture using exact opaque intent and operation tokens.',
    input: { hint: '<intentId> <intentDigest> <operationId> <operationBindingDigest>' },
    recordInput: false,
    async handler(invocation) {
      try {
        const receipt = interactive.applyCommand(String(invocation.agent.id), invocation.rawInput);
        return { kind: 'success', text: JSON.stringify(receipt) };
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  const disposePolicy = commands.register({
    name: 'drawing-policy',
    description: 'Set Drawing edit policy: review immediately downgrades the current task; auto-safe applies to future tasks.',
    input: { hint: 'review | auto-safe' },
    async handler(invocation) {
      const policy = invocation.rawInput.trim();
      if (policy !== 'review' && policy !== 'auto-safe') {
        return { kind: 'error', text: 'Usage: /drawing-policy review|auto-safe' };
      }
      semantic.setSessionPolicy(String(invocation.agent.id), policy);
      return { kind: 'success', text: policy === 'review'
        ? '当前图纸任务及后续任务已切换为先预览确认。'
        : '后续新图纸任务将使用 auto-safe；当前 review 任务不会被反向升级。' };
    },
  });
  const disposeUndo = commands.register({
    name: 'drawing-undo',
    description: 'Undo an exact current Drawing commit as a new compensating revision.',
    input: { hint: '<commitId> <drawingId>@<revision> [operationId operationBindingDigest]' },
    recordInput: false,
    async handler(invocation) {
      const [targetCommitId, encodedRef, operationId, operationBindingDigest, ...extra] = invocation.rawInput.trim().split(/\s+/);
      const match = encodedRef?.match(/^(.+)@(\d+)$/);
      if (!targetCommitId || !match || extra.length > 0 || Boolean(operationId) !== Boolean(operationBindingDigest)) {
        return { kind: 'error', text: 'Usage: /drawing-undo <commitId> <drawingId>@<revision> [operationId operationBindingDigest]' };
      }
      try {
        const input = {
          targetCommitId,
          expectedCurrentRef: { drawingId: match[1], revision: Number(match[2]) },
        };
        const receipt = operationId && operationBindingDigest
          ? semantic.undo(String(invocation.agent.id), { ...input, operationId, operationBindingDigest })
          : semantic.undoAuthorized(String(invocation.agent.id), input);
        return { kind: 'success', text: JSON.stringify(receipt) };
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  return () => {
    disposeUndo();
    disposePolicy();
    disposeApply();
  };
}
