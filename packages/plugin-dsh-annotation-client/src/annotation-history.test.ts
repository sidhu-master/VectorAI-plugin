// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { runSharedAnnotationHistory } from './annotation-history';

describe('shared annotation history', () => {
  it('refreshes sibling annotation controllers after undoing the shared plan', async () => {
    const undo = vi.fn(async () => undefined);
    const refreshDimension = vi.fn(async () => undefined);
    const refreshGdt = vi.fn(async () => undefined);

    await runSharedAnnotationHistory(undo, [refreshDimension, refreshGdt]);

    expect(undo).toHaveBeenCalledOnce();
    expect(refreshDimension).toHaveBeenCalledOnce();
    expect(refreshGdt).toHaveBeenCalledOnce();
  });
});
