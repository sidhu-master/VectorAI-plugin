// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { calculateWorkspaceLayout } from './workspace-layout';

describe('calculateWorkspaceLayout', () => {
  it('reserves a stable right-hand chat column in a normal app window', () => {
    expect(calculateWorkspaceLayout({ left: 280, top: 0, width: 1120, height: 900 })).toEqual({
      left: 280,
      top: 0,
      width: 627,
      height: 900,
    });
  });

  it('never consumes the minimum chat width', () => {
    expect(calculateWorkspaceLayout({ left: 56, top: 40, width: 780, height: 600 })).toEqual({
      left: 56,
      top: 40,
      width: 420,
      height: 600,
    });
  });
});
