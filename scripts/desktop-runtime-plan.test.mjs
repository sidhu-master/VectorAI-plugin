// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import release from '../release/dsh-plugins.json' with { type: 'json' };
import { createDesktopRuntimePlan } from './desktop-runtime-plan.mjs';

describe('desktop runtime assembly plan', () => {
  it('uses the approved build and install sequence', () => {
    assert.deepEqual(
      createDesktopRuntimePlan(release, 'darwin-arm64').steps.map((step) => step.id),
      [
        'verify-clean-source',
        'build-vectorizer',
        'pack-vectorai-bundles',
        'checkout-dsh',
        'build-dsh',
        'pack-dsh-families',
        'install-dsh-closure',
        'install-space',
        'install-annotation',
        'write-settings',
        'write-manifest',
        'audit-runtime',
      ],
    );
  });

  it('keeps the two bundle commands ordered and narrowly allows one build script', () => {
    const plan = createDesktopRuntimePlan(release, 'win32-x64');
    assert.deepEqual(plan.installCommands, [
      { bundle: '@newwe/vectorai-plugin-dsh-space', allowBuild: [] },
      { bundle: '@newwe/vectorai-plugin-dsh-annotation', allowBuild: ['tesseract.js'] },
    ]);
  });

  it('rejects targets outside the desktop product matrix', () => {
    assert.throws(() => createDesktopRuntimePlan(release, 'linux-x64'), /DESKTOP_RUNTIME_TARGET_UNSUPPORTED/);
  });
});
