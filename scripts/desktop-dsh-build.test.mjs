// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDshBuildCommands } from './desktop-dsh-build.mjs';

describe('desktop DSH build', () => {
  it('installs an immutable checkout and creates official client artifacts', () => {
    assert.deepEqual(createDshBuildCommands('/tmp/dsh-source'), [
      {
        command: 'corepack',
        args: ['pnpm@11.7.0', '--dir', '/tmp/dsh-source', 'install', '--frozen-lockfile'],
      },
      {
        command: 'corepack',
        args: ['pnpm@11.7.0', '--dir', '/tmp/dsh-source', 'run', 'build:official'],
      },
    ]);
  });
});
