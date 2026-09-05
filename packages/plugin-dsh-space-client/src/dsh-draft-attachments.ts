// SPDX-License-Identifier: Apache-2.0

export interface DshDraftAttachment {
  readonly id: string;
}

export interface DshDraftConversation {
  createDrafts(sessionId: string, files: readonly File[]): readonly DshDraftAttachment[];
  releaseDraftAttachments(drafts: readonly DshDraftAttachment[]): void;
}

export interface DshInputActions {
  addAttachments(ids: readonly string[]): boolean;
  setDraft(text: string): void;
  submit(): void;
}

export function stageDraftAttachments(input: {
  readonly sessionId: string;
  readonly files: readonly File[];
  readonly conversation: DshDraftConversation;
  readonly inputActions: Pick<DshInputActions, 'addAttachments'>;
}): boolean {
  if (input.files.length === 0) return false;
  const drafts = input.conversation.createDrafts(input.sessionId, input.files);
  if (drafts.length === 0) return false;
  if (input.inputActions.addAttachments(drafts.map(({ id }) => id))) return true;
  input.conversation.releaseDraftAttachments(drafts);
  return false;
}
