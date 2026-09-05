// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { bundleInstallCommands } from './verify-dsh-install-plan.mjs';

const release = {
  version: '1.2.3-alpha.1',
  bundles: ['space', 'annotation'],
  dsh: {
    profile: 'web',
    installArgs: { annotation: ['--allow-build=tesseract.js'] },
  },
};

describe('fresh DSH two-Bundle install plan', () => {
  it('installs local tarballs in exactly two ordered commands', () => {
    expect(bundleInstallCommands({
      release,
      sources: { space: '/tmp/space.tgz', annotation: '/tmp/annotation.tgz' },
    })).toEqual([
      ['plugin', '--profile', 'web', 'add', '/tmp/space.tgz'],
      ['plugin', '--profile', 'web', 'add', '--allow-build=tesseract.js', '/tmp/annotation.tgz'],
    ]);
  });

  it('uses exact public package versions without changing the two-command shape', () => {
    expect(bundleInstallCommands({
      release,
      sources: { space: 'space@1.2.3-alpha.1', annotation: 'annotation@1.2.3-alpha.1' },
    })).toEqual([
      ['plugin', '--profile', 'web', 'add', 'space@1.2.3-alpha.1'],
      ['plugin', '--profile', 'web', 'add', '--allow-build=tesseract.js', 'annotation@1.2.3-alpha.1'],
    ]);
  });

  it('rejects a missing Bundle source instead of inventing an install step', () => {
    expect(() => bundleInstallCommands({ release, sources: { space: '/tmp/space.tgz' } }))
      .toThrow(/missing.*annotation/i);
  });
});
