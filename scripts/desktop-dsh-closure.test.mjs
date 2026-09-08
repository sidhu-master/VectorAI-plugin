// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createPortableDshManifest,
  dshProductionInstallEnvironment,
  dshProductionInstallArgs,
  selectPackedRuntimeClosure,
} from './desktop-dsh-closure.mjs';

describe('desktop DSH packed closure', () => {
  it('includes runtime dependencies and internal peers without unrelated packages', () => {
    const packed = [
      entry('@deepseek-ai/dsh', { dependencies: { '@deepseek-ai/runtime': '1.0.0' } }),
      entry('@deepseek-ai/runtime', { peerDependencies: { '@deepseek-ai/cordis': '^4.0.0' } }),
      entry('@deepseek-ai/cordis'),
      entry('@deepseek-ai/test-only', { peerDependencies: { vitest: '*' } }),
    ];
    assert.deepEqual(
      selectPackedRuntimeClosure(packed).map((item) => item.manifest.name),
      ['@deepseek-ai/cordis', '@deepseek-ai/dsh', '@deepseek-ai/runtime'],
    );
  });

  it('fails when the executable package is absent', () => {
    assert.throws(() => selectPackedRuntimeClosure([]), /DESKTOP_DSH_PACKED_DEPENDENCY_MISSING/);
  });

  it('can close over an external bundle and its internal DSH dependencies', () => {
    const packed = [
      entry('@newwe/space', { dependencies: { '@deepseek-ai/runtime': '1.0.0' } }),
      entry('@deepseek-ai/runtime'),
      entry('@deepseek-ai/unrelated'),
    ];
    assert.deepEqual(
      selectPackedRuntimeClosure(packed, '@newwe/space').map((item) => item.manifest.name),
      ['@deepseek-ai/runtime', '@newwe/space'],
    );
  });

  it('keeps native production installation enabled and writes portable dependency versions', () => {
    assert.deepEqual(dshProductionInstallArgs(), [
      'install', '--omit=dev', '--include=optional', '--no-audit', '--no-fund', '--package-lock=false',
    ]);
    assert.deepEqual(createPortableDshManifest([
      entry('@deepseek-ai/dsh', { version: '0.1.3' }),
      entry('@newwe/space', { version: '0.1.0' }),
    ]), {
      name: 'vectorai-embedded-dsh',
      private: true,
      version: '0.0.0',
      dependencies: { '@deepseek-ai/dsh': '0.1.3', '@newwe/space': '0.1.0' },
    });
  });

  it('isolates npm installs from the developer machine cache', () => {
    assert.deepEqual(dshProductionInstallEnvironment({ PATH: '/usr/bin', NODE_OPTIONS: '--inspect' }, '/tmp/vectorai-npm-cache'), {
      PATH: '/usr/bin',
      NODE_OPTIONS: '',
      NODE_PATH: '',
      npm_config_cache: '/tmp/vectorai-npm-cache',
    });
  });
});

function entry(name, fields = {}) {
  return { manifest: { name, ...fields }, tarball: `/tmp/${name}.tgz` };
}
