// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import { stageDraftAttachments } from './dsh-draft-attachments';

describe('stageDraftAttachments', () => {
  it('creates session-owned drafts and preserves their input order', () => {
    const files = [
      { name: 'drawing.dxf', type: 'application/dxf' },
      { name: 'drawing.png', type: 'image/png' },
    ] as File[];
    const drafts = [{ id: 'draft-1' }, { id: 'draft-2' }];
    const conversation = {
      createDrafts: vi.fn(() => drafts),
      releaseDraftAttachments: vi.fn(),
    };
    const inputActions = { addAttachments: vi.fn(() => true) };

    expect(stageDraftAttachments({ sessionId: 'session-1', files, conversation, inputActions })).toBe(true);
    expect(conversation.createDrafts).toHaveBeenCalledWith('session-1', files);
    expect(inputActions.addAttachments).toHaveBeenCalledWith(['draft-1', 'draft-2']);
    expect(conversation.releaseDraftAttachments).not.toHaveBeenCalled();
  });

  it('releases every new draft when the active input refuses insertion', () => {
    const files = [{ name: 'drawing.png', type: 'image/png' }] as File[];
    const drafts = [{ id: 'draft-1' }];
    const conversation = {
      createDrafts: vi.fn(() => drafts),
      releaseDraftAttachments: vi.fn(),
    };
    const inputActions = { addAttachments: vi.fn(() => false) };

    expect(stageDraftAttachments({ sessionId: 'session-1', files, conversation, inputActions })).toBe(false);
    expect(conversation.releaseDraftAttachments).toHaveBeenCalledWith(drafts);
  });

  it('does not call DSH for an empty file list', () => {
    const conversation = {
      createDrafts: vi.fn(() => []),
      releaseDraftAttachments: vi.fn(),
    };
    const inputActions = { addAttachments: vi.fn(() => true) };

    expect(stageDraftAttachments({ sessionId: 'session-1', files: [], conversation, inputActions })).toBe(false);
    expect(conversation.createDrafts).not.toHaveBeenCalled();
    expect(inputActions.addAttachments).not.toHaveBeenCalled();
  });
});
