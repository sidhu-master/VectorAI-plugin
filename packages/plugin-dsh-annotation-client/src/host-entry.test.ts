// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import * as entry from './index';

describe('DSH dual-face host entry', () => {
  it('exports the no-op Host apply required for dsh.client discovery', () => {
    expect(entry.apply).toEqual(expect.any(Function));
    expect(entry.apply()).toBeUndefined();
  });
});
